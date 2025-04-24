import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

// Initialize Supabase client with service role key for admin access
const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST(request: Request) {
  try {
    const { userId } = await request.json();

    if (!userId) {
      return NextResponse.json({
        error: 'Missing userId'
      }, { status: 400 });
    }

    // Add test credits
    const { data, error } = await supabase
      .rpc('add_user_credits', {
        user_id: userId,
        amount: 5,
        transaction_type: 'test',
        description: 'Test credits added via debug endpoint',
        metadata: { source: 'debug_endpoint' }
      });

    if (error) {
      return NextResponse.json({
        error: 'Failed to add test credits',
        details: error
      }, { status: 500 });
    }

    // Get updated balance
    const { data: balance, error: balanceError } = await supabase
      .rpc('get_user_credit_balance', {
        user_id: userId
      });

    if (balanceError) {
      return NextResponse.json({
        error: 'Failed to get updated balance',
        details: balanceError
      }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      transactionId: data,
      newBalance: balance
    });
  } catch (error) {
    return NextResponse.json({
      error: 'Unexpected error',
      details: error
    }, { status: 500 });
  }
} 