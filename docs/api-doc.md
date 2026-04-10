# E-Commerce API Documentation

## Overview

This document covers the full API surface of the E-Commerce platform. All client traffic enters through the **API Gateway** (port `3000`), which authenticates requests, enforces rate limits, and proxies to downstream microservices.

| Service         | Default Port | Description                        |
| --------------- | ------------ | ---------------------------------- |
| API Gateway     | 3000         | Single entry point for all clients |
| Product Catalog | 3001         | Products and categories            |
| Order           | 3002         | Order lifecycle management         |
| Inventory       | 3003         | Stock levels and reservations      |
| Notification    | 3004         | Email and real-time alerts         |

Interactive Swagger UI is available at `http://localhost:3000/docs` when the gateway is running.

---

## OpenAPI / Swagger Specification

The gateway auto-generates an OpenAPI 3.0 spec via `@fastify/swagger`. The spec is served at:

- **UI:** `GET /docs`
- **JSON:** `GET /docs/json`
- **YAML:** `GET /docs/yaml`

### Spec Info

```yaml
openapi: '3.0.0'
info:
  title: E-Commerce API Gateway
  version: '1.0.0'
servers:
  - url: http://localhost:3000
    description: Development
components:
  securitySchemes:
    bearerAuth:
      type: http
      scheme: bearer
      bearerFormat: JWT
```

---

## Authentication

### How It Works

The API uses **JWT Bearer tokens**. Two token types are issued:

| Token         | Expiry     | Purpose                   |
| ------------- | ---------- | ------------------------- |
| Access Token  | 15 minutes | Authenticate API requests |
| Refresh Token | 7 days     | Obtain a new access token |

### Using a Token

Include the access token in every protected request:

```
Authorization: Bearer <access_token>
```

### JWT Payload

```json
{
  "userId": "uuid",
  "email": "user@example.com",
  "role": "USER | ADMIN"
}
```

### Roles

| Role    | Description                                                          |
| ------- | -------------------------------------------------------------------- |
| `USER`  | Default role. Can browse products, place and cancel own orders.      |
| `ADMIN` | Full access. Can create, update, and delete products and categories. |

### OAuth2 (Google)

Redirect the user to `GET /v1/auth/google`. After Google authenticates the user, the callback at `GET /v1/auth/google/callback` issues the same `accessToken` / `refreshToken` pair.

---

## Rate Limits

Rate limiting is applied at the API Gateway level using `@fastify/rate-limit`.

| Setting      | Default                                          | Env Variable                |
| ------------ | ------------------------------------------------ | --------------------------- |
| Window       | 15 minutes                                       | `RATE_LIMIT_WINDOW_MS` (ms) |
| Max requests | 100                                              | `RATE_LIMIT_MAX_REQUESTS`   |
| Key          | `user:<userId>` if authenticated, else `ip:<ip>` | —                           |

When the limit is exceeded the gateway returns:

```json
{
  "status": 429,
  "message": "Too many requests",
  "data": {},
  "error": "Too many requests"
}
```

---

## Standard Response Format

Every response — success or error — follows this envelope:

```json
{
  "status": 200,
  "message": "Human-readable description",
  "data": {},
  "error": ""
}
```

On error, `data` is `{}` and `error` contains the error detail. On success, `error` is `""`.

### Pagination

List endpoints that support pagination return:

```json
{
  "status": 200,
  "message": "...",
  "data": {
    "items": [],
    "meta": {
      "page": 1,
      "limit": 20,
      "total": 100,
      "totalPages": 5,
      "hasNext": true,
      "hasPrev": false
    }
  },
  "error": ""
}
```

---

## Error Response Formats

### Error Codes

| HTTP Status | Class                 | When                                               |
| ----------- | --------------------- | -------------------------------------------------- |
| 400         | Bad Request           | Invalid input or validation failure                |
| 401         | Unauthorized          | Missing, invalid, or expired token                 |
| 403         | Forbidden             | Authenticated but insufficient role                |
| 404         | Not Found             | Resource does not exist                            |
| 409         | Conflict              | Duplicate resource (e.g. email already registered) |
| 422         | Unprocessable Entity  | Semantic validation failure                        |
| 429         | Too Many Requests     | Rate limit exceeded                                |
| 500         | Internal Server Error | Unexpected server-side failure                     |

### Examples

**401 — Missing token**

```json
{
  "status": 401,
  "message": "Missing or invalid authorization header",
  "data": {},
  "error": "Missing or invalid authorization header"
}
```

**400 — Validation error**

```json
{
  "status": 400,
  "message": "Validation error",
  "data": {},
  "error": "items.0.productId: Invalid product ID, shippingAddress.zipCode: Zip code is required"
}
```

**403 — Insufficient role**

```json
{
  "status": 403,
  "message": "Access denied. Required roles: ADMIN",
  "data": {},
  "error": "Access denied. Required roles: ADMIN"
}
```

**404 — Not found**

```json
{
  "status": 404,
  "message": "Product not found",
  "data": {},
  "error": "Product not found"
}
```

**409 — Conflict**

```json
{
  "status": 409,
  "message": "Email already registered",
  "data": {},
  "error": "Email already registered"
}
```

**429 — Rate limit**

```json
{
  "status": 429,
  "message": "Too many requests",
  "data": {},
  "error": "Too many requests"
}
```

**500 — Server error**

```json
{
  "status": 500,
  "message": "Internal server error",
  "data": {},
  "error": "Internal server error"
}
```

---

## Endpoints

### Auth — `/v1/auth`

#### `POST /v1/auth/register`

Register a new user account.

**Auth required:** No

**Request body:**

```json
{
  "email": "user@example.com",
  "password": "secret123",
  "firstName": "Jane",
  "lastName": "Doe"
}
```

| Field     | Type   | Required | Notes                 |
| --------- | ------ | -------- | --------------------- |
| email     | string | Yes      | Must be a valid email |
| password  | string | Yes      | Minimum 8 characters  |
| firstName | string | No       |                       |
| lastName  | string | No       |                       |

**Response `201`:**

```json
{
  "status": 201,
  "message": "User registered successfully",
  "data": {
    "user": {
      "id": "550e8400-e29b-41d4-a716-446655440000",
      "email": "user@example.com",
      "firstName": "Jane",
      "lastName": "Doe",
      "role": "USER"
    },
    "accessToken": "<jwt>",
    "refreshToken": "<jwt>"
  },
  "error": ""
}
```

**Errors:** `400` validation, `409` email already registered

---

#### `POST /v1/auth/login`

Authenticate with email and password.

**Auth required:** No

**Request body:**

```json
{
  "email": "user@example.com",
  "password": "secret123"
}
```

**Response `200`:**

```json
{
  "status": 200,
  "message": "Login successful",
  "data": {
    "user": {
      "id": "550e8400-e29b-41d4-a716-446655440000",
      "email": "user@example.com",
      "firstName": "Jane",
      "lastName": "Doe",
      "role": "USER"
    },
    "accessToken": "<jwt>",
    "refreshToken": "<jwt>"
  },
  "error": ""
}
```

**Errors:** `400` validation, `401` invalid credentials or account disabled

---

#### `POST /v1/auth/refresh`

Exchange a valid refresh token for a new access token.

**Auth required:** No

**Request body:**

```json
{
  "refreshToken": "<jwt>"
}
```

**Response `200`:**

```json
{
  "status": 200,
  "message": "Token refreshed successfully",
  "data": {
    "accessToken": "<new_jwt>"
  },
  "error": ""
}
```

**Errors:** `401` invalid or expired refresh token

---

#### `GET /v1/auth/google`

Initiates Google OAuth2 flow. Redirects the browser to Google's consent screen.

**Auth required:** No

**Response:** `302` redirect to Google

---

#### `GET /v1/auth/google/callback`

OAuth2 callback. Google redirects here after user consent. Returns tokens on success.

**Auth required:** No

**Query params:** `code`, `state` (managed by Google)

**Response `200`:** Same shape as login response, with `provider: "GOOGLE"` on the user object.

**Errors:** `400` missing/invalid state or OAuth not configured, `401` Google token exchange failed

---

### Products — `/v1/products`

#### `GET /v1/products`

List products with optional filtering and pagination.

**Auth required:** No

**Query parameters:**

| Param      | Type    | Default | Notes                                |
| ---------- | ------- | ------- | ------------------------------------ |
| page       | integer | 1       |                                      |
| limit      | integer | 20      | Max 100                              |
| categoryId | uuid    | —       | Filter by category                   |
| minPrice   | number  | —       | Minimum price filter                 |
| maxPrice   | number  | —       | Maximum price filter                 |
| search     | string  | —       | Full-text search on name/description |

**Response `200`:**

```json
{
  "status": 200,
  "message": "Products fetched successfully",
  "data": {
    "items": [
      {
        "id": "uuid",
        "sku": "PROD-001",
        "name": "Wireless Headphones",
        "slug": "wireless-headphones",
        "description": "Premium noise-cancelling headphones",
        "price": 199.99,
        "categoryId": "uuid",
        "imageUrl": "https://example.com/image.jpg"
      }
    ],
    "meta": {
      "page": 1,
      "limit": 20,
      "total": 50,
      "totalPages": 3,
      "hasNext": true,
      "hasPrev": false
    }
  },
  "error": ""
}
```

---

#### `GET /v1/products/:id`

Get a single product by UUID.

**Auth required:** No

**Path params:** `id` — UUID

**Response `200`:**

```json
{
  "status": 200,
  "message": "Product fetched successfully",
  "data": {
    "product": {
      "id": "uuid",
      "sku": "PROD-001",
      "name": "Wireless Headphones",
      "slug": "wireless-headphones",
      "description": "Premium noise-cancelling headphones",
      "price": 199.99,
      "categoryId": "uuid",
      "imageUrl": "https://example.com/image.jpg"
    }
  },
  "error": ""
}
```

**Errors:** `400` invalid UUID, `404` not found

---

#### `POST /v1/products`

Create a new product.

**Auth required:** Yes — `ADMIN` role

**Request body:**

```json
{
  "sku": "PROD-002",
  "name": "Bluetooth Speaker",
  "slug": "bluetooth-speaker",
  "description": "Portable waterproof speaker",
  "price": 89.99,
  "categoryId": "uuid",
  "imageUrl": "https://example.com/speaker.jpg"
}
```

| Field       | Type         | Required | Notes                            |
| ----------- | ------------ | -------- | -------------------------------- |
| sku         | string       | Yes      | Max 100 chars                    |
| name        | string       | Yes      | Max 255 chars                    |
| slug        | string       | Yes      | Max 255 chars, URL-safe          |
| description | string       | No       |                                  |
| price       | number       | Yes      | Must be positive                 |
| categoryId  | uuid         | Yes      | Must reference existing category |
| imageUrl    | string (url) | No       |                                  |

**Response `201`:**

```json
{
  "status": 201,
  "message": "Product created successfully",
  "data": { "product": { "id": "uuid", "...": "..." } },
  "error": ""
}
```

**Errors:** `400` validation, `401` unauthenticated, `403` not admin

---

#### `PUT /v1/products/:id`

Update an existing product. All fields are optional (partial update).

**Auth required:** Yes — `ADMIN` role

**Path params:** `id` — UUID

**Request body:** Any subset of the create body fields.

**Response `200`:**

```json
{
  "status": 200,
  "message": "Product updated successfully",
  "data": { "product": { "id": "uuid", "...": "..." } },
  "error": ""
}
```

**Errors:** `400` empty body or invalid UUID, `401`, `403`, `404`

---

#### `DELETE /v1/products/:id`

Delete a product.

**Auth required:** Yes — `ADMIN` role

**Path params:** `id` — UUID

**Response `200`:**

```json
{
  "status": 200,
  "message": "Product deleted successfully",
  "data": {},
  "error": ""
}
```

**Errors:** `400` invalid UUID, `401`, `403`, `404`

---

### Categories — `/v1/categories`

#### `GET /v1/categories`

List all categories.

**Auth required:** No

**Response `200`:**

```json
{
  "status": 200,
  "message": "Categories fetched successfully",
  "data": {
    "categories": [
      {
        "id": "uuid",
        "name": "Electronics",
        "slug": "electronics",
        "description": "Electronic devices and accessories",
        "parentId": null
      }
    ]
  },
  "error": ""
}
```

---

#### `GET /v1/categories/:id`

Get a single category by UUID.

**Auth required:** No

**Path params:** `id` — UUID

**Response `200`:**

```json
{
  "status": 200,
  "message": "Category fetched successfully",
  "data": {
    "category": {
      "id": "uuid",
      "name": "Electronics",
      "slug": "electronics",
      "description": "Electronic devices and accessories",
      "parentId": null
    }
  },
  "error": ""
}
```

**Errors:** `400` invalid UUID, `404` not found

---

#### `POST /v1/categories`

Create a new category.

**Auth required:** Yes — `ADMIN` role

**Request body:**

```json
{
  "name": "Audio",
  "slug": "audio",
  "description": "Headphones, speakers, and more",
  "parentId": "uuid"
}
```

| Field       | Type   | Required | Notes                       |
| ----------- | ------ | -------- | --------------------------- |
| name        | string | Yes      | Max 255 chars               |
| slug        | string | Yes      | Max 255 chars               |
| description | string | No       |                             |
| parentId    | uuid   | No       | Parent category for nesting |

**Response `201`:**

```json
{
  "status": 201,
  "message": "Category created successfully",
  "data": { "category": { "id": "uuid", "...": "..." } },
  "error": ""
}
```

**Errors:** `400` validation, `401`, `403`

---

#### `PUT /v1/categories/:id`

Update a category. All fields are optional.

**Auth required:** Yes — `ADMIN` role

**Path params:** `id` — UUID

**Response `200`:**

```json
{
  "status": 200,
  "message": "Category updated successfully",
  "data": { "category": { "id": "uuid", "...": "..." } },
  "error": ""
}
```

**Errors:** `400` empty body or invalid UUID, `401`, `403`, `404`

---

#### `DELETE /v1/categories/:id`

Delete a category.

**Auth required:** Yes — `ADMIN` role

**Path params:** `id` — UUID

**Response `200`:**

```json
{
  "status": 200,
  "message": "Category deleted successfully",
  "data": {},
  "error": ""
}
```

**Errors:** `400` invalid UUID, `401`, `403`, `404`

---

### Orders — `/v1/orders`

All order endpoints require authentication.

#### `GET /v1/orders`

List the authenticated user's orders.

**Auth required:** Yes

**Query parameters:**

| Param  | Type    | Default | Notes                  |
| ------ | ------- | ------- | ---------------------- |
| page   | integer | 1       |                        |
| limit  | integer | 20      | Max 100                |
| status | string  | —       | Filter by order status |

**Response `200`:**

```json
{
  "status": 200,
  "message": "Orders fetched successfully",
  "data": {
    "orders": [
      {
        "id": "uuid",
        "userId": "uuid",
        "status": "PENDING",
        "items": [{ "productId": "uuid", "quantity": 2, "price": 199.99 }],
        "shippingAddress": {
          "street": "123 Main St",
          "city": "Springfield",
          "state": "IL",
          "zipCode": "62701",
          "country": "US"
        },
        "createdAt": "2026-04-10T12:00:00Z"
      }
    ]
  },
  "error": ""
}
```

**Errors:** `401` unauthenticated

---

#### `GET /v1/orders/:id`

Get a specific order by UUID. Users can only access their own orders.

**Auth required:** Yes

**Path params:** `id` — UUID

**Response `200`:**

```json
{
  "status": 200,
  "message": "Order fetched successfully",
  "data": {
    "order": {
      "id": "uuid",
      "userId": "uuid",
      "status": "PENDING",
      "items": [],
      "shippingAddress": {},
      "createdAt": "2026-04-10T12:00:00Z"
    }
  },
  "error": ""
}
```

**Errors:** `400` invalid UUID, `401`, `404`

---

#### `POST /v1/orders`

Place a new order.

**Auth required:** Yes

**Request body:**

```json
{
  "items": [{ "productId": "uuid", "quantity": 2 }],
  "shippingAddress": {
    "street": "123 Main St",
    "city": "Springfield",
    "state": "IL",
    "zipCode": "62701",
    "country": "US"
  },
  "paymentMethod": "pm_card_visa"
}
```

| Field             | Type    | Required | Notes                    |
| ----------------- | ------- | -------- | ------------------------ |
| items             | array   | Yes      | At least one item        |
| items[].productId | uuid    | Yes      |                          |
| items[].quantity  | integer | Yes      | Must be ≥ 1              |
| shippingAddress   | object  | Yes      | All sub-fields required  |
| paymentMethod     | string  | No       | Stripe payment method ID |

**Response `201`:**

```json
{
  "status": 201,
  "message": "Order created successfully",
  "data": {
    "order": {
      "id": "uuid",
      "status": "PENDING",
      "items": [],
      "shippingAddress": {},
      "createdAt": "2026-04-10T12:00:00Z"
    }
  },
  "error": ""
}
```

**Errors:** `400` validation (e.g. insufficient stock), `401`

---

#### `PUT /v1/orders/:id/cancel`

Cancel an order. Only orders in a cancellable state can be cancelled.

**Auth required:** Yes

**Path params:** `id` — UUID

**Response `200`:**

```json
{
  "status": 200,
  "message": "Order cancelled successfully",
  "data": {
    "order": {
      "id": "uuid",
      "status": "CANCELLED"
    }
  },
  "error": ""
}
```

**Errors:** `400` invalid UUID or order not cancellable, `401`, `404`

---

### Health & Metrics

These endpoints are available on the API Gateway and are not rate-limited.

#### `GET /health`

Returns service health status.

**Auth required:** No

**Response `200`:**

```json
{
  "status": "ok",
  "service": "api-gateway",
  "timestamp": "2026-04-10T12:00:00Z"
}
```

#### `GET /metrics`

Returns Prometheus-compatible metrics.

**Auth required:** No

---

## Internal Service Endpoints

The following endpoints are exposed by downstream services and are **not** directly accessible from the internet. They are called by the API Gateway or other services via internal networking.

### Inventory Service (port 3003)

| Method | Path                  | Description                            |
| ------ | --------------------- | -------------------------------------- |
| GET    | /inventory            | List all inventory records             |
| GET    | /inventory/low-stock  | Items below their low-stock threshold  |
| GET    | /inventory/:productId | Get inventory for a product            |
| PUT    | /inventory/:productId | Update quantity or low-stock threshold |
| POST   | /inventory/reserve    | Reserve stock for an order             |
| POST   | /inventory/release    | Release previously reserved stock      |

**Reserve / Release body:**

```json
{
  "items": [{ "productId": "uuid", "quantity": 2 }]
}
```

**Update body:**

```json
{
  "quantity": 50,
  "lowStockThreshold": 10
}
```

### Product Catalog Service (port 3001)

| Method | Path             | Description          |
| ------ | ---------------- | -------------------- |
| GET    | /products        | List products        |
| GET    | /products/:id    | Get product          |
| GET    | /products/search | Search products      |
| POST   | /products        | Create product       |
| PUT    | /products/:id    | Update product       |
| DELETE | /products/:id    | Delete product       |
| GET    | /categories      | List categories      |
| GET    | /categories/:id  | Get category         |
| POST   | /categories      | Create category      |
| PUT    | /categories/:id  | Update category      |
| DELETE | /categories/:id  | Delete category      |
| GET    | /cache/metrics   | Cache hit/miss stats |
| POST   | /cache/reset     | Reset cache metrics  |

### Order Service (port 3002)

| Method | Path               | Description                                  |
| ------ | ------------------ | -------------------------------------------- |
| GET    | /orders            | List orders (filtered by userId query param) |
| GET    | /orders/:id        | Get order                                    |
| POST   | /orders            | Create order                                 |
| PUT    | /orders/:id/cancel | Cancel order                                 |

---

## Environment Variables

Key variables that affect API behaviour:

| Variable                  | Default                 | Description                       |
| ------------------------- | ----------------------- | --------------------------------- |
| `JWT_ACCESS_EXPIRY`       | `15m`                   | Access token lifetime             |
| `JWT_REFRESH_EXPIRY`      | `7d`                    | Refresh token lifetime            |
| `RATE_LIMIT_MAX_REQUESTS` | `100`                   | Requests per window               |
| `RATE_LIMIT_WINDOW_MS`    | `900000`                | Window size in ms (15 min)        |
| `CORS_ORIGIN`             | `http://localhost:3000` | Allowed origins (comma-separated) |
