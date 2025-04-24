import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function GET() {
  try {
    // Get all credit balances from the view
    const { data: creditBalances, error: creditError } = await supabase
      .from('credit_balances')
      .select('*')

    if (creditError) {
      console.error('Error fetching credit balances:', creditError)
      return NextResponse.json({ error: 'Failed to fetch credit balances' }, { status: 500 })
    }

    // Get recent credit transactions
    const { data: transactions, error: transactionError } = await supabase
      .from('credit_transactions')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(50)

    if (transactionError) {
      console.error('Error fetching transactions:', transactionError)
      return NextResponse.json({ error: 'Failed to fetch transactions' }, { status: 500 })
    }

    // Get all user progress (for comparison)
    const { data: userProgress, error: progressError } = await supabase
      .from('user_case_progress')
      .select('*')

    if (progressError) {
      console.error('Error fetching user progress:', progressError)
      return NextResponse.json({ error: 'Failed to fetch user progress' }, { status: 500 })
    }

    return NextResponse.json({
      creditBalances,
      recentTransactions: transactions,
      userProgress,
      message: 'Successfully fetched all balances and transactions'
    })
  } catch (error) {
    console.error('Unexpected error:', error)
    return NextResponse.json({ error: 'An unexpected error occurred' }, { status: 500 })
  }
} 