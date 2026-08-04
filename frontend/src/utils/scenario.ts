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
