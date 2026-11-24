package session

import (
	"encoding/json"
	"errors"
	"fmt"
	"net/http"
	"time"
)

const (
	// CookieName is the browser cookie holding the sealed session.
	CookieName = "__Host-od_session"
	// MaxLifetime is the absolute lifetime of a session from IssuedAt.
	MaxLifetime = 7 * 24 * time.Hour
)

// ErrNoSession is returned by Read when the request carries no usable session
// cookie. Callers treat it as "anonymous".
var ErrNoSession = errors.New("session: no session")

// ErrExpired is returned by Read when a sealed session exists but its absolute
// lifetime or its refresh token has expired.
var ErrExpired = errors.New("session: session expired")

// Session is the authenticated identity stored in the sealed cookie. Tokens
// never leave the server in plaintext; the cookie value is AES-256-GCM sealed.
type Session struct {
	AccessExpiresAt  time.Time `json:"access_expires_at"`
	RefreshExpiresAt time.Time `json:"refresh_expires_at"`
	IssuedAt         time.Time `json:"issued_at"`
	Login            string    `json:"login"`
	Name             string    `json:"name"`
	AccessToken      string    `json:"access_token"`
	RefreshToken     string    `json:"refresh_token"`
	ID               int64     `json:"id"`
}

// Write seals sess and sets the session cookie on w. MaxAge is the remaining
// absolute lifetime so the browser drops the cookie when the session expires.
func Write(w http.ResponseWriter, s *Sealer, sess Session, now time.Time) error {
	plaintext, err := json.Marshal(sess)
	if err != nil {
		return fmt.Errorf("session: marshal session: %w", err)
	}
	value, err := s.Seal(plaintext)
	if err != nil {
		return fmt.Errorf("session: seal session: %w", err)
	}
	cookie := newCookie(value)
	cookie.MaxAge = remainingLifetime(sess, now)
	http.SetCookie(w, cookie)
	return nil
}

// Read opens and validates the session cookie on r. It returns ErrNoSession
// when the cookie is missing or not openable and ErrExpired when the session
// passed its absolute lifetime or its refresh token expired.
func Read(r *http.Request, s *Sealer, now time.Time) (Session, error) {
	cookie, err := r.Cookie(CookieName)
	if err != nil || cookie.Value == "" {
		return Session{}, ErrNoSession
	}
	plaintext, err := s.Open(cookie.Value)
	if err != nil {
		return Session{}, ErrNoSession
	}
	var sess Session
	if err := json.Unmarshal(plaintext, &sess); err != nil {
		return Session{}, ErrNoSession
	}
	if sess.IssuedAt.IsZero() {
		return Session{}, ErrNoSession
	}
	if expired(sess, now) {
		return Session{}, ErrExpired
	}
	return sess, nil
}

// Clear removes the session cookie by setting it to an empty value that
// expires immediately, with the same security attributes as Write.
func Clear(w http.ResponseWriter) {
	cookie := newCookie("")
	cookie.MaxAge = -1
	http.SetCookie(w, cookie)
}

// newCookie returns a cookie with the attributes every session cookie shares.
func newCookie(value string) *http.Cookie {
	return &http.Cookie{
		Name:     CookieName,
		Value:    value,
		Path:     "/",
		Secure:   true,
		HttpOnly: true,
		SameSite: http.SameSiteLaxMode,
	}
}

// remainingLifetime returns the whole seconds left before IssuedAt+MaxLifetime,
// clamped to zero, matching the cookie Max-Age contract.
func remainingLifetime(sess Session, now time.Time) int {
	remaining := sess.IssuedAt.Add(MaxLifetime).Sub(now)
	if remaining <= 0 {
		return 0
	}
	return int(remaining / time.Second)
}

// expired reports whether now is past the absolute lifetime or the refresh
// token expiry. A zero RefreshExpiresAt means the session has no refresh token
// and therefore cannot expire that way.
func expired(sess Session, now time.Time) bool {
	if !now.Before(sess.IssuedAt.Add(MaxLifetime)) {
		return true
	}
	if !sess.RefreshExpiresAt.IsZero() && !now.Before(sess.RefreshExpiresAt) {
		return true
	}
	return false
}
