export interface ScenarioInput {
  capacityGb: number
  baselinePerGb: number
  increasePercent: number
  memorySharePercent: number
}

export interface ScenarioResult {
  baselineMemoryCost: number
  memoryComponentIncrease: number
  deviceCostExposure: number
  low: number
  central: number
  high: number
}

export function calculateScenario(input: ScenarioInput): ScenarioResult {
  const baselineMemoryCost = Math.max(0, input.capacityGb) * Math.max(0, input.baselinePerGb)
  const central = baselineMemoryCost * (Math.max(0, input.increasePercent) / 100)
  const share = Math.min(100, Math.max(0, input.memorySharePercent)) / 100
  return {
    baselineMemoryCost,
    memoryComponentIncrease: central,
    deviceCostExposure: central * share,
    low: central * 0.6,
    central,
    high: central * 1.4,
  }
}

export interface ProcurementScenarioInput {
  units: number
  capacityGb: number
  currentPricePerGb: number
  expectedMovePercent: number
  delayMonths: number
  annualHoldingCostPercent: number
}

export interface ProcurementScenarioResult {
  purchaseNow: number
  carryingCost: number
  effectiveBuyNowCost: number
  projectedWaitCost: number
  costAvoidanceFromBuyingNow: number
  posture: string
}

export function calculateProcurementScenario(input: ProcurementScenarioInput): ProcurementScenarioResult {
  const purchaseNow = Math.max(0, input.units) * Math.max(0, input.capacityGb) * Math.max(0, input.currentPricePerGb)
  const delayFraction = Math.max(0, input.delayMonths) / 12
  const carryingCost = purchaseNow * Math.max(0, input.annualHoldingCostPercent) / 100 * delayFraction
  const projectedWaitCost = purchaseNow * Math.max(0, 1 + input.expectedMovePercent / 100)
  const effectiveBuyNowCost = purchaseNow + carryingCost
  const advantage = projectedWaitCost - effectiveBuyNowCost
  const materiality = purchaseNow ? advantage / purchaseNow : 0
  const posture = materiality > 0.02
    ? 'Accelerate critical coverage'
    : materiality < -0.02
      ? 'Phase purchases and preserve flexibility'
      : 'Stagger purchases; modeled difference is immaterial'
  return { purchaseNow, carryingCost, effectiveBuyNowCost, projectedWaitCost, costAvoidanceFromBuyingNow: advantage, posture }
}
