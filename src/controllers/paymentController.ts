import { Request, Response } from 'express';
import { AuthRequest } from '../middlewares/auth';
import { prisma } from '../config/db';
import Stripe from 'stripe';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || 'sk_test_mock', {
  apiVersion: '2024-09-30.acacia' as any
});

export class PaymentController {
  /**
   * 1. GET /api/payments/plans
   * Fetch active credit recharge packs directly from Stripe Dashboard.
   * Model: Pay-as-you-go credit packs (One-off / non-expiring).
   * - Plus Pack: 5 Resume Tailors & 10 ATS Audits
   * - Pro Pack: 10 Resume Tailors & 25 ATS Audits
   */
  static async getPlans(req: Request, res: Response) {
    try {
      const isMock = !process.env.STRIPE_SECRET_KEY || process.env.STRIPE_SECRET_KEY.includes('mock');

      if (isMock) {
        return res.json({
          success: true,
          source: 'mock',
          plans: [
            {
              priceId: 'price_mock_plus',
              productId: 'prod_mock_plus',
              name: 'ResumeCraft Plus',
              description: '5 AI Resume Tailors & 10 ATS Audits. Credits never expire.',
              amount: 999,
              currency: 'usd',
              interval: 'one-time',
              formattedPrice: '$9.99',
              resumeCredits: 5,
              atsCredits: 10,
              planTier: 'PLUS'
            },
            {
              priceId: 'price_mock_pro',
              productId: 'prod_mock_pro',
              name: 'ResumeCraft Pro',
              description: '10 AI Resume Tailors & 25 ATS Audits. Credits never expire.',
              amount: 1999,
              currency: 'usd',
              interval: 'one-time',
              formattedPrice: '$19.99',
              resumeCredits: 10,
              atsCredits: 25,
              planTier: 'PRO'
            }
          ]
        });
      }

      // Fetch active prices directly from Stripe Dashboard
      const prices = await stripe.prices.list({
        active: true,
        expand: ['data.product']
      });

      const formattedPlans = prices.data.map((p) => {
        const product = p.product as Stripe.Product;
        const name = product?.name || 'Credit Pack';
        const isPro = name.toLowerCase().includes('pro');

        // Check if credits are set in Stripe product metadata, otherwise use official counts
        const resumeCredits = product?.metadata?.resumeCredits
          ? parseInt(product.metadata.resumeCredits, 10)
          : (isPro ? 10 : 5);

        const atsCredits = product?.metadata?.atsCredits
          ? parseInt(product.metadata.atsCredits, 10)
          : (isPro ? 25 : 10);

        const amountDollars = (p.unit_amount || 0) / 100;

        return {
          priceId: p.id,
          productId: typeof product === 'string' ? product : product.id,
          name,
          description:
            product?.description ||
            `${resumeCredits} Resume Tailors & ${atsCredits} ATS Audits (Credits never expire)`,
          amount: p.unit_amount || 0,
          currency: p.currency,
          interval: 'one-time',
          formattedPrice: `$${amountDollars.toFixed(2)}`,
          resumeCredits,
          atsCredits,
          planTier: isPro ? 'PRO' : 'PLUS'
        };
      });

      return res.json({
        success: true,
        source: 'stripe_dashboard',
        plans: formattedPlans
      });
    } catch (err: any) {
      console.error('[STRIPE ERROR] Failed to fetch plans:', err);
      return res.status(500).json({ success: false, message: err.message || 'Error fetching Stripe plans' });
    }
  }

  /**
   * 2. POST /api/payments/create-payment-intent
   * Mobile app calls this with the selected Stripe `priceId`.
   * Backend retrieves the price from Stripe Dashboard and creates a Stripe PaymentIntent.
   */
  static async createPaymentIntent(req: AuthRequest, res: Response) {
    try {
      const userId = req.user?.id;
      if (!userId) return res.status(401).json({ success: false, message: 'Unauthorized' });

      const { priceId } = req.body;
      if (!priceId) {
        return res.status(400).json({ success: false, message: 'Stripe priceId is required.' });
      }

      const isMock = !process.env.STRIPE_SECRET_KEY || process.env.STRIPE_SECRET_KEY.includes('mock');

      if (isMock) {
        return res.json({
          success: true,
          clientSecret: 'pi_mock_secret_test_12345',
          paymentIntentId: 'pi_mock_12345',
          amount: 999,
          currency: 'usd'
        });
      }

      // 1. Retrieve the price from Stripe Dashboard
      const price = await stripe.prices.retrieve(priceId, {
        expand: ['product']
      });

      if (!price || !price.unit_amount) {
        return res.status(404).json({ success: false, message: 'Price plan not found on Stripe.' });
      }

      const product = price.product as Stripe.Product;
      const productName = product?.name || 'ResumeCraft Pack';
      const isPro = productName.toLowerCase().includes('pro');

      // Determine credits granted
      const resumeCredits = product?.metadata?.resumeCredits
        ? parseInt(product.metadata.resumeCredits, 10)
        : (isPro ? 10 : 5);

      const atsCredits = product?.metadata?.atsCredits
        ? parseInt(product.metadata.atsCredits, 10)
        : (isPro ? 25 : 10);

      // 2. Create PaymentIntent on Stripe
      const paymentIntent = await stripe.paymentIntents.create({
        amount: price.unit_amount,
        currency: price.currency,
        payment_method_types: ['card'],
        metadata: {
          userId,
          priceId: price.id,
          planName: productName,
          planTier: isPro ? 'PRO' : 'PLUS',
          resumeCredits: resumeCredits.toString(),
          atsCredits: atsCredits.toString()
        }
      });

      return res.json({
        success: true,
        clientSecret: paymentIntent.client_secret,
        paymentIntentId: paymentIntent.id,
        amount: price.unit_amount,
        currency: price.currency
      });
    } catch (err: any) {
      console.error('[STRIPE PAYMENT INTENT ERROR]', err);
      return res.status(500).json({ success: false, message: err.message || 'Failed to create PaymentIntent' });
    }
  }

  /**
   * 3. POST /api/payments/confirm-payment
   * When mobile client completes card entry, it sends paymentIntentId here.
   * Increments the user's resumeCredits and atsCredits in the DB.
   * Credits NEVER expire!
   */
  static async confirmPayment(req: AuthRequest, res: Response) {
    try {
      const userId = req.user?.id;
      if (!userId) return res.status(401).json({ success: false, message: 'Unauthorized' });

      const { paymentIntentId } = req.body;
      if (!paymentIntentId) {
        return res.status(400).json({ success: false, message: 'paymentIntentId is required.' });
      }

      const isMock = !process.env.STRIPE_SECRET_KEY || process.env.STRIPE_SECRET_KEY.includes('mock');

      if (isMock || paymentIntentId.startsWith('pi_mock')) {
        // Immediate mock upgrade: Plus = +5 / +10, Pro = +10 / +25
        const updatedUser = await prisma.user.update({
          where: { id: userId },
          data: {
            plan: 'PRO',
            resumeCredits: { increment: 10 },
            atsCredits: { increment: 25 }
          }
        });

        return res.json({
          success: true,
          message: 'Payment verified! 10 Resume Tailor & 25 ATS Audit credits added to your account.',
          user: updatedUser
        });
      }

      // Verify directly with Stripe
      const paymentIntent = await stripe.paymentIntents.retrieve(paymentIntentId);

      if (paymentIntent.status !== 'succeeded') {
        return res.status(400).json({
          success: false,
          message: `Payment not completed. Current status: ${paymentIntent.status}`
        });
      }

      // Verify the payment belonged to this user
      if (paymentIntent.metadata?.userId && paymentIntent.metadata.userId !== userId) {
        return res.status(403).json({ success: false, message: 'Payment authorization mismatch.' });
      }

      const planName = paymentIntent.metadata?.planName || '';
      const isPro = planName.toLowerCase().includes('pro');

      const resumeCreditsToAdd = paymentIntent.metadata?.resumeCredits
        ? parseInt(paymentIntent.metadata.resumeCredits, 10)
        : (isPro ? 10 : 5);

      const atsCreditsToAdd = paymentIntent.metadata?.atsCredits
        ? parseInt(paymentIntent.metadata.atsCredits, 10)
        : (isPro ? 25 : 10);

      const planTier = paymentIntent.metadata?.planTier || (isPro ? 'PRO' : 'PLUS');

      // Lifetime non-expiring credit package (set 10 years in future)
      const expiresAt = new Date();
      expiresAt.setFullYear(expiresAt.getFullYear() + 10);

      // Increment User Credits (They never expire!)
      const updatedUser = await prisma.user.update({
        where: { id: userId },
        data: {
          plan: planTier,
          resumeCredits: { increment: resumeCreditsToAdd },
          atsCredits: { increment: atsCreditsToAdd }
        }
      });

      // Record transaction in Subscription history
      await prisma.subscription.create({
        data: {
          userId,
          stripeCustomerId: (paymentIntent.customer as string) || null,
          stripeSubscriptionId: paymentIntent.id,
          planType: planTier,
          resumeCreditsGranted: resumeCreditsToAdd,
          atsCreditsGranted: atsCreditsToAdd,
          status: 'ACTIVE',
          expiresAt
        }
      });

      return res.json({
        success: true,
        message: `Success! Added +${resumeCreditsToAdd} Resume Tailors & +${atsCreditsToAdd} ATS Audits. Credits never expire!`,
        user: {
          id: updatedUser.id,
          email: updatedUser.email,
          name: updatedUser.name,
          plan: updatedUser.plan,
          resumeCredits: updatedUser.resumeCredits,
          atsCredits: updatedUser.atsCredits
        }
      });
    } catch (err: any) {
      console.error('[STRIPE CONFIRMATION ERROR]', err);
      return res.status(500).json({ success: false, message: err.message || 'Payment confirmation error' });
    }
  }

  /**
   * 4. POST /api/payments/checkout (Hosted Stripe Checkout fallback)
   */
  static async createCheckoutSession(req: AuthRequest, res: Response) {
    try {
      const userId = req.user?.id;
      const { priceId } = req.body;

      if (!userId) return res.status(401).json({ error: 'Unauthorized' });

      const isMock = !process.env.STRIPE_SECRET_KEY || process.env.STRIPE_SECRET_KEY.includes('mock');

      if (isMock) {
        await prisma.user.update({
          where: { id: userId },
          data: {
            plan: 'PRO',
            resumeCredits: { increment: 10 },
            atsCredits: { increment: 25 }
          }
        });

        return res.json({
          success: true,
          checkoutUrl: 'http://localhost:3000/admin?subscription=success'
        });
      }

      const session = await stripe.checkout.sessions.create({
        payment_method_types: ['card'],
        line_items: [{ price: priceId, quantity: 1 }],
        mode: 'payment',
        client_reference_id: userId,
        metadata: { userId, priceId },
        success_url: `http://localhost:3000/payment-success?session_id={CHECKOUT_SESSION_ID}`,
        cancel_url: `http://localhost:3000/pricing`
      });

      return res.json({
        success: true,
        checkoutUrl: session.url,
        sessionId: session.id
      });
    } catch (err: any) {
      return res.status(500).json({ success: false, error: err.message || 'Payment error' });
    }
  }

  /**
   * 5. POST /api/payments/webhook
   */
  static async handleWebhook(req: any, res: Response) {
    try {
      const sig = req.headers['stripe-signature'];
      let event: Stripe.Event;

      if (process.env.STRIPE_WEBHOOK_SECRET && sig) {
        try {
          event = stripe.webhooks.constructEvent(
            req.body,
            sig,
            process.env.STRIPE_WEBHOOK_SECRET
          );
        } catch (err: any) {
          console.error(`[STRIPE WEBHOOK ERROR] Signature verification failed:`, err.message);
          return res.status(400).send(`Webhook Error: ${err.message}`);
        }
      } else {
        event = req.body;
      }

      if (event.type === 'payment_intent.succeeded') {
        const paymentIntent = event.data.object as Stripe.PaymentIntent;
        const userId = paymentIntent.metadata?.userId;

        if (userId) {
          const isPro = (paymentIntent.metadata?.planName || '').toLowerCase().includes('pro');
          const resumeCreditsToAdd = paymentIntent.metadata?.resumeCredits
            ? parseInt(paymentIntent.metadata.resumeCredits, 10)
            : (isPro ? 10 : 5);
          const atsCreditsToAdd = paymentIntent.metadata?.atsCredits
            ? parseInt(paymentIntent.metadata.atsCredits, 10)
            : (isPro ? 25 : 10);

          await prisma.user.update({
            where: { id: userId },
            data: {
              plan: isPro ? 'PRO' : 'PLUS',
              resumeCredits: { increment: resumeCreditsToAdd },
              atsCredits: { increment: atsCreditsToAdd }
            }
          });
          console.log(`[STRIPE WEBHOOK] Credited +${resumeCreditsToAdd} Resumes, +${atsCreditsToAdd} ATS to user ${userId}`);
        }
      }

      return res.json({ received: true });
    } catch (err: any) {
      console.error('[STRIPE WEBHOOK ERROR]', err);
      return res.status(500).json({ error: err.message });
    }
  }
}
