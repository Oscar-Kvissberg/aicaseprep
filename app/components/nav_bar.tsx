'use client'

import * as React from "react"
import { signOut, useSession } from 'next-auth/react'
import Link from 'next/link'
import Image from 'next/image'
import { usePathname } from 'next/navigation'
import { UserCircleIcon, BriefcaseIcon, ArrowLeftEndOnRectangleIcon, BookOpenIcon, HomeIcon, CreditCardIcon, ArrowRightOnRectangleIcon } from '@heroicons/react/24/outline'
import { Button } from './ui/button'
import { BuyCredits } from './buy_credits'
import {
  NavigationMenu,
  NavigationMenuContent,
  NavigationMenuItem,
  NavigationMenuLink,
  NavigationMenuList,
  NavigationMenuTrigger
} from "@/app/components/ui/navigation-menu"
import { cn } from "@/lib/utils"
import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'

const ListItem = React.forwardRef<
  React.ElementRef<"a">,
  React.ComponentPropsWithoutRef<"a">
>(({ className, title, children, ...props }, ref) => {
  return (
    <li>
      <NavigationMenuLink asChild>
        <a
          ref={ref}
          className={cn(
            "block select-none space-y-1 rounded-md p-3 leading-none no-underline outline-none transition-colors hover:bg-accent hover:text-accent-foreground focus:bg-accent focus:text-accent-foreground",
            className
          )}
          {...props}
        >
          <div className="text-sm font-medium leading-none">{title}</div>
          <p className="line-clamp-2 text-sm leading-snug text-muted-foreground">
            {children}
          </p>
        </a>
      </NavigationMenuLink>
    </li>
  )
})
ListItem.displayName = "ListItem"

export function NavBar() {
  const { data: session } = useSession()
  const pathname = usePathname()
  const [creditBalance, setCreditBalance] = useState<number>(0)
  const [showBuyCredits, setShowBuyCredits] = useState(false)

  useEffect(() => {
    if (session?.user?.id) {
      const fetchCreditBalance = async () => {
        const { data: balanceData, error } = await supabase
          .from('credit_balances')
          .select('current_balance')
          .eq('user_id', session.user.id)
          .single()

        if (!error && balanceData) {
          setCreditBalance(balanceData.current_balance)
        }
      }

      fetchCreditBalance()
    }
  }, [session])

  return (
    <>
      <div className="fixed top-0 left-0 right-0 h-14 bg-white border-b border-gray-200 z-40">
        <div className="container mx-auto h-full flex items-center justify-between px-4">
          {/* Left side - Navigation */}
          <NavigationMenu delayDuration={0} skipDelayDuration={0}>
            <NavigationMenuList>
              <NavigationMenuItem>
                <Button 
                  variant="ghost" 
                  asChild
                  className={cn(
                    pathname === '/dash' && "gradient-border-normal rounded-xl"
                  )}
                >
                  <Link href="/dash">
                    <span className="flex items-center">
                      <HomeIcon className="w-5 h-5 mr-2" />
                      Home
                    </span>
                  </Link>
                </Button>
              </NavigationMenuItem>

              <NavigationMenuItem>
                <Button 
                  variant="ghost" 
                  asChild
                  className={cn(
                    pathname === '/cases' && "gradient-border-normal rounded-xl"
                  )}
                >
                  <Link href="/cases">
                    <span className="flex items-center">
                      <BriefcaseIcon className="w-5 h-5 mr-2" />
                      Case Library
                    </span>
                  </Link>
                </Button>
              </NavigationMenuItem>

              <NavigationMenuItem>
                <Button 
                  variant="ghost" 
                  asChild
                  className={cn(
                    pathname === '/tips' && "gradient-border-normal rounded-xl"
                  )}
                >
                  <Link href="/tips">
                    <span className="flex items-center">
                      <BookOpenIcon className="w-5 h-5 mr-2" />
                      Tips & Guides
                    </span>
                  </Link>
                </Button>
              </NavigationMenuItem>

              <NavigationMenuItem>
                <Button 
                  variant="ghost" 
                  asChild
                  className={cn(
                    pathname === '/profile' && "gradient-border-normal rounded-xl"
                  )}
                >
                  <Link href="/profile">
                    <span className="flex items-center">
                      <UserCircleIcon className="w-5 h-5 mr-2" />
                      Profile
                    </span>
                  </Link>
                </Button>
              </NavigationMenuItem>

            </NavigationMenuList>
          </NavigationMenu>

          {/* Right side - Profile info and logout */}
          <div className="flex items-center gap-4">
            <NavigationMenu delayDuration={0} skipDelayDuration={0} className="[&_[data-slot=navigation-menu-viewport]]:rounded-xl">
              <NavigationMenuList>
                <NavigationMenuItem className="rounded-xl">
                  <NavigationMenuTrigger>
                    <CreditCardIcon className="w-5 h-5 mr-2 " />
                    <span className="text-gray-900">{creditBalance} Credits</span>
                  </NavigationMenuTrigger>
                  <NavigationMenuContent className="rounded-xl">
                    <div className="p-4 w-[300px] bg-background shadow-xs rounded-xl">
                      <div className="mb-4">
                        <h3 className="text-lg font-semibold mb-2">Your Credits</h3>
                        <p className="text-3xl font-bold text-p-custom">{creditBalance}</p>
                        <p className="text-sm text-gray-500 mt-1">1 Credit = 1 Case</p>
                      </div>
                      <Button 
                        variant="primary_c2a" 
                        className="w-full"
                        onClick={() => setShowBuyCredits(true)}
                      >
                        Buy more credits
                      </Button>
                    </div>
                  </NavigationMenuContent>
                </NavigationMenuItem>
              </NavigationMenuList>
            </NavigationMenu>

            {session?.user?.name && session?.user?.email && (
              <div className="flex flex-col items-end">
                <p className="text-sm text-gray-800">{session.user.email}</p>
              </div>
            )}

            {session?.user?.image ? (
              <div className="relative w-10 h-10 rounded-full overflow-hidden">
                <Image
                  src={session.user.image}
                  alt={session.user.name || 'Profile'}
                  fill
                  className="object-cover"
                  priority
                />
              </div>
            ) : (
              <UserCircleIcon className="h-10 w-10 text-gray-400" />
            )}

            {session ? (
              <Button
                variant="primary_c2a"
                onClick={() => signOut({ callbackUrl: '/' })}
                className="text-sm"
              >
                <ArrowLeftEndOnRectangleIcon className="w-4 h-4 mr-2" />
                Sign out
              </Button>
            ) : (
              <Link href="/login">
                <Button 
                variant="primary_c2a" 
                className="text-sm"
                >
                  <span className="flex items-center">
                    <ArrowRightOnRectangleIcon className="w-4 h-4 mr-2" />
                    Sign in
                  </span>
                </Button>
              </Link>
            )}
          </div>
        </div>
      </div>

      {/* Buy Credits Modal */}
      {showBuyCredits && (
        <div 
          className="fixed inset-0 bg-black/80 flex items-center justify-center z-50"
          onClick={() => setShowBuyCredits(false)}
        >
                      <div 
              className="max-w-4xl w-full mx-4"
              onClick={(e) => e.stopPropagation()}
            >
              <BuyCredits onClose={() => setShowBuyCredits(false)} />
            </div>
        </div>
      )}
    </>
  )
}
