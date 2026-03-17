// @ts-ignore
const { test, expect } = require('@playwright/test');

let adminToken = '';
let userToken = '';
let userRefreshToken = '';
let dynEmail = '';
let dynToken = '';
let testCategoryId = '';
let testProductId = '';
let orderId = '';

const USER_EMAIL = 'user@ecommerce.com';
const USER_PASSWORD = 'User@1234';
const ADMIN_EMAIL = 'admin@ecommerce.com';
const ADMIN_PASSWORD = 'Admin@1234';

async function loginAs(request: any, email: string, password: string) {
  const res = await request.post('/v1/auth/login', {
    data: { email, password },
  });
  expect(res.status(), `Login failed for ${email}: ${await res.text()}`).toBe(
    200
  );
  const body = await res.json();
  return {
    accessToken: body.data.accessToken,
    refreshToken: body.data.refreshToken,
    user: body.data.user,
  };
}

function authHeader(token: string) {
  return { Authorization: `Bearer ${token}` };
}

async function withRetry(
  fn: () => Promise<any>,
  maxRetries = 3,
  delayMs = 2000
): Promise<any> {
  let lastRes: any;
  for (let i = 0; i <= maxRetries; i++) {
    lastRes = await fn();
    if (lastRes.status() !== 500) return lastRes;
    if (i < maxRetries) await new Promise((r) => setTimeout(r, delayMs));
  }
  return lastRes;
}

// ── SETUP ─────────────────────────────────────────────────────────────────────
test.describe('Setup – admin creates test fixtures', () => {
  test('admin logs in', async ({ request }: any) => {
    const { accessToken } = await loginAs(request, ADMIN_EMAIL, ADMIN_PASSWORD);
    adminToken = accessToken;
    expect(adminToken).toBeTruthy();
  });

  test('admin creates test category', async ({ request }: any) => {
    const ts = Date.now();
    const res = await withRetry(() =>
      request.post('/v1/categories', {
        headers: authHeader(adminToken),
        data: {
          name: `User E2E Category ${ts}`,
          slug: `user-e2e-cat-${ts}`,
          description: 'For user E2E tests',
        },
      })
    );
    expect(res.status(), `Category creation failed: ${await res.text()}`).toBe(
      201
    );
    const body = await res.json();
    testCategoryId = body.data.id;
    expect(testCategoryId).toBeTruthy();
  });

  test('admin creates test product', async ({ request }: any) => {
    const ts = Date.now();
    const res = await withRetry(() =>
      request.post('/v1/products', {
        headers: authHeader(adminToken),
        data: {
          sku: `USER-E2E-${ts}`,
          name: `User E2E Product ${ts}`,
          slug: `user-e2e-prod-${ts}`,
          description: 'For user E2E tests',
          price: 29.99,
          categoryId: testCategoryId,
        },
      })
    );
    expect(res.status(), `Product creation failed: ${await res.text()}`).toBe(
      201
    );
    const body = await res.json();
    testProductId = body.data.id;
    expect(testProductId).toBeTruthy();
  });
});

// ── 1. AUTH ───────────────────────────────────────────────────────────────────
test.describe('Auth – user', () => {
  test('register a new dynamic user', async ({ request }: any) => {
    dynEmail = `e2e-user-${Date.now()}@test.com`;
    const res = await request.post('/v1/auth/register', {
      data: {
        email: dynEmail,
        password: 'TestPass@99',
        firstName: 'E2E',
        lastName: 'User',
      },
    });
    expect(res.status(), `Register failed: ${await res.text()}`).toBe(201);
    const body = await res.json();
    expect(body.data.user.email).toBe(dynEmail);
    expect(body.data.user.role).toBe('USER');
    dynToken = body.data.accessToken;
    expect(dynToken).toBeTruthy();
  });

  test('register with duplicate email returns 409', async ({
    request,
  }: any) => {
    const res = await request.post('/v1/auth/register', {
      data: { email: dynEmail, password: 'AnotherPass@1' },
    });
    expect(res.status()).toBe(409);
    const body = await res.json();
    expect(body.message).toMatch(/already registered/i);
  });

  test('register with invalid email returns 400', async ({ request }: any) => {
    const res = await request.post('/v1/auth/register', {
      data: { email: 'not-an-email', password: 'ValidPass@1' },
    });
    expect(res.status()).toBe(400);
  });

  test('register with short password returns 400', async ({ request }: any) => {
    const res = await request.post('/v1/auth/register', {
      data: { email: 'short@test.com', password: 'abc' },
    });
    expect(res.status()).toBe(400);
  });

  test('login with seed user credentials', async ({ request }: any) => {
    const { accessToken, refreshToken, user } = await loginAs(
      request,
      USER_EMAIL,
      USER_PASSWORD
    );
    userToken = accessToken;
    userRefreshToken = refreshToken;
    expect(user.email).toBe(USER_EMAIL);
    expect(user.role).toBe('USER');
  });

  test('login with wrong password returns 401', async ({ request }: any) => {
    const res = await request.post('/v1/auth/login', {
      data: { email: USER_EMAIL, password: 'WrongPass!99' },
    });
    expect(res.status()).toBe(401);
    const body = await res.json();
    expect(body.message).toMatch(/invalid credentials/i);
  });

  test('login with unknown email returns 401', async ({ request }: any) => {
    const res = await request.post('/v1/auth/login', {
      data: { email: 'ghost@nowhere.com', password: 'Whatever1!' },
    });
    expect(res.status()).toBe(401);
  });

  test('refresh token returns new access token', async ({ request }: any) => {
    const res = await request.post('/v1/auth/refresh', {
      data: { refreshToken: userRefreshToken },
    });
    expect(res.status()).toBe(200);
    const body = await res.json();
    expect(body.data.accessToken).toBeTruthy();
    userToken = body.data.accessToken;
  });

  test('refresh with invalid token returns 401', async ({ request }: any) => {
    const res = await request.post('/v1/auth/refresh', {
      data: { refreshToken: 'bad.token.here' },
    });
    expect(res.status()).toBe(401);
  });

  test('refresh with missing body returns 400', async ({ request }: any) => {
    const res = await request.post('/v1/auth/refresh', { data: {} });
    expect(res.status()).toBe(400);
  });
});

// ── 2. BROWSE ─────────────────────────────────────────────────────────────────
test.describe('Browse – public catalog', () => {
  test('GET /v1/categories returns non-empty list', async ({
    request,
  }: any) => {
    const res = await request.get('/v1/categories');
    expect(res.status()).toBe(200);
    const body = await res.json();
    expect(Array.isArray(body.data)).toBe(true);
    expect(body.data.length).toBeGreaterThan(0);
  });

  test('GET /v1/categories/:id returns the test category', async ({
    request,
  }: any) => {
    const res = await request.get(`/v1/categories/${testCategoryId}`);
    expect(res.status()).toBe(200);
    const body = await res.json();
    expect(body.data.id).toBe(testCategoryId);
  });

  test('GET /v1/categories/:id with bad UUID returns 400', async ({
    request,
  }: any) => {
    const res = await request.get('/v1/categories/not-a-uuid');
    expect(res.status()).toBe(400);
  });

  test('GET /v1/products returns list', async ({ request }: any) => {
    const res = await request.get('/v1/products');
    expect(res.status()).toBe(200);
    const body = await res.json();
    expect(body.data).toBeDefined();
  });

  test('GET /v1/products with pagination', async ({ request }: any) => {
    const res = await request.get('/v1/products?page=1&limit=10');
    expect(res.status()).toBe(200);
  });

  test('GET /v1/products with price range filter', async ({ request }: any) => {
    const res = await request.get('/v1/products?minPrice=1&maxPrice=1000');
    expect(res.status()).toBe(200);
  });

  test('GET /v1/products with search query', async ({ request }: any) => {
    const res = await request.get('/v1/products?search=E2E');
    expect(res.status()).toBe(200);
  });

  test('GET /v1/products with categoryId filter', async ({ request }: any) => {
    const res = await request.get(`/v1/products?categoryId=${testCategoryId}`);
    expect(res.status()).toBe(200);
  });

  test('GET /v1/products/:id returns the test product', async ({
    request,
  }: any) => {
    const res = await request.get(`/v1/products/${testProductId}`);
    expect(res.status()).toBe(200);
    const body = await res.json();
    expect(body.data.id).toBe(testProductId);
    expect(Number(body.data.price)).toBe(29.99);
  });

  test('GET /v1/products/:id with bad UUID returns 400', async ({
    request,
  }: any) => {
    const res = await request.get('/v1/products/not-a-uuid');
    expect(res.status()).toBe(400);
  });

  test('GET /v1/products with limit > 100 returns 400', async ({
    request,
  }: any) => {
    const res = await request.get('/v1/products?limit=999');
    expect(res.status()).toBe(400);
  });

  test('GET /v1/products with non-numeric page returns 400', async ({
    request,
  }: any) => {
    const res = await request.get('/v1/products?page=abc');
    expect(res.status()).toBe(400);
  });
});

// ── 3. ORDERS ─────────────────────────────────────────────────────────────────
test.describe('Orders – user flow', () => {
  test('ensure fresh userToken for orders', async ({ request }: any) => {
    const { accessToken } = await loginAs(request, USER_EMAIL, USER_PASSWORD);
    userToken = accessToken;
    expect(userToken).toBeTruthy();
  });

  test('GET /v1/orders without auth returns 401', async ({ request }: any) => {
    const res = await request.get('/v1/orders');
    expect(res.status()).toBe(401);
  });

  test('GET /v1/orders with auth returns user orders list', async ({
    request,
  }: any) => {
    const res = await request.get('/v1/orders', {
      headers: authHeader(userToken),
    });
    expect(res.status()).toBe(200);
    const body = await res.json();
    expect(body.data).toBeDefined();
  });

  test('POST /v1/orders without auth returns 401', async ({ request }: any) => {
    const res = await request.post('/v1/orders', {
      data: {
        items: [{ productId: testProductId, quantity: 1 }],
        shippingAddress: {
          street: '1 Test St',
          city: 'Testville',
          state: 'TX',
          zipCode: '75001',
          country: 'US',
        },
      },
    });
    expect(res.status()).toBe(401);
  });

  test('POST /v1/orders with empty items returns 400', async ({
    request,
  }: any) => {
    const res = await request.post('/v1/orders', {
      headers: authHeader(userToken),
      data: {
        items: [],
        shippingAddress: {
          street: '1 Test St',
          city: 'Testville',
          state: 'TX',
          zipCode: '75001',
          country: 'US',
        },
      },
    });
    expect(res.status()).toBe(400);
  });

  test('POST /v1/orders with missing shippingAddress returns 400', async ({
    request,
  }: any) => {
    const res = await request.post('/v1/orders', {
      headers: authHeader(userToken),
      data: { items: [{ productId: testProductId, quantity: 1 }] },
    });
    expect(res.status()).toBe(400);
  });

  test('POST /v1/orders with invalid productId UUID returns 400', async ({
    request,
  }: any) => {
    const res = await request.post('/v1/orders', {
      headers: authHeader(userToken),
      data: {
        items: [{ productId: 'not-a-uuid', quantity: 1 }],
        shippingAddress: {
          street: '1 Test St',
          city: 'Testville',
          state: 'TX',
          zipCode: '75001',
          country: 'US',
        },
      },
    });
    expect(res.status()).toBe(400);
  });

  test('POST /v1/orders with zero quantity returns 400', async ({
    request,
  }: any) => {
    const res = await request.post('/v1/orders', {
      headers: authHeader(userToken),
      data: {
        items: [{ productId: testProductId, quantity: 0 }],
        shippingAddress: {
          street: '1 Test St',
          city: 'Testville',
          state: 'TX',
          zipCode: '75001',
          country: 'US',
        },
      },
    });
    expect(res.status()).toBe(400);
  });

  test('POST /v1/orders creates an order', async ({ request }: any) => {
    const res = await request.post('/v1/orders', {
      headers: authHeader(userToken),
      data: {
        items: [{ productId: testProductId, quantity: 2 }],
        shippingAddress: {
          street: '42 Commerce Ave',
          city: 'Austin',
          state: 'TX',
          zipCode: '78701',
          country: 'US',
        },
        paymentMethod: 'card',
      },
    });
    expect(res.status(), `Create order failed: ${await res.text()}`).toBe(201);
    const body = await res.json();
    orderId = body.data.id;
    expect(orderId).toBeTruthy();
  });

  test('GET /v1/orders/:id returns the order', async ({ request }: any) => {
    if (!orderId) return;
    const res = await request.get(`/v1/orders/${orderId}`, {
      headers: authHeader(userToken),
    });
    expect(res.status()).toBe(200);
    const body = await res.json();
    expect(body.data.id).toBe(orderId);
  });

  test('GET /v1/orders/:id with bad UUID returns 400', async ({
    request,
  }: any) => {
    const res = await request.get('/v1/orders/not-a-uuid', {
      headers: authHeader(userToken),
    });
    expect(res.status()).toBe(400);
  });

  test('PUT /v1/orders/:id/cancel cancels the order', async ({
    request,
  }: any) => {
    if (!orderId) return;
    const res = await request.put(`/v1/orders/${orderId}/cancel`, {
      headers: authHeader(userToken),
    });
    expect(res.status(), `Cancel order failed: ${await res.text()}`).toBe(200);
    const body = await res.json();
    expect(body.data).toBeDefined();
  });

  test('PUT /v1/orders/:id/cancel with bad UUID returns 400', async ({
    request,
  }: any) => {
    const res = await request.put('/v1/orders/not-a-uuid/cancel', {
      headers: authHeader(userToken),
    });
    expect(res.status()).toBe(400);
  });

  test('PUT /v1/orders/:id/cancel without auth returns 401', async ({
    request,
  }: any) => {
    const fakeId = '00000000-0000-0000-0000-000000000001';
    const res = await request.put(`/v1/orders/${fakeId}/cancel`);
    expect(res.status()).toBe(401);
  });
});

// ── 4. RBAC ───────────────────────────────────────────────────────────────────
test.describe('RBAC – user cannot use admin endpoints', () => {
  test('re-login user for RBAC', async ({ request }: any) => {
    const { accessToken } = await loginAs(request, USER_EMAIL, USER_PASSWORD);
    userToken = accessToken;
  });

  test('user cannot create a category', async ({ request }: any) => {
    const res = await request.post('/v1/categories', {
      headers: authHeader(userToken),
      data: { name: 'Forbidden', slug: `forbidden-${Date.now()}` },
    });
    expect(res.status()).toBe(403);
  });

  test('user cannot update a category', async ({ request }: any) => {
    const res = await request.put(`/v1/categories/${testCategoryId}`, {
      headers: authHeader(userToken),
      data: { description: 'Sneaky' },
    });
    expect(res.status()).toBe(403);
  });

  test('user cannot delete a category', async ({ request }: any) => {
    const res = await request.delete(`/v1/categories/${testCategoryId}`, {
      headers: authHeader(userToken),
    });
    expect(res.status()).toBe(403);
  });

  test('user cannot create a product', async ({ request }: any) => {
    const res = await request.post('/v1/products', {
      headers: authHeader(userToken),
      data: {
        sku: `FORBIDDEN-${Date.now()}`,
        name: 'Forbidden',
        slug: `forbidden-${Date.now()}`,
        price: 1.0,
        categoryId: testCategoryId,
      },
    });
    expect(res.status()).toBe(403);
  });

  test('user cannot update a product', async ({ request }: any) => {
    const res = await request.put(`/v1/products/${testProductId}`, {
      headers: authHeader(userToken),
      data: { price: 1.0 },
    });
    expect(res.status()).toBe(403);
  });

  test('user cannot delete a product', async ({ request }: any) => {
    const res = await request.delete(`/v1/products/${testProductId}`, {
      headers: authHeader(userToken),
    });
    expect(res.status()).toBe(403);
  });
});

// ── 5. VALIDATION ─────────────────────────────────────────────────────────────
test.describe('Validation edge-cases', () => {
  test('POST /v1/auth/login with missing password returns 400', async ({
    request,
  }: any) => {
    const res = await request.post('/v1/auth/login', {
      data: { email: USER_EMAIL },
    });
    expect(res.status()).toBe(400);
  });

  test('POST /v1/auth/login with missing email returns 400', async ({
    request,
  }: any) => {
    const res = await request.post('/v1/auth/login', {
      data: { password: USER_PASSWORD },
    });
    expect(res.status()).toBe(400);
  });

  test('POST /v1/auth/login with empty body returns 400', async ({
    request,
  }: any) => {
    const res = await request.post('/v1/auth/login', { data: {} });
    expect(res.status()).toBe(400);
  });

  test('POST /v1/auth/register with missing required fields returns 400', async ({
    request,
  }: any) => {
    const res = await request.post('/v1/auth/register', { data: {} });
    expect(res.status()).toBe(400);
  });

  test('dynToken user can access their own orders', async ({
    request,
  }: any) => {
    const res = await request.get('/v1/orders', {
      headers: authHeader(dynToken),
    });
    expect(res.status()).toBe(200);
    const body = await res.json();
    expect(body.data).toBeDefined();
  });
});

// ── TEARDOWN ──────────────────────────────────────────────────────────────────
test.describe('Teardown – admin removes test fixtures', () => {
  test('admin re-login for teardown', async ({ request }: any) => {
    const { accessToken } = await loginAs(request, ADMIN_EMAIL, ADMIN_PASSWORD);
    adminToken = accessToken;
    expect(adminToken).toBeTruthy();
  });

  test('admin deletes test product', async ({ request }: any) => {
    if (!testProductId) return;
    const res = await request.delete(`/v1/products/${testProductId}`, {
      headers: authHeader(adminToken),
    });
    expect(res.status()).toBe(200);
    testProductId = '';
  });

  test('admin deletes test category', async ({ request }: any) => {
    if (!testCategoryId) return;
    const res = await request.delete(`/v1/categories/${testCategoryId}`, {
      headers: authHeader(adminToken),
    });
    expect(res.status()).toBe(200);
    testCategoryId = '';
  });
});
