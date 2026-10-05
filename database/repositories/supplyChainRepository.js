const prisma = require("../client");

async function getSupplyChain(id) {
  return prisma.supplyChain.findUnique({
    where: { id },
    include: {
      nodes: {
        include: {
          outgoing: true,
          incoming: true,
          inventory: true,
          orders: {
            include: {
              items: true,
            },
          },
        },
      },
    },
  });
}

async function createSupplyChain(data) {
  return prisma.supplyChain.create({
    data,
  });
}

async function getAllSupplyChains() {
  return prisma.supplyChain.findMany({
    include: {
      nodes: true,
    },
  });
}

module.exports = {
  getSupplyChain,
  createSupplyChain,
  getAllSupplyChains,
};