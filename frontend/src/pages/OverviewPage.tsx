import { lazy, Suspense, useMemo, useState } from 'react'
import { ForecastFanChart } from '../charts/AnalyticsCharts'
import { ElectronicsStoryChart } from '../charts/ElectronicsStoryChart'
import { AnimatedMetric } from '../components/AnimatedMetric'
import { DataBoundary } from '../components/DataBoundary'
import { HashLink } from '../components/HashLink'
import { useStaticData } from '../hooks/useStaticData'
import type { AnalyticsData, DecisionBrief, ElectronicsStory, ForecastData, MarketSummary, PricesData, SourceHealthData } from '../types/data'
import { formatCurrency, formatDate, formatNumber } from '../utils/format'
import { buildLinkedInCopy, downloadInsightCard } from '../utils/share'

const SignalCore3D = lazy(() => import('../components/SignalCore3D').then((module) => ({ default: module.SignalCore3D })))

const MODEL_LABELS: Record<string, string> = {
  naive_last_value: 'Naive last value',
  drift: 'Drift',
  rolling_mean_3: 'Rolling mean',
  seasonal_naive_12: 'Seasonal naive',
  holt_damped_trend: 'Holt damped trend',
  ets_additive_damped: 'ETS additive',
  theta: 'Theta',
  autoregressive: 'Autoregression',
  arima_111: 'ARIMA',
  robust_ensemble: 'Robust ensemble',
}

export function OverviewPage() {
  const summary = useStaticData<MarketSummary>('market-summary.json')
  const health = useStaticData<SourceHealthData>('source-health.json')
  const brief = useStaticData<DecisionBrief>('decision-brief.json')
  const prices = useStaticData<PricesData>('prices.json')
  const forecasts = useStaticData<ForecastData>('forecast.json')
  const analytics = useStaticData<AnalyticsData>('analytics.json')
  const story = useStaticData<ElectronicsStory>('electronics-story.json')
  const [copied, setCopied] = useState(false)
  const [exposureCategory, setExposureCategory] = useState('gaming_console')
  const loading = summary.loading || health.loading || brief.loading || prices.loading || forecasts.loading || analytics.loading || story.loading
  const error = summary.error || health.error || brief.error || prices.error || forecasts.error || analytics.error || story.error
  const coreSources = health.data?.sources.filter((source) => source.source_kind === 'core') ?? []
  const healthy = coreSources.filter((source) => source.status === 'success').length
  const ddr5Series = prices.data?.series.find((item) => item.generation === 'DDR5')
  const allDdr5Forecasts = forecasts.data?.forecasts.filter((item) => item.series_id === ddr5Series?.label) ?? []
  const latestForecastVintage = allDdr5Forecasts.reduce(
    (latest, item) => item.forecast_created_at > latest ? item.forecast_created_at : latest,
    '',
  )
  const ddr5Forecasts = allDdr5Forecasts.filter((item) => item.forecast_created_at === latestForecastVintage)
  const latestForecast = ddr5Forecasts[0]
  const diagnostic = analytics.data?.model_diagnostics.find((item) => item.series_id === ddr5Series?.label)
  const selectedCandidate = diagnostic?.candidates.find((item) => item.selected)
  const exposure = story.data?.exposure_scenarios.find((item) => item.category === exposureCategory) ?? story.data?.exposure_scenarios[0]
  const heroEvidence = story.data?.evidence.slice(0, 3) ?? []
  const storySeries = useMemo(() => story.data?.product_series.filter((item) => item.points.length > 1) ?? [], [story.data])

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

  function scrollToChapter(id: string) {
    document.getElementById(id)?.scrollIntoView({
      behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth',
      block: 'start',
    })
  }

  return (
    <DataBoundary loading={loading} error={error}>
      <section className="story-hero">
        <div className="story-hero__copy">
          <p className="kicker"><span className="live-pip" />Component intelligence · finished-product impact</p>
          <h1>The memory shock is reaching the devices people buy.</h1>
          <p className="story-hero__lede">Follow the evidence from DDR5 and semiconductor pressure to PlayStation, Xbox, Nintendo, MacBook, and the future cost of electronics.</p>
          <div className="hero-actions">
            <button className="button button--primary" type="button" onClick={() => scrollToChapter('price-story')}>Start the story</button>
            <HashLink className="button button--quiet" to="/forecasts">Inspect the models</HashLink>
            <HashLink className="button button--text" to="/data">Download the evidence ↗</HashLink>
          </div>
          <div className="story-hero__proof">
            {heroEvidence.map((item) => <article key={item.label}><span>{item.label}</span><strong><AnimatedMetric value={item.value} decimals={1} prefix={item.value >= 0 ? '+' : ''} suffix="%" /></strong><small>{item.unit}</small></article>)}
          </div>
        </div>
        <div className="signal-stage" aria-label="Memory signal moving through consumer electronics">
          <Suspense fallback={<div className="signal-stage__fallback" />}><SignalCore3D /></Suspense>
          <div className="signal-stage__halo" />
          <span className="signal-node signal-node--one">DDR5</span>
          <span className="signal-node signal-node--two">CONSOLES</span>
          <span className="signal-node signal-node--three">LAPTOPS</span>
          <aside className="signal-readout">
            <span>LIVE PRESSURE</span>
            <strong><AnimatedMetric value={brief.data?.pressure_score} decimals={0} /></strong>
            <small>{brief.data?.regime} · {brief.data?.confidence} confidence</small>
          </aside>
        </div>
      </section>

      <nav className="story-rail" aria-label="Story chapters">
        <button type="button" onClick={() => scrollToChapter('price-story')}><b>01</b><span>Price break</span></button>
        <button type="button" onClick={() => scrollToChapter('cost-path')}><b>02</b><span>Cost path</span></button>
        <button type="button" onClick={() => scrollToChapter('forecast-story')}><b>03</b><span>What comes next</span></button>
        <button type="button" onClick={() => scrollToChapter('decision-story')}><b>04</b><span>The conclusion</span></button>
      </nav>

      <section className="story-chapter" id="price-story">
        <div className="story-chapter__intro">
          <span className="chapter-number">01</span>
          <div><p className="kicker">The price break</p><h2>Console prices moved. Laptop prices need context.</h2></div>
          <p>{story.data?.thesis}</p>
        </div>
        <div className="story-evidence-grid">
          {story.data?.evidence.map((item) => <article className={item.kind === 'qualified' ? 'qualified' : ''} key={item.label}>
            <div><span>{item.kind === 'observed' ? 'Comparable evidence' : 'Configuration-adjusted'}</span><i /></div>
            <h3>{item.label}</h3>
            <strong>{item.value >= 0 ? '+' : ''}{formatNumber(item.value, 1)}%</strong>
            <p>{item.interpretation}</p>
          </article>)}
        </div>
        <article className="chart-card story-price-chart">
          <div className="section-heading"><div><p className="kicker">Official milestones</p><h2>Starting prices across product generations</h2></div><p>Solid lines are the closest comparisons. Dashed lines connect evolving laptop entry tiers and must be read with their configuration changes.</p></div>
          <ElectronicsStoryChart series={storySeries} />
          <p className="chart-takeaway"><strong>Takeaway</strong>PS5 and Xbox increases are directly visible in official same-family price paths. MacBook starting tiers also rose, but higher memory, storage, and performance prevent a clean like-for-like conclusion.</p>
        </article>
        <div className="manufacturer-signal">
          <span className="manufacturer-signal__mark">X</span>
          <div><p className="kicker">The clearest manufacturer signal</p><h3>Microsoft explicitly connected its 2026 console increase to storage and memory pressure.</h3><p>This is evidence of a real cost channel—not proof that memory explains every dollar of the price change.</p></div>
          <a href="https://news.xbox.com/en-us/2026/06/25/xbox-console-price-update/" target="_blank" rel="noreferrer">Read the official update ↗</a>
        </div>
      </section>

      <section className="story-chapter story-chapter--dark" id="cost-path">
        <div className="story-chapter__intro">
          <span className="chapter-number">02</span>
          <div><p className="kicker">The transmission path</p><h2>A component shock does not travel in a straight line.</h2></div>
          <p>Manufacturers can absorb, delay, reconfigure, or pass through higher costs. MemoryPulse models that uncertainty instead of pretending retail prices are mechanically determined.</p>
        </div>
        <div className="signal-path" aria-label="Component cost transmission path">
          <article><span>01</span><i className="signal-path__orb" /><h3>Memory market</h3><p>DDR5, NAND, producer costs</p></article>
          <b>→</b>
          <article><span>02</span><i className="signal-path__chip" /><h3>Device bill of materials</h3><p>Memory and storage share</p></article>
          <b>→</b>
          <article><span>03</span><i className="signal-path__gate" /><h3>Manufacturer response</h3><p>Margins, contracts, redesign</p></article>
          <b>→</b>
          <article><span>04</span><i className="signal-path__device" /><h3>Retail outcome</h3><p>Price, promotion, configuration</p></article>
        </div>

        <div className="exposure-lab">
          <div className="exposure-lab__controls">
            <p className="kicker">Interactive exposure model</p>
            <h3>Which electronics category feels the signal most?</h3>
            <div role="tablist" aria-label="Device exposure category">
              {story.data?.exposure_scenarios.map((item) => <button type="button" role="tab" aria-selected={item.category === exposure?.category} className={item.category === exposure?.category ? 'active' : ''} onClick={() => setExposureCategory(item.category)} key={item.category}>{item.display_name}</button>)}
            </div>
            <p>{exposure?.basis}</p>
          </div>
          <article className="exposure-result">
            <div><span>Illustrative central effect</span><strong><AnimatedMetric value={exposure?.modeled_product_effect_central} decimals={2} prefix={(exposure?.modeled_product_effect_central ?? 0) >= 0 ? '+' : ''} suffix="%" /></strong><small>modeled product-cost exposure</small></div>
            <dl>
              <div><dt>Signal used</dt><dd>{formatNumber(exposure?.signal_percent, 1)}%</dd></div>
              <div><dt>Component share</dt><dd>{formatNumber((exposure?.memory_storage_share_central ?? 0) * 100, 0)}%</dd></div>
              <div><dt>Pass-through</dt><dd>{formatNumber((exposure?.pass_through_central ?? 0) * 100, 0)}%</dd></div>
              <div><dt>Scenario range</dt><dd>{formatNumber(exposure?.modeled_product_effect_low, 2)}%–{formatNumber(exposure?.modeled_product_effect_high, 2)}%</dd></div>
            </dl>
            <p>Scenario analysis only. This is not a retail-price forecast.</p>
          </article>
        </div>
      </section>

      <section className="story-chapter" id="forecast-story">
        <div className="story-chapter__intro">
          <span className="chapter-number">03</span>
          <div><p className="kicker">What comes next</p><h2>Ten models compete. Complexity has to earn its place.</h2></div>
          <p>Every forecast is judged on unseen historical windows. A complex model is published only when it is stable and beats the naive baseline by at least 2%.</p>
        </div>
        <div className="forecast-story-grid">
          <article className="chart-card">
            <div className="section-heading compact-heading"><div><p className="kicker">Selected DDR5 path</p><h2>{latestForecast ? `${formatCurrency(latestForecast.point_forecast)} / GB` : 'Building sufficient history'}</h2></div><p>{latestForecast ? `95% range ${formatCurrency(latestForecast.lower_bound)}–${formatCurrency(latestForecast.upper_bound)}` : 'The system withholds forecasts when evidence is insufficient.'}</p></div>
            <ForecastFanChart history={ddr5Series} forecasts={ddr5Forecasts} />
            <p className="chart-takeaway"><strong>Takeaway</strong>The range is the decision surface. The midpoint is not a promise, and every new observed vintage is scored against what the model previously published.</p>
          </article>
          <aside className="model-governance-card">
            <p className="kicker">Model governance</p>
            <h3>{MODEL_LABELS[diagnostic?.selected_model ?? ''] ?? diagnostic?.selected_model?.replaceAll('_', ' ') ?? 'No eligible model'}</h3>
            <p>Selected for {ddr5Series?.label ?? 'DDR5'} using rolling-origin validation.</p>
            <dl>
              <div><dt>Validation MAE</dt><dd>{formatNumber(selectedCandidate?.mae, 3)}</dd></div>
              <div><dt>MASE</dt><dd>{selectedCandidate?.mase == null ? 'n/a' : formatNumber(selectedCandidate.mase, 2)}</dd></div>
              <div><dt>Direction accuracy</dt><dd>{selectedCandidate?.direction_accuracy == null ? 'n/a' : `${formatNumber(selectedCandidate.direction_accuracy, 0)}%`}</dd></div>
              <div><dt>Stability</dt><dd>{formatNumber((selectedCandidate?.stability ?? 0) * 100, 0)}%</dd></div>
            </dl>
            <HashLink className="text-link" to="/forecasts">Open model leaderboard <span aria-hidden="true">→</span></HashLink>
          </aside>
        </div>
        <div className="model-family-strip" aria-label="Forecast model candidates">
          {diagnostic?.candidates.filter((item) => Number.isFinite(item.mae)).map((item) => <span className={item.selected ? 'selected' : ''} key={item.model}><i />{MODEL_LABELS[item.model] ?? item.model.replaceAll('_', ' ')}</span>)}
        </div>
      </section>

      <section className="story-chapter story-conclusion" id="decision-story">
        <div className="story-chapter__intro">
          <span className="chapter-number">04</span>
          <div><p className="kicker">The conclusion</p><h2>{brief.data?.headline}</h2></div>
          <p>{story.data?.conclusion}</p>
        </div>
        <div className="evidence-boundary-grid">
          <article><span>What the data proves</span><ul>{story.data?.story.proves.map((item) => <li key={item}>{item}</li>)}</ul></article>
          <article><span>What it suggests</span><ul>{story.data?.story.suggests.map((item) => <li key={item}>{item}</li>)}</ul></article>
          <article><span>What remains uncertain</span><ul>{story.data?.story.uncertain.map((item) => <li key={item}>{item}</li>)}</ul></article>
        </div>
        <div className="decision-banner">
          <div><span>Current analytical posture</span><h3>{brief.data?.recommended_posture.procurement}</h3><p>{brief.data?.conclusion}</p></div>
          <dl><div><dt>Pressure</dt><dd>{formatNumber(brief.data?.pressure_score, 0)}/100</dd></div><div><dt>Confidence</dt><dd>{brief.data?.confidence}</dd></div><div><dt>Source health</dt><dd>{healthy}/{coreSources.length}</dd></div><div><dt>Updated</dt><dd>{formatDate(brief.data?.generated_at)}</dd></div></dl>
        </div>
        <details className="disclosure-card conclusion-reversal"><summary><span>What would change this view?</span><small>Signals that would reverse the conclusion</small></summary><ul>{story.data?.story.would_change_view.map((item) => <li key={item}>{item}</li>)}</ul></details>
      </section>

      <section className="share-insight story-share">
        <div><p className="kicker">Explore or reproduce it</p><h2>The story is public. So is the evidence.</h2><p>Inspect every model, download the versioned dataset, or share the latest evidence-based conclusion.</p></div>
        <div className="share-insight__actions">
          <HashLink className="button button--primary" to="/data">Download open dataset</HashLink>
          <button type="button" className="button button--quiet" onClick={() => void copyLinkedIn()} disabled={!brief.data}>{copied ? 'LinkedIn copy ready' : 'Copy LinkedIn summary'}</button>
          <button type="button" className="button button--text" onClick={() => brief.data && downloadInsightCard(brief.data)} disabled={!brief.data}>Download insight card</button>
        </div>
      </section>
      <p className="page-disclaimer">{story.data?.disclaimer} {brief.data?.disclaimer}</p>
    </DataBoundary>
  )
}
