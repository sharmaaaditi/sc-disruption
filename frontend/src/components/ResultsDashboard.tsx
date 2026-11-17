import {useLayoutEffect, useMemo, useRef, useState} from 'react';
import {ArrowLeft, ArrowRight, CheckCircle2, Clock3, PackageCheck, PackageX} from 'lucide-react';
import {Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis} from 'recharts';
import {gsap} from 'gsap';
import {ScrollTrigger} from 'gsap/ScrollTrigger';
import type {SimulationEvent, SimulationResult} from '../types';

gsap.registerPlugin(ScrollTrigger);

const metricDefinitions = [
  {key: 'fulfilledQuantity', label: 'Fulfilled quantity', icon: PackageCheck, tone: 'recovery'},
  {key: 'remainingQuantity', label: 'Unfilled demand', icon: PackageX, tone: 'warning'},
  {key: 'delayedOrders', label: 'Delayed orders', icon: Clock3, tone: 'failure'},
  {key: 'recoveryTime', label: 'Recovery steps', icon: CheckCircle2, tone: 'signal'},
] as const;

export function ResultsDashboard({result}: {result: SimulationResult}) {
  const section = useRef<HTMLElement>(null);
  const summary = useRef<HTMLDivElement>(null);
  const [activeEvent, setActiveEvent] = useState(0);
  const events = result.events || [];
  const inventory = useMemo(
    () => (result.finalState?.inventory || []).map((item) => ({name: compact(item.nodeId), quantity: item.quantity})),
    [result.finalState],
  );

  useLayoutEffect(() => {
    setActiveEvent(0);
    const media = gsap.matchMedia();
    media.add('(prefers-reduced-motion: no-preference)', () => {
      const context = gsap.context(() => {
        gsap.from('.metric-card', {y: 72, opacity: 0, duration: 0.7, stagger: 0.09, ease: 'power3.out'});
        gsap.from('.result-detail', {y: 48, opacity: 0, duration: 0.8, stagger: 0.12, ease: 'power3.out'});
      }, section);
      return () => context.revert();
    });
    media.add('(min-width: 960px) and (prefers-reduced-motion: no-preference)', () => {
      if (!section.current || !summary.current) return;
      const trigger = ScrollTrigger.create({
        trigger: section.current,
        start: 'top top+=36',
        end: 'bottom bottom-=80',
        pin: summary.current,
        pinSpacing: false,
      });
      return () => trigger.kill();
    });
    return () => media.revert();
  }, [result.runId]);

  function moveEvent(direction: number) {
    if (!events.length) return;
    setActiveEvent((current) => (current + direction + events.length) % events.length);
  }

  return (
    <section className="results-section" id="results" ref={section} aria-labelledby="results-heading">
      <div className="results-summary" ref={summary}>
        <p className="eyebrow">Latest saved run</p>
        <h2 id="results-heading">Impact, without the guesswork.</h2>
        <div className="run-reference"><span>{result.status}</span><code>{compact(result.runId, 18)}</code></div>
        <p>The engine completed {result.totalSteps} steps and returned a final state, impact measures, and an ordered explanation of what happened.</p>
      </div>

      <div className="results-content">
        <div className="metrics-grid" aria-label="Impact metrics">
          {metricDefinitions.map(({key, label, icon: Icon, tone}) => (
            <article className={`metric-card metric-card--${tone}`} key={key}>
              <Icon aria-hidden="true" />
              <strong>{formatMetric(result.metrics?.[key])}</strong>
              <span>{label}</span>
            </article>
          ))}
        </div>

        <article className="result-detail inventory-chart">
          <header><div><p className="eyebrow">Final state</p><h3>Inventory by facility</h3></div><span>{inventory.length} records</span></header>
          {inventory.length ? (
            <ResponsiveContainer width="100%" height={280}>
              <BarChart data={inventory} margin={{top: 18, right: 12, left: -18, bottom: 0}}>
                <CartesianGrid stroke="rgba(16,33,39,0.12)" vertical={false} />
                <XAxis dataKey="name" tick={{fill: '#496067', fontSize: 11}} axisLine={false} tickLine={false} />
                <YAxis tick={{fill: '#496067', fontSize: 11}} axisLine={false} tickLine={false} />
                <Tooltip cursor={{fill: 'rgba(52,214,198,0.12)'}} contentStyle={{borderRadius: 10, border: 0, background: '#102127', color: '#f4f7f2'}} />
                <Bar dataKey="quantity" fill="#087d72" radius={[7, 7, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          ) : <p className="empty-copy">The API did not return final inventory records for this run.</p>}
        </article>

        <article className="result-detail event-inspector">
          <header>
            <div><p className="eyebrow">Ordered evidence</p><h3>Event timeline</h3></div>
            <div className="event-controls">
              <button type="button" onClick={() => moveEvent(-1)} disabled={!events.length} aria-label="Previous event"><ArrowLeft /></button>
              <span>{events.length ? `${activeEvent + 1} / ${events.length}` : '0 / 0'}</span>
              <button type="button" onClick={() => moveEvent(1)} disabled={!events.length} aria-label="Next event"><ArrowRight /></button>
            </div>
          </header>
          {events.length ? <EventAccordion events={events} active={activeEvent} onSelect={setActiveEvent} /> : <p className="empty-copy">No ordered events were returned for this run.</p>}
        </article>
      </div>
    </section>
  );
}

function EventAccordion({events, active, onSelect}: {events: SimulationEvent[]; active: number; onSelect: (index: number) => void}) {
  return (
    <div className="event-accordion">
      {events.map((event, index) => (
        <button
          className={index === active ? 'event-slice event-slice--active' : 'event-slice'}
          type="button"
          key={`${event.step}-${event.sequence || index}-${event.type}`}
          onClick={() => onSelect(index)}
          aria-pressed={index === active}
        >
          <span className="event-step">t{String(event.step).padStart(2, '0')}</span>
          <span className="event-body"><strong>{humanize(event.type)}</strong><small>{event.message || event.targetId || 'Recorded simulation event'}</small></span>
        </button>
      ))}
    </div>
  );
}

function compact(value: string, length = 14) {
  return value.length > length ? `${value.slice(0, length - 1)}…` : value;
}

function humanize(value: string) {
  return value.toLowerCase().split('_').map((part) => part.charAt(0).toUpperCase() + part.slice(1)).join(' ');
}

function formatMetric(value: number | undefined) {
  return value === undefined ? 'N/A' : new Intl.NumberFormat('en-IN').format(value);
}
