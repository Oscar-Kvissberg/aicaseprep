import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

// Initialize Supabase client with service role key for admin access
const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function GET() {
  try {
    // Check credit_balances table
    const { data: balance, error: balanceError } = await supabase
      .from('credit_balances')
      .select('*')
      .limit(5);

    if (balanceError) {
      return NextResponse.json({
        error: 'Failed to check credit_balances',
        details: balanceError
      }, { status: 500 });
    }

    return NextResponse.json({
      tableExists: true,
      sampleBalances: balance
    });
  } catch (error) {
    return NextResponse.json({
      error: 'Unexpected error',
      details: error
    }, { status: 500 });
  }
} 