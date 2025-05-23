'use client'

import { Suspense } from 'react'
import { signIn } from 'next-auth/react'
import { useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { useState, useEffect, useCallback } from 'react'
import { PrimaryButton } from '../components/ui/primary_button'
import { GoogleIcon } from '../components/ui/google_icon'
import Image from 'next/image'

function LoginContent() {
  const searchParams = useSearchParams()
  const registered = searchParams.get('registered')
  const error = searchParams.get('error')
  const callbackUrl = searchParams.get('callbackUrl')
  const [isLoading, setIsLoading] = useState(false)
  const [message, setMessage] = useState<string | null>(null)

  const getErrorMessage = useCallback((errorCode?: string) => {
    switch (errorCode) {
      case 'OAuthAccountNotLinked':
        return 'Detta Google-konto är inte kopplat till något befintligt konto. Skapa först ett konto med din e-postadress.'
      case 'AccessDenied':
        return 'Åtkomst nekad. Kontrollera att du har rätt behörighet.'
      default:
        return error ? 'Ett fel uppstod vid inloggning. Försök igen.' : null
    }
  }, [error])

  useEffect(() => {
    if (registered) {
      setMessage('Konto skapat! Du kan nu logga in med Google.')
    }
    
    if (error) {
      setMessage(getErrorMessage(error))
    }
  }, [registered, error, getErrorMessage])

  const handleGoogleLogin = async () => {
    try {
      setIsLoading(true)
      setMessage(null)
      
      await signIn('google', {
        redirect: true,
        callbackUrl: callbackUrl || '/dash'
      })
    } catch (error) {
      console.error('Login error:', error)
      setMessage('Ett fel uppstod vid inloggning. Försök igen.')
      setIsLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-white">
      <div className="w-full max-w-md p-8 space-y-8">
        <div className="text-center">
          <div className="flex justify-center mb-2">
            <Image src="/logo.png" alt="Case" width={100} height={100} />
          </div>
          <h2 className="text-3xl font-bold text-gray-900">
            Välkommen tillbaka!
          </h2>
          <p className="mt-2 text-sm text-gray-600">
            Logga in för att fortsätta till ditt konto
          </p>
        </div>

        {message && (
          <div className={`p-4 rounded-lg text-sm ${
            message.includes('Konto skapat') 
              ? 'bg-green-50 text-green-700 border border-green-200' 
              : 'bg-red-50 text-red-700 border border-red-200'
          }`}>
            {message}
          </div>
        )}

        <div className="mt-8 space-y-6">
          <PrimaryButton
            onClick={handleGoogleLogin}
            disabled={isLoading}
            className="w-full flex items-center justify-center px-4 py-3 text-base"
            icon={<GoogleIcon />}
          >
            {isLoading ? 'Loggar in...' : 'Fortsätt med Google'}
          </PrimaryButton>

          <div className="relative">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-gray-200"></div>
            </div>
            <div className="relative flex justify-center text-sm">
              <span className="px-2 bg-white text-gray-500">eller</span>
            </div>
          </div>

          <div className="text-center">
            <Link 
              href="/register" 
              className="text-sm font-medium text-indigo-600 hover:text-indigo-500 transition-colors"
            >
              Har du inget konto? Skapa ett här
            </Link>
          </div>
        </div>
      </div>
    </div>
  )
}

export default function LoginPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center bg-white">
        <div className="text-center">
          <div className="inline-block h-8 w-8 animate-spin rounded-full border-4 border-solid border-indigo-600 border-r-transparent align-[-0.125em]" role="status">
            <span className="!absolute !-m-px !h-px !w-px !overflow-hidden !whitespace-nowrap !border-0 !p-0 ![clip:rect(0,0,0,0)]">Loading...</span>
          </div>
          <p className="mt-2 text-gray-600">Laddar...</p>
        </div>
      </div>
    }>
      <LoginContent />
    </Suspense>
  )
} 