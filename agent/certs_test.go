package main

import (
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"os"
	"path/filepath"
	"testing"
)

func writeACME(t *testing.T, path, resolver, domain string) {
	t.Helper()
	body := map[string]any{resolver: map[string]any{"Certificates": []any{
		map[string]any{"domain": map[string]any{"main": domain, "sans": []any{}}, "certificate": ""},
	}}}
	b, _ := json.Marshal(body)
	if err := os.WriteFile(path, b, 0o644); err != nil {
		t.Fatal(err)
	}
}

func certsFor(t *testing.T, acmePath string) map[string]any {
	t.Helper()
	app := &App{cfg: &Config{ACMEJSONPath: acmePath}}
	rr := httptest.NewRecorder()
	app.certsHandler(rr, httptest.NewRequest(http.MethodGet, "/api/traefik/certs", nil))
	var out map[string]any
	if err := json.Unmarshal(rr.Body.Bytes(), &out); err != nil {
		t.Fatalf("bad json: %v (%s)", err, rr.Body.String())
	}
	return out
}

func TestAcmeJSONPathsSingle(t *testing.T) {
	got := acmeJSONPaths("/etc/traefik/acme.json")
	if len(got) != 1 || got[0] != "/etc/traefik/acme.json" {
		t.Fatalf("got %v", got)
	}
}

func TestAcmeJSONPathsCommaSeparated(t *testing.T) {
	got := acmeJSONPaths("/a/ovh.json, /a/lan.json ,/a/le.json")
	want := []string{"/a/ovh.json", "/a/lan.json", "/a/le.json"}
	if len(got) != len(want) {
		t.Fatalf("got %v want %v", got, want)
	}
	for i := range want {
		if got[i] != want[i] {
			t.Fatalf("got %v want %v", got, want)
		}
	}
}

func TestAcmeJSONPathsDeduplicates(t *testing.T) {
	if got := acmeJSONPaths("/a/x.json,/a/x.json"); len(got) != 1 {
		t.Fatalf("got %v", got)
	}
}

func TestAcmeJSONPathsDirectory(t *testing.T) {
	dir := t.TempDir()
	writeACME(t, filepath.Join(dir, "ovh.json"), "ovh", "a.example.com")
	writeACME(t, filepath.Join(dir, "lan.json"), "lan", "b.internal")
	os.WriteFile(filepath.Join(dir, "notes.txt"), []byte("ignore"), 0o644)

	got := acmeJSONPaths(dir)
	if len(got) != 2 {
		t.Fatalf("expected 2 json files, got %v", got)
	}
	if filepath.Base(got[0]) != "lan.json" || filepath.Base(got[1]) != "ovh.json" {
		t.Fatalf("expected sorted json files, got %v", got)
	}
}

// The common case, and what every existing agent install uses.
func TestCertsHandlerSingleFileUnchanged(t *testing.T) {
	dir := t.TempDir()
	p := filepath.Join(dir, "acme.json")
	writeACME(t, p, "letsencrypt", "solo.example.com")

	out := certsFor(t, p)
	certs, _ := out["certs"].([]any)
	if len(certs) != 1 {
		t.Fatalf("expected 1 cert, got %v", out)
	}
	c := certs[0].(map[string]any)
	if c["main"] != "solo.example.com" || c["resolver"] != "letsencrypt" {
		t.Fatalf("unexpected cert %v", c)
	}
	if _, hasErr := out["error"]; hasErr {
		t.Fatalf("single working file reported an error: %v", out["error"])
	}
}

func TestCertsHandlerMergesDirectory(t *testing.T) {
	dir := t.TempDir()
	writeACME(t, filepath.Join(dir, "ovh.json"), "ovh", "a.example.com")
	writeACME(t, filepath.Join(dir, "lan.json"), "lan", "b.internal")

	out := certsFor(t, dir)
	certs, _ := out["certs"].([]any)
	if len(certs) != 2 {
		t.Fatalf("expected 2 certs merged, got %v", out)
	}
	seen := map[string]string{}
	for _, rc := range certs {
		c := rc.(map[string]any)
		seen[c["main"].(string)] = c["source"].(string)
	}
	if seen["a.example.com"] != "ovh.json" || seen["b.internal"] != "lan.json" {
		t.Fatalf("certs not tagged with their source file: %v", seen)
	}
}

func TestCertsHandlerUnconfigured(t *testing.T) {
	out := certsFor(t, "")
	if out["error"] == nil {
		t.Fatalf("expected an error when ACME_JSON_PATH is empty, got %v", out)
	}
}

func TestCertsHandlerEmptyFileIsNotAnError(t *testing.T) {
	dir := t.TempDir()
	p := filepath.Join(dir, "acme.json")
	os.WriteFile(p, []byte(""), 0o644)
	out := certsFor(t, p)
	if certs, _ := out["certs"].([]any); len(certs) != 0 {
		t.Fatalf("expected no certs, got %v", out)
	}
	if out["error"] != nil {
		t.Fatalf("an empty acme.json should not be an error: %v", out["error"])
	}
}
