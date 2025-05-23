import { NextResponse } from 'next/server';
import { stripeServer } from '../../../lib/stripe-server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/api/auth/config';

// These IDs will come from Stripe after we create the products
const CREDITS_PRICE_MAP = {
  '3': 'price_1RFimkRiJA2ZIwb0rC19TT8a',  // Replace with the actual price ID from Stripe
  '5': 'price_1RFinPRiJA2ZIwb0CSX0Dh9H',  // Replace with the actual price ID from Stripe
  '10': 'price_1RFio7RiJA2ZIwb0o2k2OR1e'  // Replace with the actual price ID from Stripe
};

export async function POST(request: Request) {
  try {
    // Get the session and verify user is authenticated
    const session = await getServerSession(authOptions);
    
    if (!session?.user?.id) {
      console.error('No session or user ID found');
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Parse the request body
    const { priceId, creditAmount } = await request.json();
    
    if (!priceId || !creditAmount) {
      console.error('Missing required fields:', { priceId, creditAmount });
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      );
    }

    // Validate credit amount
    if (!CREDITS_PRICE_MAP[creditAmount as keyof typeof CREDITS_PRICE_MAP]) {
      console.error('Invalid credit amount:', creditAmount);
      return NextResponse.json({ error: 'Invalid credit amount' }, { status: 400 });
    }

    console.log('Creating checkout session for:', {
      userId: session.user.id,
      creditAmount,
      priceId
    });

    // Create Stripe checkout session
    const checkoutSession = await stripeServer.checkout.sessions.create({
      payment_method_types: ['card'],
      line_items: [
        {
          price: priceId,
          quantity: 1,
        },
      ],
      mode: 'payment',
      success_url: `${process.env.NEXTAUTH_URL}/dash?success=true&credits=${creditAmount}`,
      cancel_url: `${process.env.NEXTAUTH_URL}/dash?canceled=true`,
      metadata: {
        userId: session.user.id,
        creditAmount: creditAmount.toString()
      }
    });

    if (!checkoutSession?.url) {
      console.error('Failed to create checkout session URL');
      return NextResponse.json(
        { error: 'Failed to create checkout session' },
        { status: 500 }
      );
    }

    console.log('Successfully created checkout session:', {
      sessionId: checkoutSession.id,
      url: checkoutSession.url
    });

    return NextResponse.json({ url: checkoutSession.url });
  } catch (err) {
    console.error('Error creating checkout session:', err);
    return NextResponse.json(
      { error: 'Error creating checkout session' },
      { status: 500 }
    );
  }
} 