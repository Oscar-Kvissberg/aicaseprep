'use client'

import { useEffect, useState, useRef, Suspense } from 'react'
import { useSession } from 'next-auth/react'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import Image, { ImageLoaderProps } from 'next/image'
import toast from 'react-hot-toast'
import { Whiteboard } from '@/app/components/whiteboard'
import { supabase } from '@/lib/supabase'
import { Button } from '@/app/components/ui/button'
import { GradientBorderButton } from '../components/ui/s_button'


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
  
  // Load conversation history from sessionStorage on mount
  useEffect(() => {
    if (sectionId) {
      const savedHistory = sessionStorage.getItem(`chat-history-${caseId}-${sectionId}`)
      if (savedHistory) {
        setConversationHistory(savedHistory)
      }
    }
  }, [caseId, sectionId])
  
  // Save conversation history to sessionStorage whenever it changes
  useEffect(() => {
    if (sectionId && conversationHistory) {
      sessionStorage.setItem(`chat-history-${caseId}-${sectionId}`, conversationHistory)
    }
  }, [conversationHistory, caseId, sectionId])
  const [isComplete, setIsComplete] = useState(false)
  const [isAiResponding, setIsAiResponding] = useState(false)
  const [showWhiteboard, setShowWhiteboard] = useState(false)
  const [whiteboardImageUrl, setWhiteboardImageUrl] = useState<string | null>(null)
  const [isRecording, setIsRecording] = useState(false)
  const [showHint, setShowHint] = useState(false)
  const [hint, setHint] = useState<string | null>(null)
  const [showFullImage, setShowFullImage] = useState(false)
  const [fullImageUrl, setFullImageUrl] = useState<string | null>(null)
  const mediaRecorderRef = useRef<MediaRecorder | null>(null)
  const chunksRef = useRef<Blob[]>([])
  const chatContainerRef = useRef<HTMLDivElement>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  // Auto-scroll to bottom when conversation updates
  useEffect(() => {
    if (chatContainerRef.current) {
      chatContainerRef.current.scrollTop = chatContainerRef.current.scrollHeight;
    }
  }, [conversationHistory, isAiResponding]);

  // Auto-resize textarea when responseText changes
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 300)}px`;
    }
  }, [responseText]);

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
            // Only reset conversation history if it's empty (new section)
            const savedHistory = sessionStorage.getItem(`chat-history-${caseId}-${sectionId}`)
            if (!savedHistory) {
              setConversationHistory('')
            }
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
          toast.error('Could not check your progress');
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
          toast.error('Could not check your progress');
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
            toast.error('Could not create user progress');
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
            toast.error('Could not check your credits');
            return;
          }

          const availableCredits = balanceData?.current_balance || 0;

          if (availableCredits < 1) {
            toast.error('You have no credits left. Buy more to continue.');
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
            toast.error(`Could not deduct credit: ${deductError.message || 'Unknown error'}`);
            return;
          }

          console.log('Successfully deducted credit:', deductData);

          toast.success('One credit has been deducted. Good luck with the case!');
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
          toast.error('Could not update your progress');
          return;
        }

        // Show different success message for first case
        if (isFirstCase) {
          toast.success('Welcome! You have received 2 credits and one has been used for this case. Good luck!');
        }
        
        // Clear all sessionStorage keys for this case when it's restarted
        const keysToRemove = [];
        for (let i = 0; i < sessionStorage.length; i++) {
          const key = sessionStorage.key(i);
          if (key && key.startsWith(`chat-history-${caseId}-`)) {
            keysToRemove.push(key);
          }
        }
        keysToRemove.forEach(key => sessionStorage.removeItem(key));
        
        // Navigate to the first section
        router.push(`/case-interview?caseId=${caseId}&sectionId=${sections[0].id}`);
      } catch (error) {
        console.error('Error in handleStartCase:', error);
        toast.error('An unexpected error occurred. Please try again.');
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
          toast.error('Could not update your progress');
          return;
        }

        // Redirect to completion page
        router.push(`/case-completed?caseId=${caseId}`);
      } catch (err) {
        console.error('Error completing case:', err);
        toast.error('Could not complete the case');
      }
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    if (!session?.user?.email) {
      toast.error('You must be signed in to submit a response')
      return
    }
    
    if (!responseText.trim() && !whiteboardImageUrl) {
      toast.error('Please write your response or add a sketch')
      return
    }
    
    setSubmitting(true)
    setIsAiResponding(true)
    
    // Create message content with optional whiteboard image
    const messageContent = whiteboardImageUrl 
      ? `${responseText.trim()}\n\n[Sketch]\n![Sketch](${whiteboardImageUrl})`
      : responseText.trim()
    
    console.log('Message content:', messageContent); // Debug log
    
    // Create or update conversation history with user's message
    const updatedHistory = conversationHistory 
      ? `${conversationHistory}\n\n---\n\nCandidate: ${messageContent}`
      : `Client: ${currentSection?.prompt}${currentSection?.imageUrl ? `\n\n![Case graph/image](${currentSection.imageUrl})` : ''}\n\n---\n\nCandidate: ${messageContent}`
    
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
      setConversationHistory(updatedHistory + `\n\n---\n\nClient: ${data.feedback}`)
      
      toast.success('Response sent!')
    } catch (err) {
      console.error('Error submitting response:', err)
      toast.error('Could not send the response. Please try again.')
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
            throw new Error('Transcription failed')
          }
          
          const { text } = await response.json()
          setResponseText(text)
          // Trigger resize after setting text
          setTimeout(() => {
            if (textareaRef.current) {
              textareaRef.current.style.height = 'auto';
              textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 300)}px`;
            }
          }, 100)
          
        } catch (error) {
          console.error('Error transcribing audio:', error)
          toast.error('Could not transcribe the audio recording')
        }
      }

      mediaRecorder.start()
      setIsRecording(true)
    } catch (error) {
      console.error('Error starting recording:', error)
      toast.error('Could not start audio recording')
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
      <div className="container mx-auto px-4 md:px-8 lg:px-16 xl:px-24 py-8">
        <div className="mb-6">
          <div className="w-32 h-4 bg-gray-200 rounded animate-pulse"></div>
        </div>
        
        <div className="bg-white shadow-md rounded-xl overflow-hidden mb-8">
          <div className="p-6">
            {/* Title skeleton */}
            <div className="w-3/4 h-8 bg-gray-200 rounded mb-2 animate-pulse"></div>
            
            {/* Tags skeleton */}
            <div className="flex space-x-2 mb-4">
              <div className="w-16 h-6 bg-gray-200 rounded animate-pulse"></div>
              <div className="w-20 h-6 bg-gray-200 rounded animate-pulse"></div>
              <div className="w-24 h-6 bg-gray-200 rounded animate-pulse"></div>
            </div>
            
            {/* Description skeleton */}
            <div className="space-y-3 mb-6">
              <div className="w-full h-4 bg-gray-200 rounded animate-pulse"></div>
              <div className="w-5/6 h-4 bg-gray-200 rounded animate-pulse"></div>
              <div className="w-4/5 h-4 bg-gray-200 rounded animate-pulse"></div>
              <div className="w-3/4 h-4 bg-gray-200 rounded animate-pulse"></div>
            </div>
            
            {/* Sections skeleton */}
            <div className="mb-6">
              <div className="w-24 h-5 bg-gray-200 rounded mb-3 animate-pulse"></div>
              <div className="space-y-2">
                <div className="w-48 h-4 bg-gray-200 rounded animate-pulse"></div>
                <div className="w-52 h-4 bg-gray-200 rounded animate-pulse"></div>
                <div className="w-44 h-4 bg-gray-200 rounded animate-pulse"></div>
                <div className="w-40 h-4 bg-gray-200 rounded animate-pulse"></div>
              </div>
            </div>
            
            {/* Button skeleton */}
            <div className="w-32 h-10 bg-gray-200 rounded animate-pulse"></div>
          </div>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="flex justify-center items-center min-h-screen">
        <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded">
          <p>{error}</p>
          <Link href="/cases" className="mt-2 inline-block text-blue-500 underline">
            Back to case library
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
            Back to case library
          </Link>
        </div>
      </div>
    )
  }

  // If no section is selected, show the case overview with chat interface
  if (!currentSection) {
    return (
      <div className="container mx-auto px-4 md:px-8 lg:px-16 xl:px-24 py-8">
        <div className="mb-6">
          <Link href="/cases" className="text-blue-500 hover:underline">
            &larr; Back to case library
          </Link>
        </div>
        
        <div className="bg-white shadow-md rounded-xl overflow-hidden mb-8">
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
                <p>Please <Link href="/login" className="underline">sign in</Link> to start the case interview.</p>
              </div>
            ) : (
              <div className="mt-8">
                <div className="bg-gray-50 p-6 rounded-xl mb-6">
                  <div className="prose max-w-none">
                    <p className="text-lg mb-6">
                      {businessCase.description}
                    </p>
                    
                    <div className="mb-6">
                      <h3 className="text-lg font-semibold mb-2">Sections:</h3>
                      <ul className="list-disc pl-5">
                        {sections.map((section) => (
                          <li key={section.id} className="mb-1">
                            {section.title}
                          </li>
                        ))}
                      </ul>
                    </div>

                    <p className="text-lg">
                      Are you ready to start? Click &quot;Start Case&quot; below to begin the first section!
                    </p>
                  </div>
                </div>
                
                <Button
                  onClick={handleStartCase}
                  variant="primary_c2a"
                >
                  Start Case
                </Button>
              </div>
            )}
          </div>
        </div>
      </div>
    )
  }

  // Show the current section with chat interface
  return (
    <div className="container mx-auto px-4 md:px-8 lg:px-24 xl:px-36 py-8">
      <div className="mb-6">
        <button
          onClick={() => router.push('/cases')}
          className="text-blue-500 hover:text-blue-600 hover:underline flex items-center"
        >
          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5 mr-1">
            <path strokeLinecap="round" strokeLinejoin="round" d="M9 15L3 9m0 0l6-6M3 9h12a6 6 0 010 12h-3" />
          </svg>
          Exit case
        </button>
      </div>

      {/* Progress Bar */}
      <div className="mb-6">
        <div className="bg-white shadow-md rounded-lg p-4">
          <div className="flex justify-between items-center mb-3">
            <h2 className="text-lg font-semibold text-gray-800">Case Progress</h2>
            <span className="text-sm text-gray-600">
              Section {sections.findIndex(s => s.id === currentSection.id) + 1} of {sections.length}
            </span>
          </div>
          <div className="flex gap-1">
            {sections
              .sort((a, b) => a.order_index - b.order_index)
              .map((section, index) => {
              const isCurrentSection = section.id === currentSection.id;
              const isLast = index === sections.length - 1;
              
              return (
                <button
                  key={section.id}
                  onClick={() => {
                    router.push(`/case-interview?caseId=${caseId}&sectionId=${section.id}`);
                  }}
                  className={`group relative transition-all duration-200 ${
                    isCurrentSection
                      ? 'bg-gradient-to-r from-p-custom to-s-custom text-white shadow-lg'
                      : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                  } cursor-pointer`}
                                      style={{
                      clipPath: index === 0
                        ? 'polygon(0 0, 90% 0, 100% 50%, 90% 100%, 0 100%)' // First section - flat left edge
                        : isLast 
                        ? 'polygon(0 0, 90% 0, 100% 50%, 90% 100%, 0 100%)' // Last section - flat right edge
                        : 'polygon(0 0, 90% 0, 100% 50%, 90% 100%, 0 100%, 5% 50%)' // Middle sections - pointed on both sides
                    }}
                  title={section.title}
                >
                  <div className="px-4 py-2 text-sm font-medium whitespace-nowrap">
                    {section.title}
                  </div>
                </button>
              );
            })}
          </div>
          <div className="flex justify-between items-center mt-2">
            <span className="text-xs text-gray-500">
              Section {sections.findIndex(s => s.id === currentSection.id) + 1} of {sections.length}
            </span>
            <span className="text-xs text-gray-500">
              Click any section to navigate
            </span>
          </div>
        </div>
      </div>
      
      <div className="bg-white shadow-md rounded-lg overflow-hidden mb-8">
        <div className="p-6">
          <div className="mb-6">
            <h1 className="text-2xl font-bold">{businessCase.title}</h1>
          </div>
          
          <div className="lg:grid lg:grid-cols-3 lg:gap-6">
            {/* Left column - Description and hint */}
            <div className="lg:col-span-1 mb-6 lg:mb-0">
              <div className="bg-gray-50 p-4 rounded-lg sticky top-4">
                <div className="prose max-w-none">
                  <h3 className="text-lg font-semibold mb-3">Case Information</h3>
                  <p className="text-sm mb-4">
                    {businessCase.description}
                  </p>
                  {hint && (
                    <div>
                      <GradientBorderButton
                        type="button"
                        onClick={() => setShowHint(!showHint)}
                        className="w-full flex items-center justify-center gap-2"
                      >
                        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M9.879 7.519c1.171-1.025 3.071-1.025 4.242 0 1.172 1.025 1.172 2.687 0 3.712-.203.179-.43.326-.67.442-.745.361-1.45.999-1.45 1.827v.75M21 12a9 9 0 11-18 0 9 9 0 0118 0zm-9 5.25h.008v.008H12v-.008z" />
                        </svg>
                        <span>Show hint</span>
                      </GradientBorderButton>
                      {showHint && hint && (
                        <div className="mt-4 p-4 bg-gradient-to-r from-p-custom/20 to-s-custom/20 border border-purple-200 rounded-xl">
                          <div className="flex items-start">
                            <div className="flex-shrink-0 mr-3">
                              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-6 h-6 text-purple-500">
                                <path strokeLinecap="round" strokeLinejoin="round" d="M9.879 7.519c1.171-1.025 3.071-1.025 4.242 0 1.172 1.025 1.172 2.687 0 3.712-.203.179-.43.326-.67.442-.745.361-1.45.999-1.45 1.827v.75M21 12a9 9 0 11-18 0 9 9 0 0118 0zm-9 5.25h.008v.008H12v-.008z" />
                              </svg>
                            </div>
                            <div className="flex-1">
                              <h4 className="text-sm font-semibold text-purple-800 mb-1">Hint</h4>
                              <p className="text-sm text-purple-900">{hint}</p>
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Right column - Chat */}
            <div className="lg:col-span-2">
              {!session ? (
                <div className="bg-yellow-100 border border-yellow-400 text-yellow-700 px-4 py-3 rounded-xl mb-6">
                  <p>Please <Link href="/login" className="underline">sign in</Link> to submit your response and get feedback.</p>
                </div>
              ) : (
                <div>
                  <div className="bg-gray-50 p-4 rounded-xl mb-6 h-[60vh] overflow-y-auto" ref={chatContainerRef}>
                {!conversationHistory ? (
                  <div className="flex justify-start mb-4 items-start">
                    <div className="flex-shrink-0 mr-3">
                      <Image
                        src="/images/customer-avatar.png"
                        alt="Client"
                        width={70}
                        height={70}
                        className="rounded-full"
                      />
                    </div>
                    <div className="max-w-[80%] p-3 rounded-xl bg-gray-100 text-gray-800 rounded-tl-none">
                      <div className="text-xs font-semibold mb-1">Client</div>
                      <div className="whitespace-pre-line">
                        {currentSection.prompt}
                        {currentSection.imageUrl && (
                          <div className="mt-4 relative inline-block">
                            <Image
                              loader={supabaseImageLoader}
                              src={currentSection.imageUrl}
                              alt="Case graph/image"
                              width={400}
                              height={300}
                              className="rounded-xl border border-gray-200 max-w-full h-auto"
                              style={{ maxHeight: '200px', objectFit: 'contain' }}
                              unoptimized
                            />
                            <button
                              onClick={() => {
                                setFullImageUrl(currentSection.imageUrl || null);
                                setShowFullImage(true);
                              }}
                              className="absolute top-2 right-2 p-1.5 bg-white/90 hover:bg-white rounded-md shadow-sm transition-colors z-10"
                              title="Förstora bild"
                            >
                              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-3.5 h-3.5">
                                <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607zM10.607 10.607zM10.5 7.5v6m3-3h-6" />
                              </svg>
                            </button>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                ) : (
                  <div>
                    {conversationHistory.split('\n\n---\n\n').map((message, index) => {
                      if (message.trim() === '') return null;
                      
                      const isUser = message.startsWith('Candidate:');
                      const content = message.replace(/^(Candidate:|Client:)\s*/, '');
                      
                      return (
                        <div 
                          key={index} 
                          className={`mb-4 flex items-start ${isUser ? 'flex-row-reverse' : 'flex-row'}`}
                        >
                          {!isUser ? (
                            <div className={`flex-shrink-0 ${isUser ? 'ml-3' : 'mr-3'}`}>
                              <Image
                                src="/images/customer-avatar.png"
                                alt="Client"
                                width={40}
                                height={40}
                                className="rounded-full"
                              />
                            </div>
                          ) : (
                            <div className={`flex-shrink-0 ${isUser ? 'ml-3' : 'mr-3'}`}>
                              <Image
                                src={session?.user?.image || '/images/default-avatar.png'}
                                alt="You"
                                width={40}
                                height={40}
                                className="rounded-full"
                              />
                            </div>
                          )}
                          <div 
                            className={`max-w-[80%] p-3 rounded-xl ${
                              isUser 
                                ? 'bg-gradient-to-r from-p-custom/90 to-s-custom/90 text-white rounded-tr-none' 
                                : 'bg-gray-100 text-gray-800 rounded-tl-none'
                            }`}
                          >
                            <div className="text-xs font-semibold mb-1">
                              {isUser ? 'You' : 'Client'}
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
                                    <div key={i} className="mt-2 relative inline-block">
                                      <Image
                                        loader={supabaseImageLoader}
                                        src={imageUrl}
                                        alt={altText}
                                        width={400}
                                        height={300}
                                        className="rounded-xl max-w-full h-auto"
                                        style={{ maxHeight: '200px', objectFit: 'contain' }}
                                        unoptimized
                                      />
                                      <button
                                        onClick={() => {
                                          setFullImageUrl(imageUrl);
                                          setShowFullImage(true);
                                        }}
                                        className="absolute top-2 right-2 p-1.5 bg-white/90 hover:bg-white rounded-md shadow-sm transition-colors z-10"
                                        title="Förstora bild"
                                        style={{ position: 'absolute', top: '8px', right: '8px' }}
                                      >
                                        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-3.5 h-3.5">
                                          <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 3.75v4.5m0-4.5h4.5m-4.5 0l9 9m0 0v4.5m0-4.5h-4.5m4.5 0l-9-9" />
                                        </svg>
                                      </button>
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
                            alt="Client"
                            width={40}
                            height={40}
                            className="rounded-full"
                          />
                        </div>
                        <div className="max-w-[80%] p-3 rounded-xl bg-gray-100 text-gray-800 rounded-tl-none">
                          <div className="text-xs font-semibold mb-1">Client</div>
                          <div className="flex items-center space-x-2">
                            <div className="w-2 h-2 bg-gray-600 rounded-full animate-bounce" style={{ animationDelay: '0ms' }}></div>
                            <div className="w-2 h-2 bg-gray-600 rounded-full animate-bounce" style={{ animationDelay: '150ms' }}></div>
                            <div className="w-2 h-2 bg-gray-600 rounded-full animate-bounce" style={{ animationDelay: '300ms' }}></div>
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
                        ref={textareaRef}
                        rows={1}
                        className="w-full px-4 py-3 pr-24 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none overflow-hidden"
                        value={responseText}
                        onChange={(e) => {
                          setResponseText(e.target.value);
                          // Auto-resize textarea
                          e.target.style.height = 'auto';
                          e.target.style.height = `${Math.min(e.target.scrollHeight, 300)}px`;
                        }}
                        placeholder="Write your response here..."
                        disabled={submitting}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter' && !e.shiftKey) {
                            e.preventDefault();
                            if (responseText.trim() || whiteboardImageUrl) {
                              handleSubmit(e);
                            }
                          }
                        }}
                        style={{ minHeight: '44px', maxHeight: '300px', overflowY: 'auto' }}
                        onWheel={(e) => {
                          const textarea = e.currentTarget;
                          const { scrollTop, scrollHeight, clientHeight } = textarea;
                          
                          // If we're at the top and scrolling up, or at the bottom and scrolling down,
                          // prevent the default scroll behavior and stop propagation
                          if ((scrollTop === 0 && e.deltaY < 0) || 
                              (scrollTop + clientHeight >= scrollHeight && e.deltaY > 0)) {
                            e.preventDefault();
                            e.stopPropagation();
                            return false;
                          }
                        }}
                      ></textarea>
                      <div className="absolute right-2 bottom-2 flex gap-2">
                        <button
                          type="button"
                          onClick={() => setShowWhiteboard(true)}
                          className="p-2 text-gray-500 hover:text-gray-700"
                          title="Add sketch"
                        >
                          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L10.582 16.07a4.5 4.5 0 01-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 011.13-1.897l8.932-8.931zm0 0L19.5 7.125M18 14v4.75A2.25 2.25 0 0115.75 21H5.25A2.25 2.25 0 013 18.75V8.25A2.25 2.25 0 015.25 6H10" />
                          </svg>
                        </button>
                        <button
                          type="button"
                          onClick={isRecording ? stopRecording : startRecording}
                          className={`p-2 ${isRecording ? 'text-red-500 hover:text-red-700' : 'text-gray-500 hover:text-gray-700'}`}
                          title={isRecording ? 'Stop recording' : 'Record voice message'}
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
                      Press Enter to send, Shift+Enter for new line
                    </div>
                    {whiteboardImageUrl && (
                      <div className="mt-2 p-2 bg-gray-100 rounded-xl flex items-center justify-between">
                        <div className="flex items-center">
                          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5 mr-2 text-gray-500">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 15.75l5.159-5.159a2.25 2.25 0 013.182 0l5.159 5.159m-1.5-1.5l1.409-1.409a2.25 2.25 0 013.182 0l2.909 2.909m-18 3.75h16.5a1.5 1.5 0 001.5-1.5V6a1.5 1.5 0 00-1.5-1.5H3.75A1.5 1.5 0 002.25 6v12a1.5 1.5 0 001.5 1.5zm10.5-11.25h.008v.008h-.008V8.25zm.375 0a.375.375 0 11-.75 0 .375.375 0 01.75 0z" />
                          </svg>
                          <span className="text-sm text-gray-700">Sketch attached</span>
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
                    <p>
                      {sections.findIndex(s => s.id === currentSection.id) < sections.length - 1 
                        ? 'Congratulations! You have completed this section. Click "Next Section" to continue.'
                        : 'Congratulations! You have completed this case. Click "Complete Case" to finish.'
                      }
                    </p>
                    <div className="mt-3">
                    <Button
                      onClick={handleNextSection}
                      className="w-1/3"
                      variant="primary_c2a"
                    >
                      {sections.findIndex(s => s.id === currentSection.id) < sections.length - 1 
                        ? 'Next Section' 
                        : 'Complete Case'}
                    </Button>
                    </div>
                  </div>
              )}
            </div>
          )}
        </div>
      </div>
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

      {/* Full Image Modal */}
      {showFullImage && fullImageUrl && (
        <div 
          className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4"
          onClick={() => {
            setShowFullImage(false);
            setFullImageUrl(null);
          }}
        >
          <div 
            className="relative max-w-2xl max-h-[80vh]"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              onClick={() => {
                setShowFullImage(false);
                setFullImageUrl(null);
              }}
              className="absolute -top-10 right-0 p-2 bg-white/20 hover:bg-white/30 rounded-lg text-white transition-colors"
              title="Stäng"
            >
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5">
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
            <Image
              loader={supabaseImageLoader}
              src={fullImageUrl}
              alt="Förstorad bild"
              width={600}
              height={400}
              className="rounded-xl max-w-full max-h-full object-contain"
              unoptimized
            />
          </div>
        </div>
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