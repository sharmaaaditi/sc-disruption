import {useState, type FormEvent} from 'react';
import {AlertTriangle, LoaderCircle, Play} from 'lucide-react';
import type {SimulationRequest, SupplyChain} from '../types';

type Props = {supplyChain: SupplyChain; busy: boolean; onRun: (request: SimulationRequest) => Promise<void>};
type DisruptionType = SimulationRequest['disruptions'][number]['type'];

export function SimulationPanel({supplyChain, busy, onRun}: Props) {
  const [type, setType] = useState<DisruptionType>('SUPPLIER_FAILURE');
  const [selectedTargetId, setSelectedTargetId] = useState('');
  const [startStep, setStartStep] = useState(1);
  const [duration, setDuration] = useState(3);
  const [totalSteps, setTotalSteps] = useState(10);

  const supplierFailure = type === 'SUPPLIER_FAILURE';
  const targets = supplierFailure
    ? supplyChain.nodes.filter((node) => node.type === 'SUPPLIER')
    : supplyChain.nodes;
  const defaultTarget = supplierFailure ? targets[0] : targets.find((node) => node.type === 'RETAILER') ?? targets[0];
  const target = targets.find((node) => node.id === selectedTargetId) ?? defaultTarget;

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (!target || busy || startStep >= totalSteps) return;
    await onRun({
      name: `${supplyChain.name} – ${target.name} ${supplierFailure ? 'supplier outage' : 'facility outage'}`,
      disruptions: [{type, targetId: target.id, startStep, duration}],
      config: {totalSteps, replenishmentThreshold: 30, reorderBatchSize: 50},
    });
  }

  return (
    <form className="simulation-panel" onSubmit={submit}>
      <div className="panel-heading"><div><p className="eyebrow">Scenario controls</p><h2>Set up an outage</h2></div><AlertTriangle aria-hidden="true" /></div>
      <label>Disruption type
        <select value={type} onChange={(event) => {setType(event.target.value as DisruptionType); setSelectedTargetId('');}}>
          <option value="SUPPLIER_FAILURE">Supplier outage</option>
          <option value="NODE_OUTAGE">Facility outage</option>
        </select>
      </label>
      <label>{supplierFailure ? 'Target supplier' : 'Target facility'}
        <select value={target?.id ?? ''} onChange={(event) => setSelectedTargetId(event.target.value)} required>
          {targets.map((node) => <option key={node.id} value={node.id}>{node.name}</option>)}
        </select>
      </label>
      <div className="field-pair">
        <label>Starts at step<input type="number" min="0" max={Math.max(0, totalSteps - 1)} value={startStep} onChange={(event) => setStartStep(Number(event.target.value))} /></label>
        <label>Duration<input type="number" min="1" value={duration} onChange={(event) => setDuration(Number(event.target.value))} /></label>
      </div>
      <label>Simulation steps<input type="number" min="2" value={totalSteps} onChange={(event) => setTotalSteps(Number(event.target.value))} /></label>
      <button className="primary-action" type="submit" disabled={busy || !target || startStep >= totalSteps}>{busy ? <LoaderCircle className="spin" aria-hidden="true" /> : <Play aria-hidden="true" />}{busy ? 'Running simulation' : 'Run simulation'}</button>
      {supplyChain.id === 'demo-supply-chain' && supplierFailure && <p className="empty-copy scenario-hint">Retailer stock can absorb a supplier outage. To see an order wait, try a facility outage at Retailer A.</p>}
      {!targets.length && <p className="field-error">This network has no eligible outage target.</p>}
    </form>
  );
}
