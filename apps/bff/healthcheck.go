package main

import (
	"net"
	"net/http"
	"strings"
	"time"
)

const (
	healthcheckPath    = "/@api/health"
	healthcheckHost    = "127.0.0.1"
	healthcheckTimeout = 5 * time.Second
)

// runHealthcheck probes the local BFF health endpoint derived from addr and
// returns the process exit code: 0 when the endpoint answers 200, 1 otherwise.
// A nil client uses a client with a short timeout.
func runHealthcheck(addr string, client *http.Client) int {
	if client == nil {
		client = &http.Client{Timeout: healthcheckTimeout}
	}

	url := "http://" + healthcheckHost + ":" + portFromAddr(addr) + healthcheckPath
	resp, err := client.Get(url)
	if err != nil {
		return 1
	}
	defer func() { _ = resp.Body.Close() }()

	if resp.StatusCode != http.StatusOK {
		return 1
	}
	return 0
}

// portFromAddr extracts the port from a listen address such as ":8080",
// "127.0.0.1:8080" or "8080", defaulting to the BFF default port.
func portFromAddr(addr string) string {
	addr = strings.TrimSpace(addr)
	if addr == "" {
		return "8080"
	}
	if _, port, err := net.SplitHostPort(addr); err == nil {
		return port
	}
	if strings.HasPrefix(addr, ":") {
		return strings.TrimPrefix(addr, ":")
	}
	if index := strings.LastIndex(addr, ":"); index >= 0 {
		return addr[index+1:]
	}
	return addr
}
