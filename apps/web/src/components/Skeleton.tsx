export function Skeleton({ className = "" }: { className?: string }) {
  return (
    <div
      className={`animate-pulse rounded-[18px] border border-white/[0.08] bg-white/[0.06] ${className}`}
    />
  );
}

export function CardSkeleton() {
  return (
    <div className="glass-panel p-6">
      <Skeleton className="mb-4 h-4 w-28" />
      <Skeleton className="mb-3 h-9 w-2/3" />
      <Skeleton className="mb-2 h-3 w-full" />
      <Skeleton className="h-3 w-3/4" />
    </div>
  );
}

export function ChartSkeleton() {
  return (
    <div className="glass-panel p-6">
      <Skeleton className="mb-4 h-4 w-32" />
      <Skeleton className="h-56 w-full" />
    </div>
  );
}

export function TableSkeleton({ rows = 5 }: { rows?: number }) {
  return (
    <div className="glass-panel p-6">
      <Skeleton className="mb-4 h-4 w-28" />
      {Array.from({ length: rows }).map((_, index) => (
        <Skeleton key={index} className="mb-2 h-10 w-full" />
      ))}
    </div>
  );
}
