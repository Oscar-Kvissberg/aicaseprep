import { NextResponse } from 'next/server';
import { supabaseServer } from '@/lib/supabase-server';
import bcrypt from 'bcryptjs';

export async function POST(request: Request) {
  try {
    const { email, password, name } = await request.json();

    if (!email || !password || !name) {
      return NextResponse.json(
        { error: 'Email, password and name are required' },
        { status: 400 }
      );
    }

    // Check if user already exists
    const { data: existingUser, error: queryError } = await supabaseServer
      .from('users')
      .select()
      .eq('email', email)
      .single();

    if (queryError && queryError.code !== 'PGRST116') {
      console.error('Error checking existing user:', queryError);
      return NextResponse.json(
        { error: 'Error checking existing user' },
        { status: 500 }
      );
    }

    if (existingUser) {
      return NextResponse.json(
        { error: 'User already exists' },
        { status: 400 }
      );
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 10);

    // Create new user
    const { error: insertError } = await supabaseServer
      .from('users')
      .insert({
        email,
        name,
        password: hashedPassword,
        created_at: new Date().toISOString(),
      });

    if (insertError) {
      console.error('Error creating user:', insertError);
      return NextResponse.json(
        { error: 'Error creating user' },
        { status: 500 }
      );
    }

    return NextResponse.json(
      { message: 'User created successfully' },
      { status: 201 }
    );
  } catch (error) {
    console.error('Unexpected error during registration:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
} 