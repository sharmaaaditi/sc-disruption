import {useEffect, useMemo, useState, type FormEvent} from 'react';
import {AlertTriangle, LoaderCircle, Play} from 'lucide-react';
import type {SimulationRequest, SupplyChain} from '../types';

type Props = {supplyChain: SupplyChain; busy: boolean; onRun: (request: SimulationRequest) => Promise<void>};

export function SimulationPanel({supplyChain, busy, onRun}: Props) {
  const suppliers = useMemo(() => supplyChain.nodes.filter((node) => node.type === 'SUPPLIER'), [supplyChain.nodes]);
  const [targetId, setTargetId] = useState(suppliers[0]?.id || '');
  const [startStep, setStartStep] = useState(1);
  const [duration, setDuration] = useState(3);
  const [totalSteps, setTotalSteps] = useState(10);

  useEffect(() => setTargetId(suppliers[0]?.id || ''), [supplyChain.id, suppliers]);

  async function submit(event: FormEvent) {
    event.preventDefault();
    await onRun({
      name: `${supplyChain.name} supplier interruption`,
      disruptions: [{type: 'SUPPLIER_FAILURE', targetId, startStep, duration}],
      config: {totalSteps, replenishmentThreshold: 30, reorderBatchSize: 50},
    });
  }

  return (
    <form className="simulation-panel" onSubmit={submit}>
      <div className="panel-heading"><div><p className="eyebrow">Scenario controls</p><h2>Interrupt a supplier</h2></div><AlertTriangle aria-hidden="true" /></div>
      <label>Target supplier<select value={targetId} onChange={(event) => setTargetId(event.target.value)} required>{suppliers.map((supplier) => <option key={supplier.id} value={supplier.id}>{supplier.name}</option>)}</select></label>
      <div className="field-pair">
        <label>Starts at step<input type="number" min="0" max={Math.max(0, totalSteps - 1)} value={startStep} onChange={(event) => setStartStep(Number(event.target.value))} /></label>
        <label>Duration<input type="number" min="1" value={duration} onChange={(event) => setDuration(Number(event.target.value))} /></label>
      </div>
      <label>Simulation steps<input type="number" min="2" value={totalSteps} onChange={(event) => setTotalSteps(Number(event.target.value))} /></label>
      <button className="primary-action" type="submit" disabled={busy || !targetId || startStep >= totalSteps}>{busy ? <LoaderCircle className="spin" aria-hidden="true" /> : <Play aria-hidden="true" />}{busy ? 'Running simulation' : 'Run simulation'}</button>
      {!suppliers.length && <p className="field-error">This network has no supplier node to disrupt.</p>}
    </form>
  );
}
