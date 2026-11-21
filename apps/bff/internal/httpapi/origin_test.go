package httpapi

import (
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/konsulin-care/opendraft/apps/bff/internal/config"
)

const testPublicOrigin = "https://publish.example"

// originServer builds the BFF handler with the public origin set and static
// serving disabled.
func originServer() http.Handler {
	return New(config.Config{PublicOrigin: testPublicOrigin}, Deps{Version: "1.2.3"})
}

// serveOrigin issues a request with the given method, target and Origin header.
func serveOrigin(handler http.Handler, method, target, origin string) *httptest.ResponseRecorder {
	req := httptest.NewRequest(method, target, nil)
	if origin != "" {
		req.Header.Set("Origin", origin)
	}
	rec := httptest.NewRecorder()
	handler.ServeHTTP(rec, req)
	return rec
}

func TestSameOriginRejectsUnexpectedOrigin(t *testing.T) {
	handler := originServer()

	tests := []struct {
		method string
		origin string
	}{
		{http.MethodPost, ""},
		{http.MethodPost, "https://evil.example"},
		{http.MethodPut, "https://evil.example"},
		{http.MethodDelete, "https://evil.example"},
		{http.MethodPatch, "https://publish.example.evil.example"},
	}
	for _, tc := range tests {
		rec := serveOrigin(handler, tc.method, "/@api/health", tc.origin)
		if rec.Code != http.StatusForbidden {
			t.Errorf("%s origin %q status = %d, want 403", tc.method, tc.origin, rec.Code)
			continue
		}
		body := decodeJSON(t, rec)
		if body["error"] != "forbidden_origin" {
			t.Errorf("%s origin %q error = %q, want forbidden_origin", tc.method, tc.origin, body["error"])
		}
	}
}

func TestSameOriginAllowsSafeMethodsWithoutOrigin(t *testing.T) {
	handler := originServer()

	rec := serveOrigin(handler, http.MethodGet, "/@api/health", "")
	if rec.Code != http.StatusOK {
		t.Fatalf("GET status = %d, want 200", rec.Code)
	}
	body := decodeJSON(t, rec)
	if body["status"] != "ok" {
		t.Errorf("GET status field = %q, want ok", body["status"])
	}

	head := serveOrigin(handler, http.MethodHead, "/@api/health", "")
	if head.Code != http.StatusOK {
		t.Errorf("HEAD status = %d, want 200", head.Code)
	}

	options := serveOrigin(handler, http.MethodOptions, "/@api/health", "")
	if options.Code == http.StatusForbidden {
		t.Errorf("OPTIONS was rejected, want passthrough")
	}
}

func TestSameOriginAllowsMatchingOriginOnMutation(t *testing.T) {
	handler := originServer()

	// No POST route exists, so a request that passes the origin check reaches
	// the API catch-all and answers 404 rather than 403.
	rec := serveOrigin(handler, http.MethodPost, "/@api/health", testPublicOrigin)
	if rec.Code != http.StatusNotFound {
		t.Fatalf("POST status = %d, want 404 (reached the API handler)", rec.Code)
	}
	body := decodeJSON(t, rec)
	if body["error"] != "not_found" {
		t.Errorf("POST error = %q, want not_found", body["error"])
	}
}

func TestSameOriginMiddlewarePassesMatchingMutation(t *testing.T) {
	reached := false
	next := http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
		reached = true
		w.WriteHeader(http.StatusNoContent)
	})
	handler := requireSameOrigin(testPublicOrigin, next)

	rec := serveOrigin(handler, http.MethodPost, "/@api/probe", testPublicOrigin)
	if rec.Code != http.StatusNoContent {
		t.Fatalf("status = %d, want 204", rec.Code)
	}
	if !reached {
		t.Error("handler was not reached for a matching Origin")
	}
}
