# Deployment Guide

## Local Development Setup

### Prerequisites

- Node.js 20+
- Docker Desktop
- npm

### Steps

```bash
# 1. Clone and install
git clone <repo-url>
cd ecommerce-backend
npm install

# 2. Configure environment
cp .env.example .env
# Edit .env — minimum required:
#   DATABASE_URL, JWT_ACCESS_SECRET, JWT_REFRESH_SECRET

# 3. Start infrastructure
docker-compose up -d
# Starts: PostgreSQL, Redis, RabbitMQ, Consul

# 4. Setup database
npm run prisma:generate
npm run prisma:migrate
npm run prisma:seed

# 5. Start all services
npm run dev
```

Services will be available at:

- API Gateway: http://localhost:3000
- Swagger UI: http://localhost:3000/docs
- RabbitMQ UI: http://localhost:15672 (admin/admin123)
- Redis Commander: http://localhost:8081
- Consul UI: http://localhost:8500

---

## Docker Deployment

### Build the image

```bash
docker build -t ecommerce-backend:latest .
```

### Run with docker-compose (full stack)

```bash
# Start all infrastructure + services
docker-compose -f docker-compose.full.yml up -d

# View logs
docker-compose logs -f api-gateway

# Stop
docker-compose down
```

### Run individual services

```bash
docker run -d \
  --name api-gateway \
  -p 3000:3000 \
  -e DATABASE_URL=postgresql://... \
  -e JWT_ACCESS_SECRET=... \
  -e JWT_REFRESH_SECRET=... \
  -e RABBITMQ_URL=amqp://... \
  ecommerce-backend:latest \
  node dist/services/api-gateway/server.js
```

---

## Railway Deployment

Railway is the recommended cloud platform. The `railway.json` is pre-configured.

### Steps

1. Install Railway CLI: `npm install -g @railway/cli`
2. Login: `railway login`
3. Create project: `railway init`
4. Add services in Railway dashboard:
   - PostgreSQL plugin
   - Redis plugin
   - RabbitMQ (via Docker image `rabbitmq:3-management-alpine`)
5. Set environment variables in Railway dashboard (see Environment Variables section below)
6. Deploy: `railway up`

### Required Environment Variables for Production

```
NODE_ENV=production
DATABASE_URL=<railway-postgres-url>
REDIS_HOST=<railway-redis-host>
REDIS_PORT=6379
REDIS_PASSWORD=<railway-redis-password>
RABBITMQ_URL=<rabbitmq-url>
JWT_ACCESS_SECRET=<min-32-char-random-string>
JWT_REFRESH_SECRET=<min-32-char-random-string>
STRIPE_SECRET_KEY=sk_live_...
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your@email.com
SMTP_PASSWORD=your-app-password
EMAIL_FROM=noreply@yourdomain.com
SENTRY_DSN=https://...@sentry.io/...
CORS_ORIGIN=https://yourdomain.com
```

### Deploying Multiple Services on Railway

Each microservice needs its own Railway service pointing to the same repo with a different start command:

| Service              | Start Command                                  |
| -------------------- | ---------------------------------------------- |
| API Gateway          | `node dist/services/api-gateway/server.js`     |
| Product Catalog      | `node dist/services/product-catalog/server.js` |
| Order Service        | `node dist/services/order/server.js`           |
| Inventory Service    | `node dist/services/inventory/server.js`       |
| Notification Service | `node dist/services/notification/server.js`    |

---

## Render Deployment

1. Create a new Web Service on [render.com](https://render.com)
2. Connect your GitHub repo
3. Set build command: `npm ci && npm run build && npx prisma generate`
4. Set start command: `node dist/services/api-gateway/server.js`
5. Add environment variables from the list above
6. Add a PostgreSQL and Redis database from Render's dashboard

---

## CI/CD Pipeline

GitHub Actions is configured at `.github/workflows/ci.yml`.

### Pipeline stages:

1. `test` — runs on every push/PR to `main` or `develop`
   - Spins up PostgreSQL + Redis
   - Runs `npm test` with coverage
   - Uploads coverage to Codecov
2. `build` — runs on push to `main` only
   - Builds Docker image

### To enable Docker push to a registry, update the build job:

```yaml
- name: Login to Docker Hub
  uses: docker/login-action@v3
  with:
    username: ${{ secrets.DOCKERHUB_USERNAME }}
    password: ${{ secrets.DOCKERHUB_TOKEN }}

- name: Build and push
  uses: docker/build-push-action@v5
  with:
    context: .
    push: true
    tags: yourusername/ecommerce-backend:latest
```

---

## Production Checklist

- [ ] `NODE_ENV=production`
- [ ] Strong JWT secrets (min 32 chars, randomly generated)
- [ ] HTTPS enabled (via reverse proxy like Nginx or platform-level)
- [ ] `SENTRY_DSN` configured for error tracking
- [ ] SMTP credentials configured for email notifications
- [ ] `CORS_ORIGIN` set to your actual frontend domain
- [ ] Database backups configured
- [ ] Redis persistence enabled (`appendonly yes`)
- [ ] RabbitMQ durable queues (already configured in code)
- [ ] Health check endpoints monitored (`/health`, `/ready`)
