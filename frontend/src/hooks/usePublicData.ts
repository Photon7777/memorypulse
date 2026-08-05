import { useEffect, useState } from 'react'
import { publicAssetUrl } from '../services/data'

interface DataState<T> {
  data: T | null
  loading: boolean
  error: string | null
}

export function usePublicData<T>(path: string): DataState<T> {
  const [state, setState] = useState<DataState<T>>({ data: null, loading: true, error: null })

  useEffect(() => {
    const controller = new AbortController()
    void fetch(publicAssetUrl(path), { signal: controller.signal, cache: 'no-cache' })
      .then((response) => {
        if (!response.ok) throw new Error(`Public data returned HTTP ${response.status}`)
        return response.json() as Promise<T>
      })
      .then((data) => setState({ data, loading: false, error: null }))
      .catch((error: unknown) => {
        if (controller.signal.aborted) return
        setState({ data: null, loading: false, error: error instanceof Error ? error.message : 'Unknown data error' })
      })
    return () => controller.abort()
  }, [path])

  return state
}
