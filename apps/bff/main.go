package main

import (
	"context"
	"errors"
	"log/slog"
	"net/http"
	"os"
	"os/signal"
	"syscall"
	"time"

	"github.com/konsulin-care/opendraft/apps/bff/internal/config"
	"github.com/konsulin-care/opendraft/apps/bff/internal/httpapi"
	"github.com/konsulin-care/opendraft/apps/bff/internal/logging"
)

const healthcheckArg = "healthcheck"

const readHeaderTimeout = 10 * time.Second

const shutdownTimeout = 10 * time.Second

// main dispatches the healthcheck subcommand or starts the BFF server.
func main() {
	os.Exit(run())
}

// run executes the requested mode and returns the process exit code.
func run() int {
	if len(os.Args) > 1 && os.Args[1] == healthcheckArg {
		client := &http.Client{Timeout: healthcheckTimeout}
		return runHealthcheck(os.Getenv("BFF_ADDR"), client)
	}
	return serve(os.Getenv, os.ReadFile)
}

// serve loads configuration and runs the HTTP server until SIGINT or SIGTERM
// triggers a graceful shutdown. It returns the process exit code.
func serve(getenv func(string) string, readFile func(string) ([]byte, error)) int {
	logger := newLogger()

	cfg, err := config.Load(getenv, readFile)
	if err != nil {
		logger.Error("configuration invalid", slog.String("error", err.Error()))
		return 1
	}

	handler := httpapi.New(cfg, httpapi.Deps{
		Logger:  logger,
		Version: Version,
		Now:     time.Now,
	})

	server := &http.Server{
		Addr:              cfg.Addr,
		Handler:           handler,
		ReadHeaderTimeout: readHeaderTimeout,
	}

	ctx, stop := signal.NotifyContext(context.Background(), syscall.SIGINT, syscall.SIGTERM)
	defer stop()

	errCh := make(chan error, 1)
	go func() {
		logger.Info("server listening", slog.String("addr", cfg.Addr), slog.String("version", Version))
		errCh <- server.ListenAndServe()
	}()

	select {
	case err := <-errCh:
		if !errors.Is(err, http.ErrServerClosed) {
			logger.Error("server stopped", slog.String("error", err.Error()))
			return 1
		}
	case <-ctx.Done():
		stop()
		shutdownCtx, cancel := context.WithTimeout(context.Background(), shutdownTimeout)
		defer cancel()
		if err := server.Shutdown(shutdownCtx); err != nil {
			logger.Error("shutdown failed", slog.String("error", err.Error()))
			return 1
		}
	}

	logger.Info("server stopped")
	return 0
}

// newLogger returns a JSON slog logger wrapped in the redacting handler.
func newLogger() *slog.Logger {
	handler := slog.NewJSONHandler(os.Stdout, &slog.HandlerOptions{Level: slog.LevelInfo})
	return slog.New(logging.NewRedactingHandler(handler))
}
