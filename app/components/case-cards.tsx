import { IconTrendingDown, IconTrendingUp, IconClock } from "@tabler/icons-react"
import Link from "next/link"
import Image from "next/image"

import { Badge } from "@/app/components/ui/badge"
import {
  Card,
  CardDescription,
  CardTitle,
} from "@/app/components/ui/card"

interface CardData {
  title: string
  difficulty?: string
  trend: number
  trendText: string
  description: string
  link?: string
  thumbnailUrl?: string
  industry?: string
  estimatedTime?: string
  author_note?: string
  language?: string
  company?: string
  id?: string
  created_at?: string
  updated_at?: string
  completed_sections?: number
  total_sections?: number
}

interface CaseCardsProps {
  data: CardData[]
}

// Add image loader for Supabase URLs
const supabaseImageLoader = ({ src }: { src: string }) => {
  return src;
}

export function CaseCards({ data }: CaseCardsProps) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
      {data.map((card, index) => (
        <Link 
          key={card.id || index} 
          href={card.link || '#'}
          className="h-full"
        >
          <Card className="cursor-pointer hover:shadow-lg transition-shadow overflow-hidden h-full relative group p-0">
            <div className="relative w-full h-48">
              {card.thumbnailUrl ? (
                <Image
                  loader={supabaseImageLoader}
                  src={card.thumbnailUrl}
                  alt={`${card.title} thumbnail`}
                  fill
                  className="object-cover transition-transform duration-300 group-hover:scale-105"
                  unoptimized
                />
              ) : (
                <div className="w-full h-full bg-gray-200 flex items-center justify-center">
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-12 w-12 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                  </svg>
                </div>
              )}
            </div>
            <div className="px-4 pb-4 pt-0">
              <CardTitle className="text-xl font-semibold mb-2 line-clamp-1">{card.title}</CardTitle>
              <div className="flex flex-wrap gap-2 mb-2">
                <Badge variant="outline" className="text-sm">
                  {card.trend >= 0 ? <IconTrendingUp className="mr-1" /> : <IconTrendingDown className="mr-1" />}
                  {card.trendText}
                </Badge>
                {card.estimatedTime && (
                  <Badge variant="outline" className="text-sm">
                    <IconClock className="mr-1" />
                    {card.estimatedTime}
                  </Badge>
                )}
                {card.difficulty && (
                  <Badge variant="outline" className="text-sm">
                    {card.difficulty}
                  </Badge>
                )}
              </div>
              <CardDescription className="text-sm text-muted-foreground line-clamp-2">
                {card.description}
              </CardDescription>
            </div>
          </Card>
        </Link>
      ))}
    </div>
  )
}
