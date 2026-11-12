const express = require("express");
const { getAllSupplyChains } = require("../database/repositories/supplyChainRepository");

const app = express();

app.use(express.json());

app.get("/api/supply-chains", async (req, res) => {
  try {
    const supplyChains = await getAllSupplyChains();
    res.json(supplyChains);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Failed to load supply chains" });
  }
});

const PORT = 3000;

app.listen(PORT, () => {
  console.log(`Backend server running on port ${PORT}`);
});
