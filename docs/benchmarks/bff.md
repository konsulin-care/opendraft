# BFF Benchmark

Resource targets for the BFF are defined in [ADR 011](../ADR/011-bff-scope.md)
and [Phase 7](../plans/phase-07-go-bff.md): under representative idle and
light-load conditions CPU must stay below **0.25 vCPU** and memory below
**30 MB**.

## Method

Run the benchmark against the shipped Docker image:

```bash
bash scripts/bench-bff.sh
```

The script:

1. Builds `opendraft-bff:bench` from the repository `Dockerfile` when the
   image is missing.
2. Starts the image with dummy GitHub App configuration and a dummy 32-byte
   session key. No real secret or GitHub call is involved.
3. Waits for `GET /@api/health` to answer `200`.
4. Samples `docker stats --no-stream --format '{{.CPUPerc}} {{.MemUsage}}'`
   for 30 seconds of idle.
5. Generates roughly 20 requests per second for 60 seconds, cycling through
   `GET /`, `GET /@api/health` and `GET /@assets/<hashed file>`. The load
   generator is a plain `bash` loop piped into `xargs -P` running `curl`; it
   needs no extra load-testing tools.
6. Samples `docker stats` during the load and prints peak and average CPU and
   memory for both windows.

`docker stats` reports CPU as a percentage of one CPU, so `1.00%` equals
`0.01 vCPU`. Memory is the cgroup memory usage of the container, reported here
in MiB (shown as MB). The value includes the Go runtime heap and the small
amount of page cache charged to the container.

The benchmark can be adjusted without editing the script:

```bash
BENCH_IMAGE=opendraft-bff:bench \
BENCH_IDLE_SECONDS=30 \
BENCH_LOAD_SECONDS=60 \
BENCH_REQUESTS_PER_SECOND=20 \
bash scripts/bench-bff.sh
```

## Environment

The reference run was recorded on:

- Linux x86_64 host with Docker Engine and an 8 vCPU host limit.
- The distroless `static-debian12:nonroot` runtime image from the repository
  `Dockerfile` (static Go binary plus the built Vite web app).
- Go 1.27 BFF, single container instance, no reverse proxy, no TLS.
- Loopback traffic only; GitHub API and web URLs were the defaults but were
  never called by the health, SPA or asset paths.

## Measurements

Reference run of `bash scripts/bench-bff.sh`:

| Window | CPU peak | CPU average | Memory peak | Memory average | Samples |
| --- | ---: | ---: | ---: | ---: | ---: |
| Idle (30 s) | 0.04% (0.0004 vCPU) | 0.01% (0.0001 vCPU) | 9.6 MB | 9.4 MB | 15 |
| Light load (~20 req/s, 60 s) | 1.60% (0.016 vCPU) | 0.84% (0.0084 vCPU) | 10.8 MB | 10.1 MB | 30 |

## Against targets

| Metric | Target | Measured peak | Result |
| --- | ---: | ---: | --- |
| CPU, light load | < 0.25 vCPU | 0.016 vCPU (1.60%) | Met, about 15x headroom |
| Memory, light load | < 30 MB | 10.8 MB | Met, about 2.8x headroom |

Both targets are met, so no exception or deviation is required.

The small differences between idle and load are expected rather than a
deviation: the Go heap grows by roughly 1.5 MB once request handling and
static-file serving warm up, and CPU rises from essentially zero to a fraction
of one percent while serving 20 requests per second. Even the peak values are
an order of magnitude below the agreed limits.

## Notes and limitations

- `docker stats` itself samples on an interval and has roughly one second of
  startup cost per call, so the reported average smooths very short spikes.
  The peak column is the high-water mark of the sampled points.
- The load is deliberately light and loopback-bound. Authentication callbacks,
  Git relay uploads and GitHub API round trips are not exercised here because
  they depend on external services and a real GitHub App installation.
- Changing the host CPU count changes the percentage denominator but not the
  vCPU figures: `docker stats` percentages are relative to one CPU, and the
  targets are expressed in vCPU.
- Rebuild the image after changing the BFF or web app; the script only builds
  when the image tag is absent, so remove the tag to force a fresh build:
  `docker image rm opendraft-bff:bench`.
