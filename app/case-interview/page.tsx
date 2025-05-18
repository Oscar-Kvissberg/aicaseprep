'use client'

import { useEffect, useState, useRef, Suspense } from 'react'
import { useSession } from 'next-auth/react'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import Image, { ImageLoaderProps } from 'next/image'
import toast from 'react-hot-toast'
import { Whiteboard } from '@/app/components/whiteboard'
import { supabase } from '@/lib/supabase'


interface BusinessCase {
  id: string
  title: string
  company: string
  industry: string
  difficulty: string
  estimated_time: string
  description: string
  language: string
  author_note: string
}

interface CaseSection {
  id: string
  title: string
  type: string
  prompt: string
  order_index: number
  graph_description?: string
  imageUrl?: string
  hint?: string
}

// Add image loader for Supabase URLs
const supabaseImageLoader = ({ src }: ImageLoaderProps) => {
  return src;
}

function CaseInterviewContent() {
  const { data: session, status } = useSession()
  const router = useRouter()
  const searchParams = useSearchParams()
  const caseId = searchParams.get('caseId')
  const sectionId = searchParams.get('sectionId')
  
  const [businessCase, setBusinessCase] = useState<BusinessCase | null>(null)
  const [sections, setSections] = useState<CaseSection[]>([])
  const [currentSection, setCurrentSection] = useState<CaseSection | null>(null)
  const [responseText, setResponseText] = useState('')
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [conversationHistory, setConversationHistory] = useState<string>('')
  const [isComplete, setIsComplete] = useState(false)
  const [isAiResponding, setIsAiResponding] = useState(false)
  const [showWhiteboard, setShowWhiteboard] = useState(false)
  const [whiteboardImageUrl, setWhiteboardImageUrl] = useState<string | null>(null)
  const [isRecording, setIsRecording] = useState(false)
  const [showHint, setShowHint] = useState(false)
  const [hint, setHint] = useState<string | null>(null)
  const mediaRecorderRef = useRef<MediaRecorder | null>(null)
  const chunksRef = useRef<Blob[]>([])

  useEffect(() => {
    if (status === 'loading') return;
    
    if (!session && caseId) {
      router.push(`/login?callbackUrl=${encodeURIComponent(`/case-interview?caseId=${caseId}`)}`);
    }

    if (!caseId) {
      router.push('/cases')
      return
    }

    async function fetchCase() {
      try {
        // Fetch business case and sections from API
        const response = await fetch(`/api/cases/${caseId}`)
        if (!response.ok) {
          throw new Error('Failed to fetch case data')
        }
        const data = await response.json()
        
        setBusinessCase(data.case)
        setSections(data.sections || [])

        // If sectionId is provided, set the current section
        if (sectionId) {
          const section = data.sections?.find((s: CaseSection) => s.id === sectionId)
          if (section) {
            // Fetch the section image if it exists
            console.log('Fetching image for section:', sectionId);
            const { data: imageData, error: imageError } = await supabase
              .from('case_section_images')
              .select('*')
              .eq('section_id', sectionId)
              .single();

            console.log('Image data from DB:', imageData);
            console.log('Image error if any:', imageError);

            if (imageData) {
              // Extract just the filename and clean it
              const filename = imageData.image_url.split('/').pop() || '';
              const cleanFilename = filename.replace(/^\/+/, '').replace(/%20/g, ' ');
              
              const imageUrl = supabase.storage
                .from('case-images')
                .getPublicUrl(cleanFilename).data.publicUrl;
              
              console.log('Clean filename:', cleanFilename);
              console.log('Generated image URL:', imageUrl);
              section.imageUrl = imageUrl;
            }

            setCurrentSection(section)
            setHint(section.hint || null)
            console.log('Current section with image:', section);
            // Reset conversation history when changing sections
            setConversationHistory('')
            setIsComplete(false)
            setShowHint(false)
          }
        }
      } catch (err) {
        console.error('Error fetching case:', err)
        setError('Failed to load the business case. Please try again later.')
      } finally {
        setLoading(false)
      }
    }

    fetchCase()
  }, [session, status, caseId, sectionId, router])

  const handleStartCase = async () => {
    if (sections.length > 0) {
      try {
        // First check if user already has any progress
        const { data: allProgress, error: allProgressError } = await supabase
          .from('user_case_progress')
          .select('*')
          .eq('user_id', session?.user?.id);

        if (allProgressError) {
          console.error('Error checking all progress:', allProgressError);
          toast.error('Kunde inte kontrollera din progress');
          return;
        }

        const isFirstCase = !allProgress || allProgress.length === 0;

        // Check for progress on this specific case
        const { error: progressError } = await supabase
          .from('user_case_progress')
          .select('*')
          .eq('user_id', session?.user?.id)
          .eq('case_id', caseId)
          .single();

        if (progressError && progressError.code !== 'PGRST116') { // PGRST116 is "not found" error
          console.error('Error checking existing progress:', progressError);
          toast.error('Kunde inte kontrollera din progress');
          return;
        }

        // If no progress exists at all, create initial progress
        if (isFirstCase) {
          const response = await fetch('/api/create-initial-progress', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              userId: session?.user?.id
            })
          });

          if (!response.ok) {
            const errorData = await response.json();
            console.error('Error creating initial progress:', errorData);
            toast.error('Kunde inte skapa användarprogress');
            return;
          }
        } else {
          // Only check and deduct credits if this is not the first case
          // Get credit balance
          const { data: balanceData, error: balanceError } = await supabase
            .from('credit_balances')
            .select('current_balance')
            .eq('user_id', session?.user?.id)
            .single();

          if (balanceError) {
            console.error('Error fetching credit balance:', balanceError);
            toast.error('Kunde inte kontrollera dina krediter');
            return;
          }

          const availableCredits = balanceData?.current_balance || 0;

          if (availableCredits < 1) {
            toast.error('Du har inga krediter kvar. Köp fler för att fortsätta.');
            router.push('/dash');
            return;
          }

          // Use one credit
          console.log('Attempting to use credit with params:', {
            in_user_id: session?.user?.id,
            in_amount: 1,
            in_description: `Used credit for case: ${businessCase?.title}`
          });
          
          const { data: deductData, error: deductError } = await supabase.rpc('use_user_credits', {
            in_user_id: session?.user?.id,
            in_amount: 1,
            in_description: `Used credit for case: ${businessCase?.title}`
          });

          if (deductError) {
            console.error('Error deducting credits:', {
              error: deductError,
              code: deductError.code,
              message: deductError.message,
              details: deductError.details,
              hint: deductError.hint
            });
            toast.error(`Kunde inte dra av kredit: ${deductError.message || 'Okänt fel'}`);
            return;
          }

          console.log('Successfully deducted credit:', deductData);

          toast.success('En kredit har dragits av. Lycka till med caset!');
        }

        // Create or update progress for this specific case
        const { error: updateError } = await supabase
          .from('user_case_progress')
          .upsert({
            user_id: session?.user?.id,
            case_id: caseId,
            completed_sections: 0,
            total_sections: sections.length,
            last_activity: new Date().toISOString(),
            is_completed: false
          }, {
            onConflict: 'user_id,case_id'
          });

        if (updateError) {
          console.error('Error updating case progress:', updateError);
          toast.error('Kunde inte uppdatera din progress');
          return;
        }

        // Show different success message for first case
        if (isFirstCase) {
          toast.success('Välkommen! Du har fått 2 krediter och en har använts för detta case. Lycka till!');
        }
        
        // Navigate to the first section
        router.push(`/case-interview?caseId=${caseId}&sectionId=${sections[0].id}`);
      } catch (error) {
        console.error('Error in handleStartCase:', error);
        toast.error('Ett oväntat fel uppstod. Försök igen.');
      }
    }
  };

  const handleNextSection = async () => {
    if (!currentSection) return;

    const currentIndex = sections.findIndex(s => s.id === currentSection.id);
    if (currentIndex < sections.length - 1) {
      // Reset states before navigating to next section
      setConversationHistory('');
      setIsComplete(false);
      router.push(`/case-interview?caseId=${caseId}&sectionId=${sections[currentIndex + 1].id}`);
    } else {
      // Case completed - update progress
      try {
        const { error: updateError } = await supabase
          .from('user_case_progress')
          .upsert({
            user_id: session?.user?.id,
            case_id: caseId,
            completed_sections: sections.length,
            total_sections: sections.length,
            last_activity: new Date().toISOString(),
            is_completed: true
          }, {
            onConflict: 'user_id,case_id'
          });

        if (updateError) {
          console.error('Error updating progress:', updateError);
          toast.error('Kunde inte uppdatera din progress');
          return;
        }

        // Show success message and redirect
        toast.success('Grattis! Du har slutfört alla sektioner i detta case.');
        router.push('/cases');
      } catch (err) {
        console.error('Error completing case:', err);
        toast.error('Kunde inte slutföra caset');
      }
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    if (!session?.user?.email) {
      toast.error('Du måste vara inloggad för att skicka in ett svar')
      return
    }
    
    if (!responseText.trim() && !whiteboardImageUrl) {
      toast.error('Vänligen skriv in ditt svar eller lägg till en skiss')
      return
    }
    
    setSubmitting(true)
    setIsAiResponding(true)
    
    // Create message content with optional whiteboard image
    const messageContent = whiteboardImageUrl 
      ? `${responseText.trim()}\n\n[Skiss]\n![Skiss](${whiteboardImageUrl})`
      : responseText.trim()
    
    console.log('Message content:', messageContent); // Debug log
    
    // Create or update conversation history with user's message
    const updatedHistory = conversationHistory 
      ? `${conversationHistory}\n\n---\n\nKandidat: ${messageContent}`
      : `Kund: ${currentSection?.prompt}${currentSection?.imageUrl ? `\n\n![Case graf/bild](${currentSection.imageUrl})` : ''}\n\n---\n\nKandidat: ${messageContent}`
    
    // Update conversation history immediately with user's message
    setConversationHistory(updatedHistory)
    
    // Clear response text and whiteboard image
    setResponseText('')
    setWhiteboardImageUrl(null)
    
    try {
      // Submit response to API
      const apiResponse = await fetch('/api/case-feedback', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          caseId,
          responseText: messageContent,  // Send only the current message
          sectionId: currentSection?.id,
          userId: session.user.id,
          conversationHistory  // Send the previous history (without current message)
        }),
      })
      
      if (!apiResponse.ok) {
        throw new Error('Failed to submit response')
      }
      
      const data = await apiResponse.json()
      setIsComplete(data.isComplete)
      
      // Update conversation history with AI's response
      setConversationHistory(updatedHistory + `\n\n---\n\nKund: ${data.feedback}`)
      
      toast.success('Svar skickat!')
    } catch (err) {
      console.error('Error submitting response:', err)
      toast.error('Kunde inte skicka svaret. Försök igen.')
      // Revert conversation history on error
      setConversationHistory(conversationHistory)
    } finally {
      setSubmitting(false)
      setIsAiResponding(false)
    }
  }

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      const mediaRecorder = new MediaRecorder(stream)
      mediaRecorderRef.current = mediaRecorder
      chunksRef.current = []

      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) {
          chunksRef.current.push(e.data)
        }
      }

      mediaRecorder.onstop = async () => {
        const audioBlob = new Blob(chunksRef.current, { type: 'audio/webm' })
        
        // Create FormData and append the audio file
        const formData = new FormData()
        formData.append('audio', audioBlob, 'recording.webm')
        
        try {
          const response = await fetch('/api/transcribe', {
            method: 'POST',
            body: formData,
          })
          
          if (!response.ok) {
            throw new Error('Transkribering misslyckades')
          }
          
          const { text } = await response.json()
          setResponseText(text)
          
        } catch (error) {
          console.error('Error transcribing audio:', error)
          toast.error('Kunde inte transkribera ljudinspelningen')
        }
      }

      mediaRecorder.start()
      setIsRecording(true)
    } catch (error) {
      console.error('Error starting recording:', error)
      toast.error('Kunde inte starta ljudinspelning')
    }
  }

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop()
      mediaRecorderRef.current.stream.getTracks().forEach(track => track.stop())
      setIsRecording(false)
    }
  }

  if (loading) {
    return (
      <div className="flex justify-center items-center min-h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500"></div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="flex justify-center items-center min-h-screen">
        <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded">
          <p>{error}</p>
          <Link href="/cases" className="mt-2 inline-block text-blue-500 underline">
            Tillbaka till case biblioteket
          </Link>
        </div>
      </div>
    )
  }

  if (!businessCase) {
    return (
      <div className="flex justify-center items-center min-h-screen">
        <div className="bg-yellow-100 border border-yellow-400 text-yellow-700 px-4 py-3 rounded">
          <p>Case not found</p>
          <Link href="/cases" className="mt-2 inline-block text-blue-500 underline">
            Tillbaka till case biblioteket
          </Link>
        </div>
      </div>
    )
  }

  // If no section is selected, show the case overview with chat interface
  if (!currentSection) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="mb-6">
          <Link href="/cases" className="text-blue-500 hover:underline">
            &larr; Tillbaka till case biblioteket
          </Link>
        </div>
        
        <div className="bg-white shadow-md rounded-lg overflow-hidden mb-8">
          <div className="p-6">
            <h1 className="text-3xl font-bold mb-2">{businessCase.title}</h1>
            <div className="flex space-x-2 mb-4">
              <span className="px-2 py-1 bg-blue-100 text-blue-800 text-xs rounded">
                {businessCase.difficulty}
              </span>
              <span className="px-2 py-1 bg-green-100 text-green-800 text-xs rounded">
                {businessCase.industry}
              </span>
              <span className="px-2 py-1 bg-purple-100 text-purple-800 text-xs rounded">
                {businessCase.estimated_time}
              </span>
            </div>
            
            {!session ? (
              <div className="bg-yellow-100 border border-yellow-400 text-yellow-700 px-4 py-3 rounded mb-6">
                <p>Vänligen <Link href="/login" className="underline">logga in</Link> för att börja case-intervjun.</p>
              </div>
            ) : (
              <div className="mt-8">
                <div className="bg-gray-50 p-6 rounded-lg mb-6">
                  <div className="prose max-w-none">
                    <p className="text-lg mb-6">
                      {businessCase.description}
                    </p>
                    
                    <div className="mb-6">
                      <h3 className="text-lg font-semibold mb-2">Sektioner:</h3>
                      <ul className="list-disc pl-5">
                        {sections.map((section) => (
                          <li key={section.id} className="mb-1">
                            {section.title}
                          </li>
                        ))}
                      </ul>
                    </div>

                    <p className="text-lg">
                      Är du redo att börja? Klicka på &quot;Starta Case&quot; nedan för att påbörja första sektionen!
                    </p>
                  </div>
                </div>
                
                <button
                  onClick={handleStartCase}
                  className="bg-blue-500 hover:bg-blue-600 text-white px-6 py-3 rounded-lg text-lg font-medium"
                >
                  Starta Case
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    )
  }

  // Show the current section with chat interface
  return (
    <div className="container mx-auto px-4 py-8">
      <div className="mb-6">
        <button
          onClick={() => router.push('/cases')}
          className="text-blue-500 hover:text-blue-600 hover:underline flex items-center"
        >
          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5 mr-1">
            <path strokeLinecap="round" strokeLinejoin="round" d="M9 15L3 9m0 0l6-6M3 9h12a6 6 0 010 12h-3" />
          </svg>
          Avsluta case
        </button>
      </div>
      
      <div className="bg-white shadow-md rounded-lg overflow-hidden mb-8">
        <div className="p-6">
          <div className="flex justify-between items-center mb-6">
            <h1 className="text-2xl font-bold">{businessCase.title}</h1>
            <div className="text-sm text-gray-500">
              Sektion {sections.findIndex(s => s.id === currentSection.id) + 1} av {sections.length}
            </div>
          </div>
          
          <div className="bg-gray-50 p-4 rounded-lg mb-6">
            <div className="prose max-w-none">
              <div className="flex justify-between items-start mb-4">
                <p className="text-lg">
                  {businessCase.description}
                </p>
                {hint && (
                  <button
                    type="button"
                    onClick={() => setShowHint(!showHint)}
                    className="ml-4 px-4 py-2 bg-purple-100 hover:bg-purple-200 text-purple-700 rounded-lg flex items-center gap-2 transition-colors"
                    title="Få hint"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M9.879 7.519c1.171-1.025 3.071-1.025 4.242 0 1.172 1.025 1.172 2.687 0 3.712-.203.179-.43.326-.67.442-.745.361-1.45.999-1.45 1.827v.75M21 12a9 9 0 11-18 0 9 9 0 0118 0zm-9 5.25h.008v.008H12v-.008z" />
                    </svg>
                    <span>Hint</span>
                  </button>
                )}
              </div>
              {showHint && hint && (
                <div className="mt-4 p-4 bg-purple-50 border border-purple-200 rounded-lg">
                  <div className="flex items-start">
                    <div className="flex-shrink-0 mr-3">
                      <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-6 h-6 text-purple-500">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M9.879 7.519c1.171-1.025 3.071-1.025 4.242 0 1.172 1.025 1.172 2.687 0 3.712-.203.179-.43.326-.67.442-.745.361-1.45.999-1.45 1.827v.75M21 12a9 9 0 11-18 0 9 9 0 0118 0zm-9 5.25h.008v.008H12v-.008z" />
                      </svg>
                    </div>
                    <div className="flex-1">
                      <h4 className="text-sm font-semibold text-purple-800 mb-1">Hint</h4>
                      <p className="text-sm text-purple-700">{hint}</p>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
          
          {!session ? (
            <div className="bg-yellow-100 border border-yellow-400 text-yellow-700 px-4 py-3 rounded mb-6">
              <p>Vänligen <Link href="/login" className="underline">logga in</Link> för att skicka in ditt svar och få feedback.</p>
            </div>
          ) : (
            <div>
              <div className="bg-gray-50 p-4 rounded-lg mb-6 h-[60vh] overflow-y-auto">
                {!conversationHistory ? (
                  <div className="flex justify-start mb-4 items-start">
                    <div className="flex-shrink-0 mr-3">
                      <Image
                        src="/images/customer-avatar.png"
                        alt="Kund"
                        width={70}
                        height={70}
                        className="rounded-full"
                      />
                    </div>
                    <div className="max-w-[80%] p-3 rounded-lg bg-green-100 text-green-800 rounded-tl-none">
                      <div className="text-xs font-semibold mb-1">Kund</div>
                      <div className="whitespace-pre-line">
                        {currentSection.prompt}
                        {currentSection.imageUrl && (
                          <div className="mt-4">
                            <Image
                              loader={supabaseImageLoader}
                              src={currentSection.imageUrl}
                              alt="Case graf/bild"
                              width={400}
                              height={300}
                              className="rounded-lg border border-gray-200 max-w-full h-auto"
                              style={{ maxHeight: '200px', objectFit: 'contain' }}
                              unoptimized
                            />
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                ) : (
                  <div>
                    {conversationHistory.split('\n\n---\n\n').map((message, index) => {
                      if (message.trim() === '') return null;
                      
                      const isUser = message.startsWith('Kandidat:');
                      const content = message.replace(/^(Kandidat:|Kund:)\s*/, '');
                      
                      return (
                        <div 
                          key={index} 
                          className={`mb-4 flex items-start ${isUser ? 'flex-row-reverse' : 'flex-row'}`}
                        >
                          {!isUser ? (
                            <div className={`flex-shrink-0 ${isUser ? 'ml-3' : 'mr-3'}`}>
                              <Image
                                src="/images/customer-avatar.png"
                                alt="Kund"
                                width={40}
                                height={40}
                                className="rounded-full"
                              />
                            </div>
                          ) : (
                            <div className={`flex-shrink-0 ${isUser ? 'ml-3' : 'mr-3'}`}>
                              <Image
                                src={session?.user?.image || '/images/default-avatar.png'}
                                alt="Du"
                                width={40}
                                height={40}
                                className="rounded-full"
                              />
                            </div>
                          )}
                          <div 
                            className={`max-w-[80%] p-3 rounded-lg ${
                              isUser 
                                ? 'bg-blue-100 text-blue-800 rounded-tr-none' 
                                : 'bg-green-100 text-green-800 rounded-tl-none'
                            }`}
                          >
                            <div className="text-xs font-semibold mb-1">
                              {isUser ? 'Du' : 'Kund'}
                            </div>
                            <div className="whitespace-pre-line">
                              {content.split('\n').map((line, i) => {
                                console.log('Processing line:', line); // Debug log
                                
                                // Skip empty lines
                                if (!line.trim()) {
                                  console.log('Skipping empty line');
                                  return null;
                                }
                                
                                // Handle image markdown
                                const imageMatch = line.match(/!\[([^\]]*)\]\(([^)]+)\)/);
                                if (imageMatch) {
                                  const [, altText, imageUrl] = imageMatch;
                                  console.log('Found image:', altText, imageUrl);
                                  return (
                                    <div key={i} className="mt-2">
                                      <Image
                                        loader={supabaseImageLoader}
                                        src={imageUrl}
                                        alt={altText}
                                        width={400}
                                        height={300}
                                        className="rounded-lg border border-gray-200 max-w-full h-auto"
                                        style={{ maxHeight: '200px', objectFit: 'contain' }}
                                        unoptimized
                                      />
                                    </div>
                                  );
                                }
                                
                                // Regular text line
                                return <div key={i}>{line}</div>;
                              })}
                            </div>
                          </div>
                        </div>
                      );
                    })}
                    
                    {isAiResponding && (
                      <div className="flex justify-start mb-4 items-start">
                        <div className="flex-shrink-0 mr-3">
                          <Image
                            src="/images/customer-avatar.png"
                            alt="Kund"
                            width={40}
                            height={40}
                            className="rounded-full"
                          />
                        </div>
                        <div className="max-w-[80%] p-3 rounded-lg bg-green-100 text-green-800 rounded-tl-none">
                          <div className="text-xs font-semibold mb-1">Kund</div>
                          <div className="flex items-center space-x-2">
                            <div className="w-2 h-2 bg-green-600 rounded-full animate-bounce" style={{ animationDelay: '0ms' }}></div>
                            <div className="w-2 h-2 bg-green-600 rounded-full animate-bounce" style={{ animationDelay: '150ms' }}></div>
                            <div className="w-2 h-2 bg-green-600 rounded-full animate-bounce" style={{ animationDelay: '300ms' }}></div>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
              
              {!isComplete ? (
                <form onSubmit={handleSubmit} className="relative">
                  <div className="mb-4">
                    <div className="relative">
                      <textarea
                        id="response"
                        rows={1}
                        className="w-full px-4 py-3 pr-24 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none overflow-hidden"
                        value={responseText}
                        onChange={(e) => {
                          setResponseText(e.target.value);
                          // Auto-resize textarea
                          e.target.style.height = 'auto';
                          e.target.style.height = `${Math.min(e.target.scrollHeight, 200)}px`;
                        }}
                        placeholder="Skriv ditt svar här..."
                        disabled={submitting}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter' && !e.shiftKey) {
                            e.preventDefault();
                            if (responseText.trim() || whiteboardImageUrl) {
                              handleSubmit(e);
                            }
                          }
                        }}
                      ></textarea>
                      <div className="absolute right-2 bottom-2 flex gap-2">
                        <button
                          type="button"
                          onClick={() => setShowWhiteboard(true)}
                          className="p-2 text-gray-500 hover:text-gray-700"
                          title="Lägg till skiss"
                        >
                          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L10.582 16.07a4.5 4.5 0 01-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 011.13-1.897l8.932-8.931zm0 0L19.5 7.125M18 14v4.75A2.25 2.25 0 0115.75 21H5.25A2.25 2.25 0 013 18.75V8.25A2.25 2.25 0 015.25 6H10" />
                          </svg>
                        </button>
                        <button
                          type="button"
                          onClick={isRecording ? stopRecording : startRecording}
                          className={`p-2 ${isRecording ? 'text-red-500 hover:text-red-700' : 'text-gray-500 hover:text-gray-700'}`}
                          title={isRecording ? 'Stoppa inspelning' : 'Spela in röstmeddelande'}
                        >
                          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M12 18.75a6 6 0 006-6v-1.5m-6 7.5a6 6 0 01-6-6v-1.5m6 7.5v3.75m-3.75 0h7.5M12 15.75a3 3 0 01-3-3V4.5a3 3 0 116 0v8.25a3 3 0 01-3 3z" />
                          </svg>
                        </button>
                        <button
                          type="submit"
                          className="p-2 text-blue-500 hover:text-blue-600 disabled:opacity-50 disabled:cursor-not-allowed"
                          disabled={submitting || (!responseText.trim() && !whiteboardImageUrl)}
                        >
                          {submitting ? (
                            <svg className="animate-spin h-5 w-5" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                            </svg>
                          ) : (
                            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5">
                              <path strokeLinecap="round" strokeLinejoin="round" d="M6 12L3.269 3.126A59.768 59.768 0 0121.485 12 59.77 59.77 0 013.27 20.876L5.999 12zm0 0h7.5" />
                            </svg>
                          )}
                        </button>
                      </div>
                    </div>
                    <div className="text-xs text-gray-500 mt-1 text-right">
                      Tryck Enter för att skicka, Shift+Enter för ny rad
                    </div>
                    {whiteboardImageUrl && (
                      <div className="mt-2 p-2 bg-gray-100 rounded-lg flex items-center justify-between">
                        <div className="flex items-center">
                          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5 mr-2 text-gray-500">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 15.75l5.159-5.159a2.25 2.25 0 013.182 0l5.159 5.159m-1.5-1.5l1.409-1.409a2.25 2.25 0 013.182 0l2.909 2.909m-18 3.75h16.5a1.5 1.5 0 001.5-1.5V6a1.5 1.5 0 00-1.5-1.5H3.75A1.5 1.5 0 002.25 6v12a1.5 1.5 0 001.5 1.5zm10.5-11.25h.008v.008h-.008V8.25zm.375 0a.375.375 0 11-.75 0 .375.375 0 01.75 0z" />
                          </svg>
                          <span className="text-sm text-gray-700">Skiss bifogad</span>
                        </div>
                        <button
                          type="button"
                          onClick={() => setWhiteboardImageUrl(null)}
                          className="text-red-500 hover:text-red-700"
                        >
                          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                          </svg>
                        </button>
                      </div>
                    )}
                  </div>
                </form>
              ) : (
                <div className="bg-green-50 border border-green-400 text-green-700 px-4 py-3 rounded mb-6">
                  <p>Grattis! Du har slutfört denna sektion. Klicka på &quot;Nästa sektion&quot; för att fortsätta.</p>
                  <button
                    onClick={handleNextSection}
                    className="mt-4 bg-blue-500 hover:bg-blue-600 text-white px-4 py-2 rounded"
                  >
                    {sections.findIndex(s => s.id === currentSection.id) < sections.length - 1 
                      ? 'Nästa sektion' 
                      : 'Slutför case'}
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {showWhiteboard && (
        <Whiteboard
          onSave={(imageUrl) => {
            setWhiteboardImageUrl(imageUrl)
            setShowWhiteboard(false)
          }}
          onClose={() => setShowWhiteboard(false)}
        />
      )}
    </div>
  )
}

export default function CaseInterviewPage() {
  return (
    <Suspense fallback={<div>Loading...</div>}>
      <CaseInterviewContent />
    </Suspense>
  )
}