const createApp = require("./app");

const port = Number(process.env.PORT) || 3000;
const server = createApp().listen(port, () => {
  console.log(`Backend API listening on port ${port}`);
});

module.exports = server;
