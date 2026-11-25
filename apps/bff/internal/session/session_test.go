package session

import (
	"encoding/base64"
	"errors"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
	"time"
)

const writeFailed = "Write: %v"

func newTestSealer(t *testing.T) *Sealer {
	t.Helper()
	sealer, err := NewSealer(testKey(t, 0x5a), nil)
	if err != nil {
		t.Fatalf("NewSealer: %v", err)
	}
	return sealer
}

func sampleSession(issued time.Time) Session {
	return Session{
		Login:            "octocat",
		ID:               583231,
		Name:             "The Octocat",
		AccessToken:      "ghu_access_token_value",
		AccessExpiresAt:  issued.Add(8 * time.Hour),
		RefreshToken:     "ghr_refresh_token_value",
		RefreshExpiresAt: issued.Add(180 * 24 * time.Hour),
		IssuedAt:         issued,
	}
}

func readSessionCookie(t *testing.T, w *httptest.ResponseRecorder) *http.Cookie {
	t.Helper()
	cookies := w.Result().Cookies()
	for _, cookie := range cookies {
		if cookie.Name == CookieName {
			return cookie
		}
	}
	t.Fatalf("response did not set %s; got %d cookies", CookieName, len(cookies))
	return nil
}

func TestWriteSetsSecureCookieAttributes(t *testing.T) {
	sealer := newTestSealer(t)
	now := time.Date(2024, 5, 1, 12, 0, 0, 0, time.UTC)
	w := httptest.NewRecorder()

	if err := Write(w, sealer, sampleSession(now), now); err != nil {
		t.Fatalf(writeFailed, err)
	}
	cookie := readSessionCookie(t, w)

	if cookie.Name != "__Host-od_session" {
		t.Fatalf("cookie name = %q, want __Host-od_session", cookie.Name)
	}
	if cookie.Path != "/" {
		t.Fatalf("cookie path = %q, want /", cookie.Path)
	}
	if !cookie.Secure {
		t.Fatal("cookie is not Secure")
	}
	if !cookie.HttpOnly {
		t.Fatal("cookie is not HttpOnly")
	}
	if cookie.SameSite != http.SameSiteLaxMode {
		t.Fatalf("cookie SameSite = %v, want Lax", cookie.SameSite)
	}
	if cookie.Value == "" {
		t.Fatal("cookie value is empty")
	}
}

func TestWriteMaxAgeIsRemainingLifetime(t *testing.T) {
	sealer := newTestSealer(t)
	issued := time.Date(2024, 5, 1, 12, 0, 0, 0, time.UTC)

	cases := []struct {
		now  time.Time
		name string
		want int
	}{
		{issued, "fresh", int((7 * 24 * time.Hour) / time.Second)},
		{issued.Add(time.Hour), "one hour later", int((7*24*time.Hour - time.Hour) / time.Second)},
		{issued.Add(7 * 24 * time.Hour), "almost expired", 0},
		{issued.Add(8 * 24 * time.Hour), "past lifetime", 0},
	}
	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			w := httptest.NewRecorder()
			if err := Write(w, sealer, sampleSession(issued), tc.now); err != nil {
				t.Fatalf(writeFailed, err)
			}
			if got := readSessionCookie(t, w).MaxAge; got != tc.want {
				t.Fatalf("MaxAge = %d, want %d", got, tc.want)
			}
		})
	}
}

func TestWriteThenReadRoundTrip(t *testing.T) {
	sealer := newTestSealer(t)
	now := time.Date(2024, 5, 1, 12, 0, 0, 0, time.UTC)
	want := sampleSession(now)

	w := httptest.NewRecorder()
	if err := Write(w, sealer, want, now); err != nil {
		t.Fatalf(writeFailed, err)
	}
	r := httptest.NewRequest(http.MethodGet, "/", nil)
	r.AddCookie(readSessionCookie(t, w))

	got, err := Read(r, sealer, now.Add(time.Hour))
	if err != nil {
		t.Fatalf("Read: %v", err)
	}
	if got.Login != want.Login || got.ID != want.ID || got.Name != want.Name {
		t.Fatalf("Read identity = %+v, want %+v", got, want)
	}
	if got.AccessToken != want.AccessToken || got.RefreshToken != want.RefreshToken {
		t.Fatal("Read did not restore the tokens")
	}
}

func TestCookieValueHidesTokens(t *testing.T) {
	sealer := newTestSealer(t)
	now := time.Date(2024, 5, 1, 12, 0, 0, 0, time.UTC)
	sess := sampleSession(now)

	w := httptest.NewRecorder()
	if err := Write(w, sealer, sess, now); err != nil {
		t.Fatalf(writeFailed, err)
	}
	value := readSessionCookie(t, w).Value

	if strings.Contains(value, sess.AccessToken) {
		t.Fatal("cookie value contains the access token in plaintext")
	}
	if strings.Contains(value, sess.RefreshToken) {
		t.Fatal("cookie value contains the refresh token in plaintext")
	}
	if strings.Contains(value, sess.Login) {
		t.Fatal("cookie value contains the login in plaintext")
	}
}

func TestReadMissingOrInvalidCookie(t *testing.T) {
	sealer := newTestSealer(t)
	now := time.Date(2024, 5, 1, 12, 0, 0, 0, time.UTC)

	w := httptest.NewRecorder()
	if err := Write(w, sealer, sampleSession(now), now); err != nil {
		t.Fatalf(writeFailed, err)
	}
	valid := readSessionCookie(t, w).Value

	otherSealer, err := NewSealer(testKey(t, 0x6b), nil)
	if err != nil {
		t.Fatalf("NewSealer other: %v", err)
	}
	foreign, err := otherSealer.Seal([]byte(`{"login":"attacker","issued_at":"2024-05-01T12:00:00Z"}`))
	if err != nil {
		t.Fatalf("Seal foreign: %v", err)
	}
	garbage, err := sealer.Seal([]byte("not json"))
	if err != nil {
		t.Fatalf("Seal garbage: %v", err)
	}
	raw, err := base64.RawURLEncoding.DecodeString(valid)
	if err != nil {
		t.Fatalf("decode valid: %v", err)
	}
	raw[len(raw)-1] ^= 0xff
	tampered := base64.RawURLEncoding.EncodeToString(raw)

	cases := map[string]string{
		"missing":     "",
		"empty":       " ",
		"not-base64":  "!!!not-base64!!!",
		"tampered":    tampered,
		"unknown-key": foreign,
		"not-json":    garbage,
	}
	for name, value := range cases {
		t.Run(name, func(t *testing.T) {
			r := httptest.NewRequest(http.MethodGet, "/", nil)
			if name != "missing" {
				r.AddCookie(&http.Cookie{Name: CookieName, Value: value})
			}
			if _, err := Read(r, sealer, now); !errors.Is(err, ErrNoSession) {
				t.Fatalf("Read record %s error = %v, want ErrNoSession", name, err)
			}
		})
	}
}

func TestReadRejectsOldSessions(t *testing.T) {
	sealer := newTestSealer(t)
	issued := time.Date(2024, 5, 1, 12, 0, 0, 0, time.UTC)

	w := httptest.NewRecorder()
	if err := Write(w, sealer, sampleSession(issued), issued); err != nil {
		t.Fatalf(writeFailed, err)
	}
	cookie := readSessionCookie(t, w)

	cases := []struct {
		now     time.Time
		wantErr error
		name    string
	}{
		{issued.Add(6 * 24 * time.Hour), nil, "within lifetime"},
		{issued.Add(7*24*time.Hour - time.Second), nil, "just before lifetime"},
		{issued.Add(7 * 24 * time.Hour), ErrExpired, "at lifetime"},
		{issued.Add(7*24*time.Hour + time.Second), ErrExpired, "past lifetime"},
	}
	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			r := httptest.NewRequest(http.MethodGet, "/", nil)
			r.AddCookie(cookie)
			_, err := Read(r, sealer, tc.now)
			if tc.wantErr == nil {
				if err != nil {
					t.Fatalf("Read error = %v, want nil", err)
				}
				return
			}
			if !errors.Is(err, tc.wantErr) {
				t.Fatalf("Read error = %v, want %v", err, tc.wantErr)
			}
		})
	}
}

func TestReadRejectsExpiredRefreshToken(t *testing.T) {
	sealer := newTestSealer(t)
	issued := time.Date(2024, 5, 1, 12, 0, 0, 0, time.UTC)

	cases := []struct {
		refreshExpiresAt time.Time
		now              time.Time
		wantErr          error
		name             string
	}{
		{issued.Add(48 * time.Hour), issued.Add(time.Hour), nil, "refresh still valid"},
		{issued.Add(2 * time.Hour), issued.Add(3 * time.Hour), ErrExpired, "refresh expired"},
		{time.Time{}, issued.Add(24 * time.Hour), nil, "refresh missing"},
	}
	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			sess := sampleSession(issued)
			sess.RefreshExpiresAt = tc.refreshExpiresAt

			w := httptest.NewRecorder()
			if err := Write(w, sealer, sess, issued); err != nil {
				t.Fatalf(writeFailed, err)
			}
			r := httptest.NewRequest(http.MethodGet, "/", nil)
			r.AddCookie(readSessionCookie(t, w))

			_, err := Read(r, sealer, tc.now)
			if tc.wantErr == nil {
				if err != nil {
					t.Fatalf("Read error = %v, want nil", err)
				}
				return
			}
			if !errors.Is(err, tc.wantErr) {
				t.Fatalf("Read error = %v, want %v", err, tc.wantErr)
			}
		})
	}
}

func TestClearExpiresCookie(t *testing.T) {
	w := httptest.NewRecorder()
	Clear(w)
	cookie := readSessionCookie(t, w)

	if cookie.Name != CookieName {
		t.Fatalf("cookie name = %q, want %q", cookie.Name, CookieName)
	}
	if cookie.Value != "" {
		t.Fatalf("cookie value = %q, want empty", cookie.Value)
	}
	if cookie.MaxAge != -1 {
		t.Fatalf("cookie MaxAge = %d, want -1", cookie.MaxAge)
	}
	if cookie.Path != "/" || !cookie.Secure || !cookie.HttpOnly || cookie.SameSite != http.SameSiteLaxMode {
		t.Fatalf("cookie attributes = %+v, want Path=/ Secure HttpOnly Lax", cookie)
	}
}
