// @ts-ignore
const { test, expect } = require('@playwright/test');

let adminToken: string;
let adminRefreshToken: string;
let userToken: string;
let categoryId: string;
let productId: string;
let orderId: string;

const ADMIN_EMAIL = 'admin@ecommerce.com';
const ADMIN_PASSWORD = 'Admin@1234';
const USER_EMAIL = 'user@ecommerce.com';
const USER_PASSWORD = 'User@1234';

async function loginAs(request: any, email: string, password: string) {
  const res = await request.post('/v1/auth/login', {
    data: { email, password },
  });
  expect(res.status(), `Login failed for ${email}: ${await res.text()}`).toBe(
    200,
  );
  const body = await res.json();
  return {
    accessToken: body.data.accessToken as string,
    refreshToken: body.data.refreshToken as string,
    user: body.data.user,
  };
}

function authHeader(token: string) {
  return { Authorization: `Bearer ${token}` };
}

async function withRetry(
  fn: () => Promise<any>,
  maxRetries = 3,
  delayMs = 2000,
): Promise<any> {
  let lastRes: any;
  for (let i = 0; i <= maxRetries; i++) {
    lastRes = await fn();
    if (lastRes.status() !== 500) return lastRes;
    if (i < maxRetries) await new Promise((r) => setTimeout(r, delayMs));
  }
  return lastRes;
}

// ── 0. SETUP — register user@ecommerce.com fresh via API ─────────────────────
test.describe('Setup', () => {
  test('register user@ecommerce.com via API', async ({ request }: any) => {
    const res = await request.post('/v1/auth/register', {
      data: {
        email: USER_EMAIL,
        password: USER_PASSWORD,
        firstName: 'User',
        lastName: 'User',
      },
    });
    expect(res.status(), `Register user failed: ${await res.text()}`).toBe(201);
    const body = await res.json();
    expect(body.data.user.email).toBe(USER_EMAIL);
    expect(body.data.user.role).toBe('USER');
  });

  test('login admin (created via globalSetup)', async ({ request }: any) => {
    const { accessToken, refreshToken, user } = await loginAs(
      request,
      ADMIN_EMAIL,
      ADMIN_PASSWORD,
    );
    adminToken = accessToken;
    adminRefreshToken = refreshToken;
    expect(user.email).toBe(ADMIN_EMAIL);
    expect(user.role).toBe('ADMIN');
    expect(adminToken).toBeTruthy();
  });
});

// ── 1. HEALTH ─────────────────────────────────────────────────────────────────
test.describe('Health endpoints', () => {
  test('GET /health returns 200', async ({ request }: any) => {
    const res = await request.get('/health');
    expect(res.status()).toBe(200);
    const body = await res.json();
    expect(body.data.service).toBe('api-gateway');
    expect(body.data.uptime).toBeDefined();
    expect(body.data.timestamp).toBeDefined();
  });

  test('GET /health/metrics returns memory and pid', async ({
    request,
  }: any) => {
    const res = await request.get('/health/metrics');
    expect(res.status()).toBe(200);
    const body = await res.json();
    expect(body.data.memory).toBeDefined();
    expect(body.data.pid).toBeDefined();
  });

  test('GET /ready returns ready:true', async ({ request }: any) => {
    const res = await request.get('/ready');
    expect(res.status()).toBe(200);
    const body = await res.json();
    expect(body.data.ready).toBe(true);
  });
});

// ── 2. AUTH ───────────────────────────────────────────────────────────────────
test.describe('Auth – admin', () => {
  test('login with wrong password returns 401', async ({ request }: any) => {
    const res = await request.post('/v1/auth/login', {
      data: { email: ADMIN_EMAIL, password: 'WrongPass!99' },
    });
    expect(res.status()).toBe(401);
    const body = await res.json();
    expect(body.message).toMatch(/invalid credentials/i);
  });

  test('login with unknown email returns 401', async ({ request }: any) => {
    const res = await request.post('/v1/auth/login', {
      data: { email: 'nobody@nowhere.com', password: 'Whatever1!' },
    });
    expect(res.status()).toBe(401);
  });

  test('register with duplicate admin email returns 409', async ({
    request,
  }: any) => {
    const res = await request.post('/v1/auth/register', {
      data: { email: ADMIN_EMAIL, password: 'SomePass1!', firstName: 'Dup' },
    });
    expect(res.status()).toBe(409);
    const body = await res.json();
    expect(body.message).toMatch(/already registered/i);
  });

  test('register with short password returns 400', async ({ request }: any) => {
    const res = await request.post('/v1/auth/register', {
      data: { email: 'short@test.com', password: 'abc' },
    });
    expect(res.status()).toBe(400);
  });

  test('register with invalid email returns 400', async ({ request }: any) => {
    const res = await request.post('/v1/auth/register', {
      data: { email: 'not-an-email', password: 'ValidPass@1' },
    });
    expect(res.status()).toBe(400);
  });
});

// ── 3. CATEGORIES ─────────────────────────────────────────────────────────────
test.describe('Categories – admin CRUD', () => {
  const ts = Date.now();
  const slug = `e2e-admin-cat-${ts}`;
  const name = `E2E Admin Category ${ts}`;

  test('re-login admin', async ({ request }: any) => {
    const { accessToken } = await loginAs(request, ADMIN_EMAIL, ADMIN_PASSWORD);
    adminToken = accessToken;
  });

  test('GET /v1/categories is public and returns array', async ({
    request,
  }: any) => {
    const res = await request.get('/v1/categories');
    expect(res.status()).toBe(200);
    const body = await res.json();
    expect(Array.isArray(body.data)).toBe(true);
  });

  test('POST /v1/categories without auth returns 401', async ({
    request,
  }: any) => {
    const res = await request.post('/v1/categories', {
      data: { name: 'Unauth Cat', slug: 'unauth-cat' },
    });
    expect(res.status()).toBe(401);
  });

  test('POST /v1/categories creates category as admin', async ({
    request,
  }: any) => {
    const res = await withRetry(() =>
      request.post('/v1/categories', {
        headers: authHeader(adminToken),
        data: { name, slug, description: 'Created by E2E admin test' },
      }),
    );
    expect(res.status(), `Create category failed: ${await res.text()}`).toBe(
      201,
    );
    const body = await res.json();
    categoryId = body.data.id;
    expect(categoryId).toBeTruthy();
    expect(body.data.slug).toBe(slug);
  });

  test('GET /v1/categories/:id returns the created category', async ({
    request,
  }: any) => {
    const res = await request.get(`/v1/categories/${categoryId}`);
    expect(res.status()).toBe(200);
    const body = await res.json();
    expect(body.data.id).toBe(categoryId);
    expect(body.data.slug).toBe(slug);
  });

  test('GET /v1/categories/:id with invalid UUID returns 400', async ({
    request,
  }: any) => {
    const res = await request.get('/v1/categories/not-a-uuid');
    expect(res.status()).toBe(400);
  });

  test('PUT /v1/categories/:id updates category as admin', async ({
    request,
  }: any) => {
    const res = await request.put(`/v1/categories/${categoryId}`, {
      headers: authHeader(adminToken),
      data: { description: 'Updated by E2E' },
    });
    expect(res.status()).toBe(200);
    const body = await res.json();
    expect(body.data.description).toBe('Updated by E2E');
  });

  test('PUT /v1/categories/:id with empty body returns 400', async ({
    request,
  }: any) => {
    const res = await request.put(`/v1/categories/${categoryId}`, {
      headers: authHeader(adminToken),
      data: {},
    });
    expect(res.status()).toBe(400);
  });

  test('PUT /v1/categories/:id without auth returns 401', async ({
    request,
  }: any) => {
    const res = await request.put(`/v1/categories/${categoryId}`, {
      data: { description: 'Sneaky update' },
    });
    expect(res.status()).toBe(401);
  });

  test('PUT /v1/categories/:id with invalid UUID returns 400', async ({
    request,
  }: any) => {
    const res = await request.put('/v1/categories/bad-id', {
      headers: authHeader(adminToken),
      data: { description: 'x' },
    });
    expect(res.status()).toBe(400);
  });
});

// ── 4. PRODUCTS ───────────────────────────────────────────────────────────────
test.describe('Products – admin CRUD', () => {
  const ts = Date.now();
  const sku = `E2E-ADMIN-SKU-${ts}`;
  const slug = `e2e-admin-product-${ts}`;
  const name = `E2E Admin Product ${ts}`;

  test('re-login admin', async ({ request }: any) => {
    const { accessToken } = await loginAs(request, ADMIN_EMAIL, ADMIN_PASSWORD);
    adminToken = accessToken;
  });

  test('GET /v1/products is public', async ({ request }: any) => {
    const res = await request.get('/v1/products');
    expect(res.status()).toBe(200);
    const body = await res.json();
    expect(body.data).toBeDefined();
  });

  test('GET /v1/products with pagination and filters', async ({
    request,
  }: any) => {
    const res = await request.get('/v1/products?page=1&limit=5&minPrice=1');
    expect(res.status()).toBe(200);
  });

  test('GET /v1/products with limit > 100 returns 400', async ({
    request,
  }: any) => {
    const res = await request.get('/v1/products?limit=999');
    expect(res.status()).toBe(400);
  });

  test('POST /v1/products without auth returns 401', async ({
    request,
  }: any) => {
    const res = await request.post('/v1/products', {
      data: { sku, name: 'Test', slug, price: 9.99, categoryId },
    });
    expect(res.status()).toBe(401);
  });

  test('POST /v1/products creates product as admin', async ({
    request,
  }: any) => {
    const res = await withRetry(() =>
      request.post('/v1/products', {
        headers: authHeader(adminToken),
        data: {
          sku,
          name,
          slug,
          description: 'Created by E2E',
          price: 49.99,
          categoryId,
        },
      }),
    );
    expect(res.status(), `Create product failed: ${await res.text()}`).toBe(
      201,
    );
    const body = await res.json();
    productId = body.data.id;
    expect(productId).toBeTruthy();
    expect(body.data.sku).toBe(sku);
  });

  test('GET /v1/products/:id returns the created product', async ({
    request,
  }: any) => {
    const res = await request.get(`/v1/products/${productId}`);
    expect(res.status()).toBe(200);
    const body = await res.json();
    expect(body.data.id).toBe(productId);
    expect(Number(body.data.price)).toBe(49.99);
  });

  test('GET /v1/products/:id with invalid UUID returns 400', async ({
    request,
  }: any) => {
    const res = await request.get('/v1/products/not-a-uuid');
    expect(res.status()).toBe(400);
  });

  test('GET /v1/products with categoryId filter', async ({ request }: any) => {
    const res = await request.get(`/v1/products?categoryId=${categoryId}`);
    expect(res.status()).toBe(200);
  });

  test('GET /v1/products with search query', async ({ request }: any) => {
    const res = await request.get('/v1/products?search=E2E');
    expect(res.status()).toBe(200);
  });

  test('PUT /v1/products/:id updates product as admin', async ({
    request,
  }: any) => {
    const res = await request.put(`/v1/products/${productId}`, {
      headers: authHeader(adminToken),
      data: { price: 39.99, description: 'Updated by E2E admin' },
    });
    expect(res.status()).toBe(200);
    const body = await res.json();
    expect(Number(body.data.price)).toBe(39.99);
  });

  test('PUT /v1/products/:id with empty body returns 400', async ({
    request,
  }: any) => {
    const res = await request.put(`/v1/products/${productId}`, {
      headers: authHeader(adminToken),
      data: {},
    });
    expect(res.status()).toBe(400);
  });

  test('PUT /v1/products/:id without auth returns 401', async ({
    request,
  }: any) => {
    const res = await request.put(`/v1/products/${productId}`, {
      data: { price: 1.0 },
    });
    expect(res.status()).toBe(401);
  });

  test('PUT /v1/products/:id with invalid UUID returns 400', async ({
    request,
  }: any) => {
    const res = await request.put('/v1/products/bad-id', {
      headers: authHeader(adminToken),
      data: { price: 1.0 },
    });
    expect(res.status()).toBe(400);
  });
});

// ── 5. ORDERS ─────────────────────────────────────────────────────────────────
test.describe('Orders – admin observes', () => {
  test('re-login admin', async ({ request }: any) => {
    const { accessToken } = await loginAs(request, ADMIN_EMAIL, ADMIN_PASSWORD);
    adminToken = accessToken;
  });

  test('login user', async ({ request }: any) => {
    const { accessToken } = await loginAs(request, USER_EMAIL, USER_PASSWORD);
    userToken = accessToken;
  });

  test('GET /v1/orders without auth returns 401', async ({ request }: any) => {
    const res = await request.get('/v1/orders');
    expect(res.status()).toBe(401);
  });

  test('admin can list orders', async ({ request }: any) => {
    const res = await request.get('/v1/orders', {
      headers: authHeader(adminToken),
    });
    expect(res.status()).toBe(200);
    const body = await res.json();
    expect(body.data).toBeDefined();
  });

  test('GET /v1/orders/:id with invalid UUID returns 400', async ({
    request,
  }: any) => {
    const res = await request.get('/v1/orders/not-a-uuid', {
      headers: authHeader(adminToken),
    });
    expect(res.status()).toBe(400);
  });

  test('PUT /v1/orders/:id/cancel with invalid UUID returns 400', async ({
    request,
  }: any) => {
    const res = await request.put('/v1/orders/not-a-uuid/cancel', {
      headers: authHeader(adminToken),
    });
    expect(res.status()).toBe(400);
  });

  test('user creates an order', async ({ request }: any) => {
    const res = await request.post('/v1/orders', {
      headers: authHeader(userToken),
      data: {
        items: [{ productId, quantity: 1 }],
        shippingAddress: {
          street: '123 Main St',
          city: 'Springfield',
          state: 'IL',
          zipCode: '62701',
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

  test('admin can get order by id', async ({ request }: any) => {
    if (!orderId) return;
    const res = await request.get(`/v1/orders/${orderId}`, {
      headers: authHeader(adminToken),
    });
    expect(res.status()).toBe(200);
    const body = await res.json();
    expect(body.data.id).toBe(orderId);
  });
});

// ── 6. RBAC ───────────────────────────────────────────────────────────────────
test.describe('RBAC – user blocked from admin routes', () => {
  test('re-login user for RBAC tests', async ({ request }: any) => {
    const { accessToken } = await loginAs(request, USER_EMAIL, USER_PASSWORD);
    userToken = accessToken;
  });

  test('user cannot create a category', async ({ request }: any) => {
    const res = await request.post('/v1/categories', {
      headers: authHeader(userToken),
      data: { name: 'Forbidden Cat', slug: `forbidden-cat-${Date.now()}` },
    });
    expect(res.status()).toBe(403);
  });

  test('user cannot update a category', async ({ request }: any) => {
    const res = await request.put(`/v1/categories/${categoryId}`, {
      headers: authHeader(userToken),
      data: { description: 'Sneaky' },
    });
    expect(res.status()).toBe(403);
  });

  test('user cannot delete a category', async ({ request }: any) => {
    const res = await request.delete(`/v1/categories/${categoryId}`, {
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
        categoryId,
      },
    });
    expect(res.status()).toBe(403);
  });

  test('user cannot update a product', async ({ request }: any) => {
    const res = await request.put(`/v1/products/${productId}`, {
      headers: authHeader(userToken),
      data: { price: 1.0 },
    });
    expect(res.status()).toBe(403);
  });

  test('user cannot delete a product', async ({ request }: any) => {
    const res = await request.delete(`/v1/products/${productId}`, {
      headers: authHeader(userToken),
    });
    expect(res.status()).toBe(403);
  });
});

// ── 7. TOKEN OPS ──────────────────────────────────────────────────────────────
test.describe('Auth – token operations', () => {
  test('re-login admin to get fresh refreshToken', async ({ request }: any) => {
    const { accessToken, refreshToken } = await loginAs(
      request,
      ADMIN_EMAIL,
      ADMIN_PASSWORD,
    );
    adminToken = accessToken;
    adminRefreshToken = refreshToken;
  });

  test('refresh token returns new access token', async ({ request }: any) => {
    const res = await request.post('/v1/auth/refresh', {
      data: { refreshToken: adminRefreshToken },
    });
    expect(res.status()).toBe(200);
    const body = await res.json();
    expect(body.data.accessToken).toBeTruthy();
    adminToken = body.data.accessToken;
  });

  test('refresh with invalid token returns 401', async ({ request }: any) => {
    const res = await request.post('/v1/auth/refresh', {
      data: { refreshToken: 'totally.invalid.token' },
    });
    expect(res.status()).toBe(401);
  });

  test('refresh with missing body returns 400', async ({ request }: any) => {
    const res = await request.post('/v1/auth/refresh', { data: {} });
    expect(res.status()).toBe(400);
  });
});

// ── 8. CLEANUP ────────────────────────────────────────────────────────────────
test.describe('Cleanup', () => {
  test('re-login admin for cleanup', async ({ request }: any) => {
    const { accessToken } = await loginAs(request, ADMIN_EMAIL, ADMIN_PASSWORD);
    adminToken = accessToken;
  });

  test('admin deletes the test product', async ({ request }: any) => {
    if (!productId) return;
    const res = await request.delete(`/v1/products/${productId}`, {
      headers: authHeader(adminToken),
    });
    expect(res.status()).toBe(200);
    productId = '';
  });

  test('admin deletes the test category', async ({ request }: any) => {
    if (!categoryId) return;
    const res = await request.delete(`/v1/categories/${categoryId}`, {
      headers: authHeader(adminToken),
    });
    expect(res.status()).toBe(200);
    categoryId = '';
  });
});
