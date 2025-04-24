import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function POST(request: Request) {
  try {
    const { userId, initialBalance = 3 } = await request.json()

    if (!userId) {
      return NextResponse.json({ error: 'User ID is required' }, { status: 400 })
    }

    // Call the RPC function to add credits
    const { error } = await supabase.rpc('add_user_credits', {
      user_id: userId,
      amount: initialBalance
    })

    if (error) {
      console.error('Error initializing credit balance:', error)
      return NextResponse.json({ error: 'Failed to initialize credit balance' }, { status: 500 })
    }

    // Get the current balance to confirm
    const { data: balance, error: balanceError } = await supabase.rpc('get_user_credit_balance', {
      user_id: userId
    })

    if (balanceError) {
      console.error('Error fetching updated balance:', balanceError)
      return NextResponse.json({ error: 'Failed to fetch updated balance' }, { status: 500 })
    }

    return NextResponse.json({
      message: 'Successfully initialized credit balance',
      currentBalance: balance
    })
  } catch (error) {
    console.error('Unexpected error:', error)
    return NextResponse.json({ error: 'An unexpected error occurred' }, { status: 500 })
  }
} 