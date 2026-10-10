# Simulation engine

The Week 1 engine models the supply chain as a directed graph and advances it in integer time steps. It supports supplier or node outages, blocked edges, inventory movement, order fulfilment, delayed orders, and stockouts.

## Time and disruption rules

- A disruption is active from `startStep` through `startStep + duration - 1`.
- Recovery occurs at `startStep + duration` when that step is inside the configured simulation window.
- Shipments arriving at a blocked destination remain in transit and are retried on the next step.
- Orders can be partially fulfilled. Any remaining quantity keeps the order delayed until later inventory arrives.
- `stockoutEvents` counts every step that observes a shortage. `stockouts` counts each affected order, node, and product combination once.
- `additionalCost` is `0` in Week 1 because transport and penalty costs are outside the agreed MVP model.

## Output

`runSimulation(input)` returns the event timeline, metrics, and a `finalState` containing inventory and order outcomes. `recoveryTime` is the longest completed disruption duration. It remains `0` when recovery falls outside the simulation window.

Run the focused engine and graph tests with:

```bash
npm test
```
