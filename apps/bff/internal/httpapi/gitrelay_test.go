package httpapi

import (
	"bytes"
	"encoding/base64"
	"io"
	"net/http"
	"net/http/httptest"
	"testing"
	"time"
)

type relayForwardCase struct {
	name      string
	method    string
	target    string
	body      string
	wantPath  string
	wantQuery string
	wantBody  string
}

func TestGitRelayWithoutSessionReturnsUnauthorized(t *testing.T) {
	now := time.Unix(authTestNowUnix, 0).UTC()
	fake := newFakeGitRelay(t)
	handler, _ := newGitRelayServer(t, fake, now)

	rec := serveGitRelay(t, handler, nil, now, http.MethodGet, "/@api/git/octocat/draft.git/info/refs?service=git-upload-pack", nil, false)

	if rec.Code != http.StatusUnauthorized {
		t.Fatalf("status = %d, want 401", rec.Code)
	}
	if body := decodeJSON(t, rec); body[errorKey] != unauthenticatedCode {
		t.Errorf("error = %q, want %q", body[errorKey], unauthenticatedCode)
	}
	if fake.count() != 0 {
		t.Errorf("upstream received %d requests, want 0", fake.count())
	}
}

func TestGitRelayForwardsAllowedRequests(t *testing.T) {
	tests := []relayForwardCase{
		{
			name:      "info refs upload pack",
			method:    http.MethodGet,
			target:    "/@api/git/octocat/draft.git/info/refs?service=git-upload-pack",
			wantPath:  "/octocat/draft.git/info/refs",
			wantQuery: "service=git-upload-pack",
		},
		{
			name:      "info refs receive pack",
			method:    http.MethodGet,
			target:    "/@api/git/octocat/draft.git/info/refs?service=git-receive-pack",
			wantPath:  "/octocat/draft.git/info/refs",
			wantQuery: "service=git-receive-pack",
		},
		{
			name:     "upload pack post",
			method:   http.MethodPost,
			target:   "/@api/git/octocat/draft.git/git-upload-pack",
			body:     "upload-request-body",
			wantPath: "/octocat/draft.git/git-upload-pack",
			wantBody: "upload-request-body",
		},
		{
			name:     "receive pack post",
			method:   http.MethodPost,
			target:   "/@api/git/octocat/draft.git/git-receive-pack",
			body:     "receive-request-body",
			wantPath: "/octocat/draft.git/git-receive-pack",
			wantBody: "receive-request-body",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			checkRelayForward(t, tt)
		})
	}
}

func checkRelayForward(t *testing.T, tc relayForwardCase) {
	t.Helper()
	now := time.Unix(authTestNowUnix, 0).UTC()
	fake := newFakeGitRelay(t)
	fake.status = http.StatusCreated
	handler, sealer := newGitRelayServer(t, fake, now)

	var reader io.Reader
	if tc.body != "" {
		reader = bytes.NewBufferString(tc.body)
	}
	req := httptest.NewRequest(tc.method, tc.target, reader)
	req.Header.Set("Origin", reposTestOrigin)
	req.Header.Set("Content-Type", "application/x-git-upload-pack-request")
	req.Header.Set("Accept", "application/x-git-upload-pack-result")
	req.Header.Set("Git-Protocol", "version=2")
	req.Header.Set("Content-Encoding", "gzip")
	req.Header.Set("Authorization", "Bearer client-token")
	req.Header.Set("Cookie", "client-cookie=secret")
	req.AddCookie(sessionCookie(t, sealer, liveSession(now), now))

	rec := httptest.NewRecorder()
	handler.ServeHTTP(rec, req)

	if rec.Code != http.StatusCreated {
		t.Fatalf("status = %d, want 201: %s", rec.Code, rec.Body.String())
	}
	if got := rec.Body.String(); got != fake.response {
		t.Errorf("body = %q, want %q", got, fake.response)
	}
	if got := rec.Header().Get("Content-Type"); got != fake.contentType {
		t.Errorf("Content-Type = %q, want %q", got, fake.contentType)
	}
	if got := rec.Header().Get("Cache-Control"); got != fake.cacheControl {
		t.Errorf("Cache-Control = %q, want %q", got, fake.cacheControl)
	}

	call := fake.last(t)
	if call.path != tc.wantPath || call.query != tc.wantQuery || call.body != tc.wantBody {
		t.Errorf("upstream = %s?%s body %q, want %s?%s body %q", call.path, call.query, call.body, tc.wantPath, tc.wantQuery, tc.wantBody)
	}
	assertRelayHeaders(t, call.header)
}

func assertRelayHeaders(t *testing.T, header http.Header) {
	t.Helper()
	wantHeaders := map[string]string{
		"Authorization":    "Basic " + base64.StdEncoding.EncodeToString([]byte("x-access-token:old-access")),
		"User-Agent":       gitUserAgent,
		"Cookie":           "",
		"Content-Type":     "application/x-git-upload-pack-request",
		"Accept":           "application/x-git-upload-pack-result",
		"Git-Protocol":     "version=2",
		"Content-Encoding": "gzip",
	}
	for name, want := range wantHeaders {
		if got := header.Get(name); got != want {
			t.Errorf("upstream %s = %q, want %q", name, got, want)
		}
	}
}

func TestGitRelayRejectsUnsupportedTargets(t *testing.T) {
	now := time.Unix(authTestNowUnix, 0).UTC()
	tests := []struct {
		name   string
		method string
		target string
	}{
		{name: "get other rest", method: http.MethodGet, target: "/@api/git/octocat/draft.git/objects/info/packs"},
		{name: "get unknown service", method: http.MethodGet, target: "/@api/git/octocat/draft.git/info/refs?service=git-upload-archive"},
		{name: "get missing service", method: http.MethodGet, target: "/@api/git/octocat/draft.git/info/refs"},
		{name: "post unsupported rest", method: http.MethodPost, target: "/@api/git/octocat/draft.git/git-upload-archive"},
		{name: "repo without git suffix", method: http.MethodGet, target: "/@api/git/octocat/draft/info/refs?service=git-upload-pack"},
		{name: testInvalidOwner, method: http.MethodGet, target: "/@api/git/bad_owner/draft.git/info/refs?service=git-upload-pack"},
		{name: "empty repo stem", method: http.MethodGet, target: "/@api/git/octocat/.git/info/refs?service=git-upload-pack"},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			fake := newFakeGitRelay(t)
			handler, sealer := newGitRelayServer(t, fake, now)

			rec := serveGitRelay(t, handler, sealer, now, tt.method, tt.target, nil, true)

			if rec.Code != http.StatusNotFound {
				t.Fatalf("status = %d, want 404: %s", rec.Code, rec.Body.String())
			}
			if body := decodeJSON(t, rec); body[errorKey] != errorCode {
				t.Errorf("error = %q, want %q", body[errorKey], errorCode)
			}
			if fake.count() != 0 {
				t.Errorf("upstream received %d requests, want 0", fake.count())
			}
		})
	}
}

func TestGitRelayRejectsOversizedBody(t *testing.T) {
	now := time.Unix(authTestNowUnix, 0).UTC()
	fake := newFakeGitRelay(t)
	handler, sealer := newGitRelayServer(t, fake, now)
	req := httptest.NewRequest(http.MethodPost, "/@api/git/octocat/draft.git/git-upload-pack", nil)
	req.Header.Set("Origin", reposTestOrigin)
	req.ContentLength = maxGitBodyBytes + 1
	req.Body = io.NopCloser(io.LimitReader(bytes.NewReader(nil), maxGitBodyBytes+1))
	req.AddCookie(sessionCookie(t, sealer, liveSession(now), now))
	rec := httptest.NewRecorder()
	handler.ServeHTTP(rec, req)
	if rec.Code != http.StatusRequestEntityTooLarge {
		t.Fatalf("status = %d, want 413: %s", rec.Code, rec.Body.String())
	}
	if body := decodeJSON(t, rec); body[errorKey] != tooLargeCode {
		t.Errorf("error = %q, want %q", body[errorKey], tooLargeCode)
	}
	if fake.count() != 0 {
		t.Errorf("upstream received %d requests, want 0", fake.count())
	}
}
