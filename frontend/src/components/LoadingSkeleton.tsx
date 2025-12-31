import { cn } from "@/lib/utils";

interface SkeletonProps {
  className?: string;
}

function Skeleton({ className }: SkeletonProps) {
  return (
    <div 
      className={cn(
        "bg-muted rounded-md relative overflow-hidden",
        "before:absolute before:inset-0 before:animate-shimmer",
        className
      )} 
    />
  );
}

export function CardSkeleton() {
  return (
    <div className="p-4 border border-border/50 rounded-xl bg-card/80 space-y-3">
      {/* Header */}
      <div className="flex justify-between items-start gap-3">
        <Skeleton className="h-4 w-3/4" />
        <Skeleton className="h-5 w-16 rounded-full" />
      </div>
      
      {/* Progress bar */}
      <div className="space-y-2">
        <div className="flex justify-between">
          <Skeleton className="h-3 w-20" />
          <Skeleton className="h-3 w-8" />
        </div>
        <Skeleton className="h-1.5 w-full rounded-full" />
      </div>
      
      {/* Tags */}
      <div className="flex gap-2">
        <Skeleton className="h-6 w-16 rounded-md" />
        <Skeleton className="h-6 w-14 rounded-md" />
      </div>
    </div>
  );
}

export function ColumnSkeleton() {
  return (
    <div className="flex-1 min-w-0 flex flex-col">
      {/* Column header */}
      <div className="sticky top-0 bg-background py-3 z-10 border-b border-border/50 mb-3">
        <div className="flex items-center gap-2">
          <Skeleton className="h-4 w-4 rounded" />
          <Skeleton className="h-4 w-20" />
          <Skeleton className="ml-auto h-5 w-8 rounded-full" />
        </div>
      </div>
      
      {/* Cards */}
      <div className="flex flex-col gap-3">
        {[1, 2, 3].map((i) => (
          <CardSkeleton key={i} />
        ))}
      </div>
    </div>
  );
}

export function SpecsSidebarSkeleton() {
  return (
    <div className="space-y-4 p-4">
      <Skeleton className="h-5 w-24 mb-4" />
      {[1, 2, 3].map((group) => (
        <div key={group} className="space-y-2">
          <Skeleton className="h-3 w-16" />
          {[1, 2].map((item) => (
            <Skeleton key={item} className="h-8 w-full rounded-md" />
          ))}
        </div>
      ))}
    </div>
  );
}

export function SpecContentSkeleton() {
  return (
    <div className="p-6 space-y-4">
      <Skeleton className="h-8 w-2/3" />
      <Skeleton className="h-4 w-24" />
      <div className="space-y-3 mt-8">
        <Skeleton className="h-4 w-full" />
        <Skeleton className="h-4 w-full" />
        <Skeleton className="h-4 w-3/4" />
        <Skeleton className="h-4 w-5/6" />
        <Skeleton className="h-4 w-2/3" />
      </div>
      <div className="space-y-3 mt-6">
        <Skeleton className="h-4 w-full" />
        <Skeleton className="h-4 w-4/5" />
        <Skeleton className="h-4 w-full" />
      </div>
    </div>
  );
}

export function DetailModalSkeleton() {
  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="space-y-3">
        <Skeleton className="h-7 w-3/4" />
        <div className="flex gap-2">
          <Skeleton className="h-5 w-20 rounded-full" />
          <Skeleton className="h-5 w-24 rounded-full" />
        </div>
      </div>
      
      {/* Tabs */}
      <div className="flex gap-2 p-1 bg-muted/50 rounded-lg">
        {[1, 2, 3].map((i) => (
          <Skeleton key={i} className="h-9 flex-1 rounded-md" />
        ))}
      </div>
      
      {/* Content */}
      <div className="space-y-4">
        <Skeleton className="h-6 w-1/2" />
        <Skeleton className="h-4 w-full" />
        <Skeleton className="h-4 w-full" />
        <Skeleton className="h-4 w-3/4" />
        <Skeleton className="h-4 w-5/6" />
      </div>
    </div>
  );
}
