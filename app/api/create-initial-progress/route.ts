import { NextResponse } from 'next/server';
import { supabaseServer } from '@/lib/supabase-server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/api/auth/config';

export async function POST(request: Request) {
  try {
    // Verify user is authenticated
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { userId } = await request.json();

    // Verify the user ID matches the session
    if (userId !== session.user.id) {
      return NextResponse.json({ error: 'Invalid user ID' }, { status: 403 });
    }

    console.log('Checking for existing progress for user:', userId);

    // First check if progress already exists
    const { data: existingProgress, error: checkError } = await supabaseServer
      .from('user_case_progress')
      .select('*')
      .eq('user_id', userId)
      .single();

    if (checkError && checkError.code !== 'PGRST116') {
      console.error('Error checking for existing progress:', checkError);
      return NextResponse.json(
        { error: `Failed to check existing progress: ${checkError.message}` },
        { status: 500 }
      );
    }

    // If progress exists, return it
    if (existingProgress) {
      console.log('Progress already exists, returning existing progress');
      return NextResponse.json(existingProgress);
    }

    console.log('Creating initial progress for user:', userId);

    // Start a transaction
    const { data: newProgress, error: insertError } = await supabaseServer
      .from('user_case_progress')
      .insert({
        user_id: userId,
        case_id: null,
        completed_sections: 0,
        total_sections: 0,
        is_completed: false,
        last_activity: new Date().toISOString()
      })
      .select('*')
      .single();

    if (insertError) {
      console.error('Error creating initial progress:', {
        error: insertError,
        code: insertError.code,
        message: insertError.message,
        details: insertError.details,
        hint: insertError.hint
      });
      return NextResponse.json(
        { error: `Failed to create progress: ${insertError.message}` },
        { status: 500 }
      );
    }

    if (!newProgress) {
      return NextResponse.json(
        { error: 'No data returned from insert' },
        { status: 500 }
      );
    }

    // Add initial credits using the new transaction system
    const { error: creditError } = await supabaseServer.rpc('add_user_credits', {
      in_user_id: userId,
      in_amount: 3,
      in_transaction_type: 'promotion',
      in_description: 'Welcome bonus - 3 free credits',
      in_metadata: {
        source: 'initial_signup'
      }
    });

    if (creditError) {
      console.error('Error adding initial credits:', creditError);
      // We don't return an error here, as the progress was created successfully
    }

    // Immediately use one credit for the first case
    const { error: deductError } = await supabaseServer.rpc('use_user_credits', {
      in_user_id: userId,
      in_amount: 1,
      in_description: 'Used credit for first case interview practice'
    });

    if (deductError) {
      console.error('Error deducting initial credit:', deductError);
      // We don't return an error here, as the progress was created successfully
    }

    console.log('Successfully created initial progress:', newProgress);
    return NextResponse.json(newProgress);
  } catch (error) {
    console.error('Error in create-initial-progress:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
} 