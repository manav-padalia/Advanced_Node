import { nodemailer } from '@ecommerce/shared/packages';
import { createServiceLogger, addErrorHelper } from '@ecommerce/shared';

const logger = createServiceLogger('email-service');

export class EmailService {
  private transporter: nodemailer.Transporter;

  constructor() {
    this.transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST || 'smtp.gmail.com',
      port: parseInt(process.env.SMTP_PORT || '587', 10),
      secure: false,
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASSWORD,
      },
    });
  }

  async sendOrderConfirmation(data: any) {
    try {
      const { orderId, userId, total, items } = data;

      const mailOptions = {
        from: process.env.EMAIL_FROM || 'noreply@ecommerce.com',
        to: userId, // Should be user email
        subject: 'Order Confirmation',
        html: `
          <h1>Order Confirmation</h1>
          <p>Thank you for your order!</p>
          <p><strong>Order ID:</strong> ${orderId}</p>
          <p><strong>Total:</strong> $${total}</p>
          <h2>Items:</h2>
          <ul>
            ${items.map((item: any) => `<li>Product: ${item.productId} - Quantity: ${item.quantity}</li>`).join('')}
          </ul>
        `,
      };

      await this.transporter.sendMail(mailOptions);
      logger.info(`Order confirmation email sent for order ${orderId}`);
    } catch (error: any) {
      logger.error('Failed to send order confirmation email:', error);
      await addErrorHelper({
        apiName: 'EmailService.sendOrderConfirmation',
        details: error,
      });
      throw error;
    }
  }

  async sendOrderCancellation(data: any) {
    try {
      const { orderId, userId } = data;

      const mailOptions = {
        from: process.env.EMAIL_FROM || 'noreply@ecommerce.com',
        to: userId,
        subject: 'Order Cancelled',
        html: `
          <h1>Order Cancelled</h1>
          <p>Your order has been cancelled.</p>
          <p><strong>Order ID:</strong> ${orderId}</p>
        `,
      };

      await this.transporter.sendMail(mailOptions);
      logger.info(`Order cancellation email sent for order ${orderId}`);
    } catch (error: any) {
      logger.error('Failed to send order cancellation email:', error);
      await addErrorHelper({
        apiName: 'EmailService.sendOrderCancellation',
        details: error,
      });
      throw error;
    }
  }

  async sendLowStockAlert(data: any) {
    try {
      const { productId, currentStock, threshold } = data;

      const mailOptions = {
        from: process.env.EMAIL_FROM || 'noreply@ecommerce.com',
        to: process.env.ADMIN_EMAIL || 'admin@ecommerce.com',
        subject: 'Low Stock Alert',
        html: `
          <h1>Low Stock Alert</h1>
          <p><strong>Product ID:</strong> ${productId}</p>
          <p><strong>Current Stock:</strong> ${currentStock}</p>
          <p><strong>Threshold:</strong> ${threshold}</p>
          <p>Please restock this product soon.</p>
        `,
      };

      await this.transporter.sendMail(mailOptions);
      logger.info(`Low stock alert sent for product ${productId}`);
    } catch (error: any) {
      logger.error('Failed to send low stock alert:', error);
      await addErrorHelper({
        apiName: 'EmailService.sendLowStockAlert',
        details: error,
      });
      throw error;
    }
  }

  async sendDailyReport(data: any) {
    try {
      const { date, totalOrders, totalRevenue, topProducts } = data;

      const mailOptions = {
        from: process.env.EMAIL_FROM || 'noreply@ecommerce.com',
        to: process.env.ADMIN_EMAIL || 'admin@ecommerce.com',
        subject: `Daily Report - ${date}`,
        html: `
          <h1>Daily Sales Report</h1>
          <p><strong>Date:</strong> ${date}</p>
          <p><strong>Total Orders:</strong> ${totalOrders}</p>
          <p><strong>Total Revenue:</strong> $${totalRevenue}</p>
          <h2>Top Products:</h2>
          <ul>
            ${topProducts.map((p: any) => `<li>${p.name} - ${p.sales} sales</li>`).join('')}
          </ul>
        `,
      };

      await this.transporter.sendMail(mailOptions);
      logger.info(`Daily report sent for ${date}`);
    } catch (error: any) {
      logger.error('Failed to send daily report:', error);
      await addErrorHelper({
        apiName: 'EmailService.sendDailyReport',
        details: error,
      });
      throw error;
    }
  }
}
