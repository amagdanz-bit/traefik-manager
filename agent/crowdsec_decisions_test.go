package main

import (
	"encoding/json"
	"fmt"
	"net/http"
	"net/http/httptest"
	"net/url"
	"strconv"
	"strings"
	"testing"
)

// Mirrors issue #130: a local decision that only exists past the paginated cap.
func newLAPIStub(capiCount int, localIP string) *httptest.Server {
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
	pool = append(pool, dec{ID: 999999, Origin: "crowdsec", Value: localIP, Type: "ban",
		Scenario: "crowdsecurity/http-probing", Until: "2099-01-01T00:00:00Z"})

	return httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		q, _ := url.ParseQuery(r.URL.RawQuery)
		limit, _ := strconv.Atoi(q.Get("limit"))
		page, _ := strconv.Atoi(q.Get("page"))
		if limit == 0 {
			limit = 500
		}
		if page == 0 {
			page = 1
		}
		rows := pool
		if o := q.Get("origins"); o != "" {
			wanted := map[string]bool{}
			for _, s := range strings.Split(o, ",") {
				wanted[s] = true
			}
			rows = nil
			for _, d := range pool {
				if wanted[d.Origin] {
					rows = append(rows, d)
				}
			}
		}
		start := (page - 1) * limit
		if start > len(rows) {
			start = len(rows)
		}
		end := start + limit
		if end > len(rows) {
			end = len(rows)
		}
		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(rows[start:end])
	}))
}

func decisionValues(t *testing.T, body []byte) []string {
	t.Helper()
	var out []map[string]any
	if err := json.Unmarshal(body, &out); err != nil {
		t.Fatalf("bad json: %v", err)
	}
	vals := make([]string, 0, len(out))
	for _, d := range out {
		if v, ok := d["value"].(string); ok {
			vals = append(vals, v)
		}
	}
	return vals
}

func TestLocalDecisionsSurvivePaginationCap(t *testing.T) {
	const localIP = "45.148.10.125"
	lapi := newLAPIStub(csPageSize*csMaxPages, localIP)
	defer lapi.Close()

	a := &App{cfg: &Config{CrowdSecLAPIURL: lapi.URL}}
	rec := httptest.NewRecorder()
	a.crowdsecDecisionsHandler(rec, httptest.NewRequest(http.MethodGet, "/api/crowdsec/decisions", nil))

	if rec.Code != http.StatusOK {
		t.Fatalf("status %d: %s", rec.Code, rec.Body.String())
	}
	for _, v := range decisionValues(t, rec.Body.Bytes()) {
		if v == localIP {
			return
		}
	}
	t.Fatalf("local decision %s past the %d cap was dropped (issue #130)", localIP, csPageSize*csMaxPages)
}

func TestLocalDecisionsAreNotDuplicated(t *testing.T) {
	const localIP = "45.148.10.125"
	lapi := newLAPIStub(3, localIP)
	defer lapi.Close()

	a := &App{cfg: &Config{CrowdSecLAPIURL: lapi.URL}}
	rec := httptest.NewRecorder()
	a.crowdsecDecisionsHandler(rec, httptest.NewRequest(http.MethodGet, "/api/crowdsec/decisions", nil))

	seen := 0
	for _, v := range decisionValues(t, rec.Body.Bytes()) {
		if v == localIP {
			seen++
		}
	}
	if seen != 1 {
		t.Fatalf("local decision appeared %d times, want 1", seen)
	}
}
