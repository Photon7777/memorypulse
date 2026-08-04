import { describe, expect, it } from 'vitest'
import { formatDate, formatNumber, freshnessLabel, missingDataMessage, scoreStatus } from './format'

describe('market formatting', () => {
  it('formats unavailable and finite values safely', () => {
    expect(formatNumber(null)).toBe('Not available')
    expect(formatNumber(1234.56, 1)).toBe('1,234.6')
    expect(formatDate('not-a-date')).toBe('Invalid date')
  })

  it('labels freshness deterministically', () => {
    const now = new Date('2025-02-03T12:00:00Z')
    expect(freshnessLabel('2025-02-03T01:00:00Z', now)).toBe('Updated today')
    expect(freshnessLabel('2025-02-01T12:00:00Z', now)).toBe('Updated 2 days ago')
  })

  it('matches index status boundaries and missing-data copy', () => {
    expect([0, 25, 50, 75].map(scoreStatus)).toEqual(['Normal', 'Moderate Pressure', 'Elevated Pressure', 'Severe Pressure'])
    expect(missingDataMessage('Retail history')).toContain('not available yet')
  })
})
