package session

import (
	"bytes"
	"encoding/base64"
	"errors"
	"testing"
)

// testKey returns a deterministic 32-byte key filled with fill.
func testKey(t *testing.T, fill byte) []byte {
	t.Helper()
	return bytes.Repeat([]byte{fill}, keySize)
}

// TestSealOpenRoundTrip checks that Open returns the sealed plaintext.
func TestSealOpenRoundTrip(t *testing.T) {
	current := testKey(t, 0x11)
	sealer, err := NewSealer(current, nil)
	if err != nil {
		t.Fatalf("NewSealer: %v", err)
	}

	plaintext := []byte(`{"login":"octocat","access_token":"secret"}`)
	value, err := sealer.Seal(plaintext)
	if err != nil {
		t.Fatalf("Seal: %v", err)
	}
	got, err := sealer.Open(value)
	if err != nil {
		t.Fatalf("Open: %v", err)
	}
	if !bytes.Equal(got, plaintext) {
		t.Fatalf("Open returned %q, want %q", got, plaintext)
	}
}

// TestSealOpenEmptyPlaintext checks the empty-payload edge case.
func TestSealOpenEmptyPlaintext(t *testing.T) {
	sealer, err := NewSealer(testKey(t, 0x22), nil)
	if err != nil {
		t.Fatalf("NewSealer: %v", err)
	}
	value, err := sealer.Seal(nil)
	if err != nil {
		t.Fatalf("Seal: %v", err)
	}
	got, err := sealer.Open(value)
	if err != nil {
		t.Fatalf("Open: %v", err)
	}
	if len(got) != 0 {
		t.Fatalf("Open returned %q, want empty", got)
	}
}

// TestOpenWithPreviousKey checks that a value sealed by a former current key
// still opens after rotation to a new current key.
func TestOpenWithPreviousKey(t *testing.T) {
	oldKey := testKey(t, 0x33)
	newKey := testKey(t, 0x44)

	oldSealer, err := NewSealer(oldKey, nil)
	if err != nil {
		t.Fatalf("NewSealer old: %v", err)
	}
	plaintext := []byte("rotated session")
	value, err := oldSealer.Seal(plaintext)
	if err != nil {
		t.Fatalf("Seal: %v", err)
	}

	rotated, err := NewSealer(newKey, oldKey)
	if err != nil {
		t.Fatalf("NewSealer rotated: %v", err)
	}
	got, err := rotated.Open(value)
	if err != nil {
		t.Fatalf("Open with previous key: %v", err)
	}
	if !bytes.Equal(got, plaintext) {
		t.Fatalf("Open returned %q, want %q", got, plaintext)
	}
}

// TestOpenRejectsInvalidValues checks that tampered, truncated and unknown-key
// values all return ErrInvalid.
func TestOpenRejectsInvalidValues(t *testing.T) {
	sealer, err := NewSealer(testKey(t, 0x55), nil)
	if err != nil {
		t.Fatalf("NewSealer: %v", err)
	}
	value, err := sealer.Seal([]byte("payload"))
	if err != nil {
		t.Fatalf("Seal: %v", err)
	}
	raw, err := base64.RawURLEncoding.DecodeString(value)
	if err != nil {
		t.Fatalf("decode sealed value: %v", err)
	}

	tampered := append([]byte(nil), raw...)
	tampered[len(tampered)-1] ^= 0xff

	unknown, err := NewSealer(testKey(t, 0x66), nil)
	if err != nil {
		t.Fatalf("NewSealer unknown: %v", err)
	}
	unknownValue, err := unknown.Seal([]byte("payload"))
	if err != nil {
		t.Fatalf("Seal unknown: %v", err)
	}

	cases := map[string]string{
		"tampered":    base64.RawURLEncoding.EncodeToString(tampered),
		"truncated":   base64.RawURLEncoding.EncodeToString(raw[:len(raw)-1]),
		"nonce-only":  base64.RawURLEncoding.EncodeToString(raw[:nonceSize]),
		"empty":       "",
		"not-base64":  "!!!not-base64!!!",
		"unknown-key": unknownValue,
	}
	for name, input := range cases {
		t.Run(name, func(t *testing.T) {
			got, err := sealer.Open(input)
			if !errors.Is(err, ErrInvalid) {
				t.Fatalf("Open(%s) error = %v, want ErrInvalid", name, err)
			}
			if got != nil {
				t.Fatalf("Open(%s) returned %q, want nil", name, got)
			}
		})
	}
}

// TestNewSealerRejectsBadKeyLength checks key-size validation for both keys.
func TestNewSealerRejectsBadKeyLength(t *testing.T) {
	if _, err := NewSealer([]byte("short"), nil); err == nil {
		t.Fatal("NewSealer accepted a short current key")
	}
	if _, err := NewSealer(testKey(t, 0x77), []byte("short")); err == nil {
		t.Fatal("NewSealer accepted a short previous key")
	}
}

// TestSealUsesRandomNonce checks that two seals of the same plaintext differ.
func TestSealUsesRandomNonce(t *testing.T) {
	sealer, err := NewSealer(testKey(t, 0x88), nil)
	if err != nil {
		t.Fatalf("NewSealer: %v", err)
	}
	first, err := sealer.Seal([]byte("same"))
	if err != nil {
		t.Fatalf("Seal first: %v", err)
	}
	second, err := sealer.Seal([]byte("same"))
	if err != nil {
		t.Fatalf("Seal second: %v", err)
	}
	if first == second {
		t.Fatal("two seals of the same plaintext produced identical values")
	}
}

// TestSealNonceSize checks the encoded layout is nonce || ciphertext.
func TestSealNonceSize(t *testing.T) {
	sealer, err := NewSealer(testKey(t, 0x99), nil)
	if err != nil {
		t.Fatalf("NewSealer: %v", err)
	}
	plaintext := []byte("12345")
	value, err := sealer.Seal(plaintext)
	if err != nil {
		t.Fatalf("Seal: %v", err)
	}
	raw, err := base64.RawURLEncoding.DecodeString(value)
	if err != nil {
		t.Fatalf("decode: %v", err)
	}
	// GCM appends a 16-byte tag to the ciphertext.
	want := nonceSize + len(plaintext) + 16
	if len(raw) != want {
		t.Fatalf("sealed length = %d, want %d", len(raw), want)
	}
}
