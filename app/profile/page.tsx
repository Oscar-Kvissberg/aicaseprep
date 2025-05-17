'use client'

import { useEffect, useState } from 'react'
import { useSession } from 'next-auth/react'
import Link from 'next/link'
import { NavBar } from '../components/nav_bar'
import { supabase } from '@/lib/supabase'
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card'
import { InfoFooter } from '../components/info_footer'

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

export default function ProfilePage() {
  const { data: session, status } = useSession();
  const [userProgress, setUserProgress] = useState<UserCaseProgress[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

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

        if (!isMounted) return;
        setUserProgress(transformedProgress);
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

    fetchUserData();

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
          <p>Please <Link href="/login" className="underline">sign in</Link> to view your profile.</p>
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

  return (
    <div className="flex flex-col min-h-screen">
      <NavBar />

      <div className="container mx-auto px-4 py-8">
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

        <InfoFooter />
      </div>
    </div>
  );
}