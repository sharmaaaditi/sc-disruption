export type NodeType = 'SUPPLIER' | 'WAREHOUSE' | 'DISTRIBUTION_CENTER' | 'RETAILER';
export type SupplyChainNode = {id: string; name: string; type: NodeType};
export type SupplyChainEdge = {id: string; fromNodeId: string; toNodeId: string};
export type SupplyChain = {id: string; name: string; nodes: SupplyChainNode[]; edges?: SupplyChainEdge[]};
export type SimulationEvent = {step: number; sequence?: number; type: string; targetType?: string; targetId?: string; message?: string};
export type SimulationMetrics = {
  totalOrders?: number; totalDemand?: number; fulfilledQuantity?: number;
  remainingQuantity?: number; stockoutEvents?: number; stockouts?: number;
  delayedOrders?: number; additionalCost?: number; recoveryTime?: number;
  affectedNodes?: string[]; affectedEdges?: string[];
};
export type SimulationResult = {
  runId: string; scenarioId: string; status: string; totalSteps: number;
  metrics: SimulationMetrics | null;
  finalState: {inventory?: Array<{nodeId: string; productId: string; quantity: number}>; orders?: Array<{orderId: string; status: string}>} | null;
  events: SimulationEvent[];
};
export type SimulationRequest = {
  name: string;
  disruptions: Array<{type: 'SUPPLIER_FAILURE' | 'NODE_OUTAGE'; targetId: string; startStep: number; duration: number}>;
  config: {totalSteps: number; replenishmentThreshold: number; reorderBatchSize: number};
};
