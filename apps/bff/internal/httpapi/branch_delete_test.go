package httpapi

import (
	"net/http"
	"net/http/httptest"
	"testing"
	"time"
)

// TestBranchDeleteEndpointDeletesViewerBranches checks branches under the
// signed-in user's own od-<login>/ or opendraft/<login>/ prefix are deleted
// and answer 204. The login comparison is case-insensitive.
func TestBranchDeleteEndpointDeletesViewerBranches(t *testing.T) {
	now := time.Unix(authTestNowUnix, 0).UTC()
	branches := []string{
		"od-octocat/paper",
		"od-OctoCat/paper",
		"opendraft/octocat/paper",
		"opendraft/OctoCat/paper",
	}
	for _, branch := range branches {
		t.Run(branch, func(t *testing.T) {
			fake := &fakeRepoActions{router: func(w http.ResponseWriter, r *http.Request) {
				if r.Method != http.MethodDelete {
					t.Errorf("method = %q, want DELETE", r.Method)
				}
				want := "/repos/octocat/draft/git/refs/heads/" + branch
				if r.URL.Path != want {
					t.Errorf("path = %q, want %q", r.URL.Path, want)
				}
				w.WriteHeader(http.StatusNoContent)
			}}
			handler, sealer := newRepoActionsServer(t, fake, now)

			rec := serveRepoAction(t, handler, sealer, now, http.MethodDelete,
				"/@api/repos/octocat/draft/branches/"+branch, nil)

			if rec.Code != http.StatusNoContent {
				t.Fatalf("status = %d, want 204: %s", rec.Code, rec.Body.String())
			}
			if rec.Body.Len() != 0 {
				t.Errorf("body = %q, want empty", rec.Body.String())
			}
			if fake.count() != 1 {
				t.Errorf("GitHub received %d requests, want 1", fake.count())
			}
		})
	}
}

// TestBranchDeleteEndpointRejectsUnsafeBranches checks the default branch,
// another user's branch and malformed names are rejected before any GitHub
// call.
func TestBranchDeleteEndpointRejectsUnsafeBranches(t *testing.T) {
	now := time.Unix(authTestNowUnix, 0).UTC()
	branches := []string{
		"main",
		"od-other/paper",
		"opendraft/other/paper",
		"od-octocat",
		"od-octocat/",
		"od-octocat/paper%20one",
	}
	for _, branch := range branches {
		t.Run(branch, func(t *testing.T) {
			fake := &fakeRepoActions{router: func(w http.ResponseWriter, _ *http.Request) {
				w.WriteHeader(http.StatusNoContent)
			}}
			handler, sealer := newRepoActionsServer(t, fake, now)

			rec := serveRepoAction(t, handler, sealer, now, http.MethodDelete,
				"/@api/repos/octocat/draft/branches/"+branch, nil)

			if rec.Code != http.StatusBadRequest {
				t.Fatalf("status = %d, want 400: %s", rec.Code, rec.Body.String())
			}
			body := decodeJSON(t, rec)
			if body["error"] != invalidRequestCode || body["field"] != branchFieldName {
				t.Errorf("body = %v, want field %q", body, branchFieldName)
			}
			if fake.count() != 0 {
				t.Errorf("GitHub received %d requests, want 0", fake.count())
			}
		})
	}
}

// TestSafeBranchSuffixRejectsUnsafeNames checks empty, dot and empty path
// components are rejected even though the character pattern accepts them.
func TestSafeBranchSuffixRejectsUnsafeNames(t *testing.T) {
	for _, suffix := range []string{"", ".", "..", "a//b", "a/../b", "a/./b", "a/b/"} {
		if safeBranchSuffix(suffix) {
			t.Errorf("safeBranchSuffix(%q) = true, want false", suffix)
		}
	}
	for _, suffix := range []string{"paper", "20260101-120000", "a/b"} {
		if !safeBranchSuffix(suffix) {
			t.Errorf("safeBranchSuffix(%q) = false, want true", suffix)
		}
	}
}

// TestBranchDeleteEndpointRequiresSession checks the endpoint answers 401
// without a session and makes no GitHub call.
func TestBranchDeleteEndpointRequiresSession(t *testing.T) {
	now := time.Unix(authTestNowUnix, 0).UTC()
	fake := &fakeRepoActions{router: func(w http.ResponseWriter, _ *http.Request) {
		w.WriteHeader(http.StatusNoContent)
	}}
	handler, _ := newRepoActionsServer(t, fake, now)

	req := httptest.NewRequest(http.MethodDelete,
		"/@api/repos/octocat/draft/branches/od-octocat/paper", nil)
	req.Header.Set("Origin", reposTestOrigin)
	rec := httptest.NewRecorder()
	handler.ServeHTTP(rec, req)

	if rec.Code != http.StatusUnauthorized {
		t.Fatalf("status = %d, want 401: %s", rec.Code, rec.Body.String())
	}
	if body := decodeJSON(t, rec); body["error"] != unauthenticatedCode {
		t.Errorf("error = %q, want %q", body["error"], unauthenticatedCode)
	}
	if fake.count() != 0 {
		t.Errorf("GitHub received %d requests, want 0", fake.count())
	}
}

// TestBranchDeleteEndpointMapsGitHubErrors checks a GitHub forbidden answer
// maps to 403 forbidden and other failures to 502 upstream_error.
func TestBranchDeleteEndpointMapsGitHubErrors(t *testing.T) {
	now := time.Unix(authTestNowUnix, 0).UTC()
	tests := []struct {
		name       string
		status     int
		wantStatus int
		wantCode   string
	}{
		{name: "forbidden", status: http.StatusForbidden, wantStatus: http.StatusForbidden, wantCode: forbiddenCode},
		{name: "upstream", status: http.StatusInternalServerError, wantStatus: http.StatusBadGateway, wantCode: upstreamErrorCode},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			fake := &fakeRepoActions{router: func(w http.ResponseWriter, r *http.Request) {
				if r.URL.Path != "/repos/octocat/draft/git/refs/heads/od-octocat/paper" {
					t.Errorf("path = %q", r.URL.Path)
				}
				w.WriteHeader(tt.status)
			}}
			handler, sealer := newRepoActionsServer(t, fake, now)

			rec := serveRepoAction(t, handler, sealer, now, http.MethodDelete,
				"/@api/repos/octocat/draft/branches/od-octocat/paper", nil)

			if rec.Code != tt.wantStatus {
				t.Fatalf("status = %d, want %d: %s", rec.Code, tt.wantStatus, rec.Body.String())
			}
			body := decodeJSON(t, rec)
			if body["error"] != tt.wantCode {
				t.Errorf("error = %q, want %q", body["error"], tt.wantCode)
			}
		})
	}
}
