package main

import (
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"net/http/httptest"
	"strconv"
	"strings"
	"sync"
	"testing"
)

type traefikStub struct {
	srv  *httptest.Server
	mu   sync.Mutex
	urls []string
}

func newTraefikPagedStub(count int) *traefikStub {
	s := &traefikStub{}
	s.srv = httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		s.mu.Lock()
		s.urls = append(s.urls, r.URL.String())
		s.mu.Unlock()

		q := r.URL.Query()
		perPage := 100
		if n, err := strconv.Atoi(q.Get("per_page")); err == nil && n > 0 {
			perPage = n
		}
		page := 1
		if n, err := strconv.Atoi(q.Get("page")); err == nil && n > 0 {
			page = n
		}

		kind := strings.ReplaceAll(strings.Trim(strings.TrimPrefix(r.URL.Path, "/api/"), "/"), "/", "-")
		start := (page - 1) * perPage
		out := make([]map[string]any, 0, perPage)
		for i := start; i < count && i < start+perPage; i++ {
			out = append(out, map[string]any{
				"name":     fmt.Sprintf("%s-%d@docker", kind, i),
				"address":  fmt.Sprintf(":%d", 9000+i),
				"status":   "enabled",
				"provider": "docker",
			})
		}
		next := page
		if start+perPage < count {
			next = page + 1
		}
		w.Header().Set("X-Next-Page", strconv.Itoa(next))
		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(out)
	}))
	return s
}

func (s *traefikStub) app() *App {
	return &App{cfg: &Config{TraefikAPIURL: s.srv.URL}, httpClient: s.srv.Client()}
}

func (s *traefikStub) requested() []string {
	s.mu.Lock()
	defer s.mu.Unlock()
	return append([]string(nil), s.urls...)
}

func (s *traefikStub) Close() { s.srv.Close() }

func protoRows(t *testing.T, body []byte, key string) []map[string]any {
	t.Helper()
	var envelope map[string]json.RawMessage
	if err := json.Unmarshal(body, &envelope); err != nil {
		t.Fatalf("bad envelope: %v (%s)", err, string(body))
	}
	raw, ok := envelope[key]
	if !ok {
		t.Fatalf("response has no %q key: %s", key, string(body))
	}
	var rows []map[string]any
	if err := json.Unmarshal(raw, &rows); err != nil {
		t.Fatalf("bad %s payload: %v (%s)", key, err, string(raw))
	}
	return rows
}

func arrayRows(t *testing.T, body []byte) []map[string]any {
	t.Helper()
	var rows []map[string]any
	if err := json.Unmarshal(body, &rows); err != nil {
		t.Fatalf("bad response: %v (%s)", err, string(body))
	}
	return rows
}

func TestTraefikStubTruncatesWithoutPerPage(t *testing.T) {
	stub := newTraefikPagedStub(250)
	defer stub.Close()

	resp, err := stub.srv.Client().Get(stub.srv.URL + "/api/http/routers")
	if err != nil {
		t.Fatal(err)
	}
	defer resp.Body.Close()
	var rows []map[string]any
	json.NewDecoder(resp.Body).Decode(&rows)
	if len(rows) != 100 {
		t.Fatalf("the stub must cap an unpaginated request at Traefik's default of 100, got %d; "+
			"without that the pagination tests would pass even with the fix reverted", len(rows))
	}
}

func TestRoutersHandlerReturnsEveryRouterNotJustTheFirstPage(t *testing.T) {
	stub := newTraefikPagedStub(250)
	defer stub.Close()

	rec := httptest.NewRecorder()
	stub.app().routersHandler(rec, httptest.NewRequest(http.MethodGet, "/api/traefik/routers", nil))
	if rec.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d: %s", rec.Code, rec.Body.String())
	}

	rows := protoRows(t, rec.Body.Bytes(), "http")
	if len(rows) != 250 {
		t.Fatalf("the agent returned %d of 250 routers; Traefik pages at 100 per request, so an "+
			"agent-backed instance silently loses every router past the first page", len(rows))
	}
	if rows[len(rows)-1]["name"] != "http-routers-249@docker" {
		t.Fatalf("last router is %v, expected the 250th", rows[len(rows)-1]["name"])
	}
}

func TestServicesHandlerReturnsEveryService(t *testing.T) {
	stub := newTraefikPagedStub(250)
	defer stub.Close()

	rec := httptest.NewRecorder()
	stub.app().servicesHandler(rec, httptest.NewRequest(http.MethodGet, "/api/traefik/services", nil))
	if got := len(protoRows(t, rec.Body.Bytes(), "http")); got != 250 {
		t.Fatalf("the agent returned %d of 250 services", got)
	}
}

func TestMiddlewaresHandlerReturnsEveryMiddleware(t *testing.T) {
	stub := newTraefikPagedStub(250)
	defer stub.Close()

	rec := httptest.NewRecorder()
	stub.app().middlewaresHandler(rec, httptest.NewRequest(http.MethodGet, "/api/traefik/middlewares", nil))
	if got := len(protoRows(t, rec.Body.Bytes(), "http")); got != 250 {
		t.Fatalf("the agent returned %d of 250 middlewares", got)
	}
}

func TestEveryFetchedProtocolAsksForOnePage(t *testing.T) {
	stub := newTraefikPagedStub(250)
	defer stub.Close()

	rec := httptest.NewRecorder()
	stub.app().routersHandler(rec, httptest.NewRequest(http.MethodGet, "/api/traefik/routers", nil))

	seen := stub.requested()
	if len(seen) != 3 {
		t.Fatalf("expected http, tcp and udp to be fetched, got %v", seen)
	}
	for _, u := range seen {
		if !strings.Contains(u, "per_page=1000") {
			t.Fatalf("%s was fetched without per_page, so Traefik caps it at 100 rows", u)
		}
	}
}

func TestEntrypointsProxyReturnsEveryEntryPoint(t *testing.T) {
	stub := newTraefikPagedStub(250)
	defer stub.Close()

	rec := httptest.NewRecorder()
	stub.app().router(rec, httptest.NewRequest(http.MethodGet, "/api/traefik/entrypoints", nil))
	if rec.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d: %s", rec.Code, rec.Body.String())
	}

	rows := arrayRows(t, rec.Body.Bytes())
	if len(rows) != 250 {
		t.Fatalf("the agent returned %d of 250 entry points; the entry point list is proxied "+
			"verbatim, so anything past Traefik's first page never reaches the UI", len(rows))
	}
	for _, u := range stub.requested() {
		if !strings.Contains(u, "per_page=1000") {
			t.Fatalf("entry points were fetched as %s, without per_page", u)
		}
	}
}

func TestTraefikFetchProtoKeepsAnExistingQueryString(t *testing.T) {
	stub := newTraefikPagedStub(250)
	defer stub.Close()

	if _, err := stub.app().traefikFetchProto(context.Background(), "/api/http/routers?search=web"); err != nil {
		t.Fatal(err)
	}

	seen := stub.requested()
	if len(seen) != 1 {
		t.Fatalf("expected one request, got %v", seen)
	}
	if strings.Count(seen[0], "?") != 1 {
		t.Fatalf("%s has two question marks, which makes the query string unparseable", seen[0])
	}
	if !strings.Contains(seen[0], "search=web") {
		t.Fatalf("%s dropped the caller's own query parameter", seen[0])
	}
	if !strings.Contains(seen[0], "per_page=1000") {
		t.Fatalf("%s was fetched without per_page", seen[0])
	}
}

func TestTraefikFetchProtoStillReportsANon200(t *testing.T) {
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		http.Error(w, "nope", http.StatusForbidden)
	}))
	defer srv.Close()

	a := &App{cfg: &Config{TraefikAPIURL: srv.URL}, httpClient: srv.Client()}
	body, err := a.traefikFetchProto(context.Background(), "/api/http/routers")
	if err == nil {
		t.Fatalf("a 403 from Traefik must stay an error, got body %s", string(body))
	}
	if string(body) != "[]" {
		t.Fatalf("a failed fetch must yield an empty array, got %s", string(body))
	}
}

func TestTraefikFetchProtoFollowsTheNextPageHeader(t *testing.T) {
	stub := newTraefikPagedStub(2300)
	defer stub.Close()

	body, err := stub.app().traefikFetchProto(context.Background(), "/api/http/routers")
	if err != nil {
		t.Fatal(err)
	}
	rows := arrayRows(t, body)
	if len(rows) != 2300 {
		t.Fatalf("the agent returned %d of 2300 routers; Traefik answers X-Next-Page when a "+
			"list is longer than per_page, so an install past 1000 objects is silently truncated",
			len(rows))
	}
	if rows[len(rows)-1]["name"] != "http-routers-2299@docker" {
		t.Fatalf("last router is %v, expected the 2300th", rows[len(rows)-1]["name"])
	}

	seen := stub.requested()
	if len(seen) != 3 {
		t.Fatalf("expected three pages of 1000, got %v", seen)
	}
	if !strings.Contains(seen[1], "page=2") || !strings.Contains(seen[2], "page=3") {
		t.Fatalf("follow-up pages were not requested by number: %v", seen)
	}
}

func TestTraefikFetchProtoDoesNotAskForASecondPageWhenTheFirstIsTheLast(t *testing.T) {
	stub := newTraefikPagedStub(5)
	defer stub.Close()

	if _, err := stub.app().traefikFetchProto(context.Background(), "/api/http/routers"); err != nil {
		t.Fatal(err)
	}
	seen := stub.requested()
	if len(seen) != 1 {
		t.Fatalf("a single short page must not trigger a second request, got %v", seen)
	}
	if strings.Contains(seen[0], "&page=") {
		t.Fatalf("the first request must not pin an explicit page number: %s", seen[0])
	}
}

func TestTraefikFetchProtoPassesANonArrayAnswerThrough(t *testing.T) {
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		w.Write([]byte(`{"http":{"routers":{"total":3}}}`))
	}))
	defer srv.Close()

	a := &App{cfg: &Config{TraefikAPIURL: srv.URL}, httpClient: srv.Client()}
	body, err := a.traefikFetchProto(context.Background(), "/api/overview")
	if err != nil {
		t.Fatal(err)
	}
	if !strings.Contains(string(body), `"total":3`) {
		t.Fatalf("a non-array answer must survive verbatim, got %s", string(body))
	}
}
