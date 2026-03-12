#!/bin/bash

# RabbitMQ Setup Script
# This script sets up RabbitMQ with proper configuration

set -e

echo "🐰 RabbitMQ Setup Script"
echo "========================"
echo ""

# Colors
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# Check if Docker is running
if ! docker info > /dev/null 2>&1; then
    echo -e "${RED}✗ Docker is not running${NC}"
    echo "Please start Docker and try again"
    exit 1
fi

echo "1. Starting RabbitMQ container..."
docker-compose up -d rabbitmq

echo ""
echo "2. Waiting for RabbitMQ to be ready..."
for i in {1..30}; do
    if curl -s http://localhost:15672/api/overview > /dev/null 2>&1; then
        echo -e "${GREEN}✓ RabbitMQ is ready!${NC}"
        break
    fi
    echo -n "."
    sleep 1
done

echo ""
echo "3. RabbitMQ Configuration:"
echo "  - AMQP Port: 5672"
echo "  - Management UI: http://localhost:15672"
echo "  - Username: admin"
echo "  - Password: admin123"
echo ""

echo "4. Testing connection..."
if curl -s -u admin:admin123 http://localhost:15672/api/overview > /dev/null 2>&1; then
    echo -e "${GREEN}✓ Connection successful!${NC}"
else
    echo -e "${RED}✗ Connection failed${NC}"
    exit 1
fi

echo ""
echo "======================================"
echo -e "${GREEN}✓ RabbitMQ setup complete!${NC}"
echo ""
echo "Next steps:"
echo "  1. Update .env with: RABBITMQ_URL=amqp://admin:admin123@localhost:5672"
echo "  2. Start services: npm run dev"
echo "  3. Monitor queues: http://localhost:15672"
echo ""
