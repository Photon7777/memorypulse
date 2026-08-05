import { describe, expect, it } from 'vitest'
import type { DecisionBrief } from '../types/data'
import { buildLinkedInCopy } from './share'

describe('LinkedIn insight copy', () => {
  it('includes the conclusion, DDR5 move, source link, and disclosure-friendly tags', () => {
    const brief = {
      regime: 'Stable', direction: 'Mixed signals', conclusion: 'Maintain planned purchasing.', pressure_score: 28,
      confidence: 'Medium', ddr5: { recent_change_percent: 4.25 },
    } as DecisionBrief
    const copy = buildLinkedInCopy(brief, 'https://example.com')
    expect(copy).toContain('Maintain planned purchasing.')
    expect(copy).toContain('+4.3%')
    expect(copy).toContain('https://example.com')
    expect(copy).toContain('#OpenData')
  })
})
