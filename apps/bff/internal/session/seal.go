// Package session seals and opens authenticated session values with
// AES-256-GCM and supports current/previous key rotation.
package session

import (
	"crypto/aes"
	"crypto/cipher"
	"crypto/rand"
	"encoding/base64"
	"errors"
	"fmt"
)

// ErrInvalid is returned by Open for every failure. Callers must not learn
// whether a value was malformed, tampered with, or sealed with an unknown key.
var ErrInvalid = errors.New("invalid sealed value")

const (
	keySize   = 32
	nonceSize = 12
)

// Sealer seals plaintext with the current key and opens values with either the
// current or the previous key during rotation. It is safe for concurrent use.
type Sealer struct {
	current  cipher.AEAD
	previous cipher.AEAD
}

// NewSealer builds a Sealer from a required current key and an optional
// previous key. Both keys, when present, must be exactly 32 bytes.
func NewSealer(current []byte, previous []byte) (*Sealer, error) {
	currentAEAD, err := newAEAD(current, "current")
	if err != nil {
		return nil, err
	}
	sealer := &Sealer{current: currentAEAD}
	if len(previous) > 0 {
		previousAEAD, err := newAEAD(previous, "previous")
		if err != nil {
			return nil, err
		}
		sealer.previous = previousAEAD
	}
	return sealer, nil
}

// Seal encrypts plaintext with the current key and returns
// base64.RawURLEncoding(nonce || ciphertext).
func (s *Sealer) Seal(plaintext []byte) (string, error) {
	nonce := make([]byte, nonceSize)
	if _, err := rand.Read(nonce); err != nil {
		return "", fmt.Errorf("session: generate nonce: %w", err)
	}
	sealed := s.current.Seal(nonce, nonce, plaintext, nil)
	return base64.RawURLEncoding.EncodeToString(sealed), nil
}

// Open decodes value and tries the current key first, then the previous key.
// Any failure returns ErrInvalid without detail.
func (s *Sealer) Open(value string) ([]byte, error) {
	raw, err := base64.RawURLEncoding.DecodeString(value)
	if err != nil || len(raw) < nonceSize {
		return nil, ErrInvalid
	}
	nonce := raw[:nonceSize]
	ciphertext := raw[nonceSize:]

	if plaintext, err := s.current.Open(nil, nonce, ciphertext, nil); err == nil {
		return plaintext, nil
	}
	if s.previous != nil {
		if plaintext, err := s.previous.Open(nil, nonce, ciphertext, nil); err == nil {
			return plaintext, nil
		}
	}
	return nil, ErrInvalid
}

// newAEAD builds an AES-256-GCM AEAD from a key, validating its length and
// naming the key role in the returned error.
func newAEAD(key []byte, role string) (cipher.AEAD, error) {
	if len(key) != keySize {
		return nil, fmt.Errorf("session: %s key must be exactly %d bytes, got %d", role, keySize, len(key))
	}
	block, err := aes.NewCipher(key)
	if err != nil {
		return nil, fmt.Errorf("session: %s key: %w", role, err)
	}
	aead, err := cipher.NewGCM(block)
	if err != nil {
		return nil, fmt.Errorf("session: %s key: %w", role, err)
	}
	return aead, nil
}
