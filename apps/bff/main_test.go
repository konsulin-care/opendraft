package main

import (
	"encoding/json"
	"io"
	"log/slog"
	"net/http"
	"net/http/httptest"
	"net/url"
	"testing"

	"github.com/konsulin-care/opendraft/apps/bff/internal/config"
)

// testLogger returns a logger that discards its output.
func testLogger() *slog.Logger {
	return slog.New(slog.NewTextHandler(io.Discard, nil))
}

// loginEnabledConfig returns a fully configured login-enabled config.
func loginEnabledConfig() config.Config {
	return config.Config{
		Addr:               ":0",
		PublicOrigin:       "http://bff.test",
		GitHubClientID:     "client-id",
		GitHubClientSecret: "client-secret",
		GitHubAppSlug:      "app-slug",
		LoginEnabled:       true,
		SessionKey:         []byte("0123456789abcdef0123456789abcdef"),
		GitHubWebURL:       "https://github.com",
		GitHubAPIURL:       "https://api.github.com",
	}
}

// anonymousConfig returns a config with no GitHub credentials.
func anonymousConfig() config.Config {
	return config.Config{
		Addr:         ":0",
		PublicOrigin: "http://bff.test",
		LoginEnabled: false,
		GitHubWebURL: "https://github.com",
		GitHubAPIURL: "https://api.github.com",
	}
}

// TestNewHandlerLoginEnabledRedirectsToAuthorize verifies that a login-enabled
// handler starts the OAuth flow with PKCE.
func TestNewHandlerLoginEnabledRedirectsToAuthorize(t *testing.T) {
	handler := newHandler(loginEnabledConfig(), testLogger())

	rec := httptest.NewRecorder()
	handler.ServeHTTP(rec, httptest.NewRequest(http.MethodGet, "/@api/auth/login", nil))

	if rec.Code != http.StatusFound {
		t.Fatalf("status = %d, want %d (body %q)", rec.Code, http.StatusFound, rec.Body.String())
	}
	location := rec.Header().Get("Location")
	if location == "" {
		t.Fatal("missing Location header")
	}
	parsed, err := url.Parse(location)
	if err != nil {
		t.Fatalf("parse location: %v", err)
	}
	if got := parsed.Query().Get("code_challenge_method"); got != "S256" {
		t.Fatalf("code_challenge_method = %q, want S256", got)
	}
}

// TestNewHandlerLoginEnabledSessionIsWired verifies that the sealer is wired by
// requesting the session endpoint without a cookie.
func TestNewHandlerLoginEnabledSessionIsWired(t *testing.T) {
	handler := newHandler(loginEnabledConfig(), testLogger())

	rec := httptest.NewRecorder()
	handler.ServeHTTP(rec, httptest.NewRequest(http.MethodGet, "/@api/auth/session", nil))

	if rec.Code != http.StatusUnauthorized {
		t.Fatalf("status = %d, want %d (body %q)", rec.Code, http.StatusUnauthorized, rec.Body.String())
	}
	var body map[string]string
	if err := json.Unmarshal(rec.Body.Bytes(), &body); err != nil {
		t.Fatalf("decode body: %v", err)
	}
	if body["error"] != "unauthenticated" {
		t.Fatalf("error = %q, want unauthenticated", body["error"])
	}
}

// TestNewHandlerLoginDisabled verifies the anonymous read-only mode.
func TestNewHandlerLoginDisabled(t *testing.T) {
	handler := newHandler(anonymousConfig(), testLogger())

	rec := httptest.NewRecorder()
	handler.ServeHTTP(rec, httptest.NewRequest(http.MethodGet, "/@api/auth/login", nil))

	if rec.Code != http.StatusForbidden {
		t.Fatalf("login status = %d, want %d (body %q)", rec.Code, http.StatusForbidden, rec.Body.String())
	}
	var body map[string]string
	if err := json.Unmarshal(rec.Body.Bytes(), &body); err != nil {
		t.Fatalf("decode body: %v", err)
	}
	if body["error"] != "login_disabled" {
		t.Fatalf("error = %q, want login_disabled", body["error"])
	}

	health := httptest.NewRecorder()
	handler.ServeHTTP(health, httptest.NewRequest(http.MethodGet, "/@api/health", nil))
	if health.Code != http.StatusOK {
		t.Fatalf("health status = %d, want %d (body %q)", health.Code, http.StatusOK, health.Body.String())
	}
}
