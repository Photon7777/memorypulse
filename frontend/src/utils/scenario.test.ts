import { describe, expect, it } from 'vitest'
import { calculateScenario } from './scenario'

describe('consumer impact scenarios', () => {
  it('calculates transparent low, central, and high exposure', () => {
    const result = calculateScenario({ capacityGb: 16, baselinePerGb: 4, increasePercent: 25, memorySharePercent: 10 })
    expect(result.baselineMemoryCost).toBe(64)
    expect(result.central).toBe(16)
    expect(result.low).toBe(9.6)
    expect(result.high).toBe(22.4)
    expect(result.deviceCostExposure).toBe(1.6)
  })

  it('does not produce negative cost exposure', () => {
    expect(calculateScenario({ capacityGb: -1, baselinePerGb: 4, increasePercent: 20, memorySharePercent: 10 }).central).toBe(0)
  })
})
