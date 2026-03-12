#!/bin/bash

# RabbitMQ Testing Script
# This script helps test RabbitMQ communication between services

set -e

echo "🐰 RabbitMQ Communication Test Script"
echo "======================================"
echo ""

# Colors
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# Check if RabbitMQ is running
echo "1. Checking RabbitMQ status..."
if curl -s http://localhost:15672/api/overview > /dev/null 2>&1; then
    echo -e "${GREEN}✓ RabbitMQ is running${NC}"
else
    echo -e "${RED}✗ RabbitMQ is not running${NC}"
    echo "Please start RabbitMQ: docker-compose up -d rabbitmq"
    exit 1
fi

# Check RabbitMQ queues
echo ""
echo "2. Checking RabbitMQ queues..."
QUEUES=$(curl -s -u admin:admin123 http://localhost:15672/api/queues | jq -r '.[].name' 2>/dev/null || echo "")
if [ -z "$QUEUES" ]; then
    echo -e "${YELLOW}⚠ No queues found (services may not be started yet)${NC}"
else
    echo -e "${GREEN}✓ Found queues:${NC}"
    echo "$QUEUES" | while read queue; do
        echo "  - $queue"
    done
fi

# Check RabbitMQ exchanges
echo ""
echo "3. Checking RabbitMQ exchanges..."
EXCHANGES=$(curl -s -u admin:admin123 http://localhost:15672/api/exchanges | jq -r '.[] | select(.name != "") | .name' 2>/dev/null || echo "")
if [ -z "$EXCHANGES" ]; then
    echo -e "${YELLOW}⚠ No custom exchanges found${NC}"
else
    echo -e "${GREEN}✓ Found exchanges:${NC}"
    echo "$EXCHANGES" | while read exchange; do
        echo "  - $exchange"
    done
fi

# Check connections
echo ""
echo "4. Checking active connections..."
CONNECTIONS=$(curl -s -u admin:admin123 http://localhost:15672/api/connections | jq -r 'length' 2>/dev/null || echo "0")
echo -e "${GREEN}✓ Active connections: $CONNECTIONS${NC}"

# Check channels
echo ""
echo "5. Checking active channels..."
CHANNELS=$(curl -s -u admin:admin123 http://localhost:15672/api/channels | jq -r 'length' 2>/dev/null || echo "0")
echo -e "${GREEN}✓ Active channels: $CHANNELS${NC}"

# Summary
echo ""
echo "======================================"
echo "Summary:"
echo "  - RabbitMQ Management UI: http://localhost:15672"
echo "  - Username: admin"
echo "  - Password: admin123"
echo ""
echo "To test message flow:"
echo "  1. Start all services: npm run dev"
echo "  2. Create an order via API Gateway"
echo "  3. Monitor queues in Management UI"
echo ""
echo -e "${GREEN}✓ RabbitMQ is ready for testing!${NC}"
