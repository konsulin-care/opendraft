package config

import (
	"crypto/rand"
	"crypto/rsa"
	"crypto/x509"
	"encoding/pem"
	"strings"
	"testing"
)

// generateTestKey creates a 2048-bit RSA key pair for PEM tests.
func generateTestKey(t *testing.T) *rsa.PrivateKey {
	t.Helper()
	key, err := rsa.GenerateKey(rand.Reader, 2048)
	if err != nil {
		t.Fatalf("rsa.GenerateKey: %v", err)
	}
	return key
}

// TestParseAppPrivateKeyPKCS1 verifies a PKCS#1 PEM value is accepted.
func TestParseAppPrivateKeyPKCS1(t *testing.T) {
	key := generateTestKey(t)
	encoded := pem.EncodeToMemory(&pem.Block{
		Type:  blockTypePKCS1,
		Bytes: x509.MarshalPKCS1PrivateKey(key),
	})

	parsed, err := ParseAppPrivateKey(string(encoded))
	if err != nil {
		t.Fatalf("ParseAppPrivateKey returned error: %v", err)
	}
	if parsed == nil {
		t.Fatal("ParseAppPrivateKey returned nil key for PKCS#1 input")
	}
	if !parsed.Equal(key) {
		t.Error("ParseAppPrivateKey returned a different PKCS#1 key")
	}
}

// TestParseAppPrivateKeyPKCS8 verifies a PKCS#8 PEM value is accepted.
func TestParseAppPrivateKeyPKCS8(t *testing.T) {
	key := generateTestKey(t)
	der, err := x509.MarshalPKCS8PrivateKey(key)
	if err != nil {
		t.Fatalf("x509.MarshalPKCS8PrivateKey: %v", err)
	}
	encoded := pem.EncodeToMemory(&pem.Block{Type: "PRIVATE KEY", Bytes: der})

	parsed, err := ParseAppPrivateKey(string(encoded))
	if err != nil {
		t.Fatalf("ParseAppPrivateKey returned error: %v", err)
	}
	if parsed == nil {
		t.Fatal("ParseAppPrivateKey returned nil key for PKCS#8 input")
	}
	if !parsed.Equal(key) {
		t.Error("ParseAppPrivateKey returned a different PKCS#8 key")
	}
}

// TestParseAppPrivateKeyEscapedNewlines verifies literal \n escapes are expanded.
func TestParseAppPrivateKeyEscapedNewlines(t *testing.T) {
	key := generateTestKey(t)
	encoded := pem.EncodeToMemory(&pem.Block{
		Type:  blockTypePKCS1,
		Bytes: x509.MarshalPKCS1PrivateKey(key),
	})
	escaped := strings.ReplaceAll(string(encoded), "\n", "\\n")

	parsed, err := ParseAppPrivateKey(escaped)
	if err != nil {
		t.Fatalf("ParseAppPrivateKey returned error: %v", err)
	}
	if parsed == nil {
		t.Fatal("ParseAppPrivateKey returned nil key for escaped input")
	}
	if !parsed.Equal(key) {
		t.Error("ParseAppPrivateKey returned a different key for escaped input")
	}
}

// TestParseAppPrivateKeyTrimsSpaces verifies surrounding spaces are ignored.
func TestParseAppPrivateKeyTrimsSpaces(t *testing.T) {
	key := generateTestKey(t)
	encoded := pem.EncodeToMemory(&pem.Block{
		Type:  blockTypePKCS1,
		Bytes: x509.MarshalPKCS1PrivateKey(key),
	})

	parsed, err := ParseAppPrivateKey("  \n\t" + string(encoded) + "\n  ")
	if err != nil {
		t.Fatalf("ParseAppPrivateKey returned error: %v", err)
	}
	if parsed == nil || !parsed.Equal(key) {
		t.Error("ParseAppPrivateKey failed to parse a space-padded value")
	}
}

// TestParseAppPrivateKeyEmpty verifies an empty value yields no key and no error.
func TestParseAppPrivateKeyEmpty(t *testing.T) {
	for _, raw := range []string{"", "   ", "\n\t"} {
		parsed, err := ParseAppPrivateKey(raw)
		if err != nil {
			t.Fatalf("ParseAppPrivateKey(%q) returned error: %v", raw, err)
		}
		if parsed != nil {
			t.Errorf("ParseAppPrivateKey(%q) returned non-nil key", raw)
		}
	}
}

// TestParseAppPrivateKeyInvalid verifies non-PEM and non-RSA input are rejected
// without echoing key material.
func TestParseAppPrivateKeyInvalid(t *testing.T) {
	nonPEM := "not a pem block at all"
	if _, err := ParseAppPrivateKey(nonPEM); err == nil {
		t.Fatal("ParseAppPrivateKey accepted non-PEM input")
	}

	otherKey := generateTestKey(t)
	publicPEM := pem.EncodeToMemory(&pem.Block{
		Type:  "PUBLIC KEY",
		Bytes: mustMarshalPublic(t, otherKey),
	})
	parsed, err := ParseAppPrivateKey(string(publicPEM))
	if err == nil {
		t.Fatal("ParseAppPrivateKey accepted a PUBLIC KEY block")
	}
	if parsed != nil {
		t.Error("ParseAppPrivateKey returned a key for a PUBLIC KEY block")
	}
	if strings.Contains(err.Error(), "BEGIN") || strings.Contains(err.Error(), "MII") {
		t.Errorf("error leaks key material: %v", err)
	}
}

// mustMarshalPublic encodes the PKIX form of an RSA public key.
func mustMarshalPublic(t *testing.T, key *rsa.PrivateKey) []byte {
	t.Helper()
	der, err := x509.MarshalPKIXPublicKey(&key.PublicKey)
	if err != nil {
		t.Fatalf("x509.MarshalPKIXPublicKey: %v", err)
	}
	return der
}
