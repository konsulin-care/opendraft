package github

import (
	"context"
	"crypto/sha256"
	"encoding/base64"
	"errors"
	"net/http"
	"net/http/httptest"
	"net/url"
	"strings"
	"testing"
	"time"
)

func testClient(webURL string, now time.Time) *Client {
	return &Client{
		WebURL:       webURL,
		APIURL:       webURL,
		ClientID:     "client-id-123",
		ClientSecret: "client-secret-456",
		HTTP:         http.DefaultClient,
		Now:          func() time.Time { return now },
	}
}

func TestNewPKCEChallengeIsS256OfVerifier(t *testing.T) {
	verifier, challenge := NewPKCE()

	if verifier == "" || challenge == "" {
		t.Fatal("NewPKCE returned an empty value")
	}
	raw, err := base64.RawURLEncoding.DecodeString(verifier)
	if err != nil {
		t.Fatalf("verifier is not unpadded base64url: %v", err)
	}
	if len(raw) != 32 {
		t.Fatalf("verifier decoded to %d bytes, want 32", len(raw))
	}
	sum := sha256.Sum256([]byte(verifier))
	want := base64.RawURLEncoding.EncodeToString(sum[:])
	if challenge != want {
		t.Fatalf("challenge = %q, want %q", challenge, want)
	}
}

func TestAuthorizeURLContainsParametersWithoutSecret(t *testing.T) {
	client := testClient("https://github.example", time.Now())
	got := client.AuthorizeURL("https://app.example/@api/auth/callback", "state-xyz", "challenge-abc")

	parsed, err := url.Parse(got)
	if err != nil {
		t.Fatalf("parse authorize URL: %v", err)
	}
	if parsed.Path != "/login/oauth/authorize" {
		t.Fatalf("path = %q, want /login/oauth/authorize", parsed.Path)
	}
	query := parsed.Query()
	want := map[string]string{
		"client_id":             "client-id-123",
		"redirect_uri":          "https://app.example/@api/auth/callback",
		"state":                 "state-xyz",
		"code_challenge":        "challenge-abc",
		"code_challenge_method": "S256",
	}
	for key, value := range want {
		if query.Get(key) != value {
			t.Fatalf("%s = %q, want %q", key, query.Get(key), value)
		}
	}
	if strings.Contains(got, client.ClientSecret) {
		t.Fatal("authorize URL contains the client secret")
	}
}

func TestInstallURL(t *testing.T) {
	client := testClient("https://github.example", time.Now())
	got := client.InstallURL("opendraft-app", "state-123")

	want := "https://github.example/apps/opendraft-app/installations/new?state=state-123"
	if got != want {
		t.Fatalf("InstallURL = %q, want %q", got, want)
	}
}

func TestExchangeCodePostsFieldsAndDerivesExpiry(t *testing.T) {
	now := time.Date(2024, 5, 1, 12, 0, 0, 0, time.UTC)
	var gotForm url.Values
	var gotAccept string
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.Method != http.MethodPost {
			t.Errorf("method = %s, want POST", r.Method)
		}
		if r.URL.Path != "/login/oauth/access_token" {
			t.Errorf("path = %q, want /login/oauth/access_token", r.URL.Path)
		}
		gotAccept = r.Header.Get("Accept")
		if err := r.ParseForm(); err != nil {
			t.Errorf("ParseForm: %v", err)
		}
		gotForm = r.PostForm
		w.Header().Set("Content-Type", "application/json")
		_, _ = w.Write([]byte(`{
			"access_token":"ghu_new_access",
			"expires_in":28800,
			"refresh_token":"ghr_new_refresh",
			"refresh_token_expires_in":15897600,
			"token_type":"bearer"
		}`))
	}))
	defer server.Close()

	client := testClient(server.URL, now)
	tokens, err := client.ExchangeCode(context.Background(), "code-1", "verifier-1", "https://app.example/cb")
	if err != nil {
		t.Fatalf("ExchangeCode: %v", err)
	}

	if gotAccept != "application/json" {
		t.Fatalf("Accept = %q, want application/json", gotAccept)
	}
	wantForm := map[string]string{
		"client_id":     "client-id-123",
		"client_secret": "client-secret-456",
		"code":          "code-1",
		"redirect_uri":  "https://app.example/cb",
		"code_verifier": "verifier-1",
	}
	for key, value := range wantForm {
		if gotForm.Get(key) != value {
			t.Fatalf("%s = %q, want %q", key, gotForm.Get(key), value)
		}
	}
	if _, ok := gotForm["grant_type"]; ok {
		t.Fatal("exchange request unexpectedly sends grant_type")
	}

	if tokens.AccessToken != "ghu_new_access" {
		t.Fatalf("AccessToken = %q", tokens.AccessToken)
	}
	if tokens.RefreshToken != "ghr_new_refresh" {
		t.Fatalf("RefreshToken = %q", tokens.RefreshToken)
	}
	if want := now.Add(28800 * time.Second); !tokens.AccessExpiresAt.Equal(want) {
		t.Fatalf("AccessExpiresAt = %v, want %v", tokens.AccessExpiresAt, want)
	}
	if want := now.Add(15897600 * time.Second); !tokens.RefreshExpiresAt.Equal(want) {
		t.Fatalf("RefreshExpiresAt = %v, want %v", tokens.RefreshExpiresAt, want)
	}
}

func TestExchangeCodeTreatsErrorFieldAsFailure(t *testing.T) {
	now := time.Date(2024, 5, 1, 12, 0, 0, 0, time.UTC)
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		// GitHub answers HTTP 200 even for failures.
		_, _ = w.Write([]byte(`{"error":"bad_verification_code","error_description":"The code passed is incorrect or expired."}`))
	}))
	defer server.Close()

	client := testClient(server.URL, now)
	if _, err := client.ExchangeCode(context.Background(), "bad", "verifier", "https://app.example/cb"); err == nil {
		t.Fatal("ExchangeCode returned nil error for an error response")
	}
}

func TestRefreshPostsGrantTypeAndReturnsTokens(t *testing.T) {
	now := time.Date(2024, 5, 1, 12, 0, 0, 0, time.UTC)
	var gotForm url.Values
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if err := r.ParseForm(); err != nil {
			t.Errorf("ParseForm: %v", err)
		}
		gotForm = r.PostForm
		w.Header().Set("Content-Type", "application/json")
		_, _ = w.Write([]byte(`{
			"access_token":"ghu_refreshed",
			"expires_in":28800,
			"refresh_token":"ghr_refreshed",
			"refresh_token_expires_in":15897600,
			"token_type":"bearer"
		}`))
	}))
	defer server.Close()

	client := testClient(server.URL, now)
	tokens, err := client.Refresh(context.Background(), "ghr_old")
	if err != nil {
		t.Fatalf("Refresh: %v", err)
	}

	wantForm := map[string]string{
		"client_id":     "client-id-123",
		"client_secret": "client-secret-456",
		"grant_type":    "refresh_token",
		"refresh_token": "ghr_old",
	}
	for key, value := range wantForm {
		if gotForm.Get(key) != value {
			t.Fatalf("%s = %q, want %q", key, gotForm.Get(key), value)
		}
	}
	if tokens.AccessToken != "ghu_refreshed" || tokens.RefreshToken != "ghr_refreshed" {
		t.Fatalf("tokens = %+v", tokens)
	}
	if want := now.Add(28800 * time.Second); !tokens.AccessExpiresAt.Equal(want) {
		t.Fatalf("AccessExpiresAt = %v, want %v", tokens.AccessExpiresAt, want)
	}
	if want := now.Add(15897600 * time.Second); !tokens.RefreshExpiresAt.Equal(want) {
		t.Fatalf("RefreshExpiresAt = %v, want %v", tokens.RefreshExpiresAt, want)
	}
}

func TestRefreshTreatsErrorFieldAsFailure(t *testing.T) {
	now := time.Date(2024, 5, 1, 12, 0, 0, 0, time.UTC)
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		_, _ = w.Write([]byte(`{"error":"bad_refresh_token","error_description":"The refresh token passed is incorrect or expired."}`))
	}))
	defer server.Close()

	client := testClient(server.URL, now)
	_, err := client.Refresh(context.Background(), "ghr_bad")
	if err == nil {
		t.Fatal("Refresh returned nil error for an error response")
	}
	if !errors.Is(err, ErrOAuth) {
		t.Fatalf("Refresh error = %v, want ErrOAuth", err)
	}
}
