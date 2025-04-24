import { NextResponse } from 'next/server';
import { supabaseServer } from '@/lib/supabase-server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/api/auth/config';
import { OpenAI } from 'openai';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

export async function POST(request: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { caseId } = await request.json();
    if (!caseId) {
      return NextResponse.json(
        { error: 'Missing caseId' },
        { status: 400 }
      );
    }

    // Get the business case
    const { data: businessCase, error: caseError } = await supabaseServer
      .from('business_cases')
      .select('*')
      .eq('id', caseId)
      .single();

    if (caseError) {
      console.error('Error fetching business case:', caseError);
      return NextResponse.json(
        { error: 'Failed to fetch business case' },
        { status: 500 }
      );
    }

    // Generate embedding for the case description
    const embeddingResponse = await openai.embeddings.create({
      model: 'text-embedding-3-small',
      input: businessCase.description,
    });

    const embedding = embeddingResponse.data[0].embedding;

    // Update case with embedding
    const { error: updateError } = await supabaseServer
      .from('business_cases')
      .update({ description_embedding: embedding })
      .eq('id', caseId);

    if (updateError) {
      console.error('Error updating case embedding:', updateError);
      return NextResponse.json(
        { error: 'Failed to update case embedding' },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error generating embeddings:', error);
    return NextResponse.json(
      { error: 'Failed to generate embeddings' },
      { status: 500 }
    );
  }
}