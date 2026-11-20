import {useEffect, useLayoutEffect, useMemo, useRef, useState} from 'react';
import {Activity, AlertCircle, Database, Network, RefreshCw} from 'lucide-react';
import {gsap} from 'gsap';
import {api, ApiError} from './api';
import networkStrip from './assets/network-strip.svg';
import {NetworkCanvas} from './components/NetworkCanvas';
import {SimulationPanel} from './components/SimulationPanel';
import {ResultsDashboard} from './components/ResultsDashboard';
import type {SimulationRequest, SimulationResult, SupplyChain} from './types';

type Health = 'checking' | 'online' | 'offline';

export default function App() {
  const root = useRef<HTMLElement>(null);
  const [health, setHealth] = useState<Health>('checking');
  const [supplyChains, setSupplyChains] = useState<SupplyChain[]>([]);
  const [selectedId, setSelectedId] = useState('');
  const [loading, setLoading] = useState(true);
  const [running, setRunning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<SimulationResult | null>(null);

  const selected = useMemo(
    () => supplyChains.find((chain) => chain.id === selectedId) || supplyChains[0] || null,
    [selectedId, supplyChains],
  );

  useLayoutEffect(() => {
    const media = gsap.matchMedia();
    media.add('(prefers-reduced-motion: no-preference)', () => {
      const context = gsap.context(() => {
        gsap.from('.topbar', {y: -20, opacity: 0, duration: 0.6, ease: 'power2.out'});
        gsap.from('.hero-copy > *', {y: 34, opacity: 0, duration: 0.8, stagger: 0.1, ease: 'power3.out'});
        gsap.from('.intro-orbit', {scale: 0.78, opacity: 0, duration: 1, ease: 'power3.out'});
      }, root);
      return () => context.revert();
    });
    return () => media.revert();
  }, []);

  async function loadWorkspace() {
    setLoading(true);
    setError(null);
    const healthRequest = api.health().then(() => setHealth('online')).catch(() => setHealth('offline'));
    try {
      const chains = await api.listSupplyChains();
      setSupplyChains(chains);
      setSelectedId((current) => current || chains[0]?.id || '');
    } catch (caught) {
      setError(formatError(caught));
    } finally {
      await healthRequest;
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadWorkspace();
  }, []);

  async function runSimulation(request: SimulationRequest) {
    if (!selected) return;
    setRunning(true);
    setError(null);
    try {
      setResult(await api.startSimulation(selected.id, request));
      requestAnimationFrame(() => document.getElementById('results')?.scrollIntoView({behavior: 'smooth'}));
    } catch (caught) {
      setError(formatError(caught));
    } finally {
      setRunning(false);
    }
  }

  return (
    <main className="app-shell" ref={root}>
      <nav className="topbar" aria-label="Primary navigation">
        <a className="brand" href="#top" aria-label="SC Disruption home"><span className="brand-mark">SC</span><span>Disruption</span></a>
        <div className={`topbar-status topbar-status--${health}`} role="status"><span className="status-dot" />API {health}</div>
      </nav>

      <section className="shell-intro" id="top">
        <div className="hero-copy">
          <p className="eyebrow">Supply-chain resilience workspace</p>
          <h1>See the weak link. <img className="inline-network-strip" src={networkStrip} alt="" /> Test the response.</h1>
          <p className="lede">Choose a saved network, interrupt a supplier, and read the operational impact from one traceable simulation run.</p>
        </div>
        <div className="intro-orbit" aria-hidden="true"><Network size={52} strokeWidth={1.5} /><span className="orbit orbit-one" /><span className="orbit orbit-two" /></div>
      </section>

      {error && <div className="error-banner" role="alert"><AlertCircle aria-hidden="true" /><span>{error}</span><button type="button" onClick={() => void loadWorkspace()}><RefreshCw aria-hidden="true" />Retry</button></div>}

      <section className="workspace" aria-busy={loading}>
        <header className="workspace-header">
          <div><p className="eyebrow">Operating network</p><h2>{loading ? 'Loading saved networks' : selected?.name || 'No supply chain available'}</h2></div>
          <label className="network-picker">Supply chain<select value={selected?.id || ''} onChange={(event) => {setSelectedId(event.target.value); setResult(null);}} disabled={loading || running || !supplyChains.length}>{supplyChains.map((chain) => <option key={chain.id} value={chain.id}>{chain.name}</option>)}</select></label>
        </header>

        <div className="workspace-grid">
          <article className="network-panel">
            <div className="panel-heading"><div><p className="eyebrow">Facility map</p><h3>{selected ? `${selected.nodes.length} facilities, ${selected.edges?.length ?? 0} routes` : 'Waiting for data'}</h3></div><Database aria-hidden="true" /></div>
            {selected ? <NetworkCanvas key={selected.id} nodes={selected.nodes} routes={selected.edges ?? []} /> : <div className="empty-state"><Activity aria-hidden="true" /><p>Start the backend and seed PostgreSQL to load a network.</p></div>}
          </article>
          {selected ? <SimulationPanel supplyChain={selected} busy={running} onRun={runSimulation} /> : <aside className="simulation-panel simulation-panel--empty"><p>Simulation controls become available after a network loads.</p></aside>}
        </div>
      </section>

      {result ? <ResultsDashboard result={result} /> : (
        <section className="result-placeholder" id="results" aria-live="polite">
          <p className="eyebrow">Impact analysis</p><h2>Results will collect here.</h2><p>Run a supplier interruption to reveal metrics, final inventory, delayed orders, and the ordered event timeline.</p>
        </section>
      )}
    </main>
  );
}

function formatError(error: unknown) {
  if (error instanceof ApiError) return `${error.message} (${error.code})`;
  return error instanceof Error ? error.message : 'An unexpected error occurred.';
}
