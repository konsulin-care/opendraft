package github

import (
	"context"
	"net/http"
	"net/http/httptest"
	"testing"
	"time"
)

// TestLatestPullIncludesHeadSHA checks LatestPull copies the pull request head
// sha into PullInfo.HeadSHA.
func TestLatestPullIncludesHeadSHA(t *testing.T) {
	fake := &fakeActions{router: func(w http.ResponseWriter, r *http.Request) {
		if r.URL.Path == testReviewsPath12 {
			_, _ = w.Write([]byte(testEmptyJSON))
			return
		}
		_, _ = w.Write([]byte(`[{"number":12,"html_url":"` + pullURL + `","state":"open","merged_at":null,"head":{"label":"` + testPaperHead + `","sha":"abc123def456"}}]`))
	}}
	server := httptest.NewServer(fake.handler())
	t.Cleanup(server.Close)

	pull, found, err := testClient(server.URL, time.Now()).LatestPull(context.Background(), testToken, testOwner, testRepo, testPaperHead)
	if err != nil {
		t.Fatalf(latestPullFailed, err)
	}
	if !found {
		t.Fatal("found = false, want true")
	}
	if pull.HeadSHA != "abc123def456" {
		t.Errorf("HeadSHA = %q, want abc123def456", pull.HeadSHA)
	}
}

// TestLatestPullWithoutHeadSHA checks a fixture without head.sha yields an empty
// HeadSHA without failing.
func TestLatestPullWithoutHeadSHA(t *testing.T) {
	fake := &fakeActions{router: func(w http.ResponseWriter, r *http.Request) {
		if r.URL.Path == testReviewsPath12 {
			_, _ = w.Write([]byte(testEmptyJSON))
			return
		}
		_, _ = w.Write([]byte(`[{"number":12,"html_url":"` + pullURL + `","state":"open","merged_at":null,"head":{"label":"` + testPaperHead + `"}}]`))
	}}
	server := httptest.NewServer(fake.handler())
	t.Cleanup(server.Close)

	pull, found, err := testClient(server.URL, time.Now()).LatestPull(context.Background(), testToken, testOwner, testRepo, testPaperHead)
	if err != nil {
		t.Fatalf(latestPullFailed, err)
	}
	if !found {
		t.Fatal("found = false, want true")
	}
	if pull.HeadSHA != "" {
		t.Errorf("HeadSHA = %q, want empty", pull.HeadSHA)
	}
}
