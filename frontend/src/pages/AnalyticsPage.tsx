import { useMemo, useState } from 'react'
import {
  ContributionChart,
  EventPriceChart,
  ForecastFanChart,
  MomentumMatrixChart,
  PressureHistoryChart,
} from '../charts/AnalyticsCharts'
import { BusinessSignalChart } from '../charts/BusinessSignalChart'
import { DataBoundary } from '../components/DataBoundary'
import { HashLink } from '../components/HashLink'
import { MetricCard } from '../components/MetricCard'
import { PageIntro } from '../components/PageIntro'
import { useStaticData } from '../hooks/useStaticData'
import type { AnalyticsData, DecisionBrief, ForecastData, NewsData, PricesData } from '../types/data'
import { formatCompactNumber, formatDate, formatNumber } from '../utils/format'

type AnalyticsTab = 'market' | 'drivers' | 'forecast' | 'business'

function componentTakeaway(score: number | null): string {
  if (score == null) return 'Unavailable and excluded from the current score.'
  if (score >= 55) return 'Currently adds tightening pressure.'
  if (score <= 45) return 'Currently contributes an easing signal.'
  return 'Currently near the center of its historical range.'
}

const tabs: Array<{ id: AnalyticsTab; label: string; description: string }> = [
  { id: 'market', label: 'Market trends', description: 'Momentum and event context' },
  { id: 'drivers', label: 'Pressure drivers', description: 'Index history and contributions' },
  { id: 'forecast', label: 'Forecast & models', description: 'Ranges, errors, and readiness' },
  { id: 'business', label: 'Business context', description: 'Official macro signals' },
]

export function AnalyticsPage() {
  const analytics = useStaticData<AnalyticsData>('analytics.json')
  const brief = useStaticData<DecisionBrief>('decision-brief.json')
  const prices = useStaticData<PricesData>('prices.json')
  const forecasts = useStaticData<ForecastData>('forecast.json')
  const news = useStaticData<NewsData>('news.json')
  const [activeTab, setActiveTab] = useState<AnalyticsTab>('market')
  const [hiddenSignals, setHiddenSignals] = useState<Set<string>>(() => new Set())
  const ddr5Series = prices.data?.series.find((item) => item.generation === 'DDR5')
  const ddr5Forecasts = forecasts.data?.forecasts.filter((item) => item.series_id === ddr5Series?.label) ?? []
  const visibleSignals = useMemo(
    () => analytics.data?.macro_series.filter((item) => !hiddenSignals.has(item.series_id)) ?? [],
    [analytics.data, hiddenSignals],
  )
  const loading = analytics.loading || brief.loading || prices.loading || forecasts.loading || news.loading
  const error = analytics.error || brief.error || prices.error || forecasts.error || news.error
  const momentumLeader = analytics.data?.momentum_matrix.reduce<AnalyticsData['momentum_matrix'][number] | null>((leader, item) => !leader || Math.abs(item.change_percent) > Math.abs(leader.change_percent) ? item : leader, null)
  const contributionLeader = analytics.data?.components.reduce<AnalyticsData['components'][number] | null>((leader, item) => item.weighted_contribution != null && (!leader || (leader.weighted_contribution ?? -Infinity) < item.weighted_contribution) ? item : leader, null)
  const pressureHistory = analytics.data?.pressure_history ?? []
  const pressureChange = pressureHistory.length > 1 ? pressureHistory.at(-1)!.total_score - pressureHistory[0].total_score : 0
  const eventChange = (analytics.data?.event_pressure.latest_30_days ?? 0) - (analytics.data?.event_pressure.prior_30_days ?? 0)
  const risingBusinessSignals = analytics.data?.macro_series.filter((item) => (item.change_percent ?? 0) > 0).length ?? 0

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
      <PageIntro kicker="Market analytics" title="Market trends, pressure drivers, and forecasts" description="Review price momentum, index components, forecast ranges, and official business indicators. Each view keeps its original units and source definition." />
      <DataBoundary loading={loading} error={error}>
        <section className="analytics-summary">
          <div><span className="decision-card__status"><i />Current market read · {brief.data?.regime}</span><h2>{brief.data?.headline}</h2><p>{brief.data?.conclusion}</p></div>
          <dl><div><dt>Pressure</dt><dd>{formatNumber(brief.data?.pressure_score, 1)}</dd></div><div><dt>Confidence</dt><dd>{brief.data?.confidence}</dd></div><div><dt>Latest run</dt><dd>{formatDate(brief.data?.generated_at, true)}</dd></div></dl>
        </section>

        <nav className="analytics-tabs" aria-label="Analytics views">
          {tabs.map((tab) => <button key={tab.id} type="button" className={activeTab === tab.id ? 'active' : ''} aria-selected={activeTab === tab.id} role="tab" onClick={() => setActiveTab(tab.id)}><strong>{tab.label}</strong><span>{tab.description}</span></button>)}
        </nav>

        <div className="analytics-pane" role="tabpanel">
          {activeTab === 'market' && <>
            <div className="metric-grid metric-grid--three analytics-kpis">
              <MetricCard eyebrow="DDR5 latest move" value={brief.data?.ddr5.recent_change_percent == null ? 'n/a' : `${brief.data.ddr5.recent_change_percent >= 0 ? '+' : ''}${formatNumber(brief.data.ddr5.recent_change_percent, 1)}%`} detail={`${ddr5Series?.points.length ?? 0} public observations`} tone="accent" />
              <MetricCard eyebrow="Recent event volume" value={formatNumber(analytics.data?.event_pressure.latest_30_days, 0)} detail={`${eventChange >= 0 ? '+' : ''}${eventChange} versus prior 30 days`} />
              <MetricCard eyebrow="Policy records" value={formatNumber(analytics.data?.event_pressure.policy_events, 0)} detail="Official Federal Register metadata" />
            </div>
            <section className="analytics-chart-grid">
              <article className="chart-card"><div className="chart-title"><div><p className="kicker">Momentum matrix</p><h2>Memory-generation momentum</h2></div><p>Changes are calculated separately for each source-defined series.</p></div><MomentumMatrixChart cells={analytics.data?.momentum_matrix ?? []} /><p className="chart-takeaway"><span>Analyst note</span>{momentumLeader ? `${momentumLeader.generation} has the largest visible move: ${momentumLeader.change_percent >= 0 ? '+' : ''}${formatNumber(momentumLeader.change_percent, 1)}% over ${momentumLeader.horizon_months} months.` : 'More comparable history is needed before identifying a momentum leader.'}</p></article>
              <article className="chart-card"><div className="chart-title"><div><p className="kicker">Event context</p><h2>DDR5 prices and event volume</h2></div><p>Event counts provide context. They do not establish causation.</p></div><EventPriceChart price={ddr5Series} news={news.data} /><p className="chart-takeaway"><span>Analyst note</span>Relevant public-event volume is {Math.abs(eventChange)} {eventChange >= 0 ? 'higher' : 'lower'} than the prior 30-day period. Compare the timing with price movement before drawing a conclusion.</p></article>
            </section>
            <div className="analytics-next"><HashLink className="text-link" to="/prices">Open the full source-level price explorer <span aria-hidden="true">→</span></HashLink><HashLink className="text-link" to="/events">Search every retained event <span aria-hidden="true">→</span></HashLink></div>
          </>}

          {activeTab === 'drivers' && <>
            <section className="analytics-chart-grid analytics-chart-grid--wide-first">
              <article className="chart-card"><div className="chart-title"><div><p className="kicker">Across runs</p><h2>Pressure and evidence coverage</h2></div><p>Score history is shown with the share of configured evidence represented.</p></div><PressureHistoryChart history={pressureHistory} /><p className="chart-takeaway"><span>Analyst note</span>Pressure is {Math.abs(pressureChange) < .05 ? 'unchanged' : `${formatNumber(Math.abs(pressureChange), 1)} points ${pressureChange > 0 ? 'higher' : 'lower'}`} across the visible run history. Current evidence coverage is {formatNumber((pressureHistory.at(-1)?.confidence_score ?? 0) * 100, 0)}%.</p></article>
              <article className="chart-card"><div className="chart-title"><div><p className="kicker">Latest run</p><h2>Current score contributions</h2></div><p>Missing components are excluded from the calculation.</p></div><ContributionChart components={analytics.data?.components ?? []} /><p className="chart-takeaway"><span>Analyst note</span>{contributionLeader ? `${contributionLeader.label} is the largest current contributor at ${formatNumber(contributionLeader.weighted_contribution, 1)} index points.` : 'No pressure component has enough evidence to contribute yet.'}</p></article>
            </section>
            <section className="component-ledger">
              {analytics.data?.components.map((component) => <article key={component.key} className={component.score == null ? 'missing' : ''}><header><span>{component.label}</span><strong>{component.score == null ? 'Missing' : formatNumber(component.score, 1)}</strong></header><p>{componentTakeaway(component.score)}</p><small>{component.score == null ? 'Excluded from this run' : `${formatNumber(component.effective_weight * 100, 0)}% effective weight · ${formatNumber(component.weighted_contribution, 1)} points`}</small></article>)}
            </section>
          </>}

          {activeTab === 'forecast' && <>
            <section className="chart-card"><div className="chart-title"><div><p className="kicker">Forecast range</p><h2>DDR5 short-term forecast</h2></div><p>The interval widens with the forecast horizon.</p></div><ForecastFanChart history={ddr5Series} forecasts={ddr5Forecasts} /><p className="chart-takeaway"><span>Analyst note</span>The next baseline forecast implies {brief.data?.ddr5.forecast_change_percent == null ? 'no publishable directional signal yet' : `${Math.abs(brief.data.ddr5.forecast_change_percent) < .05 ? 'a broadly flat result' : `${formatNumber(Math.abs(brief.data.ddr5.forecast_change_percent), 1)}% ${brief.data.ddr5.forecast_change_percent > 0 ? 'upside' : 'downside'}`}`}. Use the full interval when evaluating the estimate.</p></section>
            <section className="model-readiness-band">
              <div><p className="kicker">Model governance</p><h2>{analytics.data?.model_readiness.advanced_ml_ready ? 'Advanced model gate reached' : `${analytics.data?.model_readiness.points_until_advanced_ml ?? 0} monthly observations to advanced ML`}</h2><p>{analytics.data?.model_readiness.explanation}</p></div>
              <div className="readiness-meter"><i><b style={{ width: `${Math.min(100, ((analytics.data?.model_readiness.ddr5_monthly_points ?? 0) / 48) * 100)}%` }} /></i><span>{analytics.data?.model_readiness.ddr5_monthly_points ?? 0} / 48 comparable months</span></div>
              <HashLink className="button button--quiet" to="/forecasts">Open model diagnostics</HashLink>
            </section>
            <section className="model-summary-grid">{analytics.data?.model_diagnostics.map((item) => <article key={item.series_id}><span>{item.observations} observations</span><h3>{item.series_id}</h3><strong>{item.selected_model.replaceAll('_', ' ')}</strong><p>Lowest rolling-origin MAE among {item.candidates.length} transparent candidates.</p></article>)}</section>
          </>}

          {activeTab === 'business' && <>
            <section className="chart-card"><div className="chart-title"><div><p className="kicker">Official context</p><h2>Official business indicators</h2></div><p>Each visible series starts at 100 while its original values remain separate.</p></div><div className="signal-toggles">{analytics.data?.macro_series.map((item) => <button type="button" aria-pressed={!hiddenSignals.has(item.series_id)} className={!hiddenSignals.has(item.series_id) ? 'active' : ''} onClick={() => toggleSignal(item.series_id)} key={item.series_id}>{item.name}</button>)}</div>{visibleSignals.length ? <BusinessSignalChart series={visibleSignals} /> : <div className="empty-state"><strong>Select at least one official signal</strong></div>}<p className="chart-takeaway"><span>Analyst note</span>{risingBusinessSignals} of {analytics.data?.macro_series.length ?? 0} official context signals increased in their latest comparable period. They are context indicators and are not combined into a common unit.</p></section>
            <section className="business-signal-grid">{analytics.data?.macro_series.map((item) => <article key={item.series_id}><span>{item.source_id.replaceAll('_', ' ')}</span><h3>{item.name}</h3><strong>{formatCompactNumber(item.latest.value)}</strong><p>{item.change_percent == null ? 'No comparable prior observation' : `${item.change_percent >= 0 ? '+' : ''}${formatNumber(item.change_percent, 2)}% latest change`} · {item.unit}</p><a href={item.source_url} target="_blank" rel="noreferrer">Observation {formatDate(item.latest.date)}</a></article>)}</section>
          </>}
        </div>

        <details className="decision-history compact-details disclosure-card"><summary><span>How the conclusion changed</span><small>{brief.data?.history.length ?? 0} recorded runs</small></summary><div className="health-table-wrap"><table className="health-table"><thead><tr><th>Run</th><th>Regime</th><th>Direction</th><th>Pressure</th><th>Confidence</th><th>Posture</th></tr></thead><tbody>{brief.data?.history.slice(0, 20).map((item) => <tr key={item.brief_id}><td>{formatDate(item.generated_at, true)}</td><td>{item.regime}</td><td>{item.direction}</td><td>{formatNumber(item.pressure_score, 1)}</td><td>{item.confidence}</td><td>{item.procurement_posture}</td></tr>)}</tbody></table></div></details>
      </DataBoundary>
    </>
  )
}
