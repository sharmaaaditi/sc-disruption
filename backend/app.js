const express = require("express");
const { runSimulation } = require("../simulation/src");
const ApiError = require("./errors");
const { createSimulationService } = require("./services/simulationService");

function createApp({
  supplyChainRepository = require("../database/repositories/supplyChainRepository"),
  simulationRepository = require("../database/repositories/simulationRepository"),
  simulationRunner = runSimulation,
  logger = console,
} = {}) {
  const app = express();
  const service = createSimulationService({
    supplyChainRepository,
    simulationRepository,
    runSimulation: simulationRunner,
  });

  app.use(express.json({ limit: "1mb" }));

  app.get("/api/health", (req, res) => {
    res.json({ success: true, data: { status: "ok" } });
  });

  app.get("/api/supply-chains", async (req, res, next) => {
    try {
      res.json({ success: true, data: await service.listSupplyChains() });
    } catch (error) {
      next(error);
    }
  });

  app.post("/api/supply-chains/:id/simulations", async (req, res, next) => {
    try {
      const result = await service.startSimulation(req.params.id, req.body);
      res.status(201).json({ success: true, data: result });
    } catch (error) {
      next(error);
    }
  });

  app.get("/api/simulations/:id", async (req, res, next) => {
    try {
      res.json({ success: true, data: await service.getSimulation(req.params.id) });
    } catch (error) {
      next(error);
    }
  });

  app.use((req, res, next) => {
    next(new ApiError(404, "NOT_FOUND", "Route was not found"));
  });

  app.use((error, req, res, next) => {
    if (res.headersSent) return next(error);
    if (error.type === "entity.parse.failed") {
      return res.status(400).json({
        success: false,
        error: { code: "INVALID_JSON", message: "Request body contains invalid JSON" },
      });
    }
    if (error.status === 413 || error.type === "entity.too.large") {
      return res.status(413).json({
        success: false,
        error: { code: "PAYLOAD_TOO_LARGE", message: "Request body exceeds the 1mb limit" },
      });
    }

    const status = error instanceof ApiError ? error.status : 500;
    const code = error instanceof ApiError ? error.code : "INTERNAL_SERVER_ERROR";
    const message = error instanceof ApiError ? error.message : "An unexpected server error occurred";
    if (status >= 500) logger.error(error);
    return res.status(status).json({ success: false, error: { code, message } });
  });

  return app;
}

module.exports = createApp;
