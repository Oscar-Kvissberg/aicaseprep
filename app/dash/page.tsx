'use client'

import { useEffect, useState, useRef } from 'react'
import { useSession } from 'next-auth/react'
import Link from 'next/link'
import { NavBar } from '../components/nav_bar'
import { supabase } from '@/lib/supabase'
import { BuyCredits } from '../components/buy_credits'
import { toast } from 'react-hot-toast'
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from '../components/ui/card'
import { Button } from '../components/ui/button'
import { CaseCards } from '../components/case-cards'
import { IconPlus } from '@tabler/icons-react'
import Image from 'next/image'

interface UserCaseProgress {
  id?: string;
  user_id?: string;
  case_id?: string | null;
  completed_sections: number;
  total_sections: number;
  is_completed: boolean;
  last_activity: string;
  business_case?: {
    title: string;
  } | null;
}

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

// Add new interface for credit balance
//interface CreditBalanceResponse {
//  current_balance: number;
//}

//interface CreditBalanceParams {
//  user_id: string;
//}

export default function DashboardPage() {
  const { data: session, status } = useSession();
  const [userProgress, setUserProgress] = useState<UserCaseProgress[]>([]);
  const [creditBalance, setCreditBalance] = useState<number>(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showBuyCredits, setShowBuyCredits] = useState(false);
  const [cases, setCases] = useState<BusinessCase[]>([])
  const initializationRef = useRef(false);
  

  useEffect(() => {
    if (status === 'loading') return;

    if (!session?.user?.id) {
      setLoading(false);
      return;
    }

    let isMounted = true;

    async function fetchUserData() {
      try {
        const userId = session!.user!.id;
        console.log('Fetching data for user:', userId);
        
        // Fetch credit balance from user_credits table
        let balance = 0;
        try {
          console.log('Fetching credit balance from user_credits table');
          const { data: balanceData, error: balanceError } = await supabase
            .from('user_credits')
            .select('credits')
            .eq('user_id', userId);
          
          console.log('Balance query response:', {
            data: balanceData,
            error: balanceError?.message || balanceError
          });
          
          if (balanceError) {
            console.error('Error fetching credit balance:', balanceError?.message || balanceError);
            toast.error('Kunde inte hämta kreditbalans');
          } else if (!balanceData || balanceData.length === 0) {
            console.log('No balance data returned, defaulting to 0');
            balance = 0;
          } else {
            balance = balanceData[0].credits;
            console.log('Current balance:', balance);
          }
        } catch (balanceErr) {
          console.error('Exception when fetching credit balance:', {
            error: balanceErr,
            message: balanceErr instanceof Error ? balanceErr.message : 'Unknown error',
            stack: balanceErr instanceof Error ? balanceErr.stack : undefined
          });
          toast.error('Kunde inte hämta kreditbalans');
          balance = 0; // Default to 0 on error
        }
        
        if (!isMounted) return;
        console.log('Setting credit balance to:', balance);
        setCreditBalance(balance);
        
        // Fetch user progress
        const { data: progress, error: progressError } = await supabase
          .from('user_case_progress')
          .select(`
            id,
            user_id,
            case_id,
            completed_sections,
            total_sections,
            is_completed,
            last_activity,
            business_case:business_cases(title)
          `)
          .eq('user_id', userId)
          .order('last_activity', { ascending: false });

        if (progressError) {
          console.error('Error fetching progress:', progressError);
          throw progressError;
        }
        
        // Transform the data to match the UserCaseProgress interface
        const transformedProgress = progress?.map(p => ({
          ...p,
          business_case: p.business_case?.[0] || null
        })) || [];

        // If no progress exists at all and we haven't initialized yet, create initial credits entry
        if ((!transformedProgress || transformedProgress.length === 0) && !initializationRef.current) {
          console.log('No existing progress found, creating initial entry');
          initializationRef.current = true;
          
          try {
            // Create initial progress through API endpoint
            const response = await fetch('/api/create-initial-progress', {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
              },
              body: JSON.stringify({
                userId: userId
              })
            });

            if (!response.ok) {
              const errorData = await response.json();
              throw new Error(`Failed to create initial progress: ${errorData.error || response.statusText}`);
            }

            const newProgress = await response.json();
            console.log('Successfully created initial progress:', newProgress);
            
            if (!isMounted) return;
            setUserProgress([{
              ...newProgress,
              business_case: null
            }]);
          } catch (insertErr) {
            console.error('Insert operation failed:', {
              error: insertErr,
              message: insertErr instanceof Error ? insertErr.message : 'Unknown error',
              stack: insertErr instanceof Error ? insertErr.stack : undefined
            });
            throw new Error(`Insert operation failed: ${insertErr instanceof Error ? insertErr.message : 'Unknown error'}`);
          }
        } else {
          console.log('Found existing progress:', transformedProgress);
          if (!isMounted) return;
          setUserProgress(transformedProgress);
        }
      } catch (err) {
        console.error('Error in fetchUserData:', {
          error: err,
          message: err instanceof Error ? err.message : 'Unknown error',
          stack: err instanceof Error ? err.stack : undefined
        });
        if (!isMounted) return;
        setError('Failed to load your data. Please try again later.');
      } finally {
        if (!isMounted) return;
        setLoading(false);
      }
    }

    // Fetch business cases
    async function fetchBusinessCases() {
      try {
        const { data, error } = await supabase
          .from('business_cases')
          .select('*')
          .order('created_at', { ascending: false });
        
        if (error) {
          console.error('Error fetching business cases:', error);
          toast.error('Kunde inte hämta case');
          return;
        }
        
        if (data) {
          setCases(data);
        }
      } catch (err) {
        console.error('Exception when fetching business cases:', err);
        toast.error('Kunde inte hämta case');
      }
    }

    fetchUserData();
    fetchBusinessCases();

    return () => {
      isMounted = false;
    };
  }, [session, status]);

  // Show loading spinner while session is loading
  if (status === 'loading' || loading) {
    return (
      <div className="flex justify-center items-center min-h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500"></div>
      </div>
    );
  }

  // Show login prompt if no session
  if (!session) {
    return (
      <div className="flex justify-center items-center min-h-screen">
        <div className="bg-yellow-100 border border-yellow-400 text-yellow-700 px-4 py-3 rounded">
          <p>Please <Link href="/login" className="underline">sign in</Link> to view your dashboard.</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex justify-center items-center min-h-screen">
        <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded">
          <p>{error}</p>
        </div>
      </div>
    );
  }

  // Calculate statistics - only count actual cases (where case_id is not null)
  const completedCases = userProgress.filter(p => p.is_completed && p.case_id).length;
  //const inProgressCases = userProgress.filter(p => !p.is_completed && p.case_id).length;

  const caseCardsData = cases.map((case_) => ({
    title: case_.company,
    difficulty: case_.difficulty,
    trend: 0,
    trendText: case_.industry,
    description: case_.title,
    estimatedTime: case_.estimated_time,
    link: `/case-interview?caseId=${case_.id}`
  }))

  return (

    
    <div className="flex flex-col min-h-screen">
      <NavBar />

      <div className="relative w-full h-[400px] md:h-[400px]">
        <Image 
          src="/images/case_interview.png" 
          alt="Dashboard Hero" 
          fill
          priority
          className="object-cover object-[center_25%]"
        />
        <div className="absolute inset-0 bg-gradient-to-b from-transparent to-white via-white/20">
          <h1 className="text-black text-3xl md:text-4xl lg:text-5xl font-bold text-center px-4 pt-50">
            Case Interview Practice
          </h1>
        </div>
      </div>


      <div className="container mx-auto px-4 py-8">
      <div className="mb-8 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        
         <Card className="">
            <CardHeader>
              <CardTitle>Återstående Credits</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-3xl font-bold text-purple-600">{creditBalance}</p>
            </CardContent>
            <Button 
              variant="outline"
              onClick={() => setShowBuyCredits(true)}
              className="text-sm ml-4 mr-4"
              
            >
              <IconPlus className="w-4 h-4" />
              Lägg till fler credits
            </Button>
          </Card>

        
          
          <Card>
          
            <CardHeader>
              <CardTitle>Avklarade Case</CardTitle>
            </CardHeader>

            <CardContent>
              <p className="text-3xl font-bold">{completedCases}</p>
            </CardContent>
         
          </Card>
       
      </div>

     
      <Card className="mt-8">
      
        <CardHeader>
          <CardTitle>Din Progress</CardTitle>
        </CardHeader>
        
        {!userProgress.some(p => p.case_id) ? (
          <p className="text-gray-600">
            Du har inte börjat på några case än. 
            <Link href="/cases" className="text-blue-500 hover:underline ml-1">
              Börja öva nu!
            </Link>
          </p>
        ) : (
          <CardContent>
            {userProgress
              .filter(p => p.case_id)
              .map((progress) => (
                <div key={progress.case_id} className="border-b pb-4">
                  <div className="flex justify-between items-center mb-2">
                    <h3 className="text-lg font-medium">
                      {progress.business_case?.title || 'Okänt Case'}
                    </h3>
                    <span className={`px-2 py-1 rounded text-sm ${
                      progress.is_completed 
                        ? 'bg-green-100 text-green-800' 
                        : 'bg-yellow-100 text-yellow-800'
                    }`}>
                      {progress.is_completed ? 'Avklarat' : 'Pågående'}
                    </span>
                  </div>
                  <div className="flex justify-between items-center text-sm text-gray-600">
                    <span>Avklarade sektioner: {progress.completed_sections} av {progress.total_sections}</span>
                    <span>Senaste aktivitet: {new Date(progress.last_activity).toLocaleDateString('sv-SE')}</span>
                  </div>
                  <div className="mt-2 bg-gray-200 rounded-full h-2">
                    <div 
                      className="bg-blue-500 rounded-full h-2 transition-all duration-300"
                      style={{ width: `${(progress.completed_sections / progress.total_sections) * 100}%` }}
                    ></div>
                  </div>
                </div>
              ))}
          </CardContent>
        )}
      
      </Card>
        

      <Card className="mt-8">
      <CardHeader>
        <CardTitle>Populära Business cases</CardTitle>
      </CardHeader>
      <CardContent>
        <CaseCards data={caseCardsData} />
      </CardContent>
      <CardFooter>
        <Link href="/cases" className="text-blue-500 hover:underline ml-1">Utforska alla case</Link>
      </CardFooter>
      </Card>


      {/* Buy Credits Modal */}
      {showBuyCredits && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-4xl w-full mx-4">
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-2xl font-bold">Köp Credits</h2>
              <button
                onClick={() => setShowBuyCredits(false)}
                className="text-gray-500 hover:text-gray-700"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <BuyCredits />
          </div>
        </div>
      )}
    </div>
    </div>
  );
} 