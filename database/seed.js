const prisma = require("./client");

async function main() {
  console.log("Seeding database...");

  const supplyChain = await prisma.supplyChain.upsert({
    where: {
      id: "demo-supply-chain",
    },
    update: {},
    create: {
      id: "demo-supply-chain",
      name: "Demo Supply Chain",
    },
  });

  const supplier = await prisma.node.upsert({
    where: {
      id: "supplier-a",
    },
    update: {},
    create: {
      id: "supplier-a",
      name: "Supplier A",
      type: "SUPPLIER",
      supplyChainId: supplyChain.id,
    },
  });

  const warehouse = await prisma.node.upsert({
    where: {
      id: "warehouse-a",
    },
    update: {},
    create: {
      id: "warehouse-a",
      name: "Warehouse A",
      type: "WAREHOUSE",
      supplyChainId: supplyChain.id,
    },
  });

  const distributionCenter = await prisma.node.upsert({
    where: {
      id: "distribution-center-a",
    },
    update: {},
    create: {
      id: "distribution-center-a",
      name: "Distribution Center A",
      type: "DISTRIBUTION_CENTER",
      supplyChainId: supplyChain.id,
    },
  });

  const retailer = await prisma.node.upsert({
    where: {
      id: "retailer-a",
    },
    update: {},
    create: {
      id: "retailer-a",
      name: "Retailer A",
      type: "RETAILER",
      supplyChainId: supplyChain.id,
    },
  });

  await prisma.edge.upsert({
    where: {
      id: "edge-supplier-warehouse",
    },
    update: {},
    create: {
      id: "edge-supplier-warehouse",
      fromNodeId: supplier.id,
      toNodeId: warehouse.id,
      distance: 120,
      travelTime: 4,
    },
  });

  await prisma.edge.upsert({
    where: {
      id: "edge-warehouse-distribution",
    },
    update: {},
    create: {
      id: "edge-warehouse-distribution",
      fromNodeId: warehouse.id,
      toNodeId: distributionCenter.id,
      distance: 80,
      travelTime: 3,
    },
  });

  await prisma.edge.upsert({
    where: {
      id: "edge-distribution-retailer",
    },
    update: {},
    create: {
      id: "edge-distribution-retailer",
      fromNodeId: distributionCenter.id,
      toNodeId: retailer.id,
      distance: 40,
      travelTime: 2,
    },
  });

  const product1 = await prisma.product.upsert({
    where: {
      sku: "PROD-A",
    },
    update: {},
    create: {
      name: "Product A",
      sku: "PROD-A",
    },
  });

  const product2 = await prisma.product.upsert({
    where: {
      sku: "PROD-B",
    },
    update: {},
    create: {
      name: "Product B",
      sku: "PROD-B",
    },
  });

  await prisma.inventory.upsert({
    where: {
      nodeId_productId: {
        nodeId: supplier.id,
        productId: product1.id,
      },
    },
    update: {
      quantity: 1000,
    },
    create: {
      nodeId: supplier.id,
      productId: product1.id,
      quantity: 1000,
    },
  });

  await prisma.inventory.upsert({
    where: {
      nodeId_productId: {
        nodeId: warehouse.id,
        productId: product1.id,
      },
    },
    update: {
      quantity: 500,
    },
    create: {
      nodeId: warehouse.id,
      productId: product1.id,
      quantity: 500,
    },
  });

  await prisma.inventory.upsert({
    where: {
      nodeId_productId: {
        nodeId: warehouse.id,
        productId: product2.id,
      },
    },
    update: {
      quantity: 300,
    },
    create: {
      nodeId: warehouse.id,
      productId: product2.id,
      quantity: 300,
    },
  });

  await prisma.inventory.upsert({
    where: {
      nodeId_productId: {
        nodeId: distributionCenter.id,
        productId: product1.id,
      },
    },
    update: {
      quantity: 200,
    },
    create: {
      nodeId: distributionCenter.id,
      productId: product1.id,
      quantity: 200,
    },
  });

  await prisma.inventory.upsert({
    where: {
      nodeId_productId: {
        nodeId: retailer.id,
        productId: product1.id,
      },
    },
    update: {
      quantity: 100,
    },
    create: {
      nodeId: retailer.id,
      productId: product1.id,
      quantity: 100,
    },
  });

  const order = await prisma.order.upsert({
    where: {
      id: "demo-order-1",
    },
    update: {
      status: "PENDING",
      dueStep: 1,
    },
    create: {
      id: "demo-order-1",
      nodeId: retailer.id,
      status: "PENDING",
      dueStep: 1,
    },
  });

  await prisma.orderItem.upsert({
    where: {
      id: "demo-order-item-1",
    },
    update: {
      quantity: 50,
    },
    create: {
      id: "demo-order-item-1",
      orderId: order.id,
      productId: product1.id,
      quantity: 50,
    },
  });

  console.log("Seeding completed successfully.");
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });