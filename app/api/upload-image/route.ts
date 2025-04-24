import { NextResponse } from 'next/server';
import { supabaseServer } from '@/lib/supabase-server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/api/auth/config';

export async function POST(request: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { imageData } = await request.json();

    if (!imageData) {
      return NextResponse.json(
        { error: 'Missing image data' },
        { status: 400 }
      );
    }

    // Extract the base64 data
    const base64Data = imageData.replace(/^data:image\/\w+;base64,/, '');
    const buffer = Buffer.from(base64Data, 'base64');

    // Generate a unique filename
    const filename = `whiteboard-${Date.now()}-${Math.random().toString(36).substring(2, 15)}.png`;

    // Upload to Supabase Storage
    const { error } = await supabaseServer.storage
      .from('whiteboard-images')
      .upload(filename, buffer, {
        contentType: 'image/png',
        upsert: false
      });

    if (error) {
      console.error('Error uploading image:', error);
      return NextResponse.json(
        { error: 'Failed to upload image' },
        { status: 500 }
      );
    }

    // Get the public URL
    const { data: { publicUrl } } = supabaseServer.storage
      .from('whiteboard-images')
      .getPublicUrl(filename);

    return NextResponse.json({ url: publicUrl });
  } catch (error) {
    console.error('Error processing image upload:', error);
    return NextResponse.json(
      { error: 'Failed to process image upload' },
      { status: 500 }
    );
  }
} 