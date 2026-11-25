package config

import (
	"crypto/rsa"
	"crypto/x509"
	"encoding/pem"
	"errors"
	"fmt"
	"strings"
)

// blockTypePKCS1 is the PEM block type of a PKCS#1 RSA private key, which is
// what GitHub's dashboard download produces.
const blockTypePKCS1 = "RSA PRIVATE KEY"

// blockTypePKCS8 is the PEM block type of a PKCS#8 private key.
const blockTypePKCS8 = "PRIVATE KEY"

// escapedNewline is the two-character sequence some deployments use instead of
// a real line break when storing a PEM value in a single environment variable.
const escapedNewline = `\n`

// realNewline is the character escapedNewline is replaced with.
const realNewline = "\n"

// ErrAppPrivateKey is the sentinel wrapped by every ParseAppPrivateKey failure
// so callers can detect a malformed key with errors.Is.
var ErrAppPrivateKey = errors.New("invalid app private key")

// ParseAppPrivateKey decodes a PEM-encoded RSA private key for the GitHub App.
// The value is trimmed first; an empty value yields (nil, nil) so callers can
// treat the key as optional. When the value has no real newline but contains
// the literal sequence `\n`, those sequences are expanded to newlines before
// decoding. Both PKCS#1 ("RSA PRIVATE KEY") and PKCS#8 ("PRIVATE KEY") blocks
// are accepted. Errors never contain key material.
func ParseAppPrivateKey(raw string) (*rsa.PrivateKey, error) {
	value := strings.TrimSpace(raw)
	if value == "" {
		return nil, nil
	}
	if !strings.Contains(value, realNewline) && strings.Contains(value, escapedNewline) {
		value = strings.ReplaceAll(value, escapedNewline, realNewline)
	}

	block, _ := pem.Decode([]byte(value))
	if block == nil {
		return nil, fmt.Errorf("%w: no PEM block found", ErrAppPrivateKey)
	}

	switch block.Type {
	case blockTypePKCS1:
		key, err := x509.ParsePKCS1PrivateKey(block.Bytes)
		if err != nil {
			return nil, fmt.Errorf("%w: cannot parse PKCS#1 key", ErrAppPrivateKey)
		}
		if key == nil {
			return nil, fmt.Errorf("%w: empty PKCS#1 key", ErrAppPrivateKey)
		}
		return key, nil
	case blockTypePKCS8:
		parsed, err := x509.ParsePKCS8PrivateKey(block.Bytes)
		if err != nil {
			return nil, fmt.Errorf("%w: cannot parse PKCS#8 key", ErrAppPrivateKey)
		}
		key, ok := parsed.(*rsa.PrivateKey)
		if !ok {
			return nil, fmt.Errorf("%w: PKCS#8 key is not RSA", ErrAppPrivateKey)
		}
		return key, nil
	default:
		return nil, fmt.Errorf("%w: unsupported PEM block type %q", ErrAppPrivateKey, block.Type)
	}
}
