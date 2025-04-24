import { loadStripe, Stripe } from '@stripe/stripe-js';
import StripeServer from 'stripe';

let stripePromise: Promise<Stripe | null>;

export const getStripe = () => {
  if (!stripePromise) {
    stripePromise = loadStripe(process.env.NEXT_PUBLIC_STRIPE_PUBLIC_KEY!);
  }
  return stripePromise;
};

// Server-side Stripe instance
export const stripeServer = new StripeServer(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: '2025-03-31.basil',
  typescript: true,
}); 