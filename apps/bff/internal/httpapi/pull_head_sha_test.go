package httpapi

import (
	"net/http"
	"testing"
	"time"
)

// TestPullLookupEndpointHeadSHA checks the pull lookup answers a headSha field
// with the head sha of the matching pull request.
func TestPullLookupEndpointHeadSHA(t *testing.T) {
	now := time.Unix(authTestNowUnix, 0).UTC()
	fake := &fakeRepoActions{router: func(w http.ResponseWriter, r *http.Request) {
		switch r.URL.Path {
		case "/repos/octocat/draft/pulls":
			_, _ = w.Write([]byte(`[{"number":12,"html_url":"https://github.example/octocat/draft/pull/12","state":"open","merged_at":null,"head":{"label":"octocat:od-ada/paper","sha":"abc123def456"}}]`))
		case "/repos/octocat/draft/pulls/12/reviews":
			_, _ = w.Write([]byte(`[]`))
		default:
			t.Errorf("path = %q", r.URL.Path)
		}
	}}
	handler, sealer := newRepoActionsServer(t, fake, now)

	rec := serveRepoAction(t, handler, sealer, now, http.MethodGet,
		"/@api/repos/octocat/draft/pulls?head=octocat:od-ada/paper", nil)

	if rec.Code != http.StatusOK {
		t.Fatalf("status = %d, want 200: %s", rec.Code, rec.Body.String())
	}
	body := decodeAnyJSON(t, rec)
	if body["headSha"] != "abc123def456" {
		t.Errorf("headSha = %v, want abc123def456", body["headSha"])
	}
}

// TestPullLookupEndpointHeadSHAEmpty checks a fixture without head.sha answers an
// empty headSha rather than an error.
func TestPullLookupEndpointHeadSHAEmpty(t *testing.T) {
	now := time.Unix(authTestNowUnix, 0).UTC()
	fake := &fakeRepoActions{router: func(w http.ResponseWriter, r *http.Request) {
		switch r.URL.Path {
		case "/repos/octocat/draft/pulls":
			_, _ = w.Write([]byte(`[{"number":12,"html_url":"https://github.example/octocat/draft/pull/12","state":"open","merged_at":null,"head":{"label":"octocat:od-ada/paper"}}]`))
		case "/repos/octocat/draft/pulls/12/reviews":
			_, _ = w.Write([]byte(`[]`))
		default:
			t.Errorf("path = %q", r.URL.Path)
		}
	}}
	handler, sealer := newRepoActionsServer(t, fake, now)

	rec := serveRepoAction(t, handler, sealer, now, http.MethodGet,
		"/@api/repos/octocat/draft/pulls?head=octocat:od-ada/paper", nil)

	if rec.Code != http.StatusOK {
		t.Fatalf("status = %d, want 200: %s", rec.Code, rec.Body.String())
	}
	body := decodeAnyJSON(t, rec)
	if body["headSha"] != "" {
		t.Errorf("headSha = %v, want empty", body["headSha"])
	}
}
