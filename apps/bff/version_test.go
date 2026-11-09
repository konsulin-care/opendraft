package main

import (
	"regexp"
	"testing"
)

// TestVersionIsSemver asserts that Version reports a semver-shaped value.
// The 0.0.0-dev placeholder stands in until release tooling overrides it.
func TestVersionIsSemver(t *testing.T) {
	pattern := regexp.MustCompile(`^\d+\.\d+\.\d+(-[\w.]+)?$`)
	if !pattern.MatchString(Version) {
		t.Errorf("Version = %q, want a semver-shaped value matching %s", Version, pattern.String())
	}
}
