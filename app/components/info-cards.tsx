

import {
  Card,
  CardDescription,
  CardTitle,
} from "@/app/components/ui/card"

interface CardData {
    id?: string;
    user_id?: string;
    case_id?: string | null;
    completed_sections: number;
    total_sections: number;
    is_completed: boolean;
    last_activity: string;
    title: string;
    completedCases: number;
}

interface InfoCardsProps {
  data: CardData[]
}

export function InfoCards({ data }: InfoCardsProps) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
      {data.map((card) => (
        <Card key={card.id || card.case_id || card.title} className="cursor-pointer hover:shadow-lg transition-shadow p-16 h-full">
          <div className="">
            <CardTitle className="text-xl font-semibold mb-4">{card.title}</CardTitle>
            
            <CardDescription className="text-sm text-muted-foreground mt-auto">
              {card.completedCases}
            </CardDescription>
          </div>
        </Card>
      ))}
    </div>
  )
}
