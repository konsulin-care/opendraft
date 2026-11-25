package httpapi

import (
	"net/http"
	"net/http/httptest"
	"testing"
	"time"
)

// TestBranchesEndpointListsMatchingRefs checks the branch suggestion endpoint
// returns matching branch names with their head SHA.
func TestBranchesEndpointListsMatchingRefs(t *testing.T) {
	now := time.Unix(authTestNowUnix, 0).UTC()
	fake := &fakeRepoActions{router: func(w http.ResponseWriter, r *http.Request) {
		if r.URL.Path != testMatchingRefsPath+"opendraft/ada/" {
			t.Errorf("path = %q", r.URL.Path)
		}
		_, _ = w.Write([]byte(`[{"ref":"refs/heads/opendraft/ada/20260101-120000","object":{"sha":"aaa111"}},{"ref":"refs/heads/opendraft/ada/20260102-130000","object":{"sha":"bbb222"}}]`))
	}}
	handler, sealer := newRepoActionsServer(t, fake, now)

	rec := serveRepoAction(t, handler, sealer, now, http.MethodGet,
		testBranchesPath+"?prefix=opendraft/ada/", nil)

	if rec.Code != http.StatusOK {
		t.Fatalf("status = %d, want 200: %s", rec.Code, rec.Body.String())
	}
	body := decodeBranchRefs(t, rec)
	if len(body) != 2 {
		t.Fatalf("body = %v, want 2 entries", body)
	}
	if body[0]["name"] != "opendraft/ada/20260101-120000" || body[0]["sha"] != "aaa111" {
		t.Errorf("body[0] = %v", body[0])
	}
	if body[1]["name"] != "opendraft/ada/20260102-130000" || body[1]["sha"] != "bbb222" {
		t.Errorf("body[1] = %v", body[1])
	}
}

// TestBranchesEndpointAcceptsODPrefix checks od-<login> prefixes are forwarded
// to GitHub matching-refs alongside the legacy opendraft/ namespace.
func TestBranchesEndpointAcceptsODPrefix(t *testing.T) {
	now := time.Unix(authTestNowUnix, 0).UTC()
	for _, prefix := range []string{"od-ada", "od-ada/", "od-ada/paper"} {
		t.Run(prefix, func(t *testing.T) {
			assertBranchPrefixAccepted(t, now, prefix)
		})
	}
}

// assertBranchPrefixAccepted checks prefix is forwarded to GitHub matching-refs
// and answers one matching branch.
func assertBranchPrefixAccepted(t *testing.T, now time.Time, prefix string) {
	t.Helper()

	fake := &fakeRepoActions{router: func(w http.ResponseWriter, r *http.Request) {
		want := testMatchingRefsPath + prefix
		if r.URL.Path != want {
			t.Errorf("path = %q, want %q", r.URL.Path, want)
		}
		_, _ = w.Write([]byte(`[{"ref":"refs/heads/x","object":{"sha":"abc123"}}]`))
	}}
	handler, sealer := newRepoActionsServer(t, fake, now)
	rec := serveRepoAction(t, handler, sealer, now, http.MethodGet,
		testBranchesPath+"?prefix="+prefix, nil)

	if rec.Code != http.StatusOK {
		t.Fatalf("status = %d, want 200: %s", rec.Code, rec.Body.String())
	}
	body := decodeBranchRefs(t, rec)
	if len(body) != 1 || body[0]["sha"] != "abc123" {
		t.Errorf("body = %v, want one matching branch", body)
	}
	if fake.count() != 1 {
		t.Errorf("GitHub received %d requests, want 1", fake.count())
	}
}

// TestBranchesEndpointRejectsForeignPrefix checks a prefix outside the accepted
// opendraft/ and od-<login> namespaces is rejected before any GitHub call.
func TestBranchesEndpointRejectsForeignPrefix(t *testing.T) {
	now := time.Unix(authTestNowUnix, 0).UTC()
	tests := []string{"main/", "opendraft/", "/opendraft/ada/", "od-", "od-/x", "xod-ada"}
	for _, prefix := range tests {
		t.Run(prefix, func(t *testing.T) {
			assertRejectedRepoAction(t, now, http.MethodGet,
				testBranchesPath+"?prefix="+prefix, prefixField)
		})
	}
}

// TestMergeUpstreamEndpoint checks a successful upstream merge answers merged
// true and a GitHub conflict maps to 409 conflict.
func TestMergeUpstreamEndpoint(t *testing.T) {
	now := time.Unix(authTestNowUnix, 0).UTC()
	tests := []struct {
		name       string
		wantCode   string
		status     int
		wantStatus int
	}{
		{name: "merged", status: http.StatusOK, wantStatus: http.StatusOK},
		{name: "conflict", status: http.StatusConflict, wantStatus: http.StatusConflict, wantCode: conflictCode},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			assertMergeUpstream(t, now, tt.status, tt.wantStatus, tt.wantCode)
		})
	}
}

// assertMergeUpstream checks a GitHub merge status maps to wantStatus and
// wantCode, or answers merged true on success.
func assertMergeUpstream(t *testing.T, now time.Time, status, wantStatus int, wantCode string) {
	t.Helper()

	fake := &fakeRepoActions{router: func(w http.ResponseWriter, r *http.Request) {
		if r.URL.Path != testMergeUpstreamPath {
			t.Errorf("path = %q", r.URL.Path)
		}
		w.WriteHeader(status)
		_, _ = w.Write([]byte(`{"message":"upstream detail"}`))
	}}
	handler, sealer := newRepoActionsServer(t, fake, now)

	rec := serveRepoAction(t, handler, sealer, now, http.MethodPost,
		testMergeUpstreamAPI, map[string]any{"branch": testDefaultBranch})

	if rec.Code != wantStatus {
		t.Fatalf("status = %d, want %d: %s", rec.Code, wantStatus, rec.Body.String())
	}
	body := decodeAnyJSON(t, rec)
	if wantCode == "" {
		if body["merged"] != true {
			t.Errorf("body = %v, want merged true", body)
		}
		return
	}
	if body["error"] != wantCode {
		t.Errorf("body = %v, want error %q", body, wantCode)
	}
}

// TestSuggestionsRequireSession checks all three suggestion endpoints answer
// 401 without a session.
func TestSuggestionsRequireSession(t *testing.T) {
	now := time.Unix(authTestNowUnix, 0).UTC()
	fake := &fakeRepoActions{router: func(w http.ResponseWriter, _ *http.Request) { w.WriteHeader(http.StatusOK) }}
	handler, _ := newRepoActionsServer(t, fake, now)

	tests := []struct {
		name   string
		method string
		path   string
	}{
		{name: "branches", method: http.MethodGet, path: testBranchesPath + "?prefix=opendraft/ada/"},
		{name: "pulls", method: http.MethodGet, path: testPullLookupPath},
		{name: "merge-upstream", method: http.MethodPost, path: testMergeUpstreamAPI},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			req := httptest.NewRequest(tt.method, tt.path, nil)
			req.Header.Set("Origin", reposTestOrigin)
			rec := httptest.NewRecorder()
			handler.ServeHTTP(rec, req)
			if rec.Code != http.StatusUnauthorized {
				t.Fatalf("status = %d, want 401: %s", rec.Code, rec.Body.String())
			}
		})
	}
	if fake.count() != 0 {
		t.Errorf("GitHub received %d requests, want 0", fake.count())
	}
}
