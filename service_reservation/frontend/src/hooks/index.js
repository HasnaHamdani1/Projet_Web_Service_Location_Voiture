import { useCallback, useEffect, useRef, useState } from 'react'

export function useDebounce(value, delay = 300) {
  const [debounced, setDebounced] = useState(value)
  useEffect(() => {
    const t = setTimeout(() => setDebounced(value), delay)
    return () => clearTimeout(t)
  }, [value, delay])
  return debounced
}

/**
 * Charge une ressource asynchrone : { data, loading, error, reload, setData }.
 * Ignore les réponses obsolètes si les dépendances changent pendant le chargement.
 */
export function useAsync(fn, deps = [], { enabled = true } = {}) {
  const [state, setState] = useState({ data: undefined, loading: enabled, error: null })
  const callId = useRef(0)

  const run = useCallback(async () => {
    const id = ++callId.current
    setState((s) => ({ ...s, loading: true, error: null }))
    try {
      const data = await fn()
      if (id === callId.current) setState({ data, loading: false, error: null })
      return data
    } catch (error) {
      if (id === callId.current) setState((s) => ({ ...s, loading: false, error }))
      return undefined
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps)

  useEffect(() => {
    if (enabled) run()
  }, [run, enabled])

  const setData = useCallback((data) => setState((s) => ({ ...s, data })), [])
  return { ...state, reload: run, setData }
}

/** Raccourci ⌘K / Ctrl+K */
export function useHotkey(key, handler) {
  useEffect(() => {
    const onKey = (e) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === key) {
        e.preventDefault()
        handler()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [key, handler])
}

export function useDocumentTitle(title) {
  useEffect(() => {
    document.title = title ? `${title} – PARC AUTO` : 'PARC AUTO'
  }, [title])
}
