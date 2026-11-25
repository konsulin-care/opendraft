package github

import (
	"context"
	"errors"
	"net/http"
	"net/http/httptest"
	"testing"
	"time"
)

// TestDeleteBranchSendsAuthenticatedDelete checks DeleteBranch issues an
// authenticated DELETE to the encoded git refs path and returns nil on 204.
func TestDeleteBranchSendsAuthenticatedDelete(t *testing.T) {
	fake := &fakeActions{router: func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusNoContent)
	}}
	server := httptest.NewServer(fake.handler())
	t.Cleanup(server.Close)

	err := testClient(server.URL, time.Now()).DeleteBranch(
		context.Background(), testToken, testOwner, testRepo, testBranchSpaced)
	if err != nil {
		t.Fatalf("DeleteBranch: %v", err)
	}
	calls := fake.snapshot()
	if len(calls) != 1 {
		t.Fatalf("calls = %d, want 1", len(calls))
	}
	call := calls[0]
	if call.method != http.MethodDelete {
		t.Errorf("method = %q, want DELETE", call.method)
	}
	if call.path != deleteBranchPath {
		t.Errorf("path = %q", call.path)
	}
	if call.auth != testBearer {
		t.Errorf("Authorization = %q", call.auth)
	}
}

// TestDeleteBranchIdempotentStatuses checks 404 and 422 are treated as already
// deleted and return nil.
func TestDeleteBranchIdempotentStatuses(t *testing.T) {
	for _, status := range []int{http.StatusNotFound, http.StatusUnprocessableEntity} {
		t.Run(http.StatusText(status), func(t *testing.T) {
			fake := &fakeActions{router: func(w http.ResponseWriter, r *http.Request) {
				w.WriteHeader(status)
			}}
			server := httptest.NewServer(fake.handler())
			t.Cleanup(server.Close)

			if err := testClient(server.URL, time.Now()).DeleteBranch(
				context.Background(), testToken, testOwner, testRepo, testBranch); err != nil {
				t.Fatalf("DeleteBranch status %d: %v", status, err)
			}
		})
	}
}

// TestDeleteBranchErrorMapping checks 401/403 map to ErrForbidden and other
// statuses to ErrUpstream.
func TestDeleteBranchErrorMapping(t *testing.T) {
	for _, status := range []int{http.StatusUnauthorized, http.StatusForbidden} {
		t.Run(http.StatusText(status), func(t *testing.T) {
			fake := &fakeActions{router: func(w http.ResponseWriter, r *http.Request) {
				w.WriteHeader(status)
			}}
			server := httptest.NewServer(fake.handler())
			t.Cleanup(server.Close)

			err := testClient(server.URL, time.Now()).DeleteBranch(
				context.Background(), testToken, testOwner, testRepo, testBranch)
			if !errors.Is(err, ErrForbidden) {
				t.Fatalf("err = %v, want ErrForbidden", err)
			}
		})
	}

	fake := &fakeActions{router: func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusInternalServerError)
	}}
	server := httptest.NewServer(fake.handler())
	t.Cleanup(server.Close)

	err := testClient(server.URL, time.Now()).DeleteBranch(
		context.Background(), testToken, testOwner, testRepo, testBranch)
	if !errors.Is(err, ErrUpstream) {
		t.Fatalf("err = %v, want ErrUpstream", err)
	}
}
