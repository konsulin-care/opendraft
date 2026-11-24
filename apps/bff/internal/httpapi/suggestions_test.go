package httpapi

import (
	"encoding/json"
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
		if r.URL.Path != "/repos/octocat/draft/git/matching-refs/heads/opendraft/ada/" {
			t.Errorf("path = %q", r.URL.Path)
		}
		_, _ = w.Write([]byte(`[{"ref":"refs/heads/opendraft/ada/20260101-120000","object":{"sha":"aaa111"}},{"ref":"refs/heads/opendraft/ada/20260102-130000","object":{"sha":"bbb222"}}]`))
	}}
	handler, sealer := newRepoActionsServer(t, fake, now)

	rec := serveRepoAction(t, handler, sealer, now, http.MethodGet,
		"/@api/repos/octocat/draft/branches?prefix=opendraft/ada/", nil)

	if rec.Code != http.StatusOK {
		t.Fatalf("status = %d, want 200: %s", rec.Code, rec.Body.String())
	}
	var body []map[string]string
	if err := json.Unmarshal(rec.Body.Bytes(), &body); err != nil {
		t.Fatalf("decode body: %v", err)
	}
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
			fake := &fakeRepoActions{router: func(w http.ResponseWriter, r *http.Request) {
				want := "/repos/octocat/draft/git/matching-refs/heads/" + prefix
				if r.URL.Path != want {
					t.Errorf("path = %q, want %q", r.URL.Path, want)
				}
				_, _ = w.Write([]byte(`[{"ref":"refs/heads/x","object":{"sha":"abc123"}}]`))
			}}
			handler, sealer := newRepoActionsServer(t, fake, now)
			rec := serveRepoAction(t, handler, sealer, now, http.MethodGet,
				"/@api/repos/octocat/draft/branches?prefix="+prefix, nil)
			if rec.Code != http.StatusOK {
				t.Fatalf("status = %d, want 200: %s", rec.Code, rec.Body.String())
			}
			var body []map[string]string
			if err := json.Unmarshal(rec.Body.Bytes(), &body); err != nil {
				t.Fatalf("decode body: %v", err)
			}
			if len(body) != 1 || body[0]["sha"] != "abc123" {
				t.Errorf("body = %v, want one matching branch", body)
			}
			if fake.count() != 1 {
				t.Errorf("GitHub received %d requests, want 1", fake.count())
			}
		})
	}
}

// TestBranchesEndpointRejectsForeignPrefix checks a prefix outside the accepted
// opendraft/ and od-<login> namespaces is rejected before any GitHub call.
func TestBranchesEndpointRejectsForeignPrefix(t *testing.T) {
	now := time.Unix(authTestNowUnix, 0).UTC()
	tests := []string{"main/", "opendraft/", "/opendraft/ada/", "od-", "od-/x", "xod-ada"}
	for _, prefix := range tests {
		t.Run(prefix, func(t *testing.T) {
			fake := &fakeRepoActions{router: func(w http.ResponseWriter, _ *http.Request) { w.WriteHeader(http.StatusOK) }}
			handler, sealer := newRepoActionsServer(t, fake, now)
			rec := serveRepoAction(t, handler, sealer, now, http.MethodGet,
				"/@api/repos/octocat/draft/branches?prefix="+prefix, nil)
			if rec.Code != http.StatusBadRequest {
				t.Fatalf("status = %d, want 400: %s", rec.Code, rec.Body.String())
			}
			body := decodeJSON(t, rec)
			if body["error"] != invalidRequestCode || body["field"] != prefixField {
				t.Errorf("body = %v, want field %q", body, prefixField)
			}
			if fake.count() != 0 {
				t.Errorf("GitHub received %d requests, want 0", fake.count())
			}
		})
	}
}

// TestPullLookupEndpoint checks the pull lookup returns the number, URL and
// state of the newest matching pull request.
func TestPullLookupEndpoint(t *testing.T) {
	now := time.Unix(authTestNowUnix, 0).UTC()
	fake := &fakeRepoActions{router: func(w http.ResponseWriter, r *http.Request) {
		switch r.URL.Path {
		case "/repos/octocat/draft/pulls":
			if head := r.URL.Query().Get("head"); head != "octocat:opendraft/ada/20260101-120000" {
				t.Errorf("head = %q", head)
			}
			_, _ = w.Write([]byte(`[{"number":12,"html_url":"https://github.example/octocat/draft/pull/12","state":"open","merged_at":null,"head":{"label":"octocat:opendraft/ada/20260101-120000"}}]`))
		case "/repos/octocat/draft/pulls/12/reviews":
			_, _ = w.Write([]byte(`[]`))
		default:
			t.Errorf("path = %q", r.URL.Path)
		}
	}}
	handler, sealer := newRepoActionsServer(t, fake, now)

	rec := serveRepoAction(t, handler, sealer, now, http.MethodGet,
		"/@api/repos/octocat/draft/pulls?head=octocat:opendraft/ada/20260101-120000", nil)

	if rec.Code != http.StatusOK {
		t.Fatalf("status = %d, want 200: %s", rec.Code, rec.Body.String())
	}
	body := decodeAnyJSON(t, rec)
	if body["number"] != float64(12) {
		t.Errorf("number = %v, want 12", body["number"])
	}
	if body["url"] != "https://github.example/octocat/draft/pull/12" {
		t.Errorf("url = %v", body["url"])
	}
	if body["state"] != "open" {
		t.Errorf("state = %v, want open", body["state"])
	}
	if body["reviewState"] != "none" {
		t.Errorf("reviewState = %v, want none", body["reviewState"])
	}
}

// TestPullLookupEndpointReviewStates checks reviewState summarises the latest
// review per reviewer: change requests win, then approvals, else none.
func TestPullLookupEndpointReviewStates(t *testing.T) {
	now := time.Unix(authTestNowUnix, 0).UTC()
	tests := []struct {
		name    string
		reviews string
		want    string
	}{
		{name: "changes requested", reviews: `[{"id":1,"state":"APPROVED","user":{"login":"ada"}},{"id":2,"state":"CHANGES_REQUESTED","user":{"login":"grace"}}]`, want: "changes_requested"},
		{name: "approved after earlier change request", reviews: `[{"id":1,"state":"CHANGES_REQUESTED","user":{"login":"grace"}},{"id":2,"state":"APPROVED","user":{"login":"ada"}},{"id":3,"state":"APPROVED","user":{"login":"grace"}}]`, want: "approved"},
		{name: "no reviews", reviews: `[]`, want: "none"},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			fake := &fakeRepoActions{router: func(w http.ResponseWriter, r *http.Request) {
				switch r.URL.Path {
				case "/repos/octocat/draft/pulls":
					_, _ = w.Write([]byte(`[{"number":12,"html_url":"https://github.example/octocat/draft/pull/12","state":"open","merged_at":null,"head":{"label":"octocat:opendraft/ada/20260101-120000"}}]`))
				case "/repos/octocat/draft/pulls/12/reviews":
					_, _ = w.Write([]byte(tt.reviews))
				default:
					t.Errorf("path = %q", r.URL.Path)
				}
			}}
			handler, sealer := newRepoActionsServer(t, fake, now)

			rec := serveRepoAction(t, handler, sealer, now, http.MethodGet,
				"/@api/repos/octocat/draft/pulls?head=octocat:opendraft/ada/20260101-120000", nil)

			if rec.Code != http.StatusOK {
				t.Fatalf("status = %d, want 200: %s", rec.Code, rec.Body.String())
			}
			body := decodeAnyJSON(t, rec)
			if body["reviewState"] != tt.want {
				t.Errorf("reviewState = %v, want %q", body["reviewState"], tt.want)
			}
		})
	}
}

// TestPullLookupEndpointNotFound checks an empty pull list answers 404.
func TestPullLookupEndpointNotFound(t *testing.T) {
	now := time.Unix(authTestNowUnix, 0).UTC()
	fake := &fakeRepoActions{router: func(w http.ResponseWriter, _ *http.Request) { _, _ = w.Write([]byte(`[]`)) }}
	handler, sealer := newRepoActionsServer(t, fake, now)

	rec := serveRepoAction(t, handler, sealer, now, http.MethodGet,
		"/@api/repos/octocat/draft/pulls?head=octocat:opendraft/ada/20260101-120000", nil)

	if rec.Code != http.StatusNotFound {
		t.Fatalf("status = %d, want 404: %s", rec.Code, rec.Body.String())
	}
	body := decodeJSON(t, rec)
	if body["error"] != errorCode {
		t.Errorf("error = %q, want %q", body["error"], errorCode)
	}
}

// TestPullLookupEndpointRejectsInvalidHead checks an invalid or unqualified head
// is rejected before any GitHub call: GitHub ignores an unqualified head filter.
func TestPullLookupEndpointRejectsInvalidHead(t *testing.T) {
	now := time.Unix(authTestNowUnix, 0).UTC()
	for _, head := range []string{"bad%20head", "od-lamurian/add-abstract"} {
		t.Run(head, func(t *testing.T) {
			fake := &fakeRepoActions{router: func(w http.ResponseWriter, _ *http.Request) { w.WriteHeader(http.StatusOK) }}
			handler, sealer := newRepoActionsServer(t, fake, now)
			rec := serveRepoAction(t, handler, sealer, now, http.MethodGet,
				"/@api/repos/octocat/draft/pulls?head="+head, nil)

			if rec.Code != http.StatusBadRequest {
				t.Fatalf("status = %d, want 400: %s", rec.Code, rec.Body.String())
			}
			body := decodeJSON(t, rec)
			if body["error"] != invalidRequestCode || body["field"] != headField {
				t.Errorf("body = %v, want field %q", body, headField)
			}
			if fake.count() != 0 {
				t.Errorf("GitHub received %d requests, want 0", fake.count())
			}
		})
	}
}

// TestMergeUpstreamEndpoint checks a successful upstream merge answers merged
// true and a GitHub conflict maps to 409 conflict.
func TestMergeUpstreamEndpoint(t *testing.T) {
	now := time.Unix(authTestNowUnix, 0).UTC()
	tests := []struct {
		name       string
		status     int
		wantStatus int
		wantCode   string
	}{
		{name: "merged", status: http.StatusOK, wantStatus: http.StatusOK},
		{name: "conflict", status: http.StatusConflict, wantStatus: http.StatusConflict, wantCode: conflictCode},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			fake := &fakeRepoActions{router: func(w http.ResponseWriter, r *http.Request) {
				if r.URL.Path != "/repos/octocat/draft/merge-upstream" {
					t.Errorf("path = %q", r.URL.Path)
				}
				w.WriteHeader(tt.status)
				_, _ = w.Write([]byte(`{"message":"upstream detail"}`))
			}}
			handler, sealer := newRepoActionsServer(t, fake, now)

			rec := serveRepoAction(t, handler, sealer, now, http.MethodPost,
				"/@api/repos/octocat/draft/merge-upstream", map[string]any{"branch": "main"})

			if rec.Code != tt.wantStatus {
				t.Fatalf("status = %d, want %d: %s", rec.Code, tt.wantStatus, rec.Body.String())
			}
			body := decodeAnyJSON(t, rec)
			if tt.wantCode == "" {
				if body["merged"] != true {
					t.Errorf("body = %v, want merged true", body)
				}
				return
			}
			if body["error"] != tt.wantCode {
				t.Errorf("body = %v, want error %q", body, tt.wantCode)
			}
		})
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
		{name: "branches", method: http.MethodGet, path: "/@api/repos/octocat/draft/branches?prefix=opendraft/ada/"},
		{name: "pulls", method: http.MethodGet, path: "/@api/repos/octocat/draft/pulls?head=octocat:opendraft/ada/20260101-120000"},
		{name: "merge-upstream", method: http.MethodPost, path: "/@api/repos/octocat/draft/merge-upstream"},
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
