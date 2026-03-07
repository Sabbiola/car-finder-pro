const CarCardSkeleton = () => (
  <div className="rounded-2xl border border-border/60 overflow-hidden animate-pulse">
    <div className="aspect-[16/10] bg-muted" />
    <div className="p-4 space-y-3">
      <div className="h-4 bg-muted rounded w-3/4" />
      <div className="h-6 bg-muted rounded w-1/2" />
      <div className="grid grid-cols-2 gap-2">
        <div className="h-3 bg-muted rounded" />
        <div className="h-3 bg-muted rounded" />
        <div className="h-3 bg-muted rounded" />
        <div className="h-3 bg-muted rounded" />
      </div>
    </div>
  </div>
);

export default CarCardSkeleton;
