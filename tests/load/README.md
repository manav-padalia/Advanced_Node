# Load Testing

Uses [K6](https://k6.io) for load testing.

## Install K6

```bash
# macOS
brew install k6

# Linux
sudo gpg -k
sudo gpg --no-default-keyring --keyring /usr/share/keyrings/k6-archive-keyring.gpg --keyserver hkp://keyserver.ubuntu.com:80 --recv-keys C5AD17C747E3415A3642D57D77C6C491D6AC1D69
echo "deb [signed-by=/usr/share/keyrings/k6-archive-keyring.gpg] https://dl.k6.io/deb stable main" | sudo tee /etc/apt/sources.list.d/k6.list
sudo apt-get update && sudo apt-get install k6
```

## Run Tests

Make sure all services are running first (`npm run dev`).

```bash
# Baseline health check test
k6 run tests/load/health-check.js

# Full API flow test (auth + products + categories)
k6 run tests/load/api-flow.js

# Against a different environment
k6 run -e BASE_URL=https://your-api.railway.app tests/load/api-flow.js

# Output results to JSON
k6 run --out json=tests/load/results.json tests/load/api-flow.js
```

## Interpreting Results

Key metrics to watch:

- `http_req_duration` — response time (p95 target: <500ms for health, <1000ms for API)
- `http_req_failed` — error rate (target: <1%)
- `vus` — virtual users active
- `iterations` — total requests completed

## Thresholds

Tests will fail (exit code 1) if:

- `health-check.js`: p95 response time > 500ms OR error rate > 1%
- `api-flow.js`: p95 response time > 1000ms OR error rate > 5%

This makes load tests usable in CI pipelines.
