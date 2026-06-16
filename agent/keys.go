package main

import (
	"crypto/rand"
	"crypto/sha256"
	"crypto/subtle"
	"encoding/hex"
	"encoding/json"
	"net/http"
	"os"
	"path/filepath"
	"strings"
	"sync"
	"time"
)

type APIKey struct {
	ID         string     `json:"id"`
	Name       string     `json:"name"`
	KeyHash    string     `json:"key_hash"`
	CreatedAt  time.Time  `json:"created_at"`
	LastUsedAt *time.Time `json:"last_used_at,omitempty"`
}

type keyStore struct {
	mu   sync.RWMutex
	path string
	keys []APIKey
}

func newKeyStore(dir string) *keyStore {
	ks := &keyStore{
		path: filepath.Join(dir, "api_keys.json"),
		keys: []APIKey{},
	}
	ks.load()
	return ks
}

func (ks *keyStore) load() {
	data, err := os.ReadFile(ks.path)
	if err != nil {
		return
	}
	_ = json.Unmarshal(data, &ks.keys)
}

func (ks *keyStore) save() error {
	if err := os.MkdirAll(filepath.Dir(ks.path), 0755); err != nil {
		return err
	}
	data, err := json.MarshalIndent(ks.keys, "", "  ")
	if err != nil {
		return err
	}
	return os.WriteFile(ks.path, data, 0600)
}

func hashKey(key string) string {
	h := sha256.Sum256([]byte(key))
	return hex.EncodeToString(h[:])
}

func (ks *keyStore) validate(key string) bool {
	hash := hashKey(key)
	ks.mu.Lock()
	defer ks.mu.Unlock()
	for i, k := range ks.keys {
		if subtle.ConstantTimeCompare([]byte(k.KeyHash), []byte(hash)) == 1 {
			now := time.Now().UTC()
			ks.keys[i].LastUsedAt = &now
			go ks.save()
			return true
		}
	}
	return false
}

func (ks *keyStore) list() []map[string]any {
	ks.mu.RLock()
	defer ks.mu.RUnlock()
	out := make([]map[string]any, 0, len(ks.keys))
	for _, k := range ks.keys {
		m := map[string]any{
			"id":         k.ID,
			"name":       k.Name,
			"created_at": k.CreatedAt,
		}
		if k.LastUsedAt != nil {
			m["last_used_at"] = k.LastUsedAt
		}
		out = append(out, m)
	}
	return out
}

func (ks *keyStore) create(name string) (string, string, error) {
	raw := make([]byte, 32)
	if _, err := rand.Read(raw); err != nil {
		return "", "", err
	}
	rawKey := hex.EncodeToString(raw)
	idBytes := make([]byte, 8)
	_, _ = rand.Read(idBytes)

	k := APIKey{
		ID:        hex.EncodeToString(idBytes),
		Name:      name,
		KeyHash:   hashKey(rawKey),
		CreatedAt: time.Now().UTC(),
	}
	ks.mu.Lock()
	ks.keys = append(ks.keys, k)
	err := ks.save()
	ks.mu.Unlock()
	return k.ID, rawKey, err
}

func (ks *keyStore) delete(id string) bool {
	ks.mu.Lock()
	defer ks.mu.Unlock()
	for i, k := range ks.keys {
		if k.ID == id {
			ks.keys = append(ks.keys[:i], ks.keys[i+1:]...)
			_ = ks.save()
			return true
		}
	}
	return false
}

func (a *App) keysListHandler(w http.ResponseWriter, r *http.Request) {
	jsonOK(w, map[string]any{"keys": a.keys.list()})
}

func (a *App) keysCreateHandler(w http.ResponseWriter, r *http.Request) {
	var body struct {
		Name string `json:"name"`
	}
	_ = json.NewDecoder(r.Body).Decode(&body)
	name := strings.TrimSpace(body.Name)
	if name == "" {
		jsonError(w, "name is required", http.StatusBadRequest)
		return
	}
	id, rawKey, err := a.keys.create(name)
	if err != nil {
		jsonError(w, "failed to create key: "+err.Error(), http.StatusInternalServerError)
		return
	}
	jsonOK(w, map[string]any{"ok": true, "id": id, "name": name, "key": rawKey})
}

func (a *App) keysDeleteHandler(w http.ResponseWriter, r *http.Request, id string) {
	if !a.keys.delete(id) {
		jsonError(w, "key not found", http.StatusNotFound)
		return
	}
	jsonOK(w, map[string]any{"ok": true})
}
