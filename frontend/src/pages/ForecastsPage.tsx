import { useState } from 'react'
import { ForecastFanChart, StructuralForecastChart } from '../charts/AnalyticsCharts'
import { DataBoundary } from '../components/DataBoundary'
import { MetricCard } from '../components/MetricCard'
import { PageIntro } from '../components/PageIntro'
import { useStaticData } from '../hooks/useStaticData'
import type { AnalyticsData, ForecastData, PricesData } from '../types/data'
import { formatDate, formatNumber } from '../utils/format'

const SERIES_PRIORITY = ['DDR5', 'HBM', 'DDR4', 'NAND', 'DDR3']

function seriesPriority(series: string): number {
  const index = SERIES_PRIORITY.findIndex((generation) => series.toUpperCase().startsWith(generation))
  return index === -1 ? SERIES_PRIORITY.length : index
}

export function ForecastsPage() {
  const state = useStaticData<ForecastData>('forecast.json')
  const prices = useStaticData<PricesData>('prices.json')
  const analytics = useStaticData<AnalyticsData>('analytics.json')
  const series = [...new Set(state.data?.forecasts.map((forecast) => forecast.series_id) ?? [])]
    .sort((left, right) => seriesPriority(left) - seriesPriority(right) || left.localeCompare(right))
  const [selected, setSelected] = useState<string>('')
  const [selectedTarget, setSelectedTarget] = useState<string>('')
  const activeSeries = selected || series[0] || ''
  const seriesForecasts = state.data?.forecasts.filter((item) => item.series_id === activeSeries) ?? []
  const latestVintage = seriesForecasts.reduce(
    (latest, item) => item.forecast_created_at > latest ? item.forecast_created_at : latest,
    '',
  )
  const activeForecasts = seriesForecasts.filter((item) => item.forecast_created_at === latestVintage)
  const forecast = activeForecasts.find((item) => item.target_date === selectedTarget) ?? activeForecasts[0]
  const history = prices.data?.series.find((item) => item.label === activeSeries)
  const diagnostic = analytics.data?.model_diagnostics.find((item) => item.series_id === activeSeries)
  const latestActual = history?.points.at(-1)?.value
  const forecastChange = latestActual && forecast ? ((forecast.point_forecast / latestActual) - 1) * 100 : null
  const outlooks = state.data?.industry_outlooks ?? []
  const combinedOutlook = outlooks.find((item) => item.metric === 'combined_component_price_change')
  const pcOutlook = outlooks.find((item) => item.segment === 'Personal computers')
  const smartphoneOutlook = outlooks.find((item) => item.segment === 'Smartphones')
  const dramOutlook = outlooks.find((item) => item.segment === 'DRAM')
  const nandOutlook = outlooks.find((item) => item.segment === 'NAND Flash')
  const hbmOutlook = outlooks.find((item) => item.segment === 'HBM')
  const flatBaseline = forecast?.model_name === 'naive_last_value'
  const latestStructuralVintage = (state.data?.structural_forecasts ?? []).reduce(
    (latest, item) => item.forecast_created_at > latest ? item.forecast_created_at : latest,
    '',
  )
  const structural = (state.data?.structural_forecasts ?? []).filter((item) => item.forecast_created_at === latestStructuralVintage)
  const structuralBase = structural.filter((item) => item.scenario === 'base').sort((left, right) => left.target_date.localeCompare(right.target_date))
  const structuralEnd = structuralBase.at(-1)
  const evidence = state.data?.evidence_readiness

  function horizonLabel(target: string): string {
    if (!history?.points.length) return formatDate(target)
    const latest = new Date(history.points[history.points.length - 1].date)
    const date = new Date(target)
    const months = Math.max(1, (date.getUTCFullYear() - latest.getUTCFullYear()) * 12 + date.getUTCMonth() - latest.getUTCMonth())
    return `${months}M`
  }
  return (
    <>
      <PageIntro kicker="Two horizons · one honest view" title="The market outlook is upward. The short-term model remains cautious." description="Expert research describes the structural 2026–2027 market direction; observed-series models answer a narrower 1–6 month question. MemoryPulse keeps those evidence types separate instead of forcing one to imitate the other." />
      <DataBoundary loading={state.loading || prices.loading || analytics.loading} error={state.error || prices.error || analytics.error}>
        <section className="industry-outlook-hero">
          <div className="industry-outlook-hero__copy">
            <p className="kicker">Structural industry outlook · through 2027</p>
            <span className="outlook-direction"><i />Upward DRAM pressure</span>
            <h2>DRAM is not expected to flatline.</h2>
            <p>{dramOutlook?.summary ?? 'The latest sourced industry outlook has not been loaded.'} {nandOutlook ? `NAND is different: ${nandOutlook.summary.toLowerCase()}` : ''}</p>
            <div className="outlook-source-links">
              {dramOutlook && <a href={dramOutlook.source_url} target="_blank" rel="noreferrer">TrendForce DRAM outlook ↗</a>}
              {combinedOutlook && <a href={combinedOutlook.source_url} target="_blank" rel="noreferrer">Gartner device-cost outlook ↗</a>}
            </div>
          </div>
          <div className="outlook-index-visual" role="img" aria-label="Gartner expert estimate showing a combined DRAM and SSD price index rising from 100 in 2025 to 230 by the end of 2026">
            <header><span>Expert component-cost index</span><b>2025 = 100</b></header>
            <div><label>2025 baseline</label><i><b style={{ width: '43.5%' }} /></i><strong>100</strong></div>
            <div><label>End-2026 estimate</label><i><b style={{ width: '100%' }} /></i><strong>{combinedOutlook?.central_estimate == null ? 'n/a' : formatNumber(100 + combinedOutlook.central_estimate, 0)}</strong></div>
            <small>Gartner combined DRAM + SSD estimate. This is not a DDR5 $/GB series forecast.</small>
          </div>
        </section>

        <section className="outlook-evidence-grid" aria-label="Industry outlook evidence">
          <article><span>DRAM · 2027</span><strong>↑ Upward</strong><p>{dramOutlook?.summary}</p><small>Published {formatDate(dramOutlook?.published_at)} · {dramOutlook?.source_label}</small></article>
          <article><span>HBM · 2027</span><strong>↑ Pricing power</strong><p>{hbmOutlook?.summary}</p><small>Published {formatDate(hbmOutlook?.published_at)} · {hbmOutlook?.source_label}</small></article>
          <article className="outlook-evidence-grid__mixed"><span>NAND · 2H27</span><strong>↘ Easing later</strong><p>{nandOutlook?.summary}</p><small>Published {formatDate(nandOutlook?.published_at)} · {nandOutlook?.source_label}</small></article>
          <article><span>Finished devices · 2026</span><strong>PC +{formatNumber(pcOutlook?.central_estimate, 0)}% · Phone +{formatNumber(smartphoneOutlook?.central_estimate, 0)}%</strong><p>Gartner’s estimated retail-price effects from higher memory costs versus 2025.</p><small>Published {formatDate(pcOutlook?.published_at)} · Gartner</small></article>
        </section>

        {evidence ? <section className="forecast-evidence-readiness" aria-label="DDR5 evidence readiness">
          <div className="forecast-evidence-readiness__intro">
            <div><p className="kicker">Evidence readiness · independently scored</p><h2>{evidence.label}</h2><p>{evidence.explanation}</p></div>
            <div className="evidence-score"><span>Evidence score</span><strong>{formatNumber(evidence.score, 1)}</strong><small>/ 100</small></div>
          </div>
          <div className="evidence-readiness-grid">
            {[
              ['Comparable DDR5 history', evidence.ddr5_months, evidence.thresholds.ddr5_months, 'monthly observations'],
              ['Independent direct sources', evidence.direct_sources, evidence.thresholds.direct_sources, 'price sources'],
              ['Stable retail panel', evidence.retail_products, evidence.thresholds.retail_products, 'products'],
              ['Official driver families', evidence.driver_family_count, evidence.thresholds.driver_families, 'driver groups'],
            ].map(([label, value, target, unit]) => <article key={String(label)}>
              <span>{label}</span><strong>{value}<small> / {target}</small></strong>
              <i><b style={{ width: `${Math.min(100, Number(value) / Number(target) * 100)}%` }} /></i>
              <p>{unit}</p>
            </article>)}
          </div>
          {evidence.blockers.length ? <div className="evidence-blockers"><strong>What still blocks a governed long-range statistical model</strong><ul>{evidence.blockers.map((item) => <li key={item}>{item}</li>)}</ul></div> : <div className="evidence-blockers evidence-blockers--ready"><strong>Long-range statistical model gate passed</strong><p>The next run can compare multivariate candidates against the scenario baseline.</p></div>}
        </section> : null}

        {structural.length ? <section className="structural-forecast-section">
          <div className="section-heading"><div><p className="kicker">Market-informed model · 12–24 months</p><h2>A longer path built from drivers—not a repeated last value.</h2></div><p>The structural model combines clipped DDR5 momentum, official semiconductor producer prices, and attributed research. It publishes easing, base, and tight-supply cases so uncertainty remains visible.</p></div>
          <article className="chart-card structural-forecast-card">
            <div className="structural-forecast-card__summary">
              <div><span>24-month base case</span><strong>{structuralEnd ? `${structuralEnd.change_from_baseline_percent >= 0 ? '+' : ''}${formatNumber(structuralEnd.change_from_baseline_percent, 1)}%` : 'n/a'}</strong><small>versus the latest observed DDR5 value</small></div>
              <div><span>Direction</span><strong>{structuralEnd?.direction ?? 'n/a'}</strong><small>{structuralEnd?.confidence ?? 'low'} confidence · scenario model</small></div>
              <div><span>Conclusion</span><p>{structuralEnd?.direction === 'upward' ? 'The base case points upward, while the easing case preserves a credible reversal path.' : 'The structural evidence does not currently support a rising base case.'}</p></div>
            </div>
            <StructuralForecastChart history={prices.data?.series.find((item) => item.generation === 'DDR5')} forecasts={structural} />
            <p className="chart-takeaway"><strong>Driver readout</strong>{structuralEnd?.driver_summary}</p>
            <p className="chart-summary">{structuralEnd?.basis}</p>
          </article>
        </section> : null}

        <div className="forecast-scope-divider"><span>Observed-series model · 1–6 months</span><div><h2>Now zoom into a specific public price series.</h2><p>This model is descriptive and backtested. A flat midpoint means no trend model beat the naive baseline on that series—not that industry experts expect the whole market to remain flat.</p></div></div>
        {forecast ? (
          <>
            <div className="forecast-toolbar"><label>Series<select value={activeSeries} onChange={(event) => { setSelected(event.target.value); setSelectedTarget('') }}>{series.map((item) => <option key={item}>{item}</option>)}</select></label><div className="forecast-horizons" aria-label="Forecast horizon">{activeForecasts.map((item) => <button type="button" className={item.target_date === forecast.target_date ? 'active' : ''} aria-pressed={item.target_date === forecast.target_date} onClick={() => setSelectedTarget(item.target_date)} key={item.target_date}>{horizonLabel(item.target_date)}</button>)}</div><span>Created {formatDate(forecast.forecast_created_at, true)}</span></div>
            <section className="chart-card forecast-history"><div className="section-heading"><div><p className="kicker">Selected short-horizon forecast · {formatDate(forecast.target_date)}</p><h2>{formatNumber(forecast.point_forecast, 3)} <small>source-defined units</small></h2></div><p>95% interval {formatNumber(forecast.lower_bound, 3)}–{formatNumber(forecast.upper_bound, 3)}. The chart uses the latest complete forecast vintage.</p></div><ForecastFanChart history={history} forecasts={activeForecasts} /><p className="chart-takeaway"><strong>Takeaway</strong>{flatBaseline ? `The midpoint stays flat because no trend model beat the naive baseline for ${activeSeries}. This is a local statistical baseline—not the 2026–2027 industry outlook shown above.` : forecastChange == null ? 'The model has published a direction, but no comparable latest value is available for a percentage change.' : `The selected estimate is ${Math.abs(forecastChange).toFixed(1)}% ${forecastChange >= 0 ? 'above' : 'below'} the latest observed value. Treat the full interval—not only the midpoint—as the decision range.`}</p>{history && <p className="chart-summary">{history.source_label} · {history.basis}</p>}</section>
            <div className="metric-grid metric-grid--three">
              <MetricCard eyebrow="Selected short-horizon model" value={forecast.model_name.replaceAll('_', ' ')} detail={`${flatBaseline ? 'No upward model earned selection' : 'Beat the governed baseline'} · v${forecast.model_version}`} />
              <MetricCard eyebrow="Backtest MAE" value={formatNumber(forecast.backtest_mae, 3)} detail={forecast.backtest_mape == null ? 'MAPE unavailable where actual values are zero' : `MAPE ${formatNumber(forecast.backtest_mape, 1)}%`} tone="accent" />
              <MetricCard eyebrow="Training window" value={`${forecast.observations_used} points`} detail={`${formatDate(forecast.training_start)} to ${formatDate(forecast.training_end)}`} />
            </div>
            {diagnostic ? <section className="section-block"><div className="section-heading"><div><p className="kicker">Candidate comparison</p><h2>Why this model won</h2></div><p>{diagnostic.selection_rule}</p></div><div className="model-candidate-grid">{diagnostic.candidates.map((candidate) => <article className={candidate.selected ? 'selected' : ''} key={candidate.model}><span>{candidate.selected ? 'Selected' : 'Candidate'}</span><h3>{candidate.model.replaceAll('_', ' ')}</h3><strong>{formatNumber(candidate.mae, 3)}</strong><p>rolling MAE · {candidate.mase == null ? 'MASE unavailable' : `${formatNumber(candidate.mase, 2)} MASE`}</p><dl><div><dt>Direction</dt><dd>{candidate.direction_accuracy == null ? 'n/a' : `${formatNumber(candidate.direction_accuracy, 0)}%`}</dd></div><div><dt>Stability</dt><dd>{formatNumber(candidate.stability * 100, 0)}%</dd></div><div><dt>vs naive</dt><dd>{candidate.skill_vs_naive_percent == null ? 'baseline' : `${candidate.skill_vs_naive_percent >= 0 ? '+' : ''}${formatNumber(candidate.skill_vs_naive_percent, 1)}%`}</dd></div></dl></article>)}</div></section> : null}
            <section className="section-block"><div className="section-heading"><div><p className="kicker">Vintage evaluation</p><h2>Historical forecast accuracy</h2></div><p>{state.data?.historical_accuracy.length ? `${state.data.historical_accuracy.length} forecasts now have observed outcomes.` : 'No forecast vintage has reached an observed target yet.'}</p></div>{state.data?.historical_accuracy.length ? <div className="health-table-wrap"><table className="health-table"><thead><tr><th>Target</th><th>Series</th><th>Forecast</th><th>Actual</th><th>Absolute error</th></tr></thead><tbody>{state.data.historical_accuracy.slice(0, 20).map((row, index) => <tr key={`${String(row.target_date)}-${index}`}><td>{formatDate(String(row.target_date))}</td><td>{String(row.series_id)}</td><td>{formatNumber(Number(row.point_forecast), 3)}</td><td>{formatNumber(Number(row.actual_value), 3)}</td><td>{formatNumber(Number(row.absolute_error), 3)}</td></tr>)}</tbody></table></div> : null}</section>
          </>
        ) : <div className="empty-state empty-state--large"><span>∿</span><strong>{state.data?.empty_message ?? 'Collecting additional history before publishing a forecast.'}</strong><p>MemoryPulse never fabricates history to make a model run. At least 12 comparable observations are required.</p></div>}
        <p className="page-disclaimer">{state.data?.disclaimer}</p>
      </DataBoundary>
    </>
  )
}
