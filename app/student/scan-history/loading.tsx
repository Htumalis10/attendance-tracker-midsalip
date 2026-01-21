import { Skeleton } from "@/components/ui/skeleton"

export default function Loading() {
  return (
    <div className="space-y-4 sm:space-y-6">
      <div>
        <Skeleton className="h-8 w-40" />
        <Skeleton className="h-4 w-56 mt-2" />
      </div>

      {/* Stats Cards Skeleton */}
      <div className="grid grid-cols-3 gap-3">
        {[...Array(3)].map((_, i) => (
          <div key={i} className="bg-card rounded-lg border border-border p-4 text-center">
            <Skeleton className="h-3 w-16 mx-auto" />
            <Skeleton className="h-7 w-12 mx-auto mt-2" />
          </div>
        ))}
      </div>

      {/* Scan History Table Skeleton */}
      <div className="bg-card rounded-lg border border-border overflow-hidden">
        <div className="bg-muted p-4 border-b border-border">
          <Skeleton className="h-5 w-32" />
        </div>
        <div className="divide-y divide-border">
          {[...Array(6)].map((_, i) => (
            <div key={i} className="p-4 flex items-center gap-4">
              <Skeleton className="h-2 w-2 rounded-full" />
              <div className="flex-1 space-y-2">
                <Skeleton className="h-4 w-48" />
                <Skeleton className="h-3 w-32" />
              </div>
              <Skeleton className="h-6 w-16 rounded-full" />
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
