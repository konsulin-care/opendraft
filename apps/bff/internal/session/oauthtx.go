package session

import (
	"encoding/json"
	"fmt"
	"net/http"
	"time"
)

const (
	// TxCookieName is the browser cookie holding the sealed OAuth transaction.
	TxCookieName = "__Host-od_oauth"
	// TxMaxAge is the lifetime in seconds of an OAuth transaction cookie.
	TxMaxAge = 600
)

// Tx is the short-lived OAuth transaction stored in the sealed cookie between
// the login redirect and the callback.
type Tx struct {
	// State is the random anti-CSRF state sent to GitHub.
	State string `json:"state"`
	// Verifier is the PKCE code verifier for the authorization code exchange.
	Verifier string `json:"verifier"`
	// ReturnTo is the same-origin path to send the browser to after login.
	ReturnTo string `json:"return_to"`
	// ExpiresAt is when the transaction stops being usable.
	ExpiresAt time.Time `json:"expires_at"`
}

// WriteTx seals tx and sets the OAuth transaction cookie on w with a Max-Age
// of TxMaxAge seconds.
func WriteTx(w http.ResponseWriter, s *Sealer, tx Tx) error {
	plaintext, err := json.Marshal(tx)
	if err != nil {
		return fmt.Errorf("session: marshal oauth tx: %w", err)
	}
	value, err := s.Seal(plaintext)
	if err != nil {
		return fmt.Errorf("session: seal oauth tx: %w", err)
	}
	cookie := newTxCookie(value)
	cookie.MaxAge = TxMaxAge
	http.SetCookie(w, cookie)
	return nil
}

// ReadTx opens and validates the OAuth transaction cookie on r. It returns
// ErrNoSession when the cookie is missing or not openable and ErrExpired when
// the transaction passed its ExpiresAt.
func ReadTx(r *http.Request, s *Sealer, now time.Time) (Tx, error) {
	cookie, err := r.Cookie(TxCookieName)
	if err != nil || cookie.Value == "" {
		return Tx{}, ErrNoSession
	}
	plaintext, err := s.Open(cookie.Value)
	if err != nil {
		return Tx{}, ErrNoSession
	}
	var tx Tx
	if err := json.Unmarshal(plaintext, &tx); err != nil {
		return Tx{}, ErrNoSession
	}
	if tx.ExpiresAt.IsZero() {
		return Tx{}, ErrNoSession
	}
	if !now.Before(tx.ExpiresAt) {
		return Tx{}, ErrExpired
	}
	return tx, nil
}

// ClearTx removes the OAuth transaction cookie by setting it to an empty value
// that expires immediately, with the same security attributes as WriteTx.
func ClearTx(w http.ResponseWriter) {
	cookie := newTxCookie("")
	cookie.MaxAge = -1
	http.SetCookie(w, cookie)
}

// newTxCookie returns a cookie with the attributes every OAuth transaction
// cookie shares.
func newTxCookie(value string) *http.Cookie {
	return &http.Cookie{
		Name:     TxCookieName,
		Value:    value,
		Path:     "/",
		Secure:   true,
		HttpOnly: true,
		SameSite: http.SameSiteLaxMode,
	}
}
