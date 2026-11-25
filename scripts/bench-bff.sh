#!/usr/bin/env bash
#
# bench-bff.sh — Measure the resource footprint of the shipped BFF image.
#
# Usage:
#   bash scripts/bench-bff.sh
#
# Optional environment:
#   BENCH_IMAGE          image to run (default: opendraft-bff:bench)
#   BENCH_CONTAINER      container name (default: opendraft-bff-bench)
#   BENCH_PORT           host port mapped to the BFF (default: 18080)
#   BENCH_IDLE_SECONDS   idle sample window (default: 30)
#   BENCH_LOAD_SECONDS   light-load window (default: 60)
#   BENCH_REQUESTS_PER_SECOND  mixed requests per second (default: 20)
#   BENCH_CONCURRENCY    parallel curl workers (default: 20)
#   BENCH_SAMPLE_INTERVAL  seconds between docker stats samples (default: 2)
#   BENCH_ASSET_PATH     /@assets path to exercise (default: discovered from /)
#
# The script builds the image when it is missing, starts it with dummy
# configuration, waits for /@api/health, samples idle and light-load CPU and
# memory with `docker stats`, and prints peak and average figures.

set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

IMAGE="${BENCH_IMAGE:-opendraft-bff:bench}"
CONTAINER="${BENCH_CONTAINER:-opendraft-bff-bench}"
PORT="${BENCH_PORT:-18080}"
BASE="http://127.0.0.1:${PORT}"
IDLE_SECONDS="${BENCH_IDLE_SECONDS:-30}"
LOAD_SECONDS="${BENCH_LOAD_SECONDS:-60}"
REQUESTS_PER_SECOND="${BENCH_REQUESTS_PER_SECOND:-20}"
CONCURRENCY="${BENCH_CONCURRENCY:-20}"
SAMPLE_INTERVAL="${BENCH_SAMPLE_INTERVAL:-2}"

# Dummy 32-byte base64 session key; no real secret is used by this benchmark.
SESSION_KEY="$(printf '0123456789abcdef0123456789abcdef' | base64 | tr -d '\n')"

IDLE_FILE="$(mktemp)"
LOAD_FILE="$(mktemp)"

cleanup() {
  docker rm -f "$CONTAINER" >/dev/null 2>&1 || true
  rm -f "$IDLE_FILE" "$LOAD_FILE"
}
trap cleanup EXIT INT TERM

for tool in docker curl xargs awk; do
  if ! command -v "$tool" >/dev/null 2>&1; then
    echo "bench: required tool '$tool' is not installed" >&2
    exit 1
  fi
done

# mem_to_mb converts a Docker memory quantity (KiB/MiB/GiB/B) to MiB.
mem_to_mb() {
  awk -v value="$1" 'BEGIN {
    if (value ~ /KiB$/) { sub(/KiB$/, "", value); mb = value / 1024 }
    else if (value ~ /MiB$/) { sub(/MiB$/, "", value); mb = value }
    else if (value ~ /GiB$/) { sub(/GiB$/, "", value); mb = value * 1024 }
    else if (value ~ /TiB$/) { sub(/TiB$/, "", value); mb = value * 1024 * 1024 }
    else if (value ~ /B$/) { sub(/B$/, "", value); mb = value / 1048576 }
    else { mb = value / 1048576 }
    printf "%.2f", mb
  }'
}

# read_stats prints one "cpu_percent memory_mb" pair for the container.
read_stats() {
  local line cpu mem_used
  line="$(docker stats --no-stream --format '{{.CPUPerc}} {{.MemUsage}}' "$CONTAINER")" || return 1
  cpu="${line%% *}"
  cpu="${cpu%\%}"
  mem_used="${line#* }"
  mem_used="${mem_used%% / *}"
  printf '%s %s\n' "$cpu" "$(mem_to_mb "$mem_used")"
}

# sample_window records docker stats for the requested number of seconds.
sample_window() {
  local outfile="$1" seconds="$2" deadline
  deadline=$(( $(date +%s) + seconds ))
  : > "$outfile"
  while [ "$(date +%s)" -lt "$deadline" ]; do
    if stats="$(read_stats)"; then
      printf '%s\n' "$stats" >> "$outfile"
    fi
    sleep "$SAMPLE_INTERVAL"
  done
}

# run_load emits a mixed request stream at roughly REQUESTS_PER_SECOND.
run_load() {
  local i=0 target
  for _ in $(seq 1 "$LOAD_SECONDS"); do
    for _ in $(seq 1 "$REQUESTS_PER_SECOND"); do
      case $((i % 3)) in
        0) target="/" ;;
        1) target="/@api/health" ;;
        *) target="$ASSET_PATH" ;;
      esac
      printf '%s%s\n' "$BASE" "$target"
      i=$((i + 1))
    done
    sleep 1
  done
}

# print_summary prints peak and average CPU and memory for one sample file.
print_summary() {
  local file="$1" label="$2"
  awk -v label="$label" '
    NR == 1 { max_cpu = $1; max_mem = $2 }
    {
      sum_cpu += $1
      sum_mem += $2
      if ($1 > max_cpu) max_cpu = $1
      if ($2 > max_mem) max_mem = $2
    }
    END {
      if (NR == 0) {
        printf "%s: no samples collected\n", label
        exit 1
      }
      printf "%s: CPU peak %.2f%% (%.3f vCPU), avg %.2f%% (%.3f vCPU); memory peak %.2f MB, avg %.2f MB (%d samples)\n", \
        label, max_cpu, max_cpu / 100, sum_cpu / NR, sum_cpu / NR / 100, max_mem, sum_mem / NR, NR
    }
  ' "$file"
}

if ! docker image inspect "$IMAGE" >/dev/null 2>&1; then
  echo "bench: image $IMAGE not found, building it"
  docker build -t "$IMAGE" "$ROOT"
fi

docker rm -f "$CONTAINER" >/dev/null 2>&1 || true

echo "bench: starting $IMAGE as $CONTAINER on port $PORT"
docker run -d --name "$CONTAINER" \
  -p "${PORT}:8080" \
  -e BFF_ADDR=:8080 \
  -e BFF_PUBLIC_ORIGIN="$BASE" \
  -e BFF_GITHUB_CLIENT_ID=dummy-client-id \
  -e BFF_GITHUB_CLIENT_SECRET=dummy-client-secret \
  -e BFF_GITHUB_APP_SLUG=dummy-app \
  -e BFF_SESSION_KEY="$SESSION_KEY" \
  "$IMAGE" >/dev/null

ready=""
for _ in $(seq 1 60); do
  if curl -fsS "$BASE/@api/health" >/dev/null 2>&1; then
    ready="yes"
    break
  fi
  sleep 1
done
if [ -z "$ready" ]; then
  echo "bench: BFF did not become healthy; container logs follow" >&2
  docker logs "$CONTAINER" >&2 || true
  exit 1
fi

ASSET_PATH="${BENCH_ASSET_PATH:-}"
if [ -z "$ASSET_PATH" ]; then
  ASSET_PATH="$(curl -fsS "$BASE/" | grep -oE '/@assets/[A-Za-z0-9._/-]+' | head -n 1 || true)"
fi
if [ -z "$ASSET_PATH" ]; then
  ASSET_PATH="/@assets/app.js"
  echo "bench: no hashed asset found, falling back to $ASSET_PATH"
fi
echo "bench: light load asset $ASSET_PATH"

echo "bench: sampling idle for ${IDLE_SECONDS}s"
sample_window "$IDLE_FILE" "$IDLE_SECONDS"

echo "bench: sampling light load ~${REQUESTS_PER_SECOND} req/s for ${LOAD_SECONDS}s"
run_load | xargs -r -P "$CONCURRENCY" -n 1 curl -s -o /dev/null --max-time 5 &
LOAD_PID=$!
sample_window "$LOAD_FILE" "$LOAD_SECONDS"
wait "$LOAD_PID" || true

echo
print_summary "$IDLE_FILE" "Idle"
print_summary "$LOAD_FILE" "Light load"
echo "Targets: CPU < 0.25 vCPU (25%), memory < 30 MB"
