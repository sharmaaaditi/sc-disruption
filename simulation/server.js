const express = require('express');
const simulationRoutes = require('./src/routes/simulationRoutes');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());

app.get('/', (req, res) => {
  res.json({
    message: 'Supply chain simulation server is running',
    routes: ['/api/simulation/sample', '/api/simulation/run', '/api/simulation/graph/reachability'],
  });
});

app.use('/api/simulation', simulationRoutes);

if (require.main === module) {
  app.listen(PORT, () => {
    console.log(`Server listening on port ${PORT}`);
  });
}

module.exports = app;
