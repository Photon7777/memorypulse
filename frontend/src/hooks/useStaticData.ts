import { useEffect, useState } from 'react'
import { loadStaticJson } from '../services/data'

interface DataState<T> {
  data: T | null
  loading: boolean
  error: string | null
}

export function useStaticData<T>(file: string, guard?: (value: unknown) => value is T): DataState<T> {
  const [state, setState] = useState<DataState<T>>({ data: null, loading: true, error: null })

  useEffect(() => {
    const controller = new AbortController()
    setState({ data: null, loading: true, error: null })
    void loadStaticJson<unknown>(file, controller.signal)
      .then((value) => {
        if (guard && !guard(value)) throw new Error(`${file} does not match the expected data contract`)
        setState({ data: value as T, loading: false, error: null })
      })
      .catch((error: unknown) => {
        if (controller.signal.aborted) return
        setState({ data: null, loading: false, error: error instanceof Error ? error.message : 'Unknown data error' })
      })
    return () => controller.abort()
  }, [file, guard])

  return state
}
