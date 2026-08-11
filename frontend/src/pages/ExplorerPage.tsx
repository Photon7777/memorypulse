import { useState } from 'react'
import { MetricCard } from '../components/MetricCard'
import { PageIntro } from '../components/PageIntro'
import { useStaticData } from '../hooks/useStaticData'
import type { DecisionBrief } from '../types/data'
import { formatCurrency, formatNumber } from '../utils/format'
import { calculateProcurementScenario, calculateScenario } from '../utils/scenario'

const categories = {
  'Mainstream laptop': { capacity: 16, baseline: 3.25, share: 8 },
  'Gaming desktop': { capacity: 32, baseline: 3.75, share: 10 },
  'Creator workstation': { capacity: 64, baseline: 4.25, share: 12 },
}

export function ExplorerPage() {
  const brief = useStaticData<DecisionBrief>('decision-brief.json')
  const [category, setCategory] = useState<keyof typeof categories>('Mainstream laptop')
  const [capacity, setCapacity] = useState(categories[category].capacity)
  const [baseline, setBaseline] = useState(categories[category].baseline)
  const [increase, setIncrease] = useState(20)
  const [share, setShare] = useState(categories[category].share)
  const [units, setUnits] = useState(500)
  const [procurementCapacity, setProcurementCapacity] = useState(32)
  const [procurementPrice, setProcurementPrice] = useState(brief.data?.ddr5.latest_price_per_gb ?? 11.4)
  const [expectedMove, setExpectedMove] = useState(5)
  const [delayMonths, setDelayMonths] = useState(3)
  const [holdingCost, setHoldingCost] = useState(12)
  const result = calculateScenario({ capacityGb: capacity, baselinePerGb: baseline, increasePercent: increase, memorySharePercent: share })
  const procurement = calculateProcurementScenario({ units, capacityGb: procurementCapacity, currentPricePerGb: procurementPrice, expectedMovePercent: expectedMove, delayMonths, annualHoldingCostPercent: holdingCost })

  function changeCategory(value: keyof typeof categories) {
    setCategory(value)
    setCapacity(categories[value].capacity)
    setBaseline(categories[value].baseline)
    setShare(categories[value].share)
  }

  return (
    <>
      <PageIntro kicker="Scenario calculator" title="Estimate memory-cost exposure" description="Set component price, capacity, bill-of-materials share, and pass-through assumptions. Results describe component exposure, not a predicted retail price." />
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
      <p className="page-disclaimer">This scenario is not a retail-price prediction. It excludes channel margins, other components, promotions, demand response, and manufacturer pricing strategy.</p>

      <section className="section-block">
        <div className="section-heading"><div><p className="kicker">Procurement comparison</p><h2>Compare buying now with waiting</h2></div><p>The calculation compares a modeled price move with the carrying cost of purchasing earlier.</p></div>
        <div className="explorer-layout procurement-lab">
          <form className="scenario-form" onSubmit={(event) => event.preventDefault()}>
            <div className="field-pair"><label>Units <span>{formatNumber(units, 0)}</span><input type="range" min="50" max="10000" step="50" value={units} onChange={(event) => setUnits(Number(event.target.value))} /></label><label>Memory per unit <span>{procurementCapacity} GB</span><input type="range" min="8" max="256" step="8" value={procurementCapacity} onChange={(event) => setProcurementCapacity(Number(event.target.value))} /></label></div>
            <div className="field-pair"><label>Current price <span>{formatCurrency(procurementPrice)} / GB</span><input type="range" min="0.5" max="20" step="0.1" value={procurementPrice} onChange={(event) => setProcurementPrice(Number(event.target.value))} /></label><label>Expected move <span>{expectedMove >= 0 ? '+' : ''}{expectedMove}%</span><input type="range" min="-30" max="50" step="1" value={expectedMove} onChange={(event) => setExpectedMove(Number(event.target.value))} /></label></div>
            <div className="field-pair"><label>Decision delay <span>{delayMonths} months</span><input type="range" min="1" max="12" step="1" value={delayMonths} onChange={(event) => setDelayMonths(Number(event.target.value))} /></label><label>Annual holding cost <span>{holdingCost}%</span><input type="range" min="0" max="30" step="1" value={holdingCost} onChange={(event) => setHoldingCost(Number(event.target.value))} /></label></div>
            <button type="button" className="button button--quiet" disabled={brief.data?.ddr5.forecast_change_percent == null} onClick={() => {
              setExpectedMove(Math.round(brief.data?.ddr5.forecast_change_percent ?? expectedMove))
              if (brief.data?.ddr5.latest_price_per_gb != null) setProcurementPrice(brief.data.ddr5.latest_price_per_gb)
            }}>Use latest model-implied move and price</button>
            <p className="form-note">Model signal: {brief.data?.ddr5.forecast_change_percent == null ? 'not available' : `${formatNumber(brief.data.ddr5.forecast_change_percent, 2)}%`}. Inputs remain on this device.</p>
          </form>
          <aside className="scenario-results procurement-result">
            <p className="eyebrow">Modeled posture</p><h3>{procurement.posture}</h3>
            <strong className={procurement.costAvoidanceFromBuyingNow < 0 ? 'negative' : ''}>{procurement.costAvoidanceFromBuyingNow >= 0 ? '+' : '−'}{formatCurrency(Math.abs(procurement.costAvoidanceFromBuyingNow))}</strong><p>{procurement.costAvoidanceFromBuyingNow >= 0 ? 'modeled cost avoided by purchasing now' : 'modeled advantage from waiting'}</p>
            <dl><div><dt>Purchase now</dt><dd>{formatCurrency(procurement.purchaseNow)}</dd></div><div><dt>Carrying cost</dt><dd>{formatCurrency(procurement.carryingCost)}</dd></div><div><dt>Projected wait cost</dt><dd>{formatCurrency(procurement.projectedWaitCost)}</dd></div></dl>
          </aside>
        </div>
      </section>
      <p className="page-disclaimer">Decision lab output is scenario analysis, not a purchasing recommendation. It excludes supplier terms, lead-time risk, tax, financing constraints, and negotiated contract pricing.</p>
    </>
  )
}
