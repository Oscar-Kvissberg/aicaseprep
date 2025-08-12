'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@supabase/supabase-js'
import { useSession } from 'next-auth/react'
import { NavBar } from '../components/nav_bar'
import { CaseCards } from '../components/case-cards'
import { SkeletonCaseCards } from '../components/skeleton-case-cards'
import { InfoFooter } from '../components/info_footer'

// Initialize Supabase client
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
const supabase = createClient(supabaseUrl, supabaseAnonKey)

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

export default function CasesPage() {
  const { status } = useSession()
  const [cases, setCases] = useState<BusinessCase[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    async function fetchCases() {
      try {
        const { data, error } = await supabase
          .from('business_cases')
          .select(`
            *,
            case_thumbnails (
              image_url
            )
          `)
          .order('created_at', { ascending: false })

        if (error) {
          throw error
        }

        setCases(data || [])
      } catch (err) {
        console.error('Error fetching cases:', err)
        setError('Failed to load business cases. Please try again later.')
      } finally {
        setLoading(false)
      }
    }

    fetchCases()
  }, [])

  const renderContent = () => {
    if (loading) {
      return <SkeletonCaseCards count={8} />
    }

    if (error) {
      return (
        <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded">
          <p>{error}</p>
        </div>
      )
    }

    const caseCardsData = cases.map((case_) => ({
      title: case_.company,
      difficulty: case_.difficulty,
      trend: 0,
      trendText: case_.industry,
      description: case_.title,
      estimatedTime: case_.estimated_time,
      thumbnailUrl: case_.case_thumbnails?.[0]?.image_url,
      link: `/case-interview?caseId=${case_.id}`
    }))

    return <CaseCards data={caseCardsData} />
  }

  return (
    <div className="flex flex-col min-h-screen">
      <NavBar />
      <div className="container mx-auto px-4 py-8 mt-16">
        {status === 'unauthenticated' && (
          <div className="bg-yellow-100 border border-yellow-400 text-yellow-700 px-4 py-3 rounded mb-6">
            <p>You need to sign in to practice cases and get feedback. Click &quot;Sign in&quot; in the upper right corner.</p>
          </div>
        )}
        {renderContent()}
        <InfoFooter />
      </div>
    </div>
  )
}