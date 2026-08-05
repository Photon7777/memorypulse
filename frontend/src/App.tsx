import { lazy, Suspense, useEffect, useState } from 'react'
import { HashLink } from './components/HashLink'
import { useStaticData } from './hooks/useStaticData'
import { OverviewPage } from './pages/OverviewPage'
import type { Manifest } from './types/data'
import { formatDate } from './utils/format'
import { isManifest } from './utils/guards'

const PricesPage = lazy(() => import('./pages/PricesPage').then((module) => ({ default: module.PricesPage })))
const AnalyticsPage = lazy(() => import('./pages/AnalyticsPage').then((module) => ({ default: module.AnalyticsPage })))
const ContextPage = lazy(() => import('./pages/ContextPage').then((module) => ({ default: module.ContextPage })))
const EventsPage = lazy(() => import('./pages/EventsPage').then((module) => ({ default: module.EventsPage })))
const ForecastsPage = lazy(() => import('./pages/ForecastsPage').then((module) => ({ default: module.ForecastsPage })))
const ExplorerPage = lazy(() => import('./pages/ExplorerPage').then((module) => ({ default: module.ExplorerPage })))
const MethodologyPage = lazy(() => import('./pages/MethodologyPage').then((module) => ({ default: module.MethodologyPage })))
const HealthPage = lazy(() => import('./pages/HealthPage').then((module) => ({ default: module.HealthPage })))
const DataPage = lazy(() => import('./pages/DataPage').then((module) => ({ default: module.DataPage })))

const navigation = [
  ['/', 'Executive'],
  ['/analytics', 'Market analytics'],
  ['/forecasts', 'Forecasts'],
  ['/explorer', 'Scenario lab'],
  ['/data', 'Data'],
]

const routeTitles: Record<string, string> = {
  '/': 'Executive decision brief',
  '/analytics': 'Market analytics',
  '/forecasts': 'Forecasts and model governance',
  '/explorer': 'Scenario lab',
  '/data': 'Public dataset',
  '/prices': 'Price explorer',
  '/events': 'Event catalog',
  '/context': 'AI and memory context',
  '/methodology': 'Methodology',
  '/health': 'Source health',
}

function currentRoute(): string {
  return window.location.hash.replace(/^#/, '').split('?')[0] || '/'
}

function useHashRoute(): string {
  const [route, setRoute] = useState(currentRoute)
  useEffect(() => {
    const update = () => {
      setRoute(currentRoute())
      document.getElementById('main-content')?.focus({ preventScroll: true })
      window.scrollTo({ top: 0, behavior: 'instant' })
    }
    window.addEventListener('hashchange', update)
    return () => window.removeEventListener('hashchange', update)
  }, [])
  return route
}

function RouteContent({ route }: { route: string }) {
  switch (route) {
    case '/': return <OverviewPage />
    case '/analytics': return <AnalyticsPage />
    case '/prices': return <PricesPage />
    case '/context': return <ContextPage />
    case '/events': return <EventsPage />
    case '/forecasts': return <ForecastsPage />
    case '/explorer': return <ExplorerPage />
    case '/methodology': return <MethodologyPage />
    case '/health': return <HealthPage />
    case '/data': return <DataPage />
    default: return <div className="empty-state empty-state--large"><strong>Page not found</strong><HashLink to="/">Return to the overview</HashLink></div>
  }
}

function App() {
  const manifest = useStaticData<Manifest>('manifest.json', isManifest)
  const route = useHashRoute()
  useEffect(() => {
    document.title = `${routeTitles[route] ?? 'Memory intelligence'} — MemoryPulse`
  }, [route])
  return (
    <div className="site-shell">
      <a className="skip-link" href="#main-content" onClick={(event) => { event.preventDefault(); document.getElementById('main-content')?.focus() }}>Skip to content</a>
      <header className="site-header">
        <HashLink className="brand" to="/" aria-label="MemoryPulse home"><span className="brand-mark"><i /><i /><i /></span><span>Memory<strong>Pulse</strong></span></HashLink>
        <nav aria-label="Primary navigation">{navigation.map(([path, label]) => <HashLink key={path} to={path} active={route === path}>{label}</HashLink>)}</nav>
        <details className="header-more"><summary>About the data</summary><div><HashLink to="/prices">Price explorer</HashLink><HashLink to="/events">Event catalog</HashLink><HashLink to="/context">AI context</HashLink><HashLink to="/methodology">Methodology</HashLink><HashLink to="/health">Source health</HashLink></div></details>
      </header>
      <main id="main-content" tabIndex={-1}>
        <Suspense fallback={<div className="data-message" role="status"><span className="loading-mark" />Loading research view…</div>}>
          <RouteContent route={route} />
        </Suspense>
      </main>
      <footer className="site-footer">
        <div><HashLink className="brand brand--footer" to="/"><span className="brand-mark"><i /><i /><i /></span><span>Memory<strong>Pulse</strong></span></HashLink><p>Open, explainable memory-market intelligence from public data.</p></div>
        <div><p className="eyebrow">Explore</p><HashLink to="/analytics">Market analytics</HashLink><HashLink to="/forecasts">Forecasts</HashLink><HashLink to="/explorer">Scenario lab</HashLink></div>
        <div><p className="eyebrow">Open data</p><HashLink to="/data">Dataset catalog</HashLink><HashLink to="/methodology">Methodology</HashLink><HashLink to="/health">Source health</HashLink></div>
        <div><p className="eyebrow">Attribution</p><span>Stanford · FRED · BLS</span><span>World Bank · GDELT</span><span>Federal Register</span></div>
        <div><p className="eyebrow">Latest build</p><span>{manifest.error ? 'Manifest unavailable' : formatDate(manifest.data?.generated_at, true)}</span><span>Methodology v{manifest.data?.methodology_version ?? '1.1.0'}</span><a href="https://github.com/Photon7777/memorypulse">GitHub repository</a></div>
        <p className="footer-disclaimer">MemoryPulse is an independent research project. Its index and forecasts are analytical estimates—not official benchmarks, investment advice, purchasing advice, or guarantees of future prices.</p>
      </footer>
    </div>
  )
}

export default App
