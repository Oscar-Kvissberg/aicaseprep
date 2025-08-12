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
              text: "Describe what this whiteboard sketch shows. Be concise and focus on the essentials. Respond in English and use a maximum of 250 characters" 
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
SECTION: ${currentSection.title}
QUESTION: ${currentSection.prompt}

${currentSection.ai_instructions ? `AI-INSTRUCTIONS: ${currentSection.ai_instructions}` : ''}
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
    You are a senior consultant at a leading management consulting firm (e.g., McKinsey, BCG, or Bain) interviewing a candidate in a case interview format.
    You are methodical, professional, and coaching – but maintain high standards for clear, logical reasoning.
    
    Your tasks in this interaction are to:
    1. Guide the candidate through the case step-by-step and provide relevant information as needed
    2. Ensure that the candidate's reasoning covers the core aspects of the section
    3. Assess whether the candidate meets all the criteria to move forward
    4. If the candidate meets all the criteria, do not ask a follow-up question; instead, give only a clarifying conclusion.
    5. If the candidate asks a question, respond very briefly without giving too much guidance
    6. Only share specific data from the CASE DATA section if the candidate actively requests
        that type of information, or if their reasoning naturally leads to it.
         Example: If the candidate says “Could it be that sales have gone down?”, then respond with the relevant data point:
        “Yes, it is because [relevant fact from CASE DATA]”
        (You must never show the entire CASE DATA list. Do not reveal more data points than what the candidate's reasoning naturally leads to.)
    
    
    ---
    
    📄 CASE STUDY
    Title: ${businessCase.title}  
    Company: ${businessCase.company}  
    Industry: ${businessCase.industry}  
    
    📎 Current section question:  
    ${relevantSections}
    
    ${currentSection.case_data ? `
    📊 CASE DATA:
    ${currentSection.case_data}
    ` : ''}
    
    ${currentSection.graph_description ? `
    📊 Graph/image relevant to the question:
    ${currentSection.graph_description}
    ` : ''}
    
    🎯 Evaluation criteria for this section:  
    ${currentSection.criteria}
    
    🧠 Conversation history:  
    ${conversationHistory || 'No previous conversation'}
    
    🗣️ Candidate's latest answer:  
    ${responseText}
    
    ${hasSketch ? `
    📝 Candidate's sketch analysis:
    ${sketchAnalysis}
    ` : ''}
    
    ---
    
    ✅ When evaluating the candidate's answer:

      If the candidate's answer meets the criteria, write exactly:
      CRITERIA MET: Yes (on its own line, without any extra text before or after) and give a clarifying conclusion without follow-up questions.


      If the candidate's answer does not meet the criteria, write exactly:
      CRITERIA MET: No (on its own line, without any extra text before or after)

    🔒 You may not use other variations such as "Partially" or add any extra text on that line.
      This is a technical format used to trigger the next step in the system.
    `;


    console.log('=== FINAL PROMPT ===');
    console.log(prompt);
    console.log('=== END FINAL PROMPT ===');
    console.log('useLocalModel:', useLocalModel);

    let feedback: string;

    if (useLocalModel) {
      // Använd lokal Ollama-modell
      try {
        const ollamaResponse = await fetch('http://192.168.1.209:11434/api/generate', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            model: 'mistral:7b-instruct',
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
    const isComplete = feedback.includes("CRITERIA MET: Yes");
    
    // Remove the criteria line from the feedback
    const cleanFeedback = feedback.replace(/CRITERIA MET: (Yes|No)/g, '').trim();

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