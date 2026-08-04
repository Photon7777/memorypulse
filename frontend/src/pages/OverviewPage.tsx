import { DataBoundary } from '../components/DataBoundary'
import { HashLink } from '../components/HashLink'
import { MetricCard } from '../components/MetricCard'
import { ScoreDial } from '../components/ScoreDial'
import { useStaticData } from '../hooks/useStaticData'
import type { MarketSummary, NewsData, SourceHealthData } from '../types/data'
import { formatDate, formatNumber, freshnessLabel, missingDataMessage } from '../utils/format'

export function OverviewPage() {
  const summary = useStaticData<MarketSummary>('market-summary.json')
  const news = useStaticData<NewsData>('news.json')
  const health = useStaticData<SourceHealthData>('source-health.json')
  const loading = summary.loading || news.loading || health.loading
  const error = summary.error || news.error || health.error
  const index = summary.data?.latest_index ?? null
  const ddr4 = summary.data?.key_changes.ddr4_recent_change ?? null
  const ddr5 = summary.data?.key_changes.ddr5_recent_change ?? null
  const healthy = health.data?.sources.filter((source) => source.status === 'success').length ?? 0
  const sourceCount = health.data?.sources.length ?? 0
  const spread = summary.data?.key_changes.ddr5_minus_ddr4_spread ?? null

  return (
    <DataBoundary loading={loading} error={error}>
      <section className="overview-hero">
        <div className="overview-copy">
          <p className="kicker"><span className="live-pip" />Daily market monitoring · public data</p>
          <h1>Memory markets,<br /><em>read in context.</em></h1>
          <p className="hero-deck">
            A continuously updated view of memory pricing, supply signals, and the market context
            connecting AI infrastructure demand with consumer memory.
          </p>
          <div className="hero-actions">
            <HashLink className="button button--primary" to="/prices">Explore price trends</HashLink>
            <HashLink className="button button--quiet" to="/methodology">How the index works</HashLink>
          </div>
        </div>
        <aside className="index-panel" aria-label="Latest Memory Pressure Index">
          <div className="index-panel__head">
            <div><p className="eyebrow">Memory Pressure Index</p><p>Latest validated reading</p></div>
            <span className="method-badge">v{index?.methodology_version ?? '1.0.0'}</span>
          </div>
          <ScoreDial score={index?.total_score ?? null} status={index?.status_label ?? 'Collecting data'} confidence={summary.data?.confidence ?? 0} />
          <p className="index-disclaimer">{summary.data?.disclaimer}</p>
        </aside>
      </section>

      <section className="update-strip" aria-label="Data recency">
        <span><strong>Website build</strong>{formatDate(summary.data?.website_build, true)}</span>
        <span><strong>Pipeline run</strong>{formatDate(summary.data?.last_pipeline_run, true)}</span>
        <span><strong>Latest observation</strong>{formatDate(summary.data?.latest_observation)}</span>
        <span><strong>Source health</strong>{sourceCount ? `${healthy} of ${sourceCount} successful` : 'No runs yet'}</span>
      </section>

      <section className="section-block">
        <div className="section-heading">
          <div><p className="kicker">Signal board</p><h2>What the public data says now</h2></div>
          <p>Comparable measures stay separate. Gaps are shown, never guessed.</p>
        </div>
        <div className="metric-grid">
          <MetricCard eyebrow="DDR4 recent move" value={ddr4 == null ? '—' : `${ddr4 >= 0 ? '+' : ''}${formatNumber(ddr4)}%`} detail={ddr4 == null ? missingDataMessage('Comparable DDR4 history') : 'Latest comparable price-per-GB interval'} />
          <MetricCard eyebrow="DDR5 recent move" value={ddr5 == null ? '—' : `${ddr5 >= 0 ? '+' : ''}${formatNumber(ddr5)}%`} detail={ddr5 == null ? missingDataMessage('Comparable DDR5 history') : 'Latest comparable price-per-GB interval'} tone="accent" />
          <MetricCard eyebrow="DDR5–DDR4 spread" value={spread == null ? '—' : `${spread >= 0 ? '+' : ''}$${formatNumber(spread, 2)} / GB`} detail={spread == null ? 'No same-source, same-basis pair is currently available.' : 'Latest compatible Stanford generation series'} />
          <MetricCard eyebrow="Tracked events" value={formatNumber(news.data?.events.length ?? 0, 0)} detail={`Metadata retained for up to ${news.data?.retention_days ?? 365} days`} />
          <MetricCard eyebrow="Update freshness" value={freshnessLabel(summary.data?.last_successful_update)} detail={`Latest success: ${formatDate(summary.data?.last_successful_update, true)}`} />
          <MetricCard eyebrow="Source health" value={sourceCount ? `${healthy} / ${sourceCount}` : '—'} detail="Latest successful source states" />
        </div>
      </section>

      <section className="split-section">
        <article className="insight-panel">
          <p className="kicker">Deterministic readout</p>
          <h2>Key signals</h2>
          <ol className="insight-list">
            {(summary.data?.insights ?? []).map((insight, indexValue) => (
              <li key={insight}><span>{String(indexValue + 1).padStart(2, '0')}</span><p>{insight}</p></li>
            ))}
          </ol>
        </article>
        <article className="concept-card">
          <p className="kicker">Conceptual mechanism</p>
          <h2>From AI infrastructure to consumer memory</h2>
          <p>Demand for high-value HBM and server memory may coincide with manufacturing allocation decisions, conventional DRAM supply pressure, and changes in consumer pricing.</p>
          <p className="caveat">This is market context—not proof of causality.</p>
          <HashLink to="/context" className="text-link">Follow the evidence chain <span aria-hidden="true">→</span></HashLink>
        </article>
      </section>
    </DataBoundary>
  )
}
