import {Background, BackgroundVariant, Controls, ReactFlow, type Node} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import type {NodeType, SupplyChainNode} from '../types';

const columns: Record<NodeType, number> = {SUPPLIER: 40, WAREHOUSE: 310, DISTRIBUTION_CENTER: 580, RETAILER: 850};

function toFlowNodes(nodes: SupplyChainNode[]): Node[] {
  const counts: Partial<Record<NodeType, number>> = {};
  return nodes.map((node) => {
    const index = counts[node.type] || 0;
    counts[node.type] = index + 1;
    return {
      id: node.id,
      position: {x: columns[node.type], y: 64 + index * 128},
      data: {label: node.name},
      className: `network-node network-node--${node.type.toLowerCase()}`,
      draggable: false,
      selectable: true,
    };
  });
}

export function NetworkCanvas({nodes}: {nodes: SupplyChainNode[]}) {
  return (
    <div className="network-canvas" aria-label="Supply-chain facilities">
      <ReactFlow nodes={toFlowNodes(nodes)} edges={[]} fitView fitViewOptions={{padding: 0.22}} minZoom={0.55} maxZoom={1.5} nodesConnectable={false} elementsSelectable proOptions={{hideAttribution: false}}>
        <Background variant={BackgroundVariant.Dots} color="rgba(159,177,181,0.25)" gap={24} />
        <Controls showInteractive={false} />
      </ReactFlow>
      <p className="canvas-note">Facility routes require the detailed-network API; this view does not invent missing edges.</p>
    </div>
  );
}
