# E-Commerce Backend

Complete enterprise-grade e-commerce backend with microservices architecture in a single project.

## 🚀 Quick Start

**Important:** Make sure Docker Desktop is running before starting!

```bash
# 1. Install dependencies
npm install

# 2. Setup environment
cp .env.example .env
# Edit .env with your configuration

# 3. Start infrastructure (requires Docker)
docker-compose up -d

# 4. Setup database
npm run prisma:generate
npm run prisma:migrate

# 5. Start all services
npm run dev
```

**Having issues?** See the detailed [Quick Start Guide](./QUICK_START.md) for troubleshooting.

**Test RabbitMQ:**

```bash
npm run rabbitmq:test
```

## 📦 Services

| Service              | Port  | Description                              |
| -------------------- | ----- | ---------------------------------------- |
| API Gateway          | 3000  | Authentication, routing, rate limiting   |
| Product Catalog      | 3001  | Products & categories with Redis caching |
| Order Service        | 3002  | Order management & Stripe payments       |
| Inventory Service    | 3003  | Stock management & reservations          |
| Notification Service | 3004  | Emails, Socket.IO, background jobs       |
| RabbitMQ             | 5672  | Message broker for inter-service comm    |
| RabbitMQ Management  | 15672 | Web UI for monitoring queues             |
| PostgreSQL           | 5432  | Primary database                         |
| Redis                | 6379  | Cache & background jobs                  |
| Consul               | 8500  | Service discovery (optional)             |

## 🔄 Communication Architecture

The application uses **RabbitMQ** for inter-service communication:

- **RPC Pattern**: Synchronous-like request-reply (e.g., API Gateway → Product Service)
- **Event Pattern**: Asynchronous publish-subscribe (e.g., Order Created → Email Notification)

See [RABBITMQ_MIGRATION.md](./RABBITMQ_MIGRATION.md) for detailed architecture and migration guide.

### Key Benefits

- ✅ Decoupled services
- ✅ Fault tolerance with message persistence
- ✅ Automatic retries and error handling
- ✅ Horizontal scalability
- ✅ Built-in load balancing

## 🛠️ Tech Stack

- **Runtime**: Node.js 20+
- **Language**: TypeScript 5.x
- **Framework**: Fastify
- **Database**: PostgreSQL 16 + Prisma ORM
- **Cache**: Redis 7
- **Message Broker**: RabbitMQ 3 (AMQP)
- **Background Jobs**: BullMQ (Redis-based)
- **Real-time**: Socket.IO
- **Auth**: JWT + OAuth2 (Google)
- **Payment**: Stripe
- **Email**: Nodemailer
- **Validation**: Zod
- **Logging**: Pino
- **Service Discovery**: Consul (optional)

## 📚 API Documentation

Swagger UI available at: http://localhost:3000/docs

### Authentication

```bash
# Register
POST /v1/auth/register
{
  "email": "user@example.com",
  "password": "password123",
  "firstName": "John",
  "lastName": "Doe"
}

# Login
POST /v1/auth/login
{
  "email": "user@example.com",
  "password": "password123"
}
```

### Products

```bash
# List products
GET /v1/products?page=1&limit=20

# Get product
GET /v1/products/:id

# Create product (Admin only)
POST /v1/products
Authorization: Bearer <token>
{
  "sku": "PROD-001",
  "name": "Product Name",
  "slug": "product-name",
  "price": 99.99,
  "categoryId": "uuid"
}
```

### Orders

```bash
# Create order
POST /v1/orders
Authorization: Bearer <token>
{
  "items": [
    {
      "productId": "uuid",
      "quantity": 2
    }
  ],
  "shippingAddress": {
    "street": "123 Main St",
    "city": "New York",
    "state": "NY",
    "zipCode": "10001",
    "country": "USA"
  },
  "paymentMethodId": "pm_test_..."
}
```

## 🏗️ Project Structure

```
ecommerce-backend/
├── src/
│   ├── shared/                 # Shared utilities
│   │   ├── constants/          # Response codes, enums
│   │   ├── types/              # TypeScript interfaces
│   │   ├── errors/             # Custom error classes
│   │   ├── middleware/         # Response enhancer
│   │   ├── utils/              # Logger, error helper
│   │   └── config/             # Environment validation
│   │
│   └── services/
│       ├── api-gateway/        # API Gateway (:3000)
│       ├── product-catalog/    # Product Service (:3001)
│       ├── order/              # Order Service (:3002)
│       ├── inventory/          # Inventory Service (:3003)
│       └── notification/       # Notification Service (:3004)
│
├── prisma/
│   └── schema.prisma           # Database schema
├── docker-compose.yml
├── package.json
└── tsconfig.json
```

## 🔧 Development

```bash
# Start all services
npm run dev

# Start individual services
npm run dev:gateway
npm run dev:products
npm run dev:orders
npm run dev:inventory
npm run dev:notifications

# Build
npm run build

# Run tests
npm test

# Database
npm run prisma:studio
npm run prisma:migrate
```

## 🐳 Docker

```bash
# Start infrastructure (PostgreSQL, Redis, RabbitMQ, Consul)
docker-compose up -d

# Access RabbitMQ Management UI
open http://localhost:15672
# Username: admin, Password: admin123

# View logs
docker-compose logs -f

# Stop
docker-compose down
```

## 📝 Environment Variables

See `.env.example` for all required variables.

**Critical variables:**

- `DATABASE_URL` - PostgreSQL connection
- `RABBITMQ_URL` - RabbitMQ connection (default: amqp://admin:admin123@localhost:5672)
- `REDIS_HOST` - Redis host
- `JWT_ACCESS_SECRET` - Min 32 characters
- `JWT_REFRESH_SECRET` - Min 32 characters
- `STRIPE_SECRET_KEY` - Stripe API key
- `SMTP_*` - Email configuration

## 🔒 Security

- JWT access (15m) + refresh (7d) tokens
- Argon2 password hashing
- Rate limiting (100 req/15min)
- Helmet security headers
- CORS whitelist
- Input validation (Zod)
- SQL injection prevention (Prisma)

## 📊 Features

- ✅ User authentication (JWT + OAuth2)
- ✅ Product catalog with caching
- ✅ Order management
- ✅ Payment processing (Stripe)
- ✅ Inventory tracking
- ✅ Stock reservations
- ✅ **RabbitMQ message-based communication**
- ✅ **RPC pattern for synchronous operations**
- ✅ **Event-driven architecture for notifications**
- ✅ Email notifications
- ✅ Real-time updates (Socket.IO)
- ✅ Background job processing (BullMQ)
- ✅ Low-stock alerts
- ✅ Standardized API responses
- ✅ Centralized error logging
- ✅ Health checks
- ✅ API documentation (Swagger)
- ✅ Service discovery (Consul)

## 📖 Documentation

- **[Quick Start Guide](./QUICK_START.md)** - Step-by-step setup with troubleshooting
- **[RabbitMQ Migration Guide](./RABBITMQ_MIGRATION.md)** - Complete guide to RabbitMQ implementation
- **[RabbitMQ Architecture](./docs/RABBITMQ_ARCHITECTURE.md)** - Detailed architecture diagrams and patterns
- **[Implementation Summary](./IMPLEMENTATION_SUMMARY.md)** - What changed in the migration
- [Manual Testing Plan](./MANUAL_TESTING_PLAN.md) - Testing scenarios
- [Project Info](./PROJECT_INFO.md) - Project overview
- [Setup Guide](./SETUP.md) - Detailed setup instructions

## 🚀 Production Deployment

1. Set `NODE_ENV=production`
2. Use strong secrets (min 32 chars)
3. Configure production database
4. Set up Redis cluster
5. Configure SMTP
6. Enable HTTPS
7. Set up monitoring
8. Configure log aggregation

## 📄 License

MIT
