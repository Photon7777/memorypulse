import type { Manifest } from '../types/data'

export function isManifest(value: unknown): value is Manifest {
  if (!value || typeof value !== 'object') return false
  const item = value as Record<string, unknown>
  return typeof item.schema_version === 'string'
    && typeof item.generated_at === 'string'
    && Array.isArray(item.files)
    && typeof item.production_data === 'boolean'
    && typeof item.fixture_data === 'boolean'
}
