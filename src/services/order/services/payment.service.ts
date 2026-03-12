import Stripe from 'stripe';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || '', {
  apiVersion: '2023-10-16',
});

interface PaymentData {
  orderId: string;
  amount: number;
  paymentMethodId: string;
}

export class PaymentService {
  async processPayment(data: PaymentData) {
    try {
      // Create payment intent
      const paymentIntent = await stripe.paymentIntents.create({
        amount: Math.round(data.amount * 100), // Convert to cents
        currency: 'usd',
        payment_method: data.paymentMethodId,
        confirm: true,
        automatic_payment_methods: {
          enabled: true,
          allow_redirects: 'never',
        },
        metadata: {
          orderId: data.orderId,
        },
      });

      return {
        success: paymentIntent.status === 'succeeded',
        transactionId: paymentIntent.id,
      };
    } catch (error: any) {
      return {
        success: false,
        error: error.message,
      };
    }
  }

  async refundPayment(transactionId: string) {
    try {
      const refund = await stripe.refunds.create({
        payment_intent: transactionId,
      });

      return {
        success: refund.status === 'succeeded',
        refundId: refund.id,
      };
    } catch (error: any) {
      return {
        success: false,
        error: error.message,
      };
    }
  }
}
