package main

import (
	"encoding/json"
	"fmt"
	"net/http"
	"net/http/httptest"
	"net/url"
	"sort"
	"strconv"
	"testing"
)

// Models the real LAPI contract for GET /v1/decisions, verified against
// crowdsec v1.7.8 pkg/database/decisionfilter.go L82-102:
//   - limit and id_gt are honoured
//   - unknown params (page, offset on some paths) are SILENTLY IGNORED, which is
//     what made the old page= sweep return the same rows over and over
//   - results are not ordered by the server, so a client must drive the cursor
func newLAPIStub(capiCount int, localIP string) *httptest.Server {
	return newLAPIStubOrigin(capiCount, localIP, "crowdsec")
}

func newLAPIStubOrigin(capiCount int, localIP, localOrigin string) *httptest.Server {
	type dec struct {
		ID       int    `json:"id"`
		Origin   string `json:"origin"`
		Value    string `json:"value"`
		Type     string `json:"type"`
		Scenario string `json:"scenario"`
		Until    string `json:"until"`
	}
	pool := make([]dec, 0, capiCount+1)
	for i := 0; i < capiCount; i++ {
		pool = append(pool, dec{ID: i + 1, Origin: "CAPI", Value: fmt.Sprintf("10.0.%d.%d", i/256, i%256),
			Type: "ban", Scenario: "capi", Until: "2099-01-01T00:00:00Z"})
	}
	// Sorts last by id, so it is only reachable by walking the cursor to the end.
	pool = append(pool, dec{ID: 999999, Origin: localOrigin, Value: localIP, Type: "ban",
		Scenario: "crowdsecurity/http-probing", Until: "2099-01-01T00:00:00Z"})

	return httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		q, _ := url.ParseQuery(r.URL.RawQuery)
		limit, _ := strconv.Atoi(q.Get("limit"))
		if limit <= 0 {
			limit = 100
		}
		idGt, _ := strconv.Atoi(q.Get("id_gt"))

		out := make([]dec, 0, limit)
		for _, d := range pool {
			if d.ID > idGt {
				out = append(out, d)
			}
		}
		sort.Slice(out, func(i, j int) bool { return out[i].ID < out[j].ID })
		if len(out) > limit {
			out = out[:limit]
		}
		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(out)
	}))
}

func decisionValues(t *testing.T, body []byte) []string {
	t.Helper()
	var got []map[string]any
	if err := json.Unmarshal(body, &got); err != nil {
		t.Fatalf("bad response: %v", err)
	}
	vals := make([]string, 0, len(got))
	for _, d := range got {
		if v, ok := d["value"].(string); ok {
			vals = append(vals, v)
		}
	}
	return vals
}

func fetchDecisions(t *testing.T, lapi *httptest.Server) []string {
	t.Helper()
	a := &App{cfg: &Config{CrowdSecLAPIURL: lapi.URL}}
	rec := httptest.NewRecorder()
	a.crowdsecDecisionsHandler(rec, httptest.NewRequest(http.MethodGet, "/api/crowdsec/decisions", nil))
	if rec.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d: %s", rec.Code, rec.Body.String())
	}
	return decisionValues(t, rec.Body.Bytes())
}

// Issue #130: a local decision existing only past the old 5000 cap was unreachable.
func TestLocalDecisionsSurvivePaginationCap(t *testing.T) {
	const localIP = "45.148.10.125"
	lapi := newLAPIStub(6000, localIP)
	defer lapi.Close()

	for _, v := range fetchDecisions(t, lapi) {
		if v == localIP {
			return
		}
	}
	t.Fatalf("local decision %s past the old cap was dropped (issue #130)", localIP)
}

// Decisions added through Traefik Manager get origin "manual" (handlers.go), so a
// ban added from the UI must be reachable too.
func TestManuallyAddedDecisionsAreFound(t *testing.T) {
	const manualIP = "198.51.100.7"
	lapi := newLAPIStubOrigin(6000, manualIP, "manual")
	defer lapi.Close()

	for _, v := range fetchDecisions(t, lapi) {
		if v == manualIP {
			return
		}
	}
	t.Fatalf("a ban added through the UI (origin manual) past the cap was dropped")
}

// The old page= sweep returned the same rows on every request because LAPI ignores
// unknown params. Walking id_gt must not repeat a decision.
func TestDecisionsAreNotDuplicated(t *testing.T) {
	lapi := newLAPIStub(6000, "45.148.10.125")
	defer lapi.Close()

	vals := fetchDecisions(t, lapi)
	seen := map[string]int{}
	for _, v := range vals {
		seen[v]++
	}
	for v, n := range seen {
		if n > 1 {
			t.Fatalf("decision %s returned %d times", v, n)
		}
	}
}

// The cap is gone: everything LAPI holds must come back, not the first 5000.
func TestAllDecisionsAreReturned(t *testing.T) {
	lapi := newLAPIStub(6000, "45.148.10.125")
	defer lapi.Close()

	if got := len(fetchDecisions(t, lapi)); got != 6001 {
		t.Fatalf("expected all 6001 decisions, got %d", got)
	}
}

// An expired decision must still be dropped by the handler.
func TestExpiredDecisionsAreDropped(t *testing.T) {
	lapi := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		q, _ := url.ParseQuery(r.URL.RawQuery)
		if idGt, _ := strconv.Atoi(q.Get("id_gt")); idGt > 0 {
			w.Write([]byte(`[]`))
			return
		}
		w.Write([]byte(`[{"id":1,"value":"1.1.1.1","until":"2000-01-01T00:00:00Z"},
		                 {"id":2,"value":"2.2.2.2","until":"2099-01-01T00:00:00Z"}]`))
	}))
	defer lapi.Close()

	vals := fetchDecisions(t, lapi)
	if len(vals) != 1 || vals[0] != "2.2.2.2" {
		t.Fatalf("expected only the unexpired decision, got %v", vals)
	}
}
