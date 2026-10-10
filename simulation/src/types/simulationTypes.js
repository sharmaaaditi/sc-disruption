/**
 * @file simulationTypes.js
 * Definitions and constants for graph representation, disruptions, and simulation inputs/outputs.
 */

const NodeType = Object.freeze({
  SUPPLIER: 'SUPPLIER',
  WAREHOUSE: 'WAREHOUSE',
  DISTRIBUTION_CENTER: 'DISTRIBUTION_CENTER',
  RETAILER: 'RETAILER',
});

const DisruptionType = Object.freeze({
  SUPPLIER_FAILURE: 'SUPPLIER_FAILURE',
  NODE_OUTAGE: 'NODE_OUTAGE',
  EDGE_BLOCKAGE: 'EDGE_BLOCKAGE',
  CAPACITY_REDUCTION: 'CAPACITY_REDUCTION',
  DELAY: 'DELAY',
});

const EventType = Object.freeze({
  DISRUPTION_ACTIVATED: 'DISRUPTION_ACTIVATED',
  DISRUPTION_RESOLVED: 'DISRUPTION_RESOLVED',
  SHIPMENT_DISPATCHED: 'SHIPMENT_DISPATCHED',
  SHIPMENT_ARRIVED: 'SHIPMENT_ARRIVED',
  ORDER_FULFILLED: 'ORDER_FULFILLED',
  ORDER_DELAYED: 'ORDER_DELAYED',
  STOCKOUT_OCCURRED: 'STOCKOUT_OCCURRED',
  REPLENISHMENT_ORDERED: 'REPLENISHMENT_ORDERED',
});

const OrderStatus = Object.freeze({
  PENDING: 'PENDING',
  PARTIAL: 'PARTIAL',
  FULFILLED: 'FULFILLED',
  DELAYED: 'DELAYED',
  STOCKOUT: 'STOCKOUT',
});

const ShipmentStatus = Object.freeze({
  IN_TRANSIT: 'IN_TRANSIT',
  DELIVERED: 'DELIVERED',
  HELD: 'HELD',
});

module.exports = {
  NodeType,
  DisruptionType,
  EventType,
  OrderStatus,
  ShipmentStatus,
};
