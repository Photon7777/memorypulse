interface Props {
  score: number | null
  status: string
  confidence: number
}

export function ScoreDial({ score, status, confidence }: Props) {
  const displayed = score == null ? '—' : Math.round(score).toString()
  const progress = score ?? 0
  return (
    <div className="score-lockup">
      <div
        className="score-dial"
        style={{ '--score': `${progress * 3.6}deg` } as React.CSSProperties}
        role="img"
        aria-label={score == null ? 'Memory Pressure Index unavailable' : `Memory Pressure Index ${displayed} out of 100, ${status}`}
      >
        <div><strong>{displayed}</strong><span>/ 100</span></div>
      </div>
      <div className="score-copy">
        <p className="status-line"><span className="status-dot" />{status}</p>
        <p>{Math.round(confidence * 100)}% data confidence</p>
      </div>
    </div>
  )
}
