import { createClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';
import Stripe from 'stripe';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: '2025-03-31.basil' as const,
});

const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET!;

// Initialize Supabase client with service role key
const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST(req: Request) {
  try {
    const body = await req.text();
    const signature = req.headers.get('stripe-signature')!;

    console.log('Received webhook event');

    const event = stripe.webhooks.constructEvent(
      body,
      signature,
      webhookSecret
    );

    console.log('Webhook event type:', event.type);

    if (event.type === 'checkout.session.completed') {
      const session = event.data.object;
      console.log('Processing completed checkout session:', session.id);
      
      try {
        const userId = session.metadata?.userId;
        const creditAmount = session.metadata?.creditAmount;
        
        if (!userId || !creditAmount) {
          console.error('Missing required metadata:', { userId, creditAmount });
          return new Response('Missing required metadata', { status: 400 });
        }

        console.log('Adding credits:', {
          userId,
          creditAmount,
          sessionId: session.id
        });

        const { data, error } = await supabase.rpc('add_user_credits', {
          in_user_id: userId,
          in_amount: parseInt(creditAmount),
          in_transaction_type: 'purchase',
          in_description: `Stripe purchase - Session ${session.id}`,
          in_metadata: {
            stripe_session_id: session.id,
            payment_status: session.payment_status
          }
        });

        if (error) {
          console.error('Error adding credits:', {
            error: error.message,
            details: error.details,
            hint: error.hint,
            code: error.code
          });
          return new Response(JSON.stringify({ error: error.message }), { status: 500 });
        }

        console.log('Successfully added credits:', {
          userId,
          creditAmount,
          response: data
        });

        return new Response(JSON.stringify({ success: true }), { status: 200 });
      } catch (err) {
        console.error('Exception in webhook handler:', {
          error: err,
          message: err instanceof Error ? err.message : 'Unknown error',
          stack: err instanceof Error ? err.stack : undefined
        });
        return new Response(JSON.stringify({ error: 'Internal server error' }), { status: 500 });
      }
    }

    return new NextResponse('Event processed', { status: 200 });
  } catch (err) {
    console.error('Webhook Error:', err);
    return new NextResponse('Webhook Error', { status: 400 });
  }
} 