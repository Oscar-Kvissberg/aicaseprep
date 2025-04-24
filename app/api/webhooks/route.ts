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
      const session = event.data.object as Stripe.Checkout.Session;
      const userId = session.metadata?.userId;
      const creditAmount = parseInt(session.metadata?.creditAmount || '0');

      console.log('Processing completed checkout:', {
        userId,
        creditAmount,
        sessionId: session.id,
        metadata: session.metadata
      });

      if (!userId || !creditAmount) {
        console.error('Missing userId or creditAmount in session metadata:', session.metadata);
        return new NextResponse('Missing metadata', { status: 400 });
      }

      // First check current credits
      const { data: currentCredits, error: creditsError } = await supabase
        .from('user_credits')
        .select('credits')
        .eq('user_id', userId)
        .single();

      if (creditsError && creditsError.code !== 'PGRST116') {
        console.error('Error checking current credits:', creditsError);
        return new NextResponse('Error checking credits', { status: 500 });
      }

      const newCredits = (currentCredits?.credits || 0) + creditAmount;

      // Update or insert new credits
      const { error: updateError } = await supabase
        .from('user_credits')
        .upsert({
          user_id: userId,
          credits: newCredits
        }, {
          onConflict: 'user_id'
        });

      console.log('Update result:', {
        currentCredits,
        newCredits,
        error: updateError
      });

      if (updateError) {
        console.error('Error updating credits:', updateError);
        return new NextResponse('Error updating credits', { status: 500 });
      }

      return new NextResponse('Credits added successfully', { status: 200 });
    }

    return new NextResponse('Event processed', { status: 200 });
  } catch (err) {
    console.error('Webhook Error:', err);
    return new NextResponse('Webhook Error', { status: 400 });
  }
} 