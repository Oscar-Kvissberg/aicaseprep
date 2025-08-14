'use client'

import { useEffect, useState } from 'react'
import { useSession } from 'next-auth/react'
import Link from 'next/link'
import { NavBar } from '../components/nav_bar'
import { supabase } from '@/lib/supabase'
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card'
import { InfoFooter } from '../components/info_footer'
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
    company: string;
    industry: string;
  } | null;
}

interface BusinessCase {
  id: string;
  title: string;
  company: string;
  industry: string;
}

export default function ProfilePage() {
  const { data: session, status } = useSession();
  const [userProgress, setUserProgress] = useState<UserCaseProgress[]>([]);
  const [allCases, setAllCases] = useState<BusinessCase[]>([]);
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
            business_case:business_cases!case_id(title, company, industry)
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
          business_case: Array.isArray(p.business_case) ? p.business_case[0] || null : p.business_case
        })) || [];

        // Fetch all business cases
        const { data: cases, error: casesError } = await supabase
          .from('business_cases')
          .select('id, title, company, industry')
          .order('title');

        if (casesError) {
          console.error('Error fetching cases:', casesError);
          throw casesError;
        }

        if (!isMounted) return;
        setUserProgress(transformedProgress);
        setAllCases(cases || []);
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

  // Calculate statistics
  const startedCases = userProgress.filter(p => p.case_id);
  const completedCases = userProgress.filter(p => p.is_completed);

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
        {/* Profile Section */}
        <Card className="mb-8 mt-8">
          <CardContent className="p-6">
            <div className="flex items-start space-x-8">
              <div className="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center overflow-hidden">
                {session.user?.image ? (
                  <Image
                    src={session.user.image}
                    alt={session.user.name || 'Profile'}
                    width={64}
                    height={64}
                    className="object-cover w-full h-full"
                    priority
                  />
                ) : (
                  <span className="text-2xl text-blue-600 font-semibold">
                    {session.user?.name?.charAt(0) || session.user?.email?.charAt(0) || 'U'}
                  </span>
                )}
              </div>
              <div>
                <h2 className="text-xl font-semibold text-gray-900">
                  {session.user?.name || 'User'}
                </h2>
                <p className="text-gray-600">{session.user?.email}</p>
                <p className="text-sm text-gray-500">
                  Joined {new Date().toLocaleDateString('en-US')}
                </p>
              </div>
              <div className="flex space-x-12">
                <div className="text-center">
                  <div className="text-xl font-semibold text-gray-900 mb-1">Cases Started</div>
                  <div className="text-2xl font-semibold text-gray-900">{startedCases.length}</div>
                </div>
                <div className="text-center">
                  <div className="text-xl font-semibold text-gray-900 mb-1">Cases Completed</div>
                  <div className="text-2xl font-semibold text-gray-900">{completedCases.length}</div>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Cases Overview Section */}
        <Card className="mb-8">
          <CardHeader>
            <CardTitle>Completed Cases</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-16 sm:grid-cols-16 md:grid-cols-16 lg:grid-cols-24 gap-2">
              {allCases.map((case_) => {
                const userCase = userProgress.find(p => p.case_id === case_.id);
                const isCompleted = userCase?.is_completed || false;

                return (
                  <div 
                    key={case_.id} 
                    className={`aspect-square border rounded-lg transition-all duration-200 relative group ${
                      isCompleted 
                        ? 'bg-gradient-to-r from-p-custom to-s-custom border-transparent' 
                        : 'bg-white border-gray-200'
                    }`}
                    title={case_.title}
                  >
                    {/* Tooltip */}
                    <div className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 px-3 py-2 bg-gray-900 text-white text-sm rounded-lg opacity-0 group-hover:opacity-100 transition-opacity duration-200 pointer-events-none whitespace-nowrap z-10">
                      {case_.title}
                      <div className="absolute top-full left-1/2 transform -translate-x-1/2 w-0 h-0 border-l-4 border-r-4 border-t-4 border-transparent border-t-gray-900"></div>
                    </div>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>

        {/* Started Cases Details Section */}
        <Card className="mb-8">
          <CardHeader>
            <CardTitle>Started Cases</CardTitle>
          </CardHeader>
          <CardContent>
            {startedCases.length === 0 ? (
              <div className="text-center py-8">
                <p className="text-gray-600 mb-4">
                  You haven&apos;t started any cases yet.
                </p>
                <Link href="/cases" className="text-blue-500 hover:underline">
                  Start practicing now!
                </Link>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="bg-blue-50">
                      <th className="px-4 py-3 text-left text-sm font-medium text-gray-700">Case</th>
                      <th className="px-4 py-3 text-left text-sm font-medium text-gray-700">Company</th>
                      <th className="px-4 py-3 text-left text-sm font-medium text-gray-700">Industry</th>
                      <th className="px-4 py-3 text-left text-sm font-medium text-gray-700">Started</th>
                      <th className="px-4 py-3 text-left text-sm font-medium text-gray-700">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {startedCases.map((progress, index) => (
                      <tr 
                        key={progress.case_id} 
                        className={`${index % 2 === 0 ? 'bg-white' : 'bg-gray-50'} hover:bg-gray-100`}
                      >
                        <td className="px-4 py-3 text-sm font-medium text-gray-900">
                          {progress.business_case?.title || 'Unknown Case'}
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-600">
                          {progress.business_case?.company || '-'}
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-600">
                          {progress.business_case?.industry || '-'}
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-600">
                          {new Date(progress.last_activity).toLocaleDateString('en-US')}
                        </td>
                        <td className="px-4 py-3">
                          <span className={`px-3 py-1 rounded-full text-sm font-medium ${
                            progress.is_completed 
                              ? 'bg-green-100 text-green-800' 
                              : 'bg-yellow-100 text-yellow-800'
                          }`}>
                            {progress.is_completed ? 'Finished' : 'Not finished'}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>

        <InfoFooter />
      </div>
    </div>
  );
}