import { useMemo, useState } from 'react'
import { PriceChart } from '../charts/PriceChart'
import { DataBoundary } from '../components/DataBoundary'
import { PageIntro } from '../components/PageIntro'
import { useStaticData } from '../hooks/useStaticData'
import type { PricesData } from '../types/data'

export function PricesPage() {
  const state = useStaticData<PricesData>('prices.json')
  const [generation, setGeneration] = useState('DDR4')
  const [source, setSource] = useState('all')
  const [normalized, setNormalized] = useState(false)
  const generations = useMemo(() => ['all', ...new Set(state.data?.series.map((item) => item.generation) ?? [])], [state.data])
  const sources = useMemo(() => ['all', ...new Set(state.data?.series.map((item) => item.source_id) ?? [])], [state.data])
  const selected = useMemo(() => state.data?.series
    .filter((item) => (generation === 'all' || item.generation === generation) && (source === 'all' || item.source_id === source))
    .slice(0, 12) ?? [], [generation, source, state.data])

  return (
    <>
      <PageIntro kicker="Price intelligence" title="Trends without false equivalence" description="Explore source-defined memory series. Estimates, chip prices, module prices, and retail observations remain clearly labeled." />
      <DataBoundary loading={state.loading} error={state.error}>
        <section className="chart-card">
          <div className="chart-controls" aria-label="Price chart controls">
            <label>Memory type<select value={generation} onChange={(event) => setGeneration(event.target.value)}>{generations.map((item) => <option key={item}>{item}</option>)}</select></label>
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
