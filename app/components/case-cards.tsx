import { IconTrendingDown, IconTrendingUp, IconClock } from "@tabler/icons-react"
import Link from "next/link"

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
  image?: string
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

export function CaseCards({ data }: CaseCardsProps) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
      {data.map((card, index) => (
        <Link 
          key={card.id || index} 
          href={card.link || '#'}
          className="h-full"
        >
          <Card className="cursor-pointer hover:shadow-lg transition-shadow p-6 h-full">
            <div className="flex flex-col h-full">
              <CardTitle className="text-xl font-semibold mb-4">{card.title}</CardTitle>
              <div className="flex flex-wrap gap-2 mb-4">
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
              <CardDescription className="text-sm text-muted-foreground mt-auto">
                {card.description}
              </CardDescription>
            </div>
          </Card>
        </Link>
      ))}
    </div>
  )
}
