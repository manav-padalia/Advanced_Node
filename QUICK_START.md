# Quick Start Guide

## Prerequisites

- **Node.js 20+** — check with `node --version`
- **Docker Desktop** — must be running before step 3
- **npm** — comes with Node.js

---

## Step-by-Step Setup

### 1. Install dependencies

```bash
npm install
```

### 2. Configure environment

```bash
cp .env.example .env
```

Open `.env` and set at minimum:

- `JWT_ACCESS_SECRET` — random string, min 32 characters
- `JWT_REFRESH_SECRET` — different random string, min 32 characters

Everything else has working defaults for local development.

### 3. Start infrastructure

```bash
docker-compose up -d
```

This starts PostgreSQL, Redis, RabbitMQ, and Consul. Wait ~15 seconds for them to be healthy.

Verify:

```bash
docker-compose ps
# All services should show "healthy" or "running"
```

### 4. Setup database

```bash
npm run prisma:generate
npm run prisma:migrate
npm run prisma:seed
```

The seed creates:

- Admin user: `admin@ecommerce.com` / `Admin@1234`
- Regular user: `user@ecommerce.com` / `User@1234`
- Sample categories and products

### 5. Start all services

```bash
npm run dev
```

This starts all 5 microservices concurrently.

---

## Verify Everything Works

```bash
# Health check
curl http://localhost:3000/health

# Login
curl -X POST http://localhost:3000/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"user@ecommerce.com","password":"User@1234"}'

# Browse API docs
open http://localhost:3000/docs
```

---

## Troubleshooting

### "Cannot connect to database"

- Make sure Docker Desktop is running
- Run `docker-compose ps` — postgres should be healthy
- Check `DATABASE_URL` in your `.env`

### "RabbitMQ connection refused"

- Wait a few more seconds after `docker-compose up -d`
- Check `docker-compose logs rabbitmq`
- Verify `RABBITMQ_URL=amqp://admin:admin123@localhost:5672` in `.env`

### "JWT_ACCESS_SECRET must be at least 32 characters"

- Open `.env` and set a longer secret string

### Port already in use

- Check what's using the port: `lsof -i :3000`
- Stop the conflicting process or change the port in `.env`

### Prisma migration errors

```bash
# Reset database (drops all data)
npx prisma migrate reset
npm run prisma:seed
```

---

## Individual Service Start

```bash
npm run dev:gateway       # API Gateway :3000
npm run dev:products      # Product Catalog :3001
npm run dev:orders        # Order Service :3002
npm run dev:inventory     # Inventory Service :3003
npm run dev:notifications # Notification Service :3004
```

---

## Running Tests

```bash
# Unit tests with coverage
npm test

# E2E tests (requires all services running)
npm run test:e2e

# E2E admin scenarios only
npm run test:e2e:admin

# E2E user scenarios only
npm run test:e2e:user
```
