package main

import (
	"crypto/subtle"
	"net"
	"net/http"
	"strings"
	"sync"

	"golang.org/x/time/rate"
)

func (a *App) authMiddleware(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		key := r.Header.Get("X-Api-Key")
		if key == "" {
			key = strings.TrimPrefix(r.Header.Get("Authorization"), "Bearer ")
		}
		envKeyMatch := subtle.ConstantTimeCompare([]byte(key), []byte(a.cfg.APIKey)) == 1
		if !envKeyMatch && !a.keys.validate(key) {
			jsonError(w, "unauthorized", http.StatusUnauthorized)
			return
		}
		next.ServeHTTP(w, r)
	})
}

func (a *App) rateLimitMiddleware(next http.Handler) http.Handler {
	if a.cfg.RateLimit == 0 {
		return next
	}
	store := &limiterStore{
		limiters: make(map[string]*rate.Limiter),
		rpm:      a.cfg.RateLimit,
	}
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		ip, _, _ := net.SplitHostPort(r.RemoteAddr)
		if !store.allow(ip) {
			jsonError(w, "rate limit exceeded", http.StatusTooManyRequests)
			return
		}
		next.ServeHTTP(w, r)
	})
}

type limiterStore struct {
	mu       sync.Mutex
	limiters map[string]*rate.Limiter
	rpm      int
}

func (s *limiterStore) allow(ip string) bool {
	s.mu.Lock()
	l, ok := s.limiters[ip]
	if !ok {
		rps := rate.Limit(float64(s.rpm) / 60.0)
		l = rate.NewLimiter(rps, s.rpm)
		s.limiters[ip] = l
	}
	s.mu.Unlock()
	return l.Allow()
}

// perIPLimiter is kept for App struct wiring (unused directly - store is created per-middleware call)
type perIPLimiter struct{}

func newPerIPLimiter(_ int) *perIPLimiter { return &perIPLimiter{} }
