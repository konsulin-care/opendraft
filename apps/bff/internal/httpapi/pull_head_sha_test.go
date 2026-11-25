package httpapi

import (
	"net/http"
	"testing"
	"time"
)

// TestPullLookupEndpoint checks the pull lookup returns the number, URL and
// state of the newest matching pull request.
func TestPullLookupEndpoint(t *testing.T) {
	now := time.Unix(authTestNowUnix, 0).UTC()
	fake := &fakeRepoActions{router: func(w http.ResponseWriter, r *http.Request) {
		switch r.URL.Path {
		case testPullsPath:
			if head := r.URL.Query().Get("head"); head != testPullHead {
				t.Errorf("head = %q", head)
			}
			_, _ = w.Write([]byte(`[{"number":12,"html_url":"https://github.example/octocat/draft/pull/12","state":"open","merged_at":null,"head":{"label":"octocat:opendraft/ada/20260101-120000"}}]`))
		case testReviewsPath:
			_, _ = w.Write([]byte(`[]`))
		default:
			t.Errorf("path = %q", r.URL.Path)
		}
	}}
	handler, sealer := newRepoActionsServer(t, fake, now)

	rec := serveRepoAction(t, handler, sealer, now, http.MethodGet, testPullLookupPath, nil)

	body := decodePullLookup(t, rec)
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
			fake := newPullLookupFake(t,
				`[{"number":12,"html_url":"https://github.example/octocat/draft/pull/12","state":"open","merged_at":null,"head":{"label":"octocat:opendraft/ada/20260101-120000"}}]`,
				tt.reviews)
			handler, sealer := newRepoActionsServer(t, fake, now)

			rec := serveRepoAction(t, handler, sealer, now, http.MethodGet, testPullLookupPath, nil)

			body := decodePullLookup(t, rec)
			if body["reviewState"] != tt.want {
				t.Errorf("reviewState = %v, want %q", body["reviewState"], tt.want)
			}
		})
	}
}

// TestPullLookupEndpointNotFound checks an empty pull list answers 404.
func TestPullLookupEndpointNotFound(t *testing.T) {
	now := time.Unix(authTestNowUnix, 0).UTC()
	fake := newPullLookupFake(t, `[]`, `[]`)
	handler, sealer := newRepoActionsServer(t, fake, now)

	rec := serveRepoAction(t, handler, sealer, now, http.MethodGet, testPullLookupPath, nil)

	if rec.Code != http.StatusNotFound {
		t.Fatalf("status = %d, want 404: %s", rec.Code, rec.Body.String())
	}
	body := decodeJSON(t, rec)
	if body[errorKey] != errorCode {
		t.Errorf("error = %q, want %q", body[errorKey], errorCode)
	}
}

// TestPullLookupEndpointRejectsInvalidHead checks an invalid or unqualified head
// is rejected before any GitHub call: GitHub ignores an unqualified head filter.
func TestPullLookupEndpointRejectsInvalidHead(t *testing.T) {
	now := time.Unix(authTestNowUnix, 0).UTC()
	for _, head := range []string{"bad%20head", "od-lamurian/add-abstract"} {
		t.Run(head, func(t *testing.T) {
			assertRejectedRepoAction(t, now, http.MethodGet,
				testPullLookupPrefix+head, headField)
		})
	}
}

// TestPullLookupEndpointHeadSHA checks the pull lookup answers a headSha field
// with the head sha of the matching pull request, or an empty headSha when
// GitHub omits it.
func TestPullLookupEndpointHeadSHA(t *testing.T) {
	now := time.Unix(authTestNowUnix, 0).UTC()
	tests := []struct {
		name     string
		pullJSON string
		wantSHA  string
	}{
		{
			name:     "with sha",
			pullJSON: `[{"number":12,"html_url":"https://github.example/octocat/draft/pull/12","state":"open","merged_at":null,"head":{"label":"octocat:od-ada/paper","sha":"abc123def456"}}]`,
			wantSHA:  "abc123def456",
		},
		{
			name:     "without sha",
			pullJSON: `[{"number":12,"html_url":"https://github.example/octocat/draft/pull/12","state":"open","merged_at":null,"head":{"label":"octocat:od-ada/paper"}}]`,
			wantSHA:  "",
		},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			fake := newPullLookupFake(t, tt.pullJSON, `[]`)
			handler, sealer := newRepoActionsServer(t, fake, now)

			rec := serveRepoAction(t, handler, sealer, now, http.MethodGet,
				testPullLookupPrefix+testOwner+":od-ada/paper", nil)

			body := decodePullLookup(t, rec)
			if body["headSha"] != tt.wantSHA {
				t.Errorf("headSha = %v, want %q", body["headSha"], tt.wantSHA)
			}
		})
	}
}
