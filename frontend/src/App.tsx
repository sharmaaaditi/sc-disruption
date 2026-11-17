import {Activity, Network, ShieldCheck} from 'lucide-react';

export default function App() {
  return (
    <main className="app-shell">
      <nav className="topbar" aria-label="Primary navigation">
        <a className="brand" href="#top" aria-label="SC Disruption home">
          <span className="brand-mark">SC</span>
          <span>Disruption</span>
        </a>
        <div className="topbar-status" role="status">
          <span className="status-dot" />
          Interface ready
        </div>
      </nav>

      <section className="shell-intro" id="top">
        <div>
          <p className="eyebrow">Supply-chain resilience workspace</p>
          <h1>See the weak link.<br />Test the response.</h1>
          <p className="lede">
            A focused control room for turning network data into a disruption
            scenario and a traceable operational result.
          </p>
        </div>
        <div className="intro-orbit" aria-hidden="true">
          <Network size={52} strokeWidth={1.5} />
          <span className="orbit orbit-one" />
          <span className="orbit orbit-two" />
        </div>
      </section>

      <section className="placeholder-grid" aria-label="Frontend modules">
        <article><Network /><h2>Network view</h2><p>Facilities and routes will appear here from saved supply-chain data.</p></article>
        <article><Activity /><h2>Simulation controls</h2><p>Choose a disruption, run the engine, and follow its ordered events.</p></article>
        <article><ShieldCheck /><h2>Access policy</h2><p>Viewer, analyst, and admin permissions stay visible and predictable.</p></article>
      </section>
    </main>
  );
}
