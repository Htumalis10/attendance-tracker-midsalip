import { Skeleton } from "@/components/ui/skeleton"

export default function Loading() {
  return (
    <div className="space-y-4 sm:space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <Skeleton className="h-8 w-48" />
          <Skeleton className="h-4 w-64 mt-2" />
        </div>
        <Skeleton className="h-10 w-32" />
      </div>

      {/* Filters Skeleton */}
      <div className="bg-card rounded-lg border border-border p-4">
        <div className="flex flex-wrap gap-3">
          <Skeleton className="h-10 w-48" />
          <Skeleton className="h-10 w-40" />
          <Skeleton className="h-10 w-32" />
        </div>
      </div>

      {/* Table Skeleton */}
      <div className="bg-card rounded-lg border border-border overflow-hidden">
        <div className="bg-muted p-4 border-b border-border">
          <div className="grid grid-cols-5 gap-4">
            <Skeleton className="h-4 w-24" />
            <Skeleton className="h-4 w-20" />
            <Skeleton className="h-4 w-32" />
            <Skeleton className="h-4 w-20" />
            <Skeleton className="h-4 w-16" />
          </div>
        </div>
        <div className="divide-y divide-border">
          {[...Array(8)].map((_, i) => (
            <div key={i} className="p-4 grid grid-cols-5 gap-4 items-center">
              <Skeleton className="h-4 w-32" />
              <Skeleton className="h-4 w-24" />
              <Skeleton className="h-4 w-40" />
              <Skeleton className="h-6 w-16 rounded-full" />
              <Skeleton className="h-4 w-20" />
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
