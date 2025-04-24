import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function POST(request: Request) {
  try {
    const { userId, amount } = await request.json()

    if (!userId || !amount) {
      return NextResponse.json({
        error: 'Missing userId or amount'
      }, { status: 400 })
    }

    console.log('Testing credit update for:', { userId, amount })

    // Check current balance
    const { data: existingBalance, error: balanceError } = await supabase
      .from('credit_balances')
      .select('current_balance')
      .eq('user_id', userId)
      .single()

    console.log('Current balance:', { data: existingBalance, error: balanceError })

    const currentBalance = existingBalance?.current_balance || 0
    const newBalance = currentBalance + amount

    // Update balance
    const { data: updateData, error: updateError } = await supabase
      .from('credit_balances')
      .upsert({
        user_id: userId,
        current_balance: newBalance,
        updated_at: new Date().toISOString()
      }, {
        onConflict: 'user_id'
      })
      .select()

    console.log('Update result:', { data: updateData, error: updateError })

    if (updateError) {
      return NextResponse.json({
        error: 'Failed to update balance',
        details: updateError
      }, { status: 500 })
    }

    // Verify the update
    const { data: verifyData, error: verifyError } = await supabase
      .from('credit_balances')
      .select('current_balance')
      .eq('user_id', userId)
      .single()

    console.log('Verification result:', { data: verifyData, error: verifyError })

    return NextResponse.json({
      success: true,
      originalBalance: currentBalance,
      addedAmount: amount,
      newBalance: verifyData?.current_balance,
      updateResult: updateData,
    })
  } catch (error) {
    console.error('Test endpoint error:', error)
    return NextResponse.json({
      error: 'Unexpected error',
      details: error
    }, { status: 500 })
  }
} 