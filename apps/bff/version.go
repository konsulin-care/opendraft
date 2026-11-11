package main

// Version is the reported build version of the Go BFF service.
// It holds a 0.0.0-dev placeholder until release tooling overrides it;
// phase-07's /health endpoint will report this value.
var Version = "0.0.0-dev"
