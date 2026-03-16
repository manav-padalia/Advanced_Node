/**
 * K6 Load Test — Health Check Baseline
 *
 * Run: k6 run tests/load/health-check.js
 * Install K6: brew install k6
 */
import http from 'k6/http';
import { check, sleep } from 'k6';
import { Rate, Trend } from 'k6/metrics';

const errorRate = new Rate('errors');
const responseTime = new Trend('response_time');

export const options = {
    stages: [
        { duration: '30s', target: 20 },   // ramp up to 20 users
        { duration: '1m', target: 50 },   // hold at 50 users
        { duration: '30s', target: 100 },  // spike to 100 users
        { duration: '30s', target: 0 },    // ramp down
    ],
    thresholds: {
        http_req_duration: ['p(95)<500'],  // 95% of requests under 500ms
        errors: ['rate<0.01'],             // error rate under 1%
    },
};

const BASE_URL = __ENV.BASE_URL || 'http://localhost:3000';

export default function () {
    const res = http.get(`${BASE_URL}/health`);

    const ok = check(res, {
        'status is 200': (r) => r.status === 200,
        'response time < 200ms': (r) => r.timings.duration < 200,
        'has service field': (r) => {
            try {
                return JSON.parse(r.body).data?.service === 'api-gateway';
            } catch {
                return false;
            }
        },
    });

    errorRate.add(!ok);
    responseTime.add(res.timings.duration);

    sleep(0.5);
}
