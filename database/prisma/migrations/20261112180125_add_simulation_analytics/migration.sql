-- CreateTable
CREATE TABLE "Scenario" (
    "id" TEXT NOT NULL,
    "supplyChainId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Scenario_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Disruption" (
    "id" TEXT NOT NULL,
    "scenarioId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "targetId" TEXT NOT NULL,
    "startStep" INTEGER NOT NULL,
    "duration" INTEGER NOT NULL,

    CONSTRAINT "Disruption_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SimulationRun" (
    "id" TEXT NOT NULL,
    "scenarioId" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "totalSteps" INTEGER NOT NULL,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" TIMESTAMP(3),

    CONSTRAINT "SimulationRun_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SimulationEvent" (
    "id" TEXT NOT NULL,
    "runId" TEXT NOT NULL,
    "sequence" INTEGER NOT NULL,
    "step" INTEGER NOT NULL,
    "type" TEXT NOT NULL,
    "targetType" TEXT NOT NULL,
    "targetId" TEXT NOT NULL,
    "message" TEXT NOT NULL,

    CONSTRAINT "SimulationEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SimulationMetric" (
    "id" TEXT NOT NULL,
    "runId" TEXT NOT NULL,
    "totalOrders" INTEGER NOT NULL,
    "totalDemand" INTEGER NOT NULL,
    "fulfilledQuantity" INTEGER NOT NULL,
    "remainingQuantity" INTEGER NOT NULL,
    "stockoutEvents" INTEGER NOT NULL,
    "stockouts" INTEGER NOT NULL,
    "delayedOrders" INTEGER NOT NULL,
    "additionalCost" DOUBLE PRECISION NOT NULL,
    "recoveryTime" INTEGER NOT NULL,
    "affectedNodes" JSONB NOT NULL,
    "affectedEdges" JSONB NOT NULL,
    "finalState" JSONB,

    CONSTRAINT "SimulationMetric_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Scenario_supplyChainId_createdAt_idx" ON "Scenario"("supplyChainId", "createdAt");

-- CreateIndex
CREATE INDEX "Disruption_scenarioId_startStep_idx" ON "Disruption"("scenarioId", "startStep");

-- CreateIndex
CREATE INDEX "SimulationRun_scenarioId_startedAt_idx" ON "SimulationRun"("scenarioId", "startedAt");

-- CreateIndex
CREATE INDEX "SimulationEvent_runId_step_sequence_idx" ON "SimulationEvent"("runId", "step", "sequence");

-- CreateIndex
CREATE UNIQUE INDEX "SimulationEvent_runId_sequence_key" ON "SimulationEvent"("runId", "sequence");

-- CreateIndex
CREATE UNIQUE INDEX "SimulationMetric_runId_key" ON "SimulationMetric"("runId");

-- AddForeignKey
ALTER TABLE "Scenario" ADD CONSTRAINT "Scenario_supplyChainId_fkey" FOREIGN KEY ("supplyChainId") REFERENCES "SupplyChain"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Disruption" ADD CONSTRAINT "Disruption_scenarioId_fkey" FOREIGN KEY ("scenarioId") REFERENCES "Scenario"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SimulationRun" ADD CONSTRAINT "SimulationRun_scenarioId_fkey" FOREIGN KEY ("scenarioId") REFERENCES "Scenario"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SimulationEvent" ADD CONSTRAINT "SimulationEvent_runId_fkey" FOREIGN KEY ("runId") REFERENCES "SimulationRun"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SimulationMetric" ADD CONSTRAINT "SimulationMetric_runId_fkey" FOREIGN KEY ("runId") REFERENCES "SimulationRun"("id") ON DELETE CASCADE ON UPDATE CASCADE;
