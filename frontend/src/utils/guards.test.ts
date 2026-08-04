import { describe, expect, it } from 'vitest'
import { isManifest } from './guards'

describe('JSON contract guards', () => {
  it('accepts the manifest contract and rejects partial data', () => {
    expect(isManifest({ schema_version: '1', generated_at: '2025-01-01T00:00:00Z', files: [], production_data: true, fixture_data: false })).toBe(true)
    expect(isManifest({ schema_version: '1' })).toBe(false)
    expect(isManifest(null)).toBe(false)
  })
})
