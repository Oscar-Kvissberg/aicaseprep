'use client'

import { useEffect, useState } from 'react'
import { useSession } from 'next-auth/react'
import Link from 'next/link'
import { NavBar } from '../components/nav_bar'
import { supabase } from '@/lib/supabase'
import { toast } from 'react-hot-toast'

import { CaseCards } from '../components/case-cards'
import { SkeletonCaseCards } from '../components/skeleton-case-cards'
import { InfoFooter } from '../components/info_footer'
import { Button } from '../components/ui/button'
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
  const featuredCaseIds = ['c98de91e-93e6-4582-81c2-c558f1ea430e', 'c89df0bd-0d0f-4da9-8e87-965b5875e2e0', '249d9484-d24e-4f6b-a3a7-79d5b9fb6d8e', '150096b7-ef60-4b64-a92a-7577bab422e8']; // Replace with your actual case IDs
  
  // Add featured case IDs - replace these with your desired case IDs
  const newCaseIds = ['c98de91e-93e6-4582-81c2-c558f1ea430e', 'c89df0bd-0d0f-4da9-8e87-965b5875e2e0', '249d9484-d24e-4f6b-a3a7-79d5b9fb6d8e', '150096b7-ef60-4b64-a92a-7577bab422e8']; // Replace with your actual case IDs
  
  // Add featured case IDs - replace these with your desired case IDs
  const easyuredCaseIds = ['c98de91e-93e6-4582-81c2-c558f1ea430e', 'c89df0bd-0d0f-4da9-8e87-965b5875e2e0', '249d9484-d24e-4f6b-a3a7-79d5b9fb6d8e', '150096b7-ef60-4b64-a92a-7577bab422e8']; // Replace with your actual case IDs
  
  // Add featured case IDs - replace these with your desired case IDs
  const relevantCaseIds = ['c98de91e-93e6-4582-81c2-c558f1ea430e', 'c89df0bd-0d0f-4da9-8e87-965b5875e2e0', '249d9484-d24e-4f6b-a3a7-79d5b9fb6d8e', '150096b7-ef60-4b64-a92a-7577bab422e8']; // Replace with your actual case IDs
  


  useEffect(() => {
    if (status === 'loading') return;

    let isMounted = true;

    async function fetchUserData() {
      if (!session?.user?.id) {
        return;
      }

      try {
        const userId = session.user.id;
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
          toast.error('Could not fetch cases');
          return;
        }
        
        if (data) {
          setCases(data);
        }
      } catch (err) {
        console.error('Exception when fetching business cases:', err);
        toast.error('Could not fetch cases');
      } finally {
        if (!isMounted) return;
        setLoading(false);
      }
    }

    Promise.all([fetchUserData(), fetchBusinessCases()]);

    return () => {
      isMounted = false;
    };
  }, [session, status]);

  // Show loading spinner while session is loading
  if (status === 'loading' || loading) {
    return (
      <div className="flex flex-col min-h-screen">
        <NavBar />
        <div className="container mx-auto px-4 py-8 mt-16">
          <div className="mb-12">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-2xl font-bold text-gray-600">Popular Business Cases</h2>
              <Button variant="outline" disabled>
                Explore all cases
              </Button>
            </div>
            <SkeletonCaseCards />
          </div>
          <div className="mb-12">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-2xl font-bold text-gray-600">New Cases</h2>
              <Button variant="outline" disabled>
                Explore all cases
              </Button>
            </div>
            <SkeletonCaseCards />
          </div>
          <div className="mb-12">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-2xl font-bold text-gray-600">Cases with Guaranteed Quality</h2>
              <Button variant="outline" disabled>
                Explore all cases
              </Button>
            </div>
            <SkeletonCaseCards />
          </div>
          <div className="mb-12">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-2xl font-bold mb-4 text-gray-600">Relevant Cases for You</h2>
              <Button variant="outline" disabled>
                Explore all cases
              </Button>
            </div>
            <SkeletonCaseCards />
          </div>
          <InfoFooter />
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

  const newCasesData = cases
    .filter(case_ => newCaseIds.includes(case_.id))
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

  const ensuredCasesData = cases
    .filter(case_ => easyuredCaseIds.includes(case_.id))
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

  const relevantCasesData = cases
    .filter(case_ => relevantCaseIds.includes(case_.id))
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
      <div className="container mx-auto px-4 py-8 mt-16">
        <div className="mb-12">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-2xl font-bold text-gray-600">Popular Business Cases</h2>
            <Link href="/cases">
              <GradientBorderButton>
                Explore all cases
              </GradientBorderButton>
            </Link>
          </div>
          <CaseCards data={caseCardsData} />
        </div>
        <div className="mb-12">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-2xl font-bold text-gray-600">New Cases</h2>
            <Link href="/cases">
              <GradientBorderButton>
                Explore all cases
              </GradientBorderButton>
            </Link>
          </div>
          <CaseCards data={newCasesData} />
        </div>
        <div className="mb-12">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-2xl font-bold text-gray-600">Cases with Guaranteed Quality</h2>
            <Link href="/cases">
              <GradientBorderButton>
                Explore all cases
              </GradientBorderButton>
            </Link>
          </div>
          <CaseCards data={ensuredCasesData} />
        </div>
        <div className="mb-12">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-2xl font-bold mb-4 text-gray-600">Relevant Cases for You</h2>
            <Link href="/cases">
              <GradientBorderButton>
                Explore all cases
              </GradientBorderButton>
            </Link>
          </div>
          <CaseCards data={relevantCasesData} />
        </div>
        <InfoFooter />
      </div>
    </div>
  );
} 