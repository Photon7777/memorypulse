import { useMemo, useState } from 'react'
import { DeviceChangeScatter, DeviceResponseChart } from '../charts/DeviceMarketCharts'
import { AnimatedMetric } from '../components/AnimatedMetric'
import { DataBoundary } from '../components/DataBoundary'
import { HashLink } from '../components/HashLink'
import { PageIntro } from '../components/PageIntro'
import { useStaticData } from '../hooks/useStaticData'
import type { DeviceChangeEvent, DeviceMarketData, DeviceResponseType } from '../types/data'
import { formatDate, formatNumber } from '../utils/format'

const RESPONSE_LABELS: Record<DeviceResponseType, string> = {
  price_and_spec_compression: 'Price up, specs down',
  specification_compression: 'Specs down',
  price_increase: 'Price increase',
  cost_absorption: 'Cost absorbed',
  mixed_or_no_material_change: 'Mixed or stable',
  new_entry_tier: 'New entry tier',
  insufficient_evidence: 'Needs history',
}

function money(value: number | null) {
  return value == null ? 'Not disclosed' : `$${value.toLocaleString(undefined, { maximumFractionDigits: 2 })}`
}

function spec(value: number | null, unit: string) {
  return value == null ? 'Not disclosed' : `${formatNumber(value, 0)}${unit}`
}

function TransitionCard({ event }: { event: DeviceChangeEvent }) {
  const ramDown = event.ram_gb != null && event.previous_ram_gb != null && event.ram_gb < event.previous_ram_gb
  return (
    <article className="transition-card">
      <header><div><span>{event.manufacturer} · {event.category}</span><h3>{event.product_family}</h3></div><b className={`response-badge response-badge--${event.response_type}`}>{RESPONSE_LABELS[event.response_type]}</b></header>
      <div className="transition-comparison">
        <div><small>{formatDate(event.previous_observation_date)}</small><strong>{money(event.previous_price_usd)}</strong><span>{spec(event.previous_ram_gb, 'GB RAM')}</span><span>{spec(event.previous_storage_gb, 'GB storage')}</span></div>
        <i aria-hidden="true">→</i>
        <div><small>{formatDate(event.observation_date)}</small><strong>{money(event.price_usd)}</strong><span className={ramDown ? 'negative-spec' : ''}>{spec(event.ram_gb, 'GB RAM')}</span><span>{spec(event.storage_gb, 'GB storage')}</span></div>
      </div>
      <dl><div><dt>Price</dt><dd>{event.price_change_percent == null ? 'n/a' : `${event.price_change_percent >= 0 ? '+' : ''}${formatNumber(event.price_change_percent, 1)}%`}</dd></div><div><dt>RAM</dt><dd>{event.ram_change_percent == null ? 'n/a' : `${event.ram_change_percent >= 0 ? '+' : ''}${formatNumber(event.ram_change_percent, 1)}%`}</dd></div><div><dt>Comparison</dt><dd>{event.comparability.replaceAll('_', ' ')}</dd></div></dl>
      <p>{event.notes}</p>
      <a href={event.source_url} target="_blank" rel="noreferrer">{event.source_label} source ↗</a>
    </article>
  )
}

export function DeviceMarketPage() {
  const result = useStaticData<DeviceMarketData>('device-market.json')
  const [category, setCategory] = useState('all')
  const [response, setResponse] = useState('all')
  const [search, setSearch] = useState('')
  const categories = useMemo(() => [...new Set(result.data?.events.map((item) => item.category) ?? [])].sort(), [result.data])
  const events = useMemo(() => (result.data?.events ?? []).filter((item) => {
    const matchesCategory = category === 'all' || item.category === category
    const matchesResponse = response === 'all' || item.response_type === response
    const phrase = `${item.manufacturer} ${item.product_family} ${item.model}`.toLowerCase()
    return matchesCategory && matchesResponse && phrase.includes(search.trim().toLowerCase())
  }), [result.data, category, response, search])
  const metrics = result.data?.metrics
  const coverage = result.data?.coverage

  return (
    <DataBoundary loading={result.loading} error={result.error}>
      <PageIntro kicker="Device response tracker" title="Are consumers paying more for less memory?" description="A review-gated panel compares U.S. list prices, RAM, and storage across device generations. It tracks how manufacturers respond without feeding those outcomes into the DDR5 forecast." />

      <section className="device-verdict">
        <div><p className="kicker">Current read</p><h2>The response is not just price. It can also be the configuration.</h2><p>{result.data?.conclusion}</p></div>
        <dl><div><dt>Evidence status</dt><dd>{result.data?.model_readiness.status.replaceAll('_', ' ')}</dd></div><div><dt>Reviewed transitions</dt><dd>{metrics?.comparable_transitions ?? 0}</dd></div><div><dt>Primary-source share</dt><dd>{formatNumber((metrics?.primary_source_share ?? 0) * 100, 0)}%</dd></div></dl>
      </section>

      <section className="device-metric-grid" aria-label="Device market measures">
        <article><span>Sticker price pressure</span><strong><AnimatedMetric value={metrics?.sticker_price_pressure_percent} decimals={1} prefix={(metrics?.sticker_price_pressure_percent ?? 0) >= 0 ? '+' : ''} suffix="%" /></strong><p>{result.data?.metric_definitions.sticker_price_pressure_percent}</p></article>
        <article><span>Spec compression</span><strong><AnimatedMetric value={metrics?.spec_compression_rate_percent} decimals={1} suffix="%" /></strong><p>{result.data?.metric_definitions.spec_compression_rate_percent}</p></article>
        <article><span>Memory value change</span><strong><AnimatedMetric value={metrics?.memory_value_change_percent} decimals={1} prefix={(metrics?.memory_value_change_percent ?? 0) >= 0 ? '+' : ''} suffix="%" /></strong><p>{result.data?.metric_definitions.memory_value_change_percent}</p></article>
        <article><span>Consumer memory burden</span><strong><AnimatedMetric value={metrics?.consumer_memory_burden} decimals={0} suffix=" / 100" /></strong><p>{result.data?.metric_definitions.consumer_memory_burden}</p></article>
      </section>

      <section className="device-chart-grid">
        <article className="chart-card"><div className="section-heading compact-heading"><div><p className="kicker">Manufacturer response</p><h2>What changed?</h2></div><p>Every bar represents a reviewed before-and-after transition.</p></div><DeviceResponseChart counts={result.data?.response_counts ?? []} /></article>
        <article className="chart-card"><div className="section-heading compact-heading"><div><p className="kicker">Price versus memory</p><h2>The pay-more, get-less quadrant</h2></div><p>Upper-left points combine higher prices with less included RAM.</p></div><DeviceChangeScatter events={result.data?.events ?? []} /></article>
      </section>

      <section className="device-transitions">
        <div className="section-heading"><div><p className="kicker">Evidence explorer</p><h2>Inspect each comparison.</h2></div><p>Filter by category or response. Source links and comparability labels remain attached to every claim.</p></div>
        <div className="device-filters">
          <div role="group" aria-label="Category filter"><button className={category === 'all' ? 'active' : ''} onClick={() => setCategory('all')} type="button">All</button>{categories.map((item) => <button className={category === item ? 'active' : ''} onClick={() => setCategory(item)} type="button" key={item}>{item}</button>)}</div>
          <label><span>Response</span><select value={response} onChange={(event) => setResponse(event.target.value)}><option value="all">All response types</option>{Object.entries(RESPONSE_LABELS).map(([value, label]) => <option value={value} key={value}>{label}</option>)}</select></label>
          <label><span>Search</span><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Pixel, Surface, PlayStation..." /></label>
        </div>
        <div className="transition-grid">{events.map((event) => <TransitionCard event={event} key={event.event_id} />)}</div>
        {!events.length && <div className="empty-state">No reviewed transition matches these filters.</div>}
      </section>

      <section className="panel-readiness">
        <div><p className="kicker">Free public panel</p><h2>{result.data?.watchlist.family_count} product families across {result.data?.watchlist.categories.length} categories</h2><p>The watchlist is intentionally much broader than the current examples. Official pages are checked first; free news metadata only creates candidates for review.</p><div className="watchlist-categories">{result.data?.watchlist.categories.map((item) => <span key={item.id}><b>{item.id.replaceAll('_', ' ')}</b>{item.families} families · {item.target_configurations} target configurations</span>)}</div></div>
        <aside><span>Model gate</span><strong>{result.data?.model_readiness.ready ? 'Open' : 'Collecting evidence'}</strong><p>{result.data?.model_readiness.explanation}</p><dl><div><dt>Families reviewed</dt><dd>{coverage?.reviewed_families}/{coverage?.watchlist_families}</dd></div><div><dt>Categories reviewed</dt><dd>{coverage?.reviewed_categories}/{coverage?.watchlist_categories}</dd></div><div><dt>Discovery candidates</dt><dd>{result.data?.review_queue.length ?? 0}</dd></div></dl><HashLink to="/methodology">Review methodology →</HashLink></aside>
      </section>
      <p className="page-disclaimer">{result.data?.disclaimer}</p>
    </DataBoundary>
  )
}
