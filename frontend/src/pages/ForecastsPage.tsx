import { useState } from 'react'
import { PriceChart } from '../charts/PriceChart'
import { DataBoundary } from '../components/DataBoundary'
import { MetricCard } from '../components/MetricCard'
import { PageIntro } from '../components/PageIntro'
import { useStaticData } from '../hooks/useStaticData'
import type { ForecastData, PricesData } from '../types/data'
import { formatDate, formatNumber } from '../utils/format'

export function ForecastsPage() {
  const state = useStaticData<ForecastData>('forecast.json')
  const prices = useStaticData<PricesData>('prices.json')
  const series = [...new Set(state.data?.forecasts.map((forecast) => forecast.series_id) ?? [])]
  const [selected, setSelected] = useState<string>('')
  const activeSeries = selected || series[0] || ''
  const forecast = state.data?.forecasts.find((item) => item.series_id === activeSeries)
  const history = prices.data?.series.find((item) => item.label === activeSeries)
  return (
    <>
      <PageIntro kicker="Transparent baselines" title="Forecasts that know when to stay quiet" description="Forecasts publish only after sufficient genuine history and rolling-origin backtests. Every estimate retains its model, training window, error, and uncertainty interval." />
      <DataBoundary loading={state.loading || prices.loading} error={state.error || prices.error}>
        {forecast ? (
          <>
            <div className="forecast-toolbar"><label>Series<select value={activeSeries} onChange={(event) => setSelected(event.target.value)}>{series.map((item) => <option key={item}>{item}</option>)}</select></label><span>Created {formatDate(forecast.forecast_created_at, true)}</span></div>
            <section className="forecast-hero">
              <div><p className="eyebrow">Point forecast · {formatDate(forecast.target_date)}</p><strong>{formatNumber(forecast.point_forecast, 3)}</strong><p>Source-defined units</p></div>
              <div className="interval-line"><span style={{ left: '12%' }}>{formatNumber(forecast.lower_bound, 3)}</span><i /><b style={{ left: '50%' }} /><span style={{ right: '12%' }}>{formatNumber(forecast.upper_bound, 3)}</span></div>
              <p>95% residual-based uncertainty interval</p>
            </section>
            {history && <section className="chart-card forecast-history"><div className="section-heading"><div><p className="kicker">Training history</p><h2>Observed source series</h2></div><p>Historical values retain their original source basis; the forecast above is the next model target.</p></div><PriceChart series={[history]} normalized={false} /><p className="chart-summary">{history.source_label} · {history.basis}</p></section>}
            <div className="metric-grid metric-grid--three">
              <MetricCard eyebrow="Selected model" value={forecast.model_name.replaceAll('_', ' ')} detail={`Compared with a naive baseline · v${forecast.model_version}`} />
              <MetricCard eyebrow="Backtest MAE" value={formatNumber(forecast.backtest_mae, 3)} detail={forecast.backtest_mape == null ? 'MAPE unavailable where actual values are zero' : `MAPE ${formatNumber(forecast.backtest_mape, 1)}%`} tone="accent" />
              <MetricCard eyebrow="Training window" value={`${forecast.observations_used} points`} detail={`${formatDate(forecast.training_start)} to ${formatDate(forecast.training_end)}`} />
            </div>
            <section className="section-block"><div className="section-heading"><div><p className="kicker">Vintage evaluation</p><h2>Historical forecast accuracy</h2></div><p>{state.data?.historical_accuracy.length ? `${state.data.historical_accuracy.length} forecasts now have observed outcomes.` : 'No forecast vintage has reached an observed target yet.'}</p></div>{state.data?.historical_accuracy.length ? <div className="health-table-wrap"><table className="health-table"><thead><tr><th>Target</th><th>Series</th><th>Forecast</th><th>Actual</th><th>Absolute error</th></tr></thead><tbody>{state.data.historical_accuracy.slice(0, 20).map((row, index) => <tr key={`${String(row.target_date)}-${index}`}><td>{formatDate(String(row.target_date))}</td><td>{String(row.series_id)}</td><td>{formatNumber(Number(row.point_forecast), 3)}</td><td>{formatNumber(Number(row.actual_value), 3)}</td><td>{formatNumber(Number(row.absolute_error), 3)}</td></tr>)}</tbody></table></div> : null}</section>
          </>
        ) : <div className="empty-state empty-state--large"><span>∿</span><strong>{state.data?.empty_message ?? 'Collecting additional history before publishing a forecast.'}</strong><p>MemoryPulse never fabricates history to make a model run. At least 12 comparable observations are required.</p></div>}
        <p className="page-disclaimer">{state.data?.disclaimer}</p>
      </DataBoundary>
    </>
  )
}
