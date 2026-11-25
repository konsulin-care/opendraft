package github

import (
	"crypto"
	"crypto/rand"
	"crypto/rsa"
	"crypto/sha256"
	"encoding/base64"
	"encoding/json"
	"errors"
	"fmt"
	"sync"
	"time"
)

// appTokenCache holds the most recently minted app JWT until it nears expiry.
type appTokenCache struct {
	expires time.Time
	token   string
	mu      sync.Mutex
}

// errNoAppKey is returned when an app-authenticated call is attempted without
// a configured GitHub App private key.
var errNoAppKey = errors.New("github: app private key not configured")

// appJWTHeader is the fixed JOSE header for GitHub App JWTs.
type appJWTHeader struct {
	Alg string `json:"alg"`
	Typ string `json:"typ"`
}

// appJWTClaims is the payload GitHub expects from an app JWT.
type appJWTClaims struct {
	Iss string `json:"iss"`
	Iat int64  `json:"iat"`
	Exp int64  `json:"exp"`
}

// AppJWT returns an RS256 JWT authenticating as the GitHub App. Tokens are
// cached and reused while more than 60 seconds of validity remain.
func (c *Client) AppJWT() (string, error) {
	if c.AppKey == nil {
		return "", errNoAppKey
	}

	now := c.now()

	c.appToken.mu.Lock()
	defer c.appToken.mu.Unlock()

	if c.appToken.token != "" && c.appToken.expires.Sub(now) > time.Minute {
		return c.appToken.token, nil
	}

	exp := now.Add(9 * time.Minute)
	token, err := signAppJWT(c.AppKey, appJWTClaims{
		Iss: c.ClientID,
		Iat: now.Add(-time.Minute).Unix(),
		Exp: exp.Unix(),
	})
	if err != nil {
		return "", err
	}

	c.appToken.token = token
	c.appToken.expires = exp
	return token, nil
}

// signAppJWT builds and signs a compact RS256 JWT with key.
func signAppJWT(key *rsa.PrivateKey, claims appJWTClaims) (string, error) {
	headerJSON, err := json.Marshal(appJWTHeader{Alg: "RS256", Typ: "JWT"})
	if err != nil {
		return "", fmt.Errorf("github: encode app jwt header: %w", err)
	}
	claimsJSON, err := json.Marshal(claims)
	if err != nil {
		return "", fmt.Errorf("github: encode app jwt claims: %w", err)
	}

	signingInput := base64.RawURLEncoding.EncodeToString(headerJSON) + "." +
		base64.RawURLEncoding.EncodeToString(claimsJSON)

	digest := sha256.Sum256([]byte(signingInput))
	signature, err := rsa.SignPKCS1v15(rand.Reader, key, crypto.SHA256, digest[:])
	if err != nil {
		return "", fmt.Errorf("github: sign app jwt: %w", err)
	}

	return signingInput + "." + base64.RawURLEncoding.EncodeToString(signature), nil
}
