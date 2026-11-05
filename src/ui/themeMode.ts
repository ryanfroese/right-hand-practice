import { useEffect, useState } from 'preact/hooks'

export type ThemeMode = 'light' | 'dark' | 'system'
export type ResolvedTheme = 'light' | 'dark'

/**
 * Raw localStorage key (not JSON) — MUST match the inline script in index.html,
 * which sets data-theme before first paint.
 */
export const THEME_KEY = 'rh.theme'

const isMode = (m: unknown): m is ThemeMode => m === 'light' || m === 'dark' || m === 'system'

/** ?theme=light|dark|system — a session override (handy for screenshots), never persisted. */
function urlOverride(): ThemeMode | null {
  const m = new URLSearchParams(location.search).get('theme')
  return isMode(m) ? m : null
}

function stored(): ThemeMode {
  try {
    const m = localStorage.getItem(THEME_KEY)
    return isMode(m) ? m : 'system'
  } catch {
    return 'system'
  }
}

const darkQuery = () => window.matchMedia('(prefers-color-scheme: dark)')

function resolve(mode: ThemeMode): ResolvedTheme {
  if (mode !== 'system') return mode
  return darkQuery().matches ? 'dark' : 'light'
}

function apply(t: ResolvedTheme) {
  const root = document.documentElement
  root.dataset.theme = t
  const meta = document.querySelector('meta[name="theme-color"]')
  meta?.setAttribute('content', t === 'dark' ? '#0b0e14' : '#f4f2fb')
}

export function useThemeMode(): [ThemeMode, (m: ThemeMode) => void] {
  const [mode, setModeState] = useState<ThemeMode>(() => urlOverride() ?? stored())

  useEffect(() => {
    apply(resolve(mode))
    if (mode !== 'system') return
    const mq = darkQuery()
    const onChange = () => apply(resolve('system'))
    mq.addEventListener('change', onChange)
    return () => mq.removeEventListener('change', onChange)
  }, [mode])

  const setMode = (m: ThemeMode) => {
    try {
      localStorage.setItem(THEME_KEY, m)
    } catch {
      /* ignore */
    }
    setModeState(m)
  }
  return [mode, setMode]
}
