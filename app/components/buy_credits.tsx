'use client';

import { useState } from 'react';
import { useSession } from 'next-auth/react';

import { Button } from './ui/button';
import toast from 'react-hot-toast';

// These IDs should match the ones in the server-side CREDITS_PRICE_MAP
const CREDITS_PRICE_MAP = {
  '3': process.env.NEXT_PUBLIC_STRIPE_CREDIT_3_PRICE_ID || 'price_1RpzcDRiJA2ZIwb0BDNY2YSS',
  '5': process.env.NEXT_PUBLIC_STRIPE_CREDIT_5_PRICE_ID || 'price_1RpzdVRiJA2ZIwb0aBSIZRKC',
  '10': process.env.NEXT_PUBLIC_STRIPE_CREDIT_10_PRICE_ID || 'price_1RpzetRiJA2ZIwb0P9PwEkPx'
};

interface CreditOption {
  amount: number;
  price: number;
  description: string;
}

const CREDIT_OPTIONS: CreditOption[] = [
  {
    amount: 3,
    price: 15,
    description: 'Starter Pack - Perfect for trying out the platform'
  },
  {
    amount: 5,
    price: 24,
    description: 'Popular - Great value for regular practice'
  },
  {
    amount: 10,
    price: 46,
    description: 'Pro Pack - Best value for serious preparation'
  }
];

interface BuyCreditsProps {
  onClose?: () => void;
}

export function BuyCredits({ onClose }: BuyCreditsProps) {
  const { data: session } = useSession();
  const [loading, setLoading] = useState<number | null>(null);

  const handlePurchase = async (creditOption: CreditOption) => {
    try {
      if (!session?.user?.id) {
        toast.error('Du måste vara inloggad för att köpa credits');
        return;
      }

      setLoading(creditOption.amount);

      // Get the price ID from the map
      const priceId = CREDITS_PRICE_MAP[creditOption.amount.toString() as keyof typeof CREDITS_PRICE_MAP];
      
      if (!priceId) {
        throw new Error('Invalid credit amount');
      }

      // Create checkout session
      const response = await fetch('/api/create-checkout-session', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          priceId,
          creditAmount: creditOption.amount,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Network response was not ok');
      }

      const { url } = await response.json();

      // Redirect to Stripe checkout
      window.location.href = url;
    } catch (err) {
      console.error('Error:', err);
      toast.error('Failed to start checkout process');
    } finally {
      setLoading(null);
    }
  };

  return (
    <div className="relative">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 p-10">
      {/* Close button positioned relative to the rightmost card */}
      {onClose && (
        <button
          onClick={onClose}
          className="absolute -top-6 right-10 w-12 h-12 gradient-border-normal rounded-full bg-white flex items-center justify-center hover:scale-110 transition-transform duration-200 z-10"
        >
          <svg 
            xmlns="http://www.w3.org/2000/svg" 
            fill="none" 
            viewBox="0 0 24 24" 
            strokeWidth={2.5} 
            stroke="currentColor" 
            className="w-5 h-5 text-gray-600"
          >
            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      )}
      {CREDIT_OPTIONS.map((option) => (
        <div
          key={option.amount}
          className="rounded-xl shadow-md p-6 flex flex-col gradient-border-normal bg-white"
        >
          <h3 className="text-2xl font-bold mb-2">{option.amount} Credits</h3>
          <p className="text-gray-600 mb-4 flex-grow">{option.description}</p>
          <div className="text-3xl font-bold mb-4">{option.price} kr</div>
          <Button
            variant="primary_c2a"
            onClick={() => handlePurchase(option)}
            disabled={loading !== null || !session?.user?.id}
            className="w-full h-10"
          >
            {loading === option.amount ? 'Processing...' : 'Buy Now'}
          </Button>
        </div>
      ))}
      </div>
    </div>
  );
} 