const { randomUUID } = require("node:crypto");
const { DisruptionType, NodeType } = require("../../simulation/src/types/simulationTypes");
const ApiError = require("../errors");

const SUPPORTED_DISRUPTION_TYPES = new Set([
  DisruptionType.SUPPLIER_FAILURE,
  DisruptionType.NODE_OUTAGE,
  DisruptionType.EDGE_BLOCKAGE,
]);
const METRIC_FIELDS = [
  "totalOrders",
  "totalDemand",
  "fulfilledQuantity",
  "remainingQuantity",
  "stockoutEvents",
  "stockouts",
  "delayedOrders",
  "additionalCost",
  "recoveryTime",
  "affectedNodes",
  "affectedEdges",
];

function createSimulationService({
  supplyChainRepository,
  simulationRepository,
  runSimulation,
  idGenerator = randomUUID,
}) {
  return {
    async listSupplyChains() {
      return supplyChainRepository.getAllSupplyChains();
    },

    async startSimulation(supplyChainId, body) {
      validateId(supplyChainId, "supplyChainId");
      const request = validateStartRequest(body);

      let input;
      try {
        input = await supplyChainRepository.loadSimulationInput(supplyChainId);
      } catch (error) {
        if (error.message === "Supply chain not found") {
          throw new ApiError(404, "SUPPLY_CHAIN_NOT_FOUND", "Supply chain was not found");
        }
        throw error;
      }

      validateDisruptionTargets(request.disruptions, input.network);
      const disruptions = request.disruptions.map((disruption) => ({
        ...disruption,
        id: idGenerator(),
      }));
      const scenario = await simulationRepository.createScenario({
        supplyChainId,
        name: request.name || `Simulation ${new Date().toISOString()}`,
        disruptions,
      });
      const runId = idGenerator();
      const run = await simulationRepository.createRun({
        id: runId,
        scenarioId: scenario.id,
        totalSteps: request.config.totalSteps,
      });

      try {
        const result = runSimulation({
          ...input,
          disruptions,
          config: request.config,
        });
        await simulationRepository.saveRunResult(run.id, result);
        return {
          runId: run.id,
          scenarioId: scenario.id,
          status: result.status,
          totalSteps: result.totalSteps,
          metrics: normalizeMetrics(result.metrics),
          finalState: result.finalState,
          events: result.events,
        };
      } catch (error) {
        try {
          await simulationRepository.markRunFailed(run.id);
        } catch (persistenceError) {
          error.persistenceError = persistenceError;
        }
        throw error;
      }
    },

    async getSimulation(runId) {
      validateId(runId, "runId");
      const run = await simulationRepository.getRun(runId);
      if (!run) {
        throw new ApiError(404, "SIMULATION_NOT_FOUND", "Simulation run was not found");
      }

      return {
        runId: run.id,
        scenarioId: run.scenarioId,
        status: run.status,
        totalSteps: run.totalSteps,
        completedAt: run.completedAt,
        metrics: normalizeMetrics(run.metrics),
        finalState: run.metrics?.finalState || null,
        events: run.events || [],
      };
    },
  };
}

function normalizeMetrics(metrics = {}) {
  return Object.fromEntries(
    METRIC_FIELDS.map((field) => [
      field,
      metrics[field] ?? (field === "affectedNodes" || field === "affectedEdges" ? [] : 0),
    ])
  );
}

function validateId(value, field) {
  if (typeof value !== "string" || value.trim() === "") {
    throw new ApiError(400, "INVALID_REQUEST", `${field} must be a non-empty string`);
  }
}

function validateStartRequest(body) {
  if (!isRecord(body)) {
    throw new ApiError(400, "INVALID_REQUEST", "Request body must be a JSON object");
  }
  if (body.name !== undefined && (typeof body.name !== "string" || !body.name.trim())) {
    throw new ApiError(400, "INVALID_REQUEST", "name must be a non-empty string");
  }
  if (!Array.isArray(body.disruptions) || body.disruptions.length === 0) {
    throw new ApiError(400, "INVALID_REQUEST", "disruptions must be a non-empty array");
  }

  const config = body.config === undefined ? {} : body.config;
  if (!isRecord(config)) {
    throw new ApiError(400, "INVALID_REQUEST", "config must be a JSON object");
  }
  const normalizedConfig = {
    totalSteps: config.totalSteps === undefined ? 10 : config.totalSteps,
  };
  for (const key of ["replenishmentThreshold", "reorderBatchSize"]) {
    if (config[key] !== undefined) normalizedConfig[key] = config[key];
  }
  for (const [key, value] of Object.entries(normalizedConfig)) {
    if (!Number.isSafeInteger(value) || value <= 0) {
      throw new ApiError(400, "INVALID_REQUEST", `config.${key} must be a positive integer`);
    }
  }

  const disruptions = body.disruptions.map((disruption, index) => {
    const field = `disruptions[${index}]`;
    if (!isRecord(disruption)) {
      throw new ApiError(400, "INVALID_REQUEST", `${field} must be a JSON object`);
    }
    if (!SUPPORTED_DISRUPTION_TYPES.has(disruption.type)) {
      throw new ApiError(400, "INVALID_REQUEST", `${field}.type is not supported`);
    }
    if (typeof disruption.targetId !== "string" || !disruption.targetId.trim()) {
      throw new ApiError(400, "INVALID_REQUEST", `${field}.targetId must be a non-empty string`);
    }
    if (!Number.isSafeInteger(disruption.startStep) || disruption.startStep < 0) {
      throw new ApiError(400, "INVALID_REQUEST", `${field}.startStep must be a non-negative integer`);
    }
    if (!Number.isSafeInteger(disruption.duration) || disruption.duration <= 0) {
      throw new ApiError(400, "INVALID_REQUEST", `${field}.duration must be a positive integer`);
    }
    if (disruption.startStep >= normalizedConfig.totalSteps) {
      throw new ApiError(400, "INVALID_REQUEST", `${field}.startStep must be less than config.totalSteps`);
    }
    return {
      type: disruption.type,
      targetId: disruption.targetId,
      startStep: disruption.startStep,
      duration: disruption.duration,
    };
  });

  return {
    name: body.name?.trim(),
    disruptions,
    config: normalizedConfig,
  };
}

function validateDisruptionTargets(disruptions, network) {
  const nodes = new Map((network.nodes || []).map((node) => [node.id, node]));
  const edges = new Set((network.edges || []).map((edge) => edge.id));

  for (const disruption of disruptions) {
    if (disruption.type === DisruptionType.EDGE_BLOCKAGE) {
      if (!edges.has(disruption.targetId)) {
        throw new ApiError(400, "INVALID_DISRUPTION_TARGET", "Disruption target edge was not found");
      }
      continue;
    }

    const node = nodes.get(disruption.targetId);
    if (!node) {
      throw new ApiError(400, "INVALID_DISRUPTION_TARGET", "Disruption target node was not found");
    }
    if (disruption.type === DisruptionType.SUPPLIER_FAILURE && node.type !== NodeType.SUPPLIER) {
      throw new ApiError(400, "INVALID_DISRUPTION_TARGET", "SUPPLIER_FAILURE target must be a supplier node");
    }
  }
}

function isRecord(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

module.exports = { createSimulationService };
