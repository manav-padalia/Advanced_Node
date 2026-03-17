/**
 * K6 Load Test — Full API Flow
 * Tests auth + product listing under load
 *
 * Run: k6 run tests/load/api-flow.js
 * Run with custom URL: k6 run -e BASE_URL=https://your-api.com tests/load/api-flow.js
 */
import http from 'k6/http';
import { check, group, sleep } from 'k6';
import { Rate, Counter } from 'k6/metrics';

const errorRate = new Rate('errors');
const loginSuccess = new Counter('login_success');
const productsFetched = new Counter('products_fetched');

export const options = {
  stages: [
    { duration: '30s', target: 10 },
    { duration: '1m', target: 30 },
    { duration: '30s', target: 0 },
  ],
  thresholds: {
    http_req_duration: ['p(95)<1000'],
    errors: ['rate<0.05'],
  },
};

const BASE_URL = __ENV.BASE_URL || 'http://localhost:3000';
const HEADERS = { 'Content-Type': 'application/json' };

export default function () {
  let accessToken = '';

  group('Auth — Login', () => {
    const res = http.post(
      `${BASE_URL}/v1/auth/login`,
      JSON.stringify({ email: 'user@ecommerce.com', password: 'User@1234' }),
      { headers: HEADERS }
    );

    const ok = check(res, {
      'login status 200': (r) => r.status === 200,
      'has accessToken': (r) => {
        try {
          const body = JSON.parse(r.body);
          accessToken = body.data?.accessToken || '';
          return !!accessToken;
        } catch {
          return false;
        }
      },
    });

    if (ok) loginSuccess.add(1);
    errorRate.add(!ok);
  });

  sleep(0.2);

  group('Products — List', () => {
    const res = http.get(`${BASE_URL}/v1/products?page=1&limit=20`);

    const ok = check(res, {
      'products status 200': (r) => r.status === 200,
      'has data': (r) => {
        try {
          return !!JSON.parse(r.body).data;
        } catch {
          return false;
        }
      },
    });

    if (ok) productsFetched.add(1);
    errorRate.add(!ok);
  });

  sleep(0.2);

  group('Categories — List', () => {
    const res = http.get(`${BASE_URL}/v1/categories`);
    const ok = check(res, { 'categories status 200': (r) => r.status === 200 });
    errorRate.add(!ok);
  });

  sleep(1);
}
