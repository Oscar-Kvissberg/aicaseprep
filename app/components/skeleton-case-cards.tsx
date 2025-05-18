import { Skeleton } from "@/app/components/ui/skeleton"
import { Card } from "@/app/components/ui/card"

interface SkeletonCaseCardsProps {
  count?: number
}

export function SkeletonCaseCards({ count = 4 }: SkeletonCaseCardsProps) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
      {Array.from({ length: count }).map((_, index) => (
        <Card key={index} className="overflow-hidden h-full p-0">
          <div className="relative w-full h-48">
            <Skeleton className="w-full h-full" />
          </div>
          <div className="px-4 pb-4 pt-2">
            <Skeleton className="h-6 w-3/4 mb-2" />
            <div className="flex flex-col gap-2 mb-3">
              <div className="flex flex-wrap gap-2">
                <Skeleton className="h-5 w-20" />
                <Skeleton className="h-5 w-20" />
              </div>
              <div className="flex flex-wrap gap-2">
                <Skeleton className="h-5 w-20" />
              </div>
            </div>
            <div className="space-y-1">
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-4 w-2/3" />
            </div>
          </div>
        </Card>
      ))}
    </div>
  )
} 