import { DataBoundary } from '../components/DataBoundary'
import { HashLink } from '../components/HashLink'
import { MetricCard } from '../components/MetricCard'
import { useStaticData } from '../hooks/useStaticData'
import type { DecisionBrief, MarketSummary, NewsData, SourceHealthData } from '../types/data'
import { formatDate, formatNumber, freshnessLabel, missingDataMessage } from '../utils/format'

export function OverviewPage() {
  const summary = useStaticData<MarketSummary>('market-summary.json')
  const news = useStaticData<NewsData>('news.json')
  const health = useStaticData<SourceHealthData>('source-health.json')
  const brief = useStaticData<DecisionBrief>('decision-brief.json')
  const loading = summary.loading || news.loading || health.loading || brief.loading
  const error = summary.error || news.error || health.error || brief.error
  const index = summary.data?.latest_index ?? null
  const ddr4 = summary.data?.key_changes.ddr4_recent_change ?? null
  const ddr5 = summary.data?.key_changes.ddr5_recent_change ?? null
  const coreSources = health.data?.sources.filter((source) => source.source_kind === 'core') ?? []
  const healthy = coreSources.filter((source) => source.status === 'success').length
  const sourceCount = coreSources.length
  const spread = summary.data?.key_changes.ddr5_minus_ddr4_spread ?? null

  return (
    <DataBoundary loading={loading} error={error}>
      <section className="overview-hero">
        <div className="overview-copy">
          <p className="kicker"><span className="live-pip" />Executive memory intelligence · refreshed daily</p>
          <h1>Memory decisions,<br /><em>grounded in evidence.</em></h1>
          <p className="hero-deck">
            A continuously updated operating view of memory pricing, supply pressure, public policy,
            and the evidence behind a clear procurement and inventory posture.
          </p>
          <div className="hero-actions">
            <HashLink className="button button--primary" to="/analytics">Inspect decision analytics</HashLink>
            <HashLink className="button button--quiet" to="/prices">Compare price trends</HashLink>
          </div>
        </div>
        <aside className="executive-decision-panel" aria-label="Latest executive conclusion">
          <div className="index-panel__head"><div><p className="eyebrow">Run conclusion</p><p>{formatDate(brief.data?.generated_at, true)}</p></div><span className="method-badge">{brief.data?.confidence ?? '—'} confidence</span></div>
          <span className="decision-regime"><i />{brief.data?.regime ?? 'Collecting'}</span>
          <h2>{brief.data?.headline ?? 'Building the first decision brief'}</h2>
          <p>{brief.data?.conclusion}</p>
          <dl><div><dt>Procurement</dt><dd>{brief.data?.recommended_posture.procurement}</dd></div><div><dt>Inventory</dt><dd>{brief.data?.recommended_posture.inventory}</dd></div><div><dt>Budget risk</dt><dd>{brief.data?.recommended_posture.budget_risk}</dd></div></dl>
          <HashLink className="text-link" to="/analytics">See the evidence and model gates <span aria-hidden="true">→</span></HashLink>
        </aside>
      </section>

      <section className="run-conclusion" aria-label="Latest run decision detail">
        <div className="run-conclusion__copy"><p className="kicker">What changed this run</p><h2>One conclusion, with traceable inputs</h2><p>{brief.data?.method}</p></div>
        <div className="change-grid">{brief.data?.changes.map((change) => <article key={change.label}><span>{change.label}</span><strong>{change.value == null ? '—' : `${change.value >= 0 ? '+' : ''}${formatNumber(change.value, 2)}${change.unit === '%' ? '%' : ''}`}</strong><small>{change.unit}</small></article>)}</div>
        <div className="brief-driver-list">{brief.data?.drivers.map((driver, driverIndex) => <article key={driver.key}><span>{String(driverIndex + 1).padStart(2, '0')}</span><div><strong>{driver.label}</strong><p>{driver.effect} signal · score {formatNumber(driver.score, 1)}</p></div></article>)}</div>
      </section>

      <section className="update-strip" aria-label="Data recency">
        <span><strong>Website build</strong>{formatDate(summary.data?.website_build, true)}</span>
        <span><strong>Pipeline run</strong>{formatDate(summary.data?.last_pipeline_run, true)}</span>
        <span><strong>Latest observation</strong>{formatDate(summary.data?.latest_observation)}</span>
        <span><strong>Core source health</strong>{sourceCount ? `${healthy} of ${sourceCount} successful` : 'No runs yet'}</span>
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
          <MetricCard eyebrow="Core source health" value={sourceCount ? `${healthy} / ${sourceCount}` : '—'} detail="Optional and permission-gated feeds are reported separately" />
          <MetricCard eyebrow="Pressure score" value={index == null ? '—' : formatNumber(index.total_score, 1)} detail={`${index?.status_label ?? 'Collecting'} · ${Math.round((summary.data?.confidence ?? 0) * 100)}% data confidence`} />
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
