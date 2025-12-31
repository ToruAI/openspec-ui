export function CardSkeleton() {
  return (
    <div className="p-3 border rounded-lg bg-card animate-pulse space-y-2">
      <div className="flex justify-between">
        <div className="h-4 w-32 bg-muted rounded" />
        <div className="h-5 w-16 bg-muted rounded" />
      </div>
      <div className="h-3 w-20 bg-muted rounded" />
      <div className="flex gap-1">
        <div className="h-5 w-14 bg-muted rounded" />
        <div className="h-5 w-10 bg-muted rounded" />
      </div>
    </div>
  );
}

export function ColumnSkeleton() {
  return (
    <div className="flex-1 min-w-0 flex flex-col">
      <div className="sticky top-0 bg-background py-2 z-10">
        <div className="h-5 w-20 bg-muted rounded mb-1" />
        <div className="h-4 w-10 bg-muted rounded" />
      </div>
      <div className="flex flex-col gap-3">
        {[1, 2, 3].map((i) => <CardSkeleton key={i} />)}
      </div>
    </div>
  );
}
