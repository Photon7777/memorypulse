import type { ReactNode } from 'react'

interface Props {
  eyebrow: string
  value: ReactNode
  detail: string
  tone?: 'default' | 'accent' | 'warning'
}

export function MetricCard({ eyebrow, value, detail, tone = 'default' }: Props) {
  return (
    <article className={`metric-card metric-card--${tone}`}>
      <p className="eyebrow">{eyebrow}</p>
      <div className="metric-value">{value}</div>
      <p className="metric-detail">{detail}</p>
    </article>
  )
}
