const createApp = require("./app");
const path = require("node:path");

const port = Number(process.env.PORT) || 3000;
const localDemo = process.argv.includes("--local-demo");
const frontendDirectory = localDemo ? path.join(__dirname, "../frontend/dist") : undefined;
const host = localDemo ? "127.0.0.1" : undefined;
const server = createApp({ frontendDirectory }).listen(port, host, () => {
  console.log(localDemo
    ? `SC Disruption demo: http://${host}:${port}`
    : `Backend API listening on port ${port}`);
});

module.exports = server;
