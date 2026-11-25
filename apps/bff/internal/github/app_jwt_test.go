package github

import (
	"crypto"
	"crypto/rand"
	"crypto/rsa"
	"crypto/sha256"
	"encoding/base64"
	"encoding/json"
	"strings"
	"testing"
	"time"
)

// newAppKey generates a throwaway RSA key for app JWT tests.
func newAppKey(t *testing.T) *rsa.PrivateKey {
	t.Helper()
	key, err := rsa.GenerateKey(rand.Reader, 2048)
	if err != nil {
		t.Fatalf("GenerateKey: %v", err)
	}
	return key
}

// decodeJWTPart decodes one unpadded base64url JWT segment into v.
func decodeJWTPart(t *testing.T, segment string, v any) {
	t.Helper()
	raw, err := base64.RawURLEncoding.DecodeString(segment)
	if err != nil {
		t.Fatalf("decode jwt segment: %v", err)
	}
	if err := json.Unmarshal(raw, v); err != nil {
		t.Fatalf("unmarshal jwt segment: %v", err)
	}
}

// TestAppJWTVerifiesSignature checks the token shape and RS256 signature.
func TestAppJWTVerifiesSignature(t *testing.T) {
	key := newAppKey(t)
	now := time.Unix(1700000000, 0)
	client := &Client{ClientID: testClientID, AppKey: key, Now: func() time.Time { return now }}

	parts := strings.Split(mustAppJWT(t, client), ".")
	if len(parts) != 3 {
		t.Fatalf("token segments = %d, want 3", len(parts))
	}

	var header appJWTHeader
	decodeJWTPart(t, parts[0], &header)
	if header.Alg != "RS256" || header.Typ != "JWT" {
		t.Fatalf("header = %+v, want alg RS256 typ JWT", header)
	}

	signature, err := base64.RawURLEncoding.DecodeString(parts[2])
	if err != nil {
		t.Fatalf("decode signature: %v", err)
	}
	digest := sha256.Sum256([]byte(parts[0] + "." + parts[1]))
	if err := rsa.VerifyPKCS1v15(&key.PublicKey, crypto.SHA256, digest[:], signature); err != nil {
		t.Fatalf("VerifyPKCS1v15: %v", err)
	}
}

// TestAppJWTClaims checks iss, iat and exp relative to the configured clock.
func TestAppJWTClaims(t *testing.T) {
	key := newAppKey(t)
	now := time.Unix(1700000000, 0)
	client := &Client{ClientID: testClientID, AppKey: key, Now: func() time.Time { return now }}

	parts := strings.Split(mustAppJWT(t, client), ".")
	var claims appJWTClaims
	decodeJWTPart(t, parts[1], &claims)

	if claims.Iss != client.ClientID {
		t.Fatalf("iss = %q, want %q", claims.Iss, client.ClientID)
	}
	if claims.Iat != now.Add(-60*time.Second).Unix() {
		t.Fatalf("iat = %d, want %d", claims.Iat, now.Add(-60*time.Second).Unix())
	}
	if claims.Exp != now.Add(9*time.Minute).Unix() {
		t.Fatalf("exp = %d, want %d", claims.Exp, now.Add(9*time.Minute).Unix())
	}
}

// TestAppJWTCache checks reuse, re-minting and the missing-key error.
func TestAppJWTCache(t *testing.T) {
	key := newAppKey(t)
	now := time.Unix(1700000000, 0)
	client := &Client{ClientID: testClientID, AppKey: key, Now: func() time.Time { return now }}

	first := mustAppJWT(t, client)
	now = now.Add(7 * time.Minute)
	if second := mustAppJWT(t, client); second != first {
		t.Fatal("token was re-minted while more than 60s remained")
	}

	now = now.Add(2*time.Minute - 30*time.Second)
	if third := mustAppJWT(t, client); third == first {
		t.Fatal("token was reused with 30s or less of validity left")
	}

	noKey := &Client{ClientID: testClientID, Now: func() time.Time { return now }}
	if _, err := noKey.AppJWT(); err == nil {
		t.Fatal("AppJWT without AppKey returned no error")
	}
}

// mustAppJWT returns the app JWT or fails the test.
func mustAppJWT(t *testing.T, client *Client) string {
	t.Helper()
	token, err := client.AppJWT()
	if err != nil {
		t.Fatalf("AppJWT: %v", err)
	}
	return token
}
