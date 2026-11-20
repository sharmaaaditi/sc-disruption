import {Background, BackgroundVariant, Controls, MarkerType, Position, ReactFlow, type Edge, type Node} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import type {NodeType, SupplyChainEdge, SupplyChainNode} from '../types';

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
      sourcePosition: Position.Right,
      targetPosition: Position.Left,
      className: `network-node network-node--${node.type.toLowerCase()}`,
      draggable: false,
      selectable: true,
    };
  });
}

export function NetworkCanvas({nodes, routes}: {nodes: SupplyChainNode[]; routes: SupplyChainEdge[]}) {
  const names = new Map(nodes.map((node) => [node.id, node.name]));
  const edges: Edge[] = routes.map((route) => ({
    id: route.id,
    source: route.fromNodeId,
    target: route.toNodeId,
    ariaLabel: `Route from ${names.get(route.fromNodeId)} to ${names.get(route.toNodeId)}`,
    markerEnd: {type: MarkerType.ArrowClosed, color: '#6b9aa5'},
    style: {stroke: '#6b9aa5', strokeWidth: 2},
  }));

  return (
    <div className="network-canvas" aria-label="Supply-chain facilities">
      <ReactFlow nodes={toFlowNodes(nodes)} edges={edges} fitView fitViewOptions={{padding: 0.22}} minZoom={0.2} maxZoom={1.5} nodesConnectable={false} elementsSelectable proOptions={{hideAttribution: false}}>
        <Background variant={BackgroundVariant.Dots} color="rgba(159,177,181,0.25)" gap={24} />
        <Controls showInteractive={false} />
      </ReactFlow>
    </div>
  );
}
