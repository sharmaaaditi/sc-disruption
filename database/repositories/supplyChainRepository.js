const prisma = require("../client");

async function getSupplyChain(id) {
  return prisma.supplyChain.findUnique({
    where: { id },
    include: {
      nodes: {
        include: {
          outgoing: true,
          incoming: true,
          inventory: {
            include: {
              product: true,
            },
          },
          orders: {
            include: {
              items: {
                include: {
                  product: true,
                },
              },
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

async function loadSimulationInput(supplyChainId) {
  const supplyChain = await getSupplyChain(supplyChainId);

  if (!supplyChain) {
    throw new Error("Supply chain not found");
  }

  const nodes = supplyChain.nodes.map((node) => ({
    id: node.id,
    name: node.name,
    type: node.type,
  }));

  const edges = supplyChain.nodes.flatMap((node) =>
    node.outgoing.map((edge) => ({
      id: edge.id,
      fromNodeId: edge.fromNodeId,
      toNodeId: edge.toNodeId,
      distance: edge.distance,
      travelTime: edge.travelTime,
    }))
  );

  const inventory = supplyChain.nodes.flatMap((node) =>
    node.inventory.map((item) => ({
      nodeId: item.nodeId,
      productId: item.productId,
      quantity: item.quantity,
      product: {
        name: item.product.name,
        sku: item.product.sku,
      },
    }))
  );

  const orders = supplyChain.nodes.flatMap((node) =>
    node.orders.flatMap((order) =>
      order.items.map((item) => ({
        orderId: order.id,
        nodeId: order.nodeId,
        productId: item.productId,
        quantity: item.quantity,
        status: order.status,
        dueStep: order.dueStep,
        product: {
          name: item.product.name,
          sku: item.product.sku,
        },
      }))
    )
  );

  return {
    network: {
      nodes,
      edges,
    },
    inventory,
    orders,
  };
}

module.exports = {
  getSupplyChain,
  createSupplyChain,
  getAllSupplyChains,
  loadSimulationInput,
};