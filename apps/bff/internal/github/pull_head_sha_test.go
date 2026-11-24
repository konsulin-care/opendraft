package github

import (
	"context"
	"net/http"
	"net/http/httptest"
	"testing"
	"time"
)

// TestLatestPullHeadSHA checks LatestPull copies the pull request head sha into
// PullInfo.HeadSHA when the fixture carries it, and leaves it empty when the
// fixture omits it.
func TestLatestPullHeadSHA(t *testing.T) {
	tests := []struct {
		name    string
		headSHA string
		wantSHA string
	}{
		{name: "with sha", headSHA: `,"sha":"abc123def456"`, wantSHA: "abc123def456"},
		{name: "without sha", headSHA: "", wantSHA: ""},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			body := `[{"number":12,"html_url":"` + pullURL + `","state":"open","merged_at":null,"head":{"label":"` +
				testPaperHead + `"` + tt.headSHA + `}}]`
			fake := &fakeActions{router: func(w http.ResponseWriter, r *http.Request) {
				if r.URL.Path == testReviewsPath12 {
					_, _ = w.Write([]byte(testEmptyJSON))
					return
				}
				_, _ = w.Write([]byte(body))
			}}
			server := httptest.NewServer(fake.handler())
			t.Cleanup(server.Close)

			pull, found, err := testClient(server.URL, time.Now()).
				LatestPull(context.Background(), testToken, testOwner, testRepo, testPaperHead)
			if err != nil {
				t.Fatalf(latestPullFailed, err)
			}
			if !found {
				t.Fatal("found = false, want true")
			}
			if pull.HeadSHA != tt.wantSHA {
				t.Errorf("HeadSHA = %q, want %q", pull.HeadSHA, tt.wantSHA)
			}
		})
	}
}
