// Package logging provides structured logging helpers for the BFF.
package logging

import (
	"context"
	"log/slog"
	"regexp"
	"strings"
)

// redacted is the placeholder written in place of sensitive values.
const redacted = "[REDACTED]"

// sensitiveKeyParts are matched case-insensitively against attribute keys.
var sensitiveKeyParts = []string{
	"token",
	"secret",
	"code",
	"state",
	"verifier",
	"authorization",
	"cookie",
	"password",
}

// githubTokenPattern matches GitHub personal access and app tokens.
var githubTokenPattern = regexp.MustCompile(`(gh[opsur]_[A-Za-z0-9_]+|github_pat_[A-Za-z0-9_]+)`)

// redactingHandler wraps a slog.Handler and scrubs sensitive attributes before
// they reach the wrapped handler.
type redactingHandler struct {
	inner slog.Handler
}

// NewRedactingHandler returns a slog.Handler that redacts sensitive attribute
// keys (including inside groups) and GitHub token values before delegating to
// inner.
func NewRedactingHandler(inner slog.Handler) slog.Handler {
	if inner == nil {
		inner = slog.Default().Handler()
	}
	return &redactingHandler{inner: inner}
}

// Enabled reports whether the wrapped handler accepts records at level.
func (h *redactingHandler) Enabled(ctx context.Context, level slog.Level) bool {
	return h.inner.Enabled(ctx, level)
}

// Handle sanitizes the record attributes and forwards the record.
func (h *redactingHandler) Handle(ctx context.Context, record slog.Record) error {
	sanitized := slog.NewRecord(record.Time, record.Level, record.Message, record.PC)
	record.Attrs(func(attr slog.Attr) bool {
		sanitized.AddAttrs(sanitizeAttr(attr))
		return true
	})
	return h.inner.Handle(ctx, sanitized)
}

// WithAttrs returns a handler with the given attributes sanitized and attached.
func (h *redactingHandler) WithAttrs(attrs []slog.Attr) slog.Handler {
	sanitized := make([]slog.Attr, 0, len(attrs))
	for _, attr := range attrs {
		sanitized = append(sanitized, sanitizeAttr(attr))
	}
	return &redactingHandler{inner: h.inner.WithAttrs(sanitized)}
}

// WithGroup returns a handler that prefixes subsequent attributes with name.
func (h *redactingHandler) WithGroup(name string) slog.Handler {
	return &redactingHandler{inner: h.inner.WithGroup(name)}
}

// isSensitiveKey reports whether key names a field whose value must be hidden.
func isSensitiveKey(key string) bool {
	lower := strings.ToLower(key)
	for _, part := range sensitiveKeyParts {
		if strings.Contains(lower, part) {
			return true
		}
	}
	return false
}

// redactString replaces GitHub token shaped values with the placeholder.
func redactString(value string) string {
	if githubTokenPattern.MatchString(value) {
		return redacted
	}
	return value
}

// sanitizeAttr recursively redacts a single attribute and any groups it holds.
func sanitizeAttr(attr slog.Attr) slog.Attr {
	if isSensitiveKey(attr.Key) {
		return slog.String(attr.Key, redacted)
	}
	if attr.Value.Kind() == slog.KindGroup {
		members := attr.Value.Group()
		sanitized := make([]slog.Attr, 0, len(members))
		for _, member := range members {
			sanitized = append(sanitized, sanitizeAttr(member))
		}
		return slog.Attr{Key: attr.Key, Value: slog.GroupValue(sanitized...)}
	}
	if attr.Value.Kind() == slog.KindString {
		return slog.String(attr.Key, redactString(attr.Value.String()))
	}
	return attr
}
