import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/api/auth/config';
import { stripeServer } from '../../../lib/stripe-server';

export async function GET(request: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.redirect(new URL('/login', request.url));
    }

    // Get the session ID from the URL
    const url = new URL(request.url);
    const sessionId = url.searchParams.get('session_id');
    
    if (!sessionId) {
      console.error('No session ID found in URL');
      return NextResponse.redirect(new URL('/dash?error=no-session-id', request.url));
    }

    // Retrieve the checkout session
    const checkoutSession = await stripeServer.checkout.sessions.retrieve(sessionId);
    
    // Check if the session is already completed
    if (checkoutSession.payment_status !== 'paid') {
      console.error('Session payment not completed');
      return NextResponse.redirect(new URL('/dash?error=payment-not-completed', request.url));
    }
    
    // Get credit amount from metadata for display
    const creditAmount = parseInt(checkoutSession.metadata?.creditAmount || '0');
    
    // Redirect to the dashboard with a success message
    return NextResponse.redirect(new URL('/dash?success=true&credits=' + creditAmount, request.url));
  } catch (err) {
    console.error('Error processing payment success:', err);
    return NextResponse.redirect(new URL('/dash?error=server-error', request.url));
  }
} 