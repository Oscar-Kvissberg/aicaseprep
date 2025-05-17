'use client'

import { useEffect, useState } from 'react'
import { useSession } from 'next-auth/react'
import Link from 'next/link'
import { NavBar } from '../components/nav_bar'
import { supabase } from '@/lib/supabase'
import { toast } from 'react-hot-toast'
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from '../components/ui/card'
import { CaseCards } from '../components/case-cards'
import { InfoFooter } from '../components/info_footer'

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
  case_thumbnails?: {
    image_url: string
  }[]
}

export default function DashboardPage() {
  const { data: session, status } = useSession();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [cases, setCases] = useState<BusinessCase[]>([])
  
  // Add featured case IDs - replace these with your desired case IDs
  const featuredCaseIds = ['c98de91e-93e6-4582-81c2-c558f1ea430e', 'c89df0bd-0d0f-4da9-8e87-965b5875e2e0', '249d9484-d24e-4f6b-a3a7-79d5b9fb6d8e']; // Replace with your actual case IDs
  
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
        
        // Check URL parameters for payment success
        const urlParams = new URLSearchParams(window.location.search);
        const success = urlParams.get('success');
        const credits = urlParams.get('credits');
        
        if (success === 'true' && credits) {
          toast.success(`Successfully added ${credits} credits to your account!`);
          // Remove the URL parameters without refreshing the page
          window.history.replaceState({}, '', '/dash');
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
          .select(`
            *,
            case_thumbnails (
              image_url
            )
          `)
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

  const caseCardsData = cases
    .filter(case_ => featuredCaseIds.includes(case_.id))
    .map((case_) => ({
      title: case_.company,
      difficulty: case_.difficulty,
      trend: 0,
      trendText: case_.industry,
      description: case_.title,
      estimatedTime: case_.estimated_time,
      thumbnailUrl: case_.case_thumbnails?.[0]?.image_url,
      link: `/case-interview?caseId=${case_.id}`
    }))

  return (
    <div className="flex flex-col min-h-screen">
      <NavBar />

      <div className="container mx-auto px-4 py-8">
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

        <InfoFooter />
      </div>
    </div>
  );
} 