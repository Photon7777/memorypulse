export function LoadingSkeleton({ compact = false }: { compact?: boolean }) {
  return (
    <div className={`loading-skeleton${compact ? ' loading-skeleton--compact' : ''}`} role="status" aria-label="Loading current MemoryPulse data">
      <span className="sr-only">Loading current MemoryPulse data…</span>
      <div className="skeleton-line skeleton-line--short" />
      <div className="skeleton-line skeleton-line--title" />
      <div className="skeleton-line skeleton-line--copy" />
      <div className="skeleton-grid"><i /><i /><i /></div>
    </div>
  )
}
