const prisma = require("../client");
const { Prisma } = require("@prisma/client");

function createScenario({ supplyChainId, name, disruptions = [] }) {
  return prisma.scenario.create({
    data: {
      supplyChainId,
      name,
      disruptions: {
        create: disruptions.map((disruption) => ({
          id: disruption.id,
          type: disruption.type,
          targetId: disruption.targetId,
          startStep: disruption.startStep,
          duration: disruption.duration,
        })),
      },
    },
    include: { disruptions: { orderBy: { startStep: "asc" } } },
  });
}

function getScenario(id) {
  return prisma.scenario.findUnique({
    where: { id },
    include: {
      disruptions: { orderBy: { startStep: "asc" } },
      runs: { orderBy: { startedAt: "desc" } },
    },
  });
}

function createRun({ id, scenarioId, totalSteps }) {
  return prisma.simulationRun.create({
    data: {
      id,
      scenarioId,
      totalSteps,
      status: "RUNNING",
    },
  });
}

function markRunFailed(runId) {
  return prisma.simulationRun.update({
    where: { id: runId },
    data: {
      status: "FAILED",
      completedAt: new Date(),
    },
  });
}

async function saveRunResult(runId, result) {
  const metrics = result.metrics || {};
  const events = result.events || [];

  return prisma.$transaction(async (tx) => {
    await tx.simulationEvent.deleteMany({ where: { runId } });

    if (events.length > 0) {
      await tx.simulationEvent.createMany({
        data: events.map((event, sequence) => ({
          runId,
          sequence,
          step: event.step,
          type: event.type,
          targetType: event.targetType,
          targetId: event.targetId,
          message: event.message,
        })),
      });
    }

    await tx.simulationMetric.upsert({
      where: { runId },
      update: mapMetrics(metrics, result.finalState),
      create: { runId, ...mapMetrics(metrics, result.finalState) },
    });

    return tx.simulationRun.update({
      where: { id: runId },
      data: {
        status: result.status || "COMPLETED",
        completedAt: new Date(),
      },
      include: {
        events: { orderBy: [{ step: "asc" }, { sequence: "asc" }] },
        metrics: true,
      },
    });
  });
}

function getRun(id) {
  return prisma.simulationRun.findUnique({
    where: { id },
    include: {
      scenario: { include: { disruptions: { orderBy: { startStep: "asc" } } } },
      events: { orderBy: [{ step: "asc" }, { sequence: "asc" }] },
      metrics: true,
    },
  });
}

async function getImpactSummary(runId) {
  const run = await getRun(runId);
  if (!run) return null;

  return {
    runId: run.id,
    scenarioId: run.scenarioId,
    status: run.status,
    totalSteps: run.totalSteps,
    completedAt: run.completedAt,
    metrics: run.metrics,
    timeline: run.events,
  };
}

async function listRunsBySupplyChain(supplyChainId, { status, limit = 10, cursor } = {}) {
  const where = {
    scenario: {
      supplyChainId,
    },
  };
  if (status) {
    where.status = status;
  }

  const queryOptions = {
    where,
    orderBy: [
      { startedAt: "desc" },
      { id: "desc" },
    ],
    take: limit + 1,
    include: {
      scenario: true,
      metrics: true,
    },
  };

  if (cursor) {
    queryOptions.cursor = { id: cursor };
    queryOptions.skip = 1;
  }

  const runs = await prisma.simulationRun.findMany(queryOptions);
  const hasMore = runs.length > limit;
  const items = hasMore ? runs.slice(0, limit) : runs;
  const nextCursor = hasMore && items.length > 0 ? items[items.length - 1].id : null;

  return {
    runs: items,
    hasMore,
    nextCursor,
  };
}

function mapMetrics(metrics, finalState) {
  return {
    totalOrders: metrics.totalOrders || 0,
    totalDemand: metrics.totalDemand || 0,
    fulfilledQuantity: metrics.fulfilledQuantity || 0,
    remainingQuantity: metrics.remainingQuantity || 0,
    stockoutEvents: metrics.stockoutEvents || 0,
    stockouts: metrics.stockouts || 0,
    delayedOrders: metrics.delayedOrders || 0,
    additionalCost: metrics.additionalCost || 0,
    recoveryTime: metrics.recoveryTime || 0,
    affectedNodes: metrics.affectedNodes || [],
    affectedEdges: metrics.affectedEdges || [],
    finalState: finalState ?? Prisma.DbNull,
  };
}

module.exports = {
  createScenario,
  getScenario,
  createRun,
  markRunFailed,
  saveRunResult,
  getRun,
  getImpactSummary,
  listRunsBySupplyChain,
  getRunsBySupplyChain: listRunsBySupplyChain,
};
