const prisma = require("./client");

async function main() {
  console.log("Seeding database...");

  const supplyChain = await prisma.supplyChain.create({
    data: {
      name: "Demo Supply Chain",
    },
  });

  const supplier = await prisma.node.create({
    data: {
      name: "Supplier A",
      type: "SUPPLIER",
      supplyChainId: supplyChain.id,
    },
  });

  const warehouse = await prisma.node.create({
    data: {
      name: "Warehouse A",
      type: "WAREHOUSE",
      supplyChainId: supplyChain.id,
    },
  });

  const distributionCenter = await prisma.node.create({
    data: {
      name: "Distribution Center A",
      type: "DISTRIBUTION_CENTER",
      supplyChainId: supplyChain.id,
    },
  });

  const retailer = await prisma.node.create({
    data: {
      name: "Retailer A",
      type: "RETAILER",
      supplyChainId: supplyChain.id,
    },
  });

  await prisma.edge.createMany({
    data: [
      {
        fromNodeId: supplier.id,
        toNodeId: warehouse.id,
        distance: 120,
        travelTime: 4,
      },
      {
        fromNodeId: warehouse.id,
        toNodeId: distributionCenter.id,
        distance: 80,
        travelTime: 3,
      },
      {
        fromNodeId: distributionCenter.id,
        toNodeId: retailer.id,
        distance: 40,
        travelTime: 2,
      },
    ],
  });

  const product1 = await prisma.product.create({
    data: {
      name: "Product A",
      sku: "PROD-A",
    },
  });

  const product2 = await prisma.product.create({
    data: {
      name: "Product B",
      sku: "PROD-B",
    },
  });

  await prisma.inventory.createMany({
    data: [
      {
        nodeId: supplier.id,
        productId: product1.id,
        quantity: 1000,
      },
      {
        nodeId: warehouse.id,
        productId: product1.id,
        quantity: 500,
      },
      {
        nodeId: warehouse.id,
        productId: product2.id,
        quantity: 300,
      },
      {
        nodeId: distributionCenter.id,
        productId: product1.id,
        quantity: 200,
      },
      {
        nodeId: retailer.id,
        productId: product1.id,
        quantity: 100,
      },
    ],
  });

  const order = await prisma.order.create({
    data: {
      nodeId: retailer.id,
      status: "PENDING",
    },
  });

  await prisma.orderItem.create({
    data: {
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