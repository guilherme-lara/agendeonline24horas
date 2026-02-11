import { Skeleton } from "@/components/ui/skeleton";

const DashboardSkeleton = () => (
  <div className="container max-w-5xl py-8 animate-fade-in">
    <div className="flex items-center justify-between mb-1">
      <div>
        <Skeleton className="h-8 w-48 mb-2" />
        <Skeleton className="h-4 w-36" />
      </div>
      <Skeleton className="h-9 w-28" />
    </div>

    <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mt-6 mb-8">
      {Array.from({ length: 4 }).map((_, i) => (
        <div key={i} className="rounded-lg border border-border bg-card p-4">
          <Skeleton className="h-5 w-5 mb-2 rounded" />
          <Skeleton className="h-8 w-20 mb-1" />
          <Skeleton className="h-3 w-24" />
        </div>
      ))}
    </div>

    <Skeleton className="h-64 w-full rounded-lg mb-8" />

    <Skeleton className="h-6 w-32 mb-4" />
    <Skeleton className="h-10 w-full rounded-lg mb-4" />
    <div className="space-y-2">
      {Array.from({ length: 5 }).map((_, i) => (
        <Skeleton key={i} className="h-14 w-full rounded-lg" />
      ))}
    </div>
  </div>
);

export default DashboardSkeleton;
