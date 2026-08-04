import { useEffect, useMemo, useState } from 'react'
import { BusinessSignalChart } from '../charts/BusinessSignalChart'
import { DataBoundary } from '../components/DataBoundary'
import { MetricCard } from '../components/MetricCard'
import { PageIntro } from '../components/PageIntro'
import { useStaticData } from '../hooks/useStaticData'
import type { AnalyticsData, DecisionBrief } from '../types/data'
import { formatCompactNumber, formatDate, formatNumber } from '../utils/format'

function storedNumber(key: string, fallback: number): number {
  const value = Number(window.localStorage.getItem(key))
  return Number.isFinite(value) && value > 0 ? value : fallback
}

export function AnalyticsPage() {
  const analytics = useStaticData<AnalyticsData>('analytics.json')
  const brief = useStaticData<DecisionBrief>('decision-brief.json')
  const [hiddenSignals, setHiddenSignals] = useState<Set<string>>(() => new Set())
  const [pressureThreshold, setPressureThreshold] = useState(() => storedNumber('memorypulse-pressure-threshold', 65))
  const [moveThreshold, setMoveThreshold] = useState(() => storedNumber('memorypulse-ddr5-threshold', 5))
  const visibleSignals = useMemo(() => analytics.data?.macro_series.filter((item) => !hiddenSignals.has(item.series_id)) ?? [], [analytics.data, hiddenSignals])
  const eventDelta = (analytics.data?.event_pressure.latest_30_days ?? 0) - (analytics.data?.event_pressure.prior_30_days ?? 0)
  const pressureAlert = (brief.data?.pressure_score ?? 0) >= pressureThreshold
  const ddr5Move = Math.abs(brief.data?.ddr5.recent_change_percent ?? 0)
  const moveAlert = ddr5Move >= moveThreshold

  useEffect(() => {
    window.localStorage.setItem('memorypulse-pressure-threshold', String(pressureThreshold))
    window.localStorage.setItem('memorypulse-ddr5-threshold', String(moveThreshold))
  }, [moveThreshold, pressureThreshold])

  function toggleSignal(seriesId: string) {
    setHiddenSignals((current) => {
      const next = new Set(current)
      if (next.has(seriesId)) next.delete(seriesId)
      else next.add(seriesId)
      return next
    })
  }

  return (
    <>
      <PageIntro kicker="Decision analytics" title="From market signals to an operating posture" description="Inspect the evidence, statistical baselines, model readiness, and business rules behind the latest MemoryPulse conclusion." />
      <DataBoundary loading={analytics.loading || brief.loading} error={analytics.error || brief.error}>
        <section className="analytics-decision-strip">
          <div><p className="eyebrow">Latest conclusion</p><h2>{brief.data?.headline}</h2><p>{brief.data?.conclusion}</p></div>
          <dl><div><dt>Regime</dt><dd>{brief.data?.regime}</dd></div><div><dt>Direction</dt><dd>{brief.data?.direction}</dd></div><div><dt>Confidence</dt><dd>{brief.data?.confidence}</dd></div></dl>
        </section>
        <details className="decision-history">
          <summary>Conclusion history · {brief.data?.history.length ?? 0} runs retained in this view</summary>
          <div className="health-table-wrap"><table className="health-table"><thead><tr><th>Run</th><th>Regime</th><th>Direction</th><th>Pressure</th><th>Confidence</th><th>Procurement posture</th></tr></thead><tbody>{brief.data?.history.slice(0, 20).map((item) => <tr key={item.brief_id}><td>{formatDate(item.generated_at, true)}</td><td>{item.regime}</td><td>{item.direction}</td><td>{formatNumber(item.pressure_score, 1)}</td><td>{item.confidence}</td><td>{item.procurement_posture}</td></tr>)}</tbody></table></div>
        </details>

        <div className="metric-grid">
          <MetricCard eyebrow="Policy + market events" value={formatNumber(analytics.data?.event_pressure.latest_30_days, 0)} detail={`${eventDelta >= 0 ? '+' : ''}${eventDelta} versus the prior 30-day window`} />
          <MetricCard eyebrow="Official policy records" value={formatNumber(analytics.data?.event_pressure.policy_events, 0)} detail="Federal Register semiconductor metadata retained" />
          <MetricCard eyebrow="DDR5 model history" value={`${analytics.data?.model_readiness.ddr5_monthly_points ?? 0} months`} detail={analytics.data?.model_readiness.baseline_models_ready ? 'Transparent baseline models are active' : 'Still below the baseline-model gate'} tone="accent" />
          <MetricCard eyebrow="Advanced ML gate" value={analytics.data?.model_readiness.advanced_ml_ready ? 'Ready' : `${analytics.data?.model_readiness.points_until_advanced_ml ?? 0} to go`} detail="60 comparable monthly observations required" />
        </div>

        <section className="section-block">
          <div className="section-heading"><div><p className="kicker">Explainable index</p><h2>What is moving the conclusion</h2></div><p>Contributions are reweighted only across components with comparable validated data.</p></div>
          <div className="driver-grid">
            {analytics.data?.components.map((component) => <article key={component.key} className={component.score == null ? 'driver-card driver-card--missing' : 'driver-card'}>
              <div><span>{component.label}</span><strong>{component.score == null ? 'Missing' : formatNumber(component.score, 1)}</strong></div>
              <i><b style={{ width: `${component.score ?? 0}%` }} /></i>
              <p>{component.transformation}</p>
              <small>{component.score == null ? 'Excluded from the current weighted score' : `${formatNumber(component.effective_weight * 100, 0)}% effective weight · ${formatNumber(component.weighted_contribution, 1)} points`}</small>
            </article>)}
          </div>
        </section>

        <section className="chart-card">
          <div className="section-heading analytics-chart-heading"><div><p className="kicker">Business context</p><h2>Official signals, normalized for direction</h2></div><p>Normalization supports directional comparison only; original units remain visible below.</p></div>
          <div className="signal-toggles" aria-label="Business signal visibility">
            {analytics.data?.macro_series.map((item) => <button type="button" aria-pressed={!hiddenSignals.has(item.series_id)} className={!hiddenSignals.has(item.series_id) ? 'active' : ''} onClick={() => toggleSignal(item.series_id)} key={item.series_id}>{item.name}</button>)}
          </div>
          {visibleSignals.length ? <BusinessSignalChart series={visibleSignals} /> : <div className="empty-state"><strong>Select at least one signal</strong></div>}
        </section>

        <section className="business-signal-grid">
          {analytics.data?.macro_series.map((item) => <article key={item.series_id}>
            <span>{item.source_id.replaceAll('_', ' ')}</span><h3>{item.name}</h3>
            <strong>{formatCompactNumber(item.latest.value)}</strong>
            <p>{item.change_percent == null ? 'No comparable prior observation' : `${item.change_percent >= 0 ? '+' : ''}${formatNumber(item.change_percent, 2)}% latest change`} · {item.unit}</p>
            <a href={item.source_url} target="_blank" rel="noreferrer">Latest observation {formatDate(item.latest.date)}</a>
          </article>)}
        </section>

        <section className="section-block">
          <div className="section-heading"><div><p className="kicker">Model governance</p><h2>Backtests before complexity</h2></div><p>{analytics.data?.model_readiness.explanation}</p></div>
          {analytics.data?.model_diagnostics.map((diagnostic) => <article className="model-diagnostic" key={diagnostic.series_id}>
            <header><div><span>{diagnostic.observations} observations</span><h3>{diagnostic.series_id}</h3></div><strong>{diagnostic.selected_model.replaceAll('_', ' ')}</strong></header>
            <div className="health-table-wrap"><table className="health-table"><thead><tr><th>Candidate</th><th>Rolling MAE</th><th>MAPE</th><th>Decision</th></tr></thead><tbody>{diagnostic.candidates.map((candidate) => <tr key={candidate.model}><td>{candidate.model.replaceAll('_', ' ')}</td><td>{formatNumber(candidate.mae, 3)}</td><td>{candidate.mape == null ? '—' : `${formatNumber(candidate.mape, 1)}%`}</td><td>{candidate.selected ? 'Selected' : 'Benchmark'}</td></tr>)}</tbody></table></div>
          </article>)}
        </section>

        <section className="watchlist-panel">
          <div><p className="kicker">Device-local watchlist</p><h2>Set decision thresholds</h2><p>Preferences stay in this browser. This static site does not transmit or email them.</p></div>
          <div className="watchlist-controls">
            <label>Pressure alert <span>{pressureThreshold}</span><input type="range" min="25" max="90" step="5" value={pressureThreshold} onChange={(event) => setPressureThreshold(Number(event.target.value))} /></label>
            <label>DDR5 move alert <span>{moveThreshold}%</span><input type="range" min="1" max="25" step="1" value={moveThreshold} onChange={(event) => setMoveThreshold(Number(event.target.value))} /></label>
          </div>
          <div className="watchlist-status"><span className={pressureAlert ? 'alert-on' : ''}>{pressureAlert ? 'Pressure threshold reached' : 'Pressure below threshold'}</span><span className={moveAlert ? 'alert-on' : ''}>{moveAlert ? 'DDR5 move threshold reached' : 'DDR5 move below threshold'}</span></div>
        </section>
      </DataBoundary>
    </>
  )
}
