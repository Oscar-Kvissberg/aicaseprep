import { loadStripe, Stripe } from '@stripe/stripe-js';

let stripePromise: Promise<Stripe | null>;

export const getStripe = () => {
  if (!stripePromise) {
    const key = process.env.NEXT_PUBLIC_STRIPE_PUBLIC_KEY || process.env.STRIPE_PUBLIC_KEY;
    if (!key) {
      throw new Error('Stripe public key is not set');
    }
    stripePromise = loadStripe(key);
  }
  return stripePromise;
}; 