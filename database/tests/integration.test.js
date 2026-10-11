const assert = require("node:assert/strict");
const { after, test } = require("node:test");
const prisma = require("../client");
const {
  getAllSupplyChains,
  getSupplyChain,
  loadSimulationInput,
} = require("../repositories/supplyChainRepository");

after(async () => {
  await prisma.$disconnect();
});

test("seeded data has the expected counts and relationships", async () => {
  const counts = await Promise.all([
    prisma.supplyChain.count(),
    prisma.node.count(),
    prisma.edge.count(),
    prisma.product.count(),
    prisma.inventory.count(),
    prisma.order.count(),
    prisma.orderItem.count(),
  ]);

  assert.deepEqual(counts, [1, 4, 3, 2, 5, 1, 1]);

  const supplyChain = await prisma.supplyChain.findUnique({
    where: { id: "demo-supply-chain" },
    include: {
      nodes: {
        include: {
          outgoing: true,
          incoming: true,
          inventory: { include: { product: true } },
          orders: { include: { items: { include: { product: true } } } },
        },
      },
    },
  });

  assert.ok(supplyChain);
  assert.equal(supplyChain.nodes.length, 4);
  assert.equal(
    supplyChain.nodes.reduce((count, node) => count + node.outgoing.length, 0),
    3
  );
  assert.equal(
    supplyChain.nodes.reduce((count, node) => count + node.incoming.length, 0),
    3
  );
  assert.equal(
    supplyChain.nodes.reduce((count, node) => count + node.inventory.length, 0),
    5
  );

  const productA = await prisma.product.findUnique({
    where: { sku: "PROD-A" },
    include: { inventory: true, orderItems: true },
  });
  assert.ok(productA);
  assert.equal(productA.inventory.length, 4);
  assert.equal(productA.orderItems.length, 1);
  assert.equal(productA.orderItems[0].orderId, "demo-order-1");

  const orders = supplyChain.nodes.flatMap((node) => node.orders);
  assert.equal(orders.length, 1);
  assert.equal(orders[0].nodeId, "retailer-a");
  assert.equal(orders[0].items.length, 1);
  assert.equal(orders[0].items[0].product.sku, "PROD-A");
});

test("repository queries return the simulation input contract", async () => {
  const allSupplyChains = await getAllSupplyChains();
  assert.equal(allSupplyChains.length, 1);
  assert.equal(allSupplyChains[0].id, "demo-supply-chain");
  assert.equal(allSupplyChains[0].nodes.length, 4);

  const supplyChain = await getSupplyChain("demo-supply-chain");
  assert.ok(supplyChain);
  assert.equal(supplyChain.nodes.length, 4);
  assert.equal(await getSupplyChain("missing-supply-chain"), null);

  const input = await loadSimulationInput("demo-supply-chain");
  assert.deepEqual(Object.keys(input).sort(), ["inventory", "network", "orders"]);
  assert.deepEqual(
    input.network.nodes.map((node) => node.id).sort(),
    [
      "distribution-center-a",
      "retailer-a",
      "supplier-a",
      "warehouse-a",
    ]
  );

  assert.deepEqual(
    input.network.edges
      .map(({ fromNodeId, toNodeId }) => `${fromNodeId}->${toNodeId}`)
      .sort(),
    [
      "distribution-center-a->retailer-a",
      "supplier-a->warehouse-a",
      "warehouse-a->distribution-center-a",
    ]
  );

  assert.deepEqual(
    input.inventory
      .map(({ nodeId, product, quantity }) => [nodeId, product.sku, quantity])
      .sort((left, right) => left[0].localeCompare(right[0]) || left[1].localeCompare(right[1])),
    [
      ["distribution-center-a", "PROD-A", 200],
      ["retailer-a", "PROD-A", 100],
      ["supplier-a", "PROD-A", 1000],
      ["warehouse-a", "PROD-A", 500],
      ["warehouse-a", "PROD-B", 300],
    ]
  );

  assert.equal(input.orders.length, 1);
  assert.deepEqual(
    {
      orderId: input.orders[0].orderId,
      nodeId: input.orders[0].nodeId,
      quantity: input.orders[0].quantity,
      status: input.orders[0].status,
      dueStep: input.orders[0].dueStep,
      sku: input.orders[0].product.sku,
    },
    {
      orderId: "demo-order-1",
      nodeId: "retailer-a",
      quantity: 50,
      status: "PENDING",
      dueStep: 1,
      sku: "PROD-A",
    }
  );

  await assert.rejects(
    loadSimulationInput("missing-supply-chain"),
    /Supply chain not found/
  );
});

test("database constraints reject duplicate and invalid records", async () => {
  const product = await prisma.product.findUnique({
    where: { sku: "PROD-A" },
  });
  assert.ok(product);

  await assert.rejects(
    prisma.product.create({
      data: { name: "Duplicate SKU", sku: "PROD-A" },
    }),
    (error) => error.code === "P2002"
  );

  await assert.rejects(
    prisma.inventory.create({
      data: {
        nodeId: "missing-node",
        productId: product.id,
        quantity: 1,
      },
    }),
    (error) => error.code === "P2003"
  );

  await assert.rejects(
    prisma.inventory.create({
      data: {
        nodeId: "supplier-a",
        productId: product.id,
        quantity: 1,
      },
    }),
    (error) => error.code === "P2002"
  );
});
