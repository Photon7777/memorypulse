import { useState } from 'react'
import { ForecastFanChart } from '../charts/AnalyticsCharts'
import { DataBoundary } from '../components/DataBoundary'
import { MetricCard } from '../components/MetricCard'
import { PageIntro } from '../components/PageIntro'
import { useStaticData } from '../hooks/useStaticData'
import type { AnalyticsData, ForecastData, PricesData } from '../types/data'
import { formatDate, formatNumber } from '../utils/format'

export function ForecastsPage() {
  const state = useStaticData<ForecastData>('forecast.json')
  const prices = useStaticData<PricesData>('prices.json')
  const analytics = useStaticData<AnalyticsData>('analytics.json')
  const series = [...new Set(state.data?.forecasts.map((forecast) => forecast.series_id) ?? [])]
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

  function horizonLabel(target: string): string {
    if (!history?.points.length) return formatDate(target)
    const latest = new Date(history.points[history.points.length - 1].date)
    const date = new Date(target)
    const months = Math.max(1, (date.getUTCFullYear() - latest.getUTCFullYear()) * 12 + date.getUTCMonth() - latest.getUTCMonth())
    return `${months}M`
  }
  return (
    <>
      <PageIntro kicker="Transparent baselines" title="Forecasts that know when to stay quiet" description="Forecasts publish only after sufficient genuine history and rolling-origin backtests. Every estimate retains its model, training window, error, and uncertainty interval." />
      <DataBoundary loading={state.loading || prices.loading || analytics.loading} error={state.error || prices.error || analytics.error}>
        {forecast ? (
          <>
            <div className="forecast-toolbar"><label>Series<select value={activeSeries} onChange={(event) => { setSelected(event.target.value); setSelectedTarget('') }}>{series.map((item) => <option key={item}>{item}</option>)}</select></label><div className="forecast-horizons" aria-label="Forecast horizon">{activeForecasts.map((item) => <button type="button" className={item.target_date === forecast.target_date ? 'active' : ''} aria-pressed={item.target_date === forecast.target_date} onClick={() => setSelectedTarget(item.target_date)} key={item.target_date}>{horizonLabel(item.target_date)}</button>)}</div><span>Created {formatDate(forecast.forecast_created_at, true)}</span></div>
            <section className="chart-card forecast-history"><div className="section-heading"><div><p className="kicker">Selected forecast · {formatDate(forecast.target_date)}</p><h2>{formatNumber(forecast.point_forecast, 3)} <small>source-defined units</small></h2></div><p>95% interval {formatNumber(forecast.lower_bound, 3)}–{formatNumber(forecast.upper_bound, 3)}. The chart uses the latest complete forecast vintage.</p></div><ForecastFanChart history={history} forecasts={activeForecasts} />{history && <p className="chart-summary">{history.source_label} · {history.basis}</p>}</section>
            <div className="metric-grid metric-grid--three">
              <MetricCard eyebrow="Selected model" value={forecast.model_name.replaceAll('_', ' ')} detail={`Compared with a naive baseline · v${forecast.model_version}`} />
              <MetricCard eyebrow="Backtest MAE" value={formatNumber(forecast.backtest_mae, 3)} detail={forecast.backtest_mape == null ? 'MAPE unavailable where actual values are zero' : `MAPE ${formatNumber(forecast.backtest_mape, 1)}%`} tone="accent" />
              <MetricCard eyebrow="Training window" value={`${forecast.observations_used} points`} detail={`${formatDate(forecast.training_start)} to ${formatDate(forecast.training_end)}`} />
            </div>
            {diagnostic ? <section className="section-block"><div className="section-heading"><div><p className="kicker">Candidate comparison</p><h2>Why this model won</h2></div><p>Every candidate is evaluated through rolling-origin backtests on genuine observations.</p></div><div className="model-candidate-grid">{diagnostic.candidates.map((candidate) => <article className={candidate.selected ? 'selected' : ''} key={candidate.model}><span>{candidate.selected ? 'Selected' : 'Benchmark'}</span><h3>{candidate.model.replaceAll('_', ' ')}</h3><strong>{formatNumber(candidate.mae, 3)}</strong><p>rolling MAE · {candidate.mape == null ? 'MAPE unavailable' : `${formatNumber(candidate.mape, 1)}% MAPE`}</p></article>)}</div></section> : null}
            <section className="section-block"><div className="section-heading"><div><p className="kicker">Vintage evaluation</p><h2>Historical forecast accuracy</h2></div><p>{state.data?.historical_accuracy.length ? `${state.data.historical_accuracy.length} forecasts now have observed outcomes.` : 'No forecast vintage has reached an observed target yet.'}</p></div>{state.data?.historical_accuracy.length ? <div className="health-table-wrap"><table className="health-table"><thead><tr><th>Target</th><th>Series</th><th>Forecast</th><th>Actual</th><th>Absolute error</th></tr></thead><tbody>{state.data.historical_accuracy.slice(0, 20).map((row, index) => <tr key={`${String(row.target_date)}-${index}`}><td>{formatDate(String(row.target_date))}</td><td>{String(row.series_id)}</td><td>{formatNumber(Number(row.point_forecast), 3)}</td><td>{formatNumber(Number(row.actual_value), 3)}</td><td>{formatNumber(Number(row.absolute_error), 3)}</td></tr>)}</tbody></table></div> : null}</section>
          </>
        ) : <div className="empty-state empty-state--large"><span>∿</span><strong>{state.data?.empty_message ?? 'Collecting additional history before publishing a forecast.'}</strong><p>MemoryPulse never fabricates history to make a model run. At least 12 comparable observations are required.</p></div>}
        <p className="page-disclaimer">{state.data?.disclaimer}</p>
      </DataBoundary>
    </>
  )
}
