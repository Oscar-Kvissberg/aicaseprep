'use client';

import { useState } from 'react';
import { useSession } from 'next-auth/react';

import { PrimaryButton } from './ui/primary_button';
import toast from 'react-hot-toast';

// These IDs should match the ones in the server-side CREDITS_PRICE_MAP
const CREDITS_PRICE_MAP = {
  '3': 'price_1RFimkRiJA2ZIwb0rC19TT8a',
  '5': 'price_1RFinPRiJA2ZIwb0CSX0Dh9H',
  '10': 'price_1RFio7RiJA2ZIwb0o2k2OR1e'
};

interface CreditOption {
  amount: number;
  price: number;
  description: string;
}

const CREDIT_OPTIONS: CreditOption[] = [
  {
    amount: 3,
    price: 99,
    description: 'Starter Pack - Perfect for trying out the platform'
  },
  {
    amount: 5,
    price: 149,
    description: 'Popular - Great value for regular practice'
  },
  {
    amount: 10,
    price: 249,
    description: 'Pro Pack - Best value for serious preparation'
  }
];

export function BuyCredits() {
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
    <div className="grid grid-cols-1 md:grid-cols-3 gap-6 p-4">
      {CREDIT_OPTIONS.map((option) => (
        <div
          key={option.amount}
          className="bg-white rounded-lg shadow-md p-6 flex flex-col"
        >
          <h3 className="text-2xl font-bold mb-2">{option.amount} Credits</h3>
          <p className="text-gray-600 mb-4 flex-grow">{option.description}</p>
          <div className="text-3xl font-bold mb-4">{option.price} kr</div>
          <PrimaryButton
            onClick={() => handlePurchase(option)}
            disabled={loading !== null || !session?.user?.id}
            className="w-full"
          >
            {loading === option.amount ? 'Processing...' : 'Buy Now'}
          </PrimaryButton>
        </div>
      ))}
    </div>
  );
} 