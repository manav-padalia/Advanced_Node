# CloudAMQP Setup for Railway Deployment

Complete guide to integrate CloudAMQP (managed RabbitMQ) with your Railway deployment.

---

## Why CloudAMQP?

Railway doesn't provide a native RabbitMQ service, so we use CloudAMQP:

- Free tier available (Little Lemur plan)
- Fully managed RabbitMQ
- Built-in monitoring and management UI
- Automatic backups and updates
- Global availability

---

## Step 1: Create CloudAMQP Account (5 minutes)

1. Go to https://www.cloudamqp.com/
2. Click "Sign Up" (top right)
3. Choose sign-up method:
   - Email + Password
   - GitHub (recommended for easy integration)
   - Google

4. Verify your email if required

---

## Step 2: Create RabbitMQ Instance (5 minutes)

### Option A: Free Tier (Recommended for Development)

1. After login, click "Create New Instance"
2. Fill in the form:

   ```
   Name: ecommerce-rabbitmq
   Plan: Little Lemur (Free)
   Region: Choose closest to your Railway region
           - US-East (Virginia) for US deployments
           - EU-West (Ireland) for EU deployments
   Tags: production, ecommerce (optional)
   ```

3. Click "Create Instance"
4. Wait 30-60 seconds for provisioning

### Option B: Paid Tier (Production)

For production workloads, consider:

- **Bunny**: $9/month - 1GB RAM, 20 connections
- **Rabbit**: $19/month - 2GB RAM, 50 connections
- **Panda**: $49/month - 4GB RAM, 100 connections

---

## Step 3: Get Connection Details (2 minutes)

1. Click on your newly created instance name
2. You'll see the instance details page
3. Copy the following information:

### AMQP URL (Primary Connection String)

```
amqp://username:password@host.cloudamqp.com/vhost
```

Example:

```
amqp://abcdefgh:xYz123456789aBcDeFgHiJkLmNoPqRsTuVwXyZ@rattlesnake.rmq.cloudamqp.com/abcdefgh
```

### Management UI URL

```
https://rattlesnake.rmq.cloudamqp.com/
```

### Connection Details (Individual Components)

- **Host**: rattlesnake.rmq.cloudamqp.com
- **Username**: abcdefgh
- **Password**: xYz123456789aBcDeFgHiJkLmNoPqRsTuVwXyZ
- **Vhost**: abcdefgh
- **Port**: 5672 (AMQP), 5671 (AMQPS)

---

## Step 4: Configure Railway Environment Variables (5 minutes)

1. Go to your Railway project dashboard
2. Click on your service (e.g., "api-gateway")
3. Go to "Variables" tab
4. Add the following environment variable:

```bash
RABBITMQ_URL=amqp://username:password@host.cloudamqp.com/vhost
```

Replace with your actual CloudAMQP URL from Step 3.

### For All Services

Add `RABBITMQ_URL` to each service that needs RabbitMQ:

- ✅ api-gateway
- ✅ product-catalog
- ✅ order
- ✅ inventory
- ✅ notification

**Quick tip**: Use Railway's "Shared Variables" feature:

1. Go to Project Settings
2. Click "Shared Variables"
3. Add `RABBITMQ_URL` once
4. It will be available to all services

---

## Step 5: Update Application Code (Optional)

Your code already supports the `RABBITMQ_URL` environment variable. Verify in your services:

```typescript
// src/shared/messaging/rabbitmq.client.ts
const connection = await amqp.connect(
  process.env.RABBITMQ_URL || 'amqp://localhost:5672',
);
```

No changes needed if your code follows this pattern.

---

## Step 6: Test Connection Locally (5 minutes)

Before deploying, test CloudAMQP connection locally:

1. Create a `.env.cloudamqp` file:

```bash
RABBITMQ_URL=amqp://username:password@host.cloudamqp.com/vhost
DATABASE_URL=postgresql://user:pass@localhost:5432/ecommerce
REDIS_HOST=localhost
REDIS_PORT=6379
JWT_ACCESS_SECRET=your-secret-key-min-32-characters-long
JWT_REFRESH_SECRET=your-secret-key-min-32-characters-long
NODE_ENV=development
```

2. Load environment and test:

```bash
# Load CloudAMQP environment
export $(cat .env.cloudamqp | xargs)

# Start local services (PostgreSQL and Redis)
docker-compose up -d postgres redis

# Run a single service to test
npm run dev:gateway
```

3. Check logs for successful connection:

```
[INFO] RabbitMQ connected to rattlesnake.rmq.cloudamqp.com
```

---

## Step 7: Deploy to Railway (5 minutes)

1. Commit any changes:

```bash
git add .
git commit -m "Add CloudAMQP configuration"
git push origin main
```

2. Railway will automatically redeploy
3. Monitor deployment logs in Railway dashboard
4. Look for successful RabbitMQ connection messages

---

## Step 8: Verify RabbitMQ Connection (5 minutes)

### Check Railway Logs

1. Go to Railway dashboard
2. Click on your service
3. Go to "Deployments" tab
4. Click on latest deployment
5. Check logs for:

```
✓ RabbitMQ connected
✓ Queue 'order.created' declared
✓ Exchange 'ecommerce' declared
```

### Check CloudAMQP Management UI

1. Go to CloudAMQP dashboard
2. Click on your instance
3. Click "RabbitMQ Manager" button
4. Login with credentials (auto-filled)
5. Verify:
   - **Connections**: Should show 5 connections (one per service)
   - **Queues**: Should show your application queues
   - **Exchanges**: Should show your exchanges

---

## Step 9: Test Message Flow (10 minutes)

Test that messages are flowing through CloudAMQP:

```bash
# Get your Railway app URL
RAILWAY_URL="https://your-app.railway.app"

# Create a test order (triggers RabbitMQ messages)
curl -X POST $RAILWAY_URL/v1/orders \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -d '{
    "userId": "user-123",
    "items": [
      {
        "productId": "prod-123",
        "quantity": 2,
        "price": 29.99
      }
    ]
  }'
```

### Verify in CloudAMQP UI:

1. Go to "Queues" tab
2. You should see messages in queues like:
   - `order.created`
   - `inventory.reserved`
   - `notification.email`

3. Go to "Message Rates" to see throughput

---

## CloudAMQP Free Tier Limits

Be aware of free tier limitations:

| Resource       | Limit         |
| -------------- | ------------- |
| Connections    | 20 concurrent |
| Messages/month | 1 million     |
| Message size   | 10 MB max     |
| Storage        | Shared        |
| Bandwidth      | Shared        |
| Queues         | Unlimited     |
| Uptime SLA     | None          |

**Recommendations:**

- Use connection pooling (already implemented)
- Monitor usage in CloudAMQP dashboard
- Upgrade to paid tier before hitting limits

---

## Monitoring and Management

### CloudAMQP Dashboard Features

1. **Overview**
   - Connection count
   - Message rate (in/out)
   - Queue depth
   - Memory usage

2. **RabbitMQ Manager**
   - Full RabbitMQ management UI
   - Queue inspection
   - Message browsing
   - Connection management

3. **Alarms**
   - Set up email alerts
   - Memory warnings
   - Connection limits
   - Disk space alerts

4. **Metrics**
   - Historical data
   - Performance graphs
   - Usage trends

### Set Up Alerts (Recommended)

1. Go to CloudAMQP dashboard
2. Click on your instance
3. Go to "Alarms" tab
4. Enable:
   - ✅ Memory alarm (80% threshold)
   - ✅ Connection limit alarm
   - ✅ Disk space alarm

---

## Troubleshooting

### Connection Refused

**Error**: `ECONNREFUSED` or `Connection refused`

**Solutions:**

1. Verify RABBITMQ_URL is correct
2. Check CloudAMQP instance is running
3. Verify no firewall blocking port 5672
4. Try using AMQPS (port 5671) instead:
   ```
   amqps://username:password@host.cloudamqp.com/vhost
   ```

### Authentication Failed

**Error**: `ACCESS_REFUSED` or `Authentication failed`

**Solutions:**

1. Double-check username and password
2. Ensure no extra spaces in RABBITMQ_URL
3. Regenerate credentials in CloudAMQP dashboard
4. Update Railway environment variables

### Too Many Connections

**Error**: `Connection limit reached`

**Solutions:**

1. Check connection pooling is enabled
2. Close unused connections
3. Upgrade to higher tier plan
4. Review connection leaks in code

### Slow Performance

**Symptoms**: Messages taking long to process

**Solutions:**

1. Check CloudAMQP metrics for bottlenecks
2. Verify Railway service has enough resources
3. Consider upgrading CloudAMQP plan
4. Optimize message size (compress if needed)

---

## Security Best Practices

### 1. Use Environment Variables

Never hardcode CloudAMQP credentials:

```typescript
// ❌ Bad
const url = 'amqp://user:pass@host.cloudamqp.com/vhost';

// ✅ Good
const url = process.env.RABBITMQ_URL;
```

### 2. Rotate Credentials Regularly

1. Go to CloudAMQP dashboard
2. Click "Rotate Password"
3. Update Railway environment variables
4. Redeploy services

### 3. Use TLS/SSL in Production

```bash
# Use amqps:// instead of amqp://
RABBITMQ_URL=amqps://username:password@host.cloudamqp.com/vhost
```

### 4. Restrict Access

- Use Railway's private networking if available
- Enable CloudAMQP IP whitelisting (paid plans)
- Monitor connection logs regularly

---

## Cost Optimization

### Free Tier Tips

1. **Connection pooling**: Reuse connections across requests
2. **Message batching**: Send multiple messages at once
3. **TTL settings**: Set message expiration to prevent queue buildup
4. **Dead letter queues**: Handle failed messages efficiently

### When to Upgrade

Consider paid tier when:

- Exceeding 20 concurrent connections
- Processing >1M messages/month
- Need guaranteed uptime (SLA)
- Require dedicated resources
- Need advanced features (federation, shovel)

---

## Alternative Options

If CloudAMQP doesn't fit your needs:

### 1. RabbitMQ Cloud (by VMware)

- Official RabbitMQ cloud service
- Similar pricing to CloudAMQP
- https://www.rabbitmq.com/cloud.html

### 2. AWS Amazon MQ

- Managed RabbitMQ on AWS
- Good if using other AWS services
- More expensive than CloudAMQP
- https://aws.amazon.com/amazon-mq/

### 3. Self-hosted on Railway

- Deploy RabbitMQ container on Railway
- More control but requires management
- No free tier benefits
- Higher Railway costs

### 4. Google Cloud Pub/Sub

- Different messaging model (pub/sub vs queue)
- Requires code changes
- Good for high-scale applications

---

## Complete Environment Variables Checklist

Before deploying, ensure all services have:

```bash
# Database
DATABASE_URL=postgresql://user:pass@host:5432/dbname

# Redis
REDIS_HOST=redis-host.railway.app
REDIS_PORT=6379

# RabbitMQ (CloudAMQP)
RABBITMQ_URL=amqp://user:pass@host.cloudamqp.com/vhost

# JWT Secrets
JWT_ACCESS_SECRET=min-32-characters-long-secret-key
JWT_REFRESH_SECRET=min-32-characters-long-secret-key

# Application
NODE_ENV=production
LOG_LEVEL=info
PORT=3000

# Optional
SENTRY_DSN=https://key@sentry.io/project
CORS_ORIGIN=https://your-frontend.com
```

---

## Testing Checklist

After setup, verify:

- [ ] CloudAMQP instance is running
- [ ] RABBITMQ_URL added to all Railway services
- [ ] Railway services deployed successfully
- [ ] Connections visible in CloudAMQP dashboard
- [ ] Queues created automatically
- [ ] Messages flowing through queues
- [ ] No connection errors in logs
- [ ] Order creation triggers notifications
- [ ] Inventory updates via messages
- [ ] Email notifications sent

---

## Quick Reference

### CloudAMQP Dashboard

https://customer.cloudamqp.com/

### RabbitMQ Manager

https://your-instance.rmq.cloudamqp.com/

### Railway Dashboard

https://railway.app/dashboard

### Connection String Format

```
amqp://username:password@host.cloudamqp.com/vhost
```

### Common Ports

- AMQP: 5672
- AMQPS (TLS): 5671
- Management UI: 15672 (not exposed in CloudAMQP)

---

## Next Steps After Setup

1. **Monitor Usage**: Check CloudAMQP dashboard daily for first week
2. **Set Up Alerts**: Configure email notifications for issues
3. **Load Testing**: Test with expected production load
4. **Backup Strategy**: Document connection details securely
5. **Upgrade Plan**: When approaching free tier limits

---

## Support Resources

- **CloudAMQP Docs**: https://www.cloudamqp.com/docs/
- **RabbitMQ Docs**: https://www.rabbitmq.com/documentation.html
- **Railway Docs**: https://docs.railway.app/
- **CloudAMQP Support**: support@cloudamqp.com

---

## Summary

Total setup time: ~30 minutes

1. ✅ Create CloudAMQP account (5 min)
2. ✅ Create RabbitMQ instance (5 min)
3. ✅ Get connection URL (2 min)
4. ✅ Add to Railway variables (5 min)
5. ✅ Test locally (5 min)
6. ✅ Deploy to Railway (5 min)
7. ✅ Verify connection (3 min)

**You're now ready to use managed RabbitMQ in production!**
