import { NextResponse } from 'next/server'
import { supabaseServer } from '@/lib/supabase-server'
import { getServerSession } from 'next-auth'
import { authOptions } from '../config'

export async function POST(request: Request) {
  try {
    const session = await getServerSession(authOptions)
    
    if (!session?.user?.email) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    const { access_token, id_token } = await request.json()

    if (!access_token || !id_token) {
      return NextResponse.json(
        { error: 'Access token and ID token are required' },
        { status: 400 }
      )
    }

    // Check if user exists
    const { data: existingUser, error: queryError } = await supabaseServer
      .from('users')
      .select()
      .eq('email', session.user.email)
      .single()

    if (queryError && queryError.code !== 'PGRST116') {
      console.error('Error checking existing user:', queryError)
      return NextResponse.json(
        { error: 'Error checking existing user' },
        { status: 500 }
      )
    }

    if (!existingUser) {
      return NextResponse.json(
        { error: 'User not found' },
        { status: 404 }
      )
    }

    // Update user with Google tokens
    const { error: updateError } = await supabaseServer
      .from('users')
      .update({
        google_access_token: access_token,
        google_id_token: id_token,
        updated_at: new Date().toISOString(),
      })
      .eq('email', session.user.email)

    if (updateError) {
      console.error('Error updating user:', updateError)
      return NextResponse.json(
        { error: 'Error updating user' },
        { status: 500 }
      )
    }

    return NextResponse.json(
      { message: 'Google account linked successfully' },
      { status: 200 }
    )
  } catch (error) {
    console.error('Unexpected error during Google link:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
} 