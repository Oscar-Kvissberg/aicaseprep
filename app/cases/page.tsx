'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@supabase/supabase-js'
import Link from 'next/link'
import { useSession } from 'next-auth/react'
import { NavBar } from '../components/nav_bar'
import { CaseCards } from '../components/case-cards'

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
}

export default function CasesPage() {
  const { data: session } = useSession()
  const [cases, setCases] = useState<BusinessCase[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    async function fetchCases() {
      try {
        const { data, error } = await supabase
          .from('business_cases')
          .select('*')
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
        </div>
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
    link: `/case-interview?caseId=${case_.id}`
  }))

  return (
    <div className="container mx-auto px-4 py-8 mt-16">
      <NavBar />
      
      
      {!session ? (
        <div className="bg-yellow-100 border border-yellow-400 text-yellow-700 px-4 py-3 rounded mb-6">
          <p>Please <Link href="/login" className="underline">sign in</Link> to practice business cases and get feedback.</p>
        </div>
      ) : null}
      
      <div>
      <CaseCards data={caseCardsData} />
      </div>
    </div>
  )
}