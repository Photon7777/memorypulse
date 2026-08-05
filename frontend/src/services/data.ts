export class DataLoadError extends Error {
  constructor(public readonly file: string, message: string) {
    super(message)
    this.name = 'DataLoadError'
  }
}

export async function loadStaticJson<T>(file: string, signal?: AbortSignal): Promise<T> {
  const base = publicAssetUrl('data/')
  let response: Response
  try {
    response = await fetch(`${base}${file}`, { signal, cache: 'no-cache' })
  } catch (error) {
    throw new DataLoadError(file, error instanceof Error ? error.message : 'Network request failed')
  }
  if (!response.ok) throw new DataLoadError(file, `Static data returned HTTP ${response.status}`)
  try {
    return await response.json() as T
  } catch {
    throw new DataLoadError(file, 'Static data is not valid JSON')
  }
}

export function publicAssetUrl(path: string): string {
  const base = import.meta.env.BASE_URL.endsWith('/') ? import.meta.env.BASE_URL : `${import.meta.env.BASE_URL}/`
  return `${base}${path.replace(/^\//, '')}`
}
