import type { ReactNode } from 'react'

interface Props {
  loading: boolean
  error: string | null
  children: ReactNode
}

export function DataBoundary({ loading, error, children }: Props) {
  if (loading) {
    return <div className="data-message" role="status"><span className="loading-mark" />Loading validated market data…</div>
  }
  if (error) {
    return (
      <div className="data-message data-message--error" role="alert">
        <strong>Market data could not be loaded.</strong>
        <span>{error}. The previous deployed site remains available when an update fails.</span>
      </div>
    )
  }
  return children
}
