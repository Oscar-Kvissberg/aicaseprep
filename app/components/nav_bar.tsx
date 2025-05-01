'use client'

import * as React from "react"
import { signOut, useSession } from 'next-auth/react'
import Link from 'next/link'
import Image from 'next/image'
import { UserCircleIcon, BriefcaseIcon, ArrowLeftEndOnRectangleIcon, BookOpenIcon, HomeIcon } from '@heroicons/react/24/outline'
import { PrimaryButton } from './ui/primary_button'
import { Button } from './ui/button'
import {
  NavigationMenu,
  NavigationMenuContent,
  NavigationMenuItem,
  NavigationMenuLink,
  NavigationMenuList,
  NavigationMenuTrigger,
  navigationMenuTriggerStyle,
} from "@/app/components/ui/navigation-menu"
import { cn } from "@/lib/utils"



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

  return (
    <div className="fixed top-0 left-0 right-0 h-14 bg-white border-b border-gray-200 z-40">
      <div className="h-full flex items-center justify-between px-4 ml-16">
        {/* Left side - Navigation */}
        <NavigationMenu>
          <NavigationMenuList>
            <NavigationMenuItem>
              <Link href="/dash">
                <span className={navigationMenuTriggerStyle()}>
                  <HomeIcon className="w-5 h-5 mr-2 inline" />
                  Översikt
                </span>
              </Link>
            </NavigationMenuItem>

            <NavigationMenuItem>
              <Link href="/cases">
                <span className={navigationMenuTriggerStyle()}>
                  <BriefcaseIcon className="w-5 h-5 mr-2 inline" />
                  Casebank
                </span>
              </Link>
            </NavigationMenuItem>

            <NavigationMenuItem>
              <NavigationMenuTrigger>
                <BookOpenIcon className="w-5 h-5 mr-2 inline" />
                Tips & Guider
              </NavigationMenuTrigger>
              <NavigationMenuContent>
                <ul className="grid gap-3 p-4 md:w-[400px] lg:w-[500px] lg:grid-cols-[.75fr_1fr]">
                  <li className="row-span-3">
                    <NavigationMenuLink asChild>
                      <a
                        className="flex h-full w-full select-none flex-col justify-end rounded-md bg-gradient-to-b from-muted/50 to-muted p-6 no-underline outline-none focus:shadow-md"
                        href="/tips"
                      >
                        <div className="mb-2 mt-4 text-lg font-medium">
                          Case Interview Guide
                        </div>
                        <p className="text-sm leading-tight text-muted-foreground">
                          Omfattande guide för att förbereda dig inför case-intervjuer.
                        </p>
                      </a>
                    </NavigationMenuLink>
                  </li>
                  <ListItem href="/tips/frameworks" title="Frameworks">
                    Lär dig de viktigaste ramverken för case-intervjuer.
                  </ListItem>
                  <ListItem href="/tips/math" title="Mental Math">
                    Tips och övningar för att förbättra din huvudräkning.
                  </ListItem>
                  <ListItem href="/tips/structure" title="Structure">
                    Hur du strukturerar dina svar och presentationer.
                  </ListItem>
                </ul>
              </NavigationMenuContent>
            </NavigationMenuItem>

            <NavigationMenuItem>
              <Link href="/profile">
                <span className={navigationMenuTriggerStyle()}>
                  <UserCircleIcon className="w-5 h-5 mr-2 inline" />
                  Profil
                </span>
              </Link>
            </NavigationMenuItem>

          </NavigationMenuList>
        </NavigationMenu>

        {/* Right side - Profile info and logout */}
        <div className="flex items-center gap-4">
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
              variant="outline"
              onClick={() => signOut({ callbackUrl: '/' })}
              className="text-sm"
            >
              <ArrowLeftEndOnRectangleIcon className="w-4 h-4 mr-2" />
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
  )
}
