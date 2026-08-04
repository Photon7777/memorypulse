import { useMemo, useState } from 'react'
import { PriceChart } from '../charts/PriceChart'
import { DataBoundary } from '../components/DataBoundary'
import { PageIntro } from '../components/PageIntro'
import { useStaticData } from '../hooks/useStaticData'
import type { PricesData } from '../types/data'
import { formatCurrency, formatDate, formatNumber } from '../utils/format'

const GENERATION_ORDER = ['DDR5', 'DDR4', 'HBM', 'DDR3', 'NAND']

export function PricesPage() {
  const state = useStaticData<PricesData>('prices.json')
  const [generation, setGeneration] = useState('DDR5')
  const [source, setSource] = useState('all')
  const [normalized, setNormalized] = useState(false)
  const generationCounts = useMemo(() => {
    const counts = new Map<string, number>()
    for (const series of state.data?.series ?? []) counts.set(series.generation, (counts.get(series.generation) ?? 0) + 1)
    return counts
  }, [state.data])
  const generations = useMemo(() => ['all', ...[...generationCounts.keys()].sort((left, right) => {
    const leftRank = GENERATION_ORDER.indexOf(left)
    const rightRank = GENERATION_ORDER.indexOf(right)
    return (leftRank < 0 ? 99 : leftRank) - (rightRank < 0 ? 99 : rightRank) || left.localeCompare(right)
  })], [generationCounts])
  const sources = useMemo(() => ['all', ...new Set(state.data?.series.map((item) => item.source_id) ?? [])], [state.data])
  const selected = useMemo(() => state.data?.series
    .filter((item) => (generation === 'all' || item.generation === generation) && (source === 'all' || item.source_id === source))
    .slice(0, 12) ?? [], [generation, source, state.data])
  const ddr5Series = useMemo(() => state.data?.series.find((item) => item.generation === 'DDR5'), [state.data])
  const latestDdr5 = ddr5Series?.points.at(-1)

  return (
    <>
      <PageIntro kicker="Price intelligence" title="Trends without false equivalence" description="Explore source-defined memory series. Estimates, chip prices, module prices, and retail observations remain clearly labeled." />
      <DataBoundary loading={state.loading} error={state.error}>
        {ddr5Series && latestDdr5 ? (
          <section className="ddr5-availability" aria-label="DDR5 data availability">
            <div><p className="kicker">DDR5 is available</p><h2>{ddr5Series.label}</h2><p>The chart opens on DDR5 by default. This public series is kept separate from retail-module and spot-price definitions.</p></div>
            <dl>
              <div><dt>Latest</dt><dd>{formatCurrency(latestDdr5.price_per_gb)} / GB</dd></div>
              <div><dt>Observation</dt><dd>{formatDate(latestDdr5.date)}</dd></div>
              <div><dt>History</dt><dd>{formatNumber(ddr5Series.points.length, 0)} months</dd></div>
            </dl>
          </section>
        ) : null}
        <section className="chart-card">
          <div className="generation-shortcuts" aria-label="Quick memory type filters">
            {generations.map((item) => (
              <button type="button" className={generation === item ? 'active' : ''} aria-pressed={generation === item} onClick={() => setGeneration(item)} key={item}>
                <span>{item === 'all' ? 'All types' : item}</span>
                <small>{item === 'all' ? state.data?.series.length ?? 0 : generationCounts.get(item) ?? 0} series</small>
              </button>
            ))}
          </div>
          <div className="chart-controls" aria-label="Price chart controls">
            <label>Memory type<select value={generation} onChange={(event) => setGeneration(event.target.value)}>{generations.map((item) => <option key={item} value={item}>{item === 'all' ? 'All types' : item}</option>)}</select></label>
            <label>Source<select value={source} onChange={(event) => setSource(event.target.value)}>{sources.map((item) => <option key={item}>{item}</option>)}</select></label>
            <label className="toggle-control"><input type="checkbox" checked={normalized} onChange={(event) => setNormalized(event.target.checked)} /><span>Normalize first value to 100</span></label>
          </div>
          {selected.length ? <PriceChart series={selected} normalized={normalized} /> : <div className="empty-state"><strong>No compatible series</strong><p>Try another memory type or source. Missing observations are not interpolated.</p></div>}
          <p className="chart-summary">Showing {selected.length} source-defined series. {state.data?.units_note}</p>
        </section>
        <section className="series-list" aria-label="Displayed series definitions">
          {selected.map((item) => (
            <article key={item.id}>
              <span className={`series-tag ${item.is_estimate ? 'series-tag--estimate' : ''}`}>{item.is_estimate ? 'Estimate' : item.market_type.replaceAll('_', ' ')}</span>
              <h2>{item.label}</h2>
              <p>{item.generation} · {item.currency} · {item.basis} · {item.points.length} observations</p>
              <a href={item.source_url} target="_blank" rel="noreferrer">{item.source_label}</a>
            </article>
          ))}
        </section>
      </DataBoundary>
    </>
  )
}
