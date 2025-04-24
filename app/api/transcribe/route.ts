import { NextResponse } from 'next/server'
import { OpenAI } from 'openai'
import { writeFile } from 'fs/promises'
import { join } from 'path'

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
})

export async function POST(request: Request) {
  try {
    const formData = await request.formData()
    const audioFile = formData.get('audio') as Blob

    if (!audioFile) {
      return NextResponse.json(
        { error: 'No audio file provided' },
        { status: 400 }
      )
    }

    // Create a temporary file path
    const tempFilePath = join('/tmp', 'recording.webm')
    
    // Write the blob to a temporary file
    await writeFile(tempFilePath, Buffer.from(await audioFile.arrayBuffer()))

    // Create a transcription using OpenAI's Whisper model
    const transcriptionResponse = await openai.audio.transcriptions.create({
      file: await import('fs').then(fs => fs.createReadStream(tempFilePath)),
      model: 'whisper-1',
      language: 'sv',
      response_format: 'json',
      prompt: 'Transkribera exakt vad som sägs, utan att lägga till något extra.'
    })

    // Clean up the temporary file
    await import('fs/promises').then(fs => fs.unlink(tempFilePath))

    // Ensure we're getting just the transcribed text
    const transcribedText = typeof transcriptionResponse === 'string' 
      ? transcriptionResponse 
      : transcriptionResponse.text

    return NextResponse.json({ text: transcribedText.trim() })

  } catch (error) {
    console.error('Error transcribing audio:', error)
    return NextResponse.json(
      { error: 'Failed to transcribe audio' },
      { status: 500 }
    )
  }
} 