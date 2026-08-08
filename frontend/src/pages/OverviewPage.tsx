import { useState } from 'react'
import { ForecastFanChart } from '../charts/AnalyticsCharts'
import { AnimatedMetric } from '../components/AnimatedMetric'
import { DataBoundary } from '../components/DataBoundary'
import { HashLink } from '../components/HashLink'
import { useStaticData } from '../hooks/useStaticData'
import type { DecisionBrief, ForecastData, MarketSummary, PricesData, SourceHealthData } from '../types/data'
import { formatDate, formatNumber } from '../utils/format'
import { buildLinkedInCopy, downloadInsightCard } from '../utils/share'

export function OverviewPage() {
  const summary = useStaticData<MarketSummary>('market-summary.json')
  const health = useStaticData<SourceHealthData>('source-health.json')
  const brief = useStaticData<DecisionBrief>('decision-brief.json')
  const prices = useStaticData<PricesData>('prices.json')
  const forecasts = useStaticData<ForecastData>('forecast.json')
  const [copied, setCopied] = useState(false)
  const loading = summary.loading || health.loading || brief.loading || prices.loading || forecasts.loading
  const error = summary.error || health.error || brief.error || prices.error || forecasts.error
  const coreSources = health.data?.sources.filter((source) => source.source_kind === 'core') ?? []
  const healthy = coreSources.filter((source) => source.status === 'success').length
  const ddr5Series = prices.data?.series.find((item) => item.generation === 'DDR5')
  const ddr5Forecasts = forecasts.data?.forecasts.filter((item) => item.series_id === ddr5Series?.label) ?? []
  const priceObservationCount = prices.data?.series.reduce((total, series) => total + series.points.length, 0) ?? 0

  async function copyLinkedIn() {
    if (!brief.data) return
    const shareUrl = `${window.location.origin}${window.location.pathname}#/`
    try {
      await navigator.clipboard.writeText(buildLinkedInCopy(brief.data, shareUrl))
      setCopied(true)
      window.setTimeout(() => setCopied(false), 1800)
    } catch {
      setCopied(false)
    }
  }

  return (
    <DataBoundary loading={loading} error={error}>
      <section className="executive-hero">
        <div className="executive-hero__copy">
          <p className="kicker"><span className="live-pip" />Memory-market intelligence · updated daily</p>
          <h1>Memory signals, turned into a clear decision.</h1>
          <p>Understand where DDR5 prices and market pressure may be heading—using public evidence, transparent forecasts, and an open dataset.</p>
          <div className="hero-actions">
            <HashLink className="button button--primary" to="/analytics">Explore the evidence</HashLink>
            <HashLink className="button button--quiet" to="/data">Get the open dataset</HashLink>
            <a className="button button--text" href="https://github.com/Photon7777/memorypulse" target="_blank" rel="noreferrer">View the build on GitHub ↗</a>
          </div>
          <div className="hero-proof" aria-label="MemoryPulse product attributes"><span>Public evidence</span><span>Explainable models</span><span>Free open data</span></div>
        </div>
        <aside className="decision-card" aria-label="Latest business conclusion">
          <div className="decision-card__meta"><span>Latest conclusion</span><time>{formatDate(brief.data?.generated_at, true)}</time></div>
          <div className="decision-card__status"><i />{brief.data?.regime} · {brief.data?.direction}</div>
          <h2>{brief.data?.headline}</h2>
          <p>{brief.data?.conclusion}</p>
          <dl>
            <div><dt>Procurement</dt><dd>{brief.data?.recommended_posture.procurement}</dd></div>
            <div><dt>Inventory</dt><dd>{brief.data?.recommended_posture.inventory}</dd></div>
            <div><dt>Budget risk</dt><dd>{brief.data?.recommended_posture.budget_risk}</dd></div>
          </dl>
        </aside>
      </section>

      <section className="executive-kpis" aria-label="Latest key indicators">
        <article><span>Market pressure</span><strong><AnimatedMetric value={brief.data?.pressure_score} decimals={1} /></strong><p>0–100 analytical index</p></article>
        <article><span>Recent DDR5 move</span><strong><AnimatedMetric value={brief.data?.ddr5.recent_change_percent} decimals={1} prefix={(brief.data?.ddr5.recent_change_percent ?? 0) >= 0 ? '+' : ''} suffix="%" /></strong><p>latest comparable period</p></article>
        <article><span>Next forecast</span><strong><AnimatedMetric value={brief.data?.ddr5.forecast_change_percent} decimals={1} prefix={(brief.data?.ddr5.forecast_change_percent ?? 0) >= 0 ? '+' : ''} suffix="%" /></strong><p>model-implied change</p></article>
        <article><span>Source health</span><strong>{healthy}/{coreSources.length}</strong><p>core feeds healthy</p></article>
      </section>

      <section className="credibility-strip" aria-label="Project credibility">
        <span><strong>{formatNumber(priceObservationCount, 0)}</strong> chart-ready price points</span>
        <span><strong>{coreSources.length}</strong> automated public feeds</span>
        <span><strong>Daily</strong> validated refresh</span>
        <span><strong>CSV + Parquet</strong> reusable downloads</span>
      </section>

      <section className="executive-analysis">
        <article className="chart-card executive-primary-chart">
          <div className="section-heading compact-heading"><div><p className="kicker">Primary market view</p><h2>Where DDR5 may move next</h2></div><p>Observed history, the current baseline forecast, and its uncertainty range.</p></div>
          <ForecastFanChart history={ddr5Series} forecasts={ddr5Forecasts} />
          <p className="chart-summary">{ddr5Series?.source_label} · {ddr5Series?.points.length ?? 0} genuine observations · {ddr5Series?.basis}</p>
        </article>
        <aside className="executive-drivers">
          <div><p className="kicker">Why this conclusion</p><h2>What is moving the signal</h2></div>
          {brief.data?.drivers.map((driver, index) => <article key={driver.key}>
            <span>{String(index + 1).padStart(2, '0')}</span>
            <div><strong>{driver.label}</strong><p>{driver.effect} signal</p></div>
            <b>{formatNumber(driver.score, 1)}</b>
          </article>)}
          <HashLink className="text-link" to="/analytics">See every contribution and trend <span aria-hidden="true">→</span></HashLink>
        </aside>
      </section>

      <section className="share-insight">
        <div><p className="kicker">Share the research</p><h2>Turn the latest run into a credible update.</h2><p>Copy a concise evidence-based summary or download a polished 1200×630 insight card.</p></div>
        <div className="share-insight__actions">
          <button type="button" className="button button--primary" onClick={() => void copyLinkedIn()} disabled={!brief.data}>{copied ? 'LinkedIn copy ready' : 'Copy LinkedIn summary'}</button>
          <button type="button" className="button button--quiet" onClick={() => brief.data && downloadInsightCard(brief.data)} disabled={!brief.data}>Download insight card</button>
        </div>
      </section>

      <details className="executive-details disclosure-card">
        <summary><span>Evidence notes</span><small>Risks, freshness, and method</small></summary>
        <div className="executive-details__grid">
          <section><h3>Known risks</h3><ul>{brief.data?.risks.map((risk) => <li key={risk}>{risk}</li>)}</ul></section>
          <section><h3>Update record</h3><dl><div><dt>Latest observation</dt><dd>{formatDate(summary.data?.latest_observation)}</dd></div><div><dt>Pipeline run</dt><dd>{formatDate(summary.data?.last_pipeline_run, true)}</dd></div><div><dt>Confidence</dt><dd>{brief.data?.confidence} · {formatNumber((brief.data?.confidence_score ?? 0) * 100, 0)}% coverage</dd></div></dl></section>
          <section><h3>Method</h3><p>{brief.data?.method}</p><HashLink className="text-link" to="/methodology">Read the methodology <span aria-hidden="true">→</span></HashLink></section>
        </div>
      </details>
      <p className="page-disclaimer">{brief.data?.disclaimer}</p>
    </DataBoundary>
  )
}
