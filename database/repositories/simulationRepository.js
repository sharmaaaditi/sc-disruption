const prisma = require("../client");

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

async function saveRunResult(runId, result) {
  const metrics = result.metrics || {};
  const events = result.events || [];

  return prisma.$transaction(async (tx) => {
    const run = await tx.simulationRun.findUnique({
      where: { id: runId },
      select: { id: true },
    });

    if (!run) {
      throw new Error(`Simulation run not found: ${runId}`);
    }

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
    finalState: finalState || undefined,
  };
}

module.exports = {
  createScenario,
  getScenario,
  createRun,
  saveRunResult,
  getRun,
  getImpactSummary,
};
