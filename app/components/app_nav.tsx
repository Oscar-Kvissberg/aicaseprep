'use client'

import { useEffect, useRef, useState } from 'react'
import Link from 'next/link'

import { signOut, useSession } from 'next-auth/react'
import { UserCircleIcon, RocketLaunchIcon, CakeIcon, ArrowLeftEndOnRectangleIcon } from '@heroicons/react/24/outline'
import { PrimaryButton } from './ui/primary_button'
import { Button } from './ui/button'
import { Avatar, AvatarImage, AvatarFallback } from './ui/avatar'
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuItem,
  SidebarMenuButton,
  SidebarProvider,
  SidebarTrigger,
} from './ui/sidebar'

export function AppNav() {
  const { data: session } = useSession()
  const [isOpen, setIsOpen] = useState(false)
  const navRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (navRef.current && !navRef.current.contains(event.target as Node)) {
        const hamburgerButton = document.querySelector('#hamburger-button')
        if (!hamburgerButton?.contains(event.target as Node)) {
          setIsOpen(false)
        }
      }
    }

    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  return (
    <SidebarProvider defaultOpen={true}>
      <div className="flex flex-col min-h-screen">
        {/* Top Navigation Bar */}
        <div className="fixed top-0 left-0 right-0 h-14 bg-white border-b border-gray-200 z-40">
          <div className="h-full flex items-center justify-between ml-20">
            {/* Left side - Company name */}
            <div className="flex items-center">
              <h1 className="text-lg font-medium">
                <Link href="/dash">Case Intervju Prac</Link>
              </h1>
            </div>

            {/* Right side - Profile info and logout */}
            <div className="flex items-center gap-4">
              {session?.user?.name && session?.user?.email && (
                <div className="flex flex-col items-end">
                  <p className="text-sm text-gray-800">{session.user.email}</p>
                </div>
              )}

              {session?.user?.image ? (
                <Avatar className="h-10 w-10">
                  <AvatarImage src={session.user.image} alt={session.user.name || 'Profile'} />
                  <AvatarFallback>
                    {session.user.name?.charAt(0) || session.user.email?.charAt(0) || 'U'}
                  </AvatarFallback>
                </Avatar>
              ) : (
                <Avatar className="h-10 w-10">
                  <AvatarFallback>
                    <UserCircleIcon className="h-6 w-6 text-gray-400" />
                  </AvatarFallback>
                </Avatar>
              )}

              {session ? (
                <Button
                  variant="outline"
                  onClick={() => signOut({ callbackUrl: '/' })}
                  className="text-sm mr-4"
                >
                  <ArrowLeftEndOnRectangleIcon className="w-4 h-4 mr-1" />
                  Logga ut
                </Button>
              ) : (
                <Link href="/login">
                  <PrimaryButton className="text-sm">Logga in</PrimaryButton>
                </Link>
              )}
            </div>
          </div>
        </div>

        {/* Hamburger button */}
        <button
          id="hamburger-button"
          onClick={() => setIsOpen(!isOpen)}
          className="fixed top-0 h-14 flex items-center left-4 z-[51] p-2 hover:bg-gray-100 rounded-full transition-colors"
        >
          <div className="flex flex-col gap-1.5 w-6">
            <span className={`block h-0.5 w-full bg-gray-900 transition-transform duration-300 ${isOpen ? 'rotate-45 translate-y-2' : ''}`} />
            <span className={`block h-0.5 w-full bg-gray-900 transition-opacity duration-300 ${isOpen ? 'opacity-0' : ''}`} />
            <span className={`block h-0.5 w-full bg-gray-900 transition-transform duration-300 ${isOpen ? '-rotate-45 -translate-y-2' : ''}`} />
          </div>
        </button>

        <div className="flex flex-1 pt-14">
          {/* Sidebar */}
          <Sidebar>
            <SidebarHeader>
              <div className="flex items-center justify-between">
                <h1 className="text-lg font-medium">
                  <Link href="/dash">Case Intervju Prac</Link>
                </h1>
                <SidebarTrigger />
              </div>
            </SidebarHeader>
            
            <SidebarContent>
              <SidebarMenu>
                <SidebarMenuItem>
                  <SidebarMenuButton asChild isActive={false}>
                    <Link href="/cases">
                      <CakeIcon className="w-5 h-5" />
                      <span>Case Bibliotek</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
                
                <SidebarMenuItem>
                  <SidebarMenuButton asChild isActive={false}>
                    <Link href="/dash">
                      <RocketLaunchIcon className="w-5 h-5" />
                      <span>Översikt</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              </SidebarMenu>
            </SidebarContent>
            
            <SidebarFooter>
              <div className="flex items-center gap-4 p-2 border-t border-gray-200">
                {session?.user?.image ? (
                  <Avatar className="h-10 w-10">
                    <AvatarImage src={session.user.image} alt={session.user.name || 'Profile'} />
                    <AvatarFallback>
                      {session.user.name?.charAt(0) || session.user.email?.charAt(0) || 'U'}
                    </AvatarFallback>
                  </Avatar>
                ) : (
                  <Avatar className="h-10 w-10">
                    <AvatarFallback>
                      <UserCircleIcon className="h-6 w-6 text-gray-400" />
                    </AvatarFallback>
                  </Avatar>
                )}
                
                <div className="flex flex-col">
                  <p className="text-sm font-medium">{session?.user?.name || 'Guest'}</p>
                  <p className="text-xs text-gray-500">{session?.user?.email}</p>
                </div>
              </div>
            </SidebarFooter>
          </Sidebar>
          
          {/* Main content */}
          <main className="flex-1 p-4">
            {/* Your page content will go here */}
          </main>
        </div>
      </div>
    </SidebarProvider>
  )
}
