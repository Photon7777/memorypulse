import { useState } from 'react'
import { MetricCard } from '../components/MetricCard'
import { PageIntro } from '../components/PageIntro'
import { formatCurrency } from '../utils/format'
import { calculateScenario } from '../utils/scenario'

const categories = {
  'Mainstream laptop': { capacity: 16, baseline: 3.25, share: 8 },
  'Gaming desktop': { capacity: 32, baseline: 3.75, share: 10 },
  'Creator workstation': { capacity: 64, baseline: 4.25, share: 12 },
}

export function ExplorerPage() {
  const [category, setCategory] = useState<keyof typeof categories>('Mainstream laptop')
  const [capacity, setCapacity] = useState(categories[category].capacity)
  const [baseline, setBaseline] = useState(categories[category].baseline)
  const [increase, setIncrease] = useState(20)
  const [share, setShare] = useState(categories[category].share)
  const result = calculateScenario({ capacityGb: capacity, baselinePerGb: baseline, increasePercent: increase, memorySharePercent: share })

  function changeCategory(value: keyof typeof categories) {
    setCategory(value)
    setCapacity(categories[value].capacity)
    setBaseline(categories[value].baseline)
    setShare(categories[value].share)
  }

  return (
    <>
      <PageIntro kicker="Consumer impact explorer" title="Turn a memory-price scenario into cost exposure" description="Adjust explicit assumptions to estimate component-level exposure. This calculator does not predict a product's retail price or manufacturer behavior." />
      <section className="explorer-layout">
        <form className="scenario-form" onSubmit={(event) => event.preventDefault()}>
          <label>Device category<select value={category} onChange={(event) => changeCategory(event.target.value as keyof typeof categories)}>{Object.keys(categories).map((item) => <option key={item}>{item}</option>)}</select></label>
          <div className="field-pair"><label>Memory capacity <span>{capacity} GB</span><input type="range" min="4" max="128" step="4" value={capacity} onChange={(event) => setCapacity(Number(event.target.value))} /></label><label>Baseline price <span>{formatCurrency(baseline)} / GB</span><input type="range" min="0.5" max="15" step="0.25" value={baseline} onChange={(event) => setBaseline(Number(event.target.value))} /></label></div>
          <div className="field-pair"><label>Assumed price increase <span>{increase}%</span><input type="range" min="0" max="100" step="5" value={increase} onChange={(event) => setIncrease(Number(event.target.value))} /></label><label>Memory share of device BOM <span>{share}%</span><input type="range" min="1" max="30" step="1" value={share} onChange={(event) => setShare(Number(event.target.value))} /></label></div>
          <p className="form-note">BOM means bill of materials. Your inputs stay in this browser and are not saved.</p>
        </form>
        <aside className="scenario-results">
          <p className="eyebrow">Central scenario</p><strong>{formatCurrency(result.memoryComponentIncrease)}</strong><p>estimated memory component increase</p>
          <dl><div><dt>Baseline memory cost</dt><dd>{formatCurrency(result.baselineMemoryCost)}</dd></div><div><dt>Device-cost exposure</dt><dd>{formatCurrency(result.deviceCostExposure)}</dd></div></dl>
        </aside>
      </section>
      <div className="metric-grid metric-grid--three scenario-band">
        <MetricCard eyebrow="Low scenario" value={formatCurrency(result.low)} detail="60% of central component exposure" />
        <MetricCard eyebrow="Central scenario" value={formatCurrency(result.central)} detail="Direct result of the selected assumptions" tone="accent" />
        <MetricCard eyebrow="High scenario" value={formatCurrency(result.high)} detail="140% of central component exposure" />
      </div>
      <p className="page-disclaimer">Scenario tool only—not a retail price prediction. It excludes channel margins, other components, promotions, demand response, and manufacturer pricing strategy.</p>
    </>
  )
}
