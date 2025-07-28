'use client'

import { useEffect, useState, Suspense } from 'react'
import { useSession } from 'next-auth/react'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { Button } from '@/app/components/ui/button'
import { CheckCircleIcon, TrophyIcon, ArrowRightIcon } from '@heroicons/react/24/outline'

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

function CaseCompletedContent() {
  const { data: session, status } = useSession()
  const router = useRouter()
  const searchParams = useSearchParams()
  const caseId = searchParams.get('caseId')
  
  const [businessCase, setBusinessCase] = useState<BusinessCase | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (status === 'loading') return;
    
    if (!session) {
      router.push('/login')
      return
    }

    if (!caseId) {
      router.push('/cases')
      return
    }

    async function fetchCase() {
      try {
        const response = await fetch(`/api/cases/${caseId}`)
        if (!response.ok) {
          throw new Error('Failed to fetch case data')
        }
        const data = await response.json()
        setBusinessCase(data.case)
      } catch (err) {
        console.error('Error fetching case:', err)
        router.push('/cases')
      } finally {
        setLoading(false)
      }
    }

    fetchCase()
  }, [session, status, caseId, router])

  if (loading) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="flex justify-center items-center min-h-[60vh]">
          <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500"></div>
        </div>
      </div>
    )
  }

  if (!businessCase) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="text-center">
          <p className="mb-4">Case not found</p>
          <Button asChild>
            <Link href="/cases">
              Tillbaka till case biblioteket
            </Link>
          </Button>
        </div>
      </div>
    )
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="max-w-2xl mx-auto text-center">
        {/* Success Icon */}
        <div className="flex justify-center mb-6">
          <div className="relative">
            <div className="w-24 h-24 bg-green-100 rounded-full flex items-center justify-center">
              <CheckCircleIcon className="w-12 h-12 text-green-600" />
            </div>
            <div className="absolute -top-2 -right-2">
              <div className="w-8 h-8 bg-yellow-400 rounded-full flex items-center justify-center">
                <TrophyIcon className="w-5 h-5 text-yellow-800" />
              </div>
            </div>
          </div>
        </div>

        {/* Congratulations Text */}
        <h1 className="text-4xl font-bold text-gray-900 mb-4">
          Grattis! 🎉
        </h1>
        <p className="text-xl text-gray-600 mb-8">
          Du har slutfört caset
        </p>

        {/* Case Tags */}
        <div className="flex justify-center space-x-4 mb-8">
          <span className="px-3 py-1 bg-blue-100 text-blue-800 text-sm rounded-full">
            {businessCase.difficulty}
          </span>
          <span className="px-3 py-1 bg-green-100 text-green-800 text-sm rounded-full">
            {businessCase.industry}
          </span>
          <span className="px-3 py-1 bg-purple-100 text-purple-800 text-sm rounded-full">
            {businessCase.estimated_time}
          </span>
        </div>

        {/* Action Buttons */}
        <div className="flex flex-col sm:flex-row gap-4 justify-center">
          <Button
            onClick={() => router.push('/cases')}
            className="bg-blue-500 hover:bg-blue-600 text-white px-6 py-3 rounded-lg"
          >
            <ArrowRightIcon className="w-5 h-5 mr-2" />
            Prova fler cases
          </Button>
          
          <Button
            variant="outline"
            onClick={() => router.push('/dash')}
            className="px-6 py-3 rounded-lg"
          >
            Tillbaka till dashboard
          </Button>
        </div>
      </div>
    </div>
  )
}

export default function CaseCompletedPage() {
  return (
    <Suspense fallback={
      <div className="container mx-auto px-4 py-8">
        <div className="flex justify-center items-center min-h-[60vh]">
          <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500"></div>
        </div>
      </div>
    }>
      <CaseCompletedContent />
    </Suspense>
  )
} 