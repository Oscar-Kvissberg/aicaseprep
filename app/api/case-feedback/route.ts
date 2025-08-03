import { NextResponse } from 'next/server';
import { supabaseServer } from '@/lib/supabase-server';
import { OpenAI } from 'openai';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/api/auth/config';

// Initialize OpenAI client
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

// Kontrollera om vi ska använda lokal Ollama eller OpenAI
const useLocalModel = process.env.USE_LOCAL_MODEL === 'true';
console.log('USE_LOCAL_MODEL env var:', process.env.USE_LOCAL_MODEL);
console.log('useLocalModel calculated:', useLocalModel);

async function analyzeImage(imageUrl: string): Promise<string> {
  try {
    const response = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [
        {
          role: "user",
          content: [
            { 
              type: "text", 
              text: "Beskriv vad denna whiteboard-skiss visar. Var koncis och fokusera på det väsentliga. Svara på svenska och använd max 250 tecken." 
            },
            {
              type: "image_url",
              image_url: {
                url: imageUrl,
                detail: "low"
              }
            },
          ],
        },
      ],
      max_tokens: 150,
    });
    
    return response.choices[0].message.content || "Kunde inte analysera skissen.";
  } catch (error: unknown) {
    console.error('Error analyzing image:', error);
    return "Kunde inte analysera skissen.";
  }
}

async function getRelevantSections(caseId: string, userInput: string, sectionId: string): Promise<string> {
  try {
    // Get the current section's data
    const { data: currentSection, error } = await supabaseServer
      .from('case_sections')
      .select('*')
      .eq('id', sectionId)
      .single();

    if (error) {
      console.error('Error fetching current section:', error);
      return '';
    }

    // Format the section data
    const formattedSection = `
SEKTION: ${currentSection.title}
FRÅGA: ${currentSection.prompt}

${currentSection.ai_instructions ? `AI-INSTRUKTIONER: ${currentSection.ai_instructions}` : ''}
`;

    console.log('Current Section Data:', formattedSection);
    return formattedSection;
  } catch (error) {
    console.error('Error getting section data:', error);
    return '';
  }
}

export async function POST(request: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    console.log('Session user:', session.user);

    // FIRST: Ensure user exists in our users table
    const { data: existingUser, error: userCheckError } = await supabaseServer
      .from('users')
      .select('*')
      .eq('id', session.user.id)
      .single();

    console.log('Existing user:', existingUser);
    console.log('User check error:', userCheckError);

    if (!existingUser) {
      console.log('Creating new user with ID:', session.user.id);
      
      // User doesn't exist in our table, create them
      const { data: insertResult, error: createError } = await supabaseServer
        .from('users')
        .insert({
          id: session.user.id,
          email: session.user.email,
          name: session.user.name || '',
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        })
        .select()
        .single();

      console.log('Insert result:', insertResult);
      console.log('Create error:', createError);

      if (createError) {
        console.error('Error creating user:', createError);
        return NextResponse.json(
          { error: 'Failed to create user' },
          { status: 500 }
        );
      }
    }

    const { caseId, responseText, sectionId, conversationHistory } = await request.json();

    if (!caseId || !responseText || !sectionId) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      );
    }

    // SECOND: Now we can proceed with case-related operations
    const { data: businessCase, error: caseError } = await supabaseServer
      .from('business_cases')
      .select('*, case_sections(count)')
      .eq('id', caseId)
      .single();

    if (caseError) {
      console.error('Error fetching business case:', caseError);
      return NextResponse.json(
        { error: 'Failed to fetch business case' },
        { status: 500 }
      );
    }

    // Get total number of sections for this case
    const totalSections = businessCase.case_sections[0].count;

    // Get current progress for this case
    const { data: currentProgress } = await supabaseServer
      .from('user_case_progress')
      .select('*')
      .eq('user_id', session.user.id)
      .eq('case_id', caseId)
      .single();

    // Calculate new progress
    const completedSections = currentProgress?.completed_sections || 0;
    const newCompletedSections = completedSections + 1;
    const isCompleted = newCompletedSections === totalSections;

    // Update or create progress record using upsert
    const { error: updateError } = await supabaseServer
      .from('user_case_progress')
      .upsert({
        user_id: session.user.id,
        case_id: caseId,
        completed_sections: newCompletedSections,
        total_sections: totalSections,
        last_activity: new Date().toISOString(),
        is_completed: isCompleted
      }, {
        onConflict: 'user_id,case_id',
        ignoreDuplicates: false
      });

    if (updateError) {
      console.error('Error updating progress:', updateError);
      return NextResponse.json(
        { error: 'Failed to update progress' },
        { status: 500 }
      );
    }

    // Check if response contains a sketch
    const hasSketch = responseText.includes('[Skiss]');
    let sketchAnalysis = '';
    
    if (hasSketch) {
      const imageUrlMatch = responseText.match(/!\[Skiss\]\((.*?)\)/);
      if (imageUrlMatch && imageUrlMatch[1]) {
        sketchAnalysis = await analyzeImage(imageUrlMatch[1]);
      }
    }

    // Get current section data for criteria
    const { data: currentSection, error: sectionError } = await supabaseServer
      .from('case_sections')
      .select('*')
      .eq('id', sectionId)
      .single();

    if (sectionError) {
      console.error('Error fetching current section:', sectionError);
      return NextResponse.json(
        { error: 'Failed to fetch current section' },
        { status: 500 }
      );
    }

    // Get relevant sections using RAG
    const relevantSections = await getRelevantSections(caseId, responseText, sectionId);

    // Debug logging - only log once
    console.log('=== SECTION DATA ===');
    console.log('Current Section:', {
      title: currentSection.title,
      prompt: currentSection.prompt,
      case_data: currentSection.case_data,
      criteria: currentSection.criteria
    });

    // Generate interactive response using OpenAI
    const prompt =  `
    Du är en senior konsult på en ledande managementkonsultfirma (t.ex. McKinsey, BCG eller Bain) som intervjuar en kandidat i ett caseintervjuformat.
    Du är metodisk, professionell och coachande – men håller höga krav på tydliga, logiska resonemang.
    
    Dina uppgifter i denna interaktion är att:
    1. Guida kandidaten genom caset steg för steg och ge relevant information vid behov
    2. Säkerställa att kandidatens resonemang täcker sektionens kärnaspekter
    3. Bedöma om kandidaten uppfyller samtliga kriterierier för att gå vidare
    4. Om kandidaten uppfyller alla kriterier, ställ då ingen följdfråga utan ge bara ett förtyfligande avslut.
    5. Om kandidaten ställer en fråga, svara mycket kortfattat utan att ge för mycket vägledning
    6. Dela endast med dig av specifik data från CASE DATA-sektionen om kandidaten aktivt efterfrågar 
        den typen av information, eller om deras resonemang naturligt leder till det.
         Exempel: Om kandidaten säger “Kan det vara så att försäljningen har gått ner?”, svara då med relevant datapunkt:
        “Ja, det är pga [relevant fakta från CASE DATA]”
        (Du får aldrig visa hela CASE DATA-listan. Avslöja inte fler datapunkter än vad kandidaten själv leder in samtalet mot.)
    
    
    ---
    
    📄 CASE STUDY
    Titel: ${businessCase.title}  
    Företag: ${businessCase.company}  
    Bransch: ${businessCase.industry}  
    
    📎 Nuvarande sektionsfråga:  
    ${relevantSections}
    
    ${currentSection.case_data ? `
    📊 CASE DATA:
    ${currentSection.case_data}
    ` : ''}
    
    ${currentSection.graph_description ? `
    📊 Graf/bild som är relevant för frågan:
    ${currentSection.graph_description}
    ` : ''}
    
    🎯 Bedömningskriterier i denna sektion:  
    ${currentSection.criteria}
    
    🧠 Konversationshistorik:  
    ${conversationHistory || 'Ingen tidigare konversation'}
    
    🗣️ Kandidatens senaste svar:  
    ${responseText}
    
    ${hasSketch ? `
    📝 Kandidatens skissanalys:
    ${sketchAnalysis}
    ` : ''}
    
    ---
    
    ✅ När du bedömer kandidatens svar:

      Om kandidatens svar uppfyller kriterierna, skriv exakt:
      KRITERIER UPPFYLLDA: Ja (på en egen rad, utan extra text före eller efter) och ge ett förtyfligande avslut utan följdfrågor.


      Om kandidatens svar inte uppfyller kriterierna, skriv exakt:
      KRITERIER UPPFYLLDA: Nej (på en egen rad, utan extra text före eller efter)

    🔒 Du får inte använda andra varianter som "Delvis" eller lägga till extra text på den raden.
      Detta är ett tekniskt format som används för att trigga nästa steg i systemet.
    `;

    console.log('=== FINAL PROMPT ===');
    console.log(prompt);
    console.log('=== END FINAL PROMPT ===');
    console.log('useLocalModel:', useLocalModel);

    let feedback: string;

    if (useLocalModel) {
      // Använd lokal Ollama-modell
      try {
        const ollamaResponse = await fetch('http://localhost:11434/api/generate', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            model: 'phi3:latest',
            prompt: prompt,
            stream: false,
            options: {
              temperature: 0.7,
              num_predict: 1000,
            }
          })
        });

        if (!ollamaResponse.ok) {
          throw new Error(`Ollama request failed: ${ollamaResponse.statusText}`);
        }

        const ollamaData = await ollamaResponse.json();
        feedback = ollamaData.response || "No feedback generated.";
      } catch (error) {
        console.error('Error with Ollama:', error);
        feedback = "Kunde inte generera feedback med lokal modell.";
      }
    } else {
      // Använd OpenAI
      const completion = await openai.chat.completions.create({
        model: "gpt-4",
        messages: [
          { role: "user", content: prompt }
        ],
        temperature: 0.7,
        max_tokens: 1000,
      });

      feedback = completion.choices[0].message.content || "No feedback generated.";
    }
    
    // Check if criteria are met
    const isComplete = feedback.includes("KRITERIER UPPFYLLDA: Ja");
    
    // Remove the criteria line from the feedback
    const cleanFeedback = feedback.replace(/KRITERIER UPPFYLLDA: (Ja|Nej)/g, '').trim();

    // Save the response to the database
    const { error: saveError } = await supabaseServer
      .from('user_responses')
      .insert({
        user_id: session.user.id,
        case_id: caseId,
        section_id: sectionId,
        response_text: responseText,
        feedback: cleanFeedback,
        conversation_history: conversationHistory,
      });

    if (saveError) {
      console.error('Error saving response:', saveError);
      return NextResponse.json(
        { error: 'Failed to save response' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      feedback: cleanFeedback,
      isComplete,
      progress: {
        completedSections: newCompletedSections,
        totalSections,
        isCompleted
      }
    });
  } catch (error) {
    console.error('Error processing case feedback:', error);
    return NextResponse.json(
      { error: 'Failed to process feedback' },
      { status: 500 }
    );
  }
} 