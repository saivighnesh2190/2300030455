const axios = require("axios");
const path = require("path");
const { Log, authHeaders } = require(path.join(__dirname, "..", "logging_middleware", "logger"));

const BASE = "http://4.224.186.213/evaluation-service";

async function fetchDepots() {
  const headers = await authHeaders();
  const res = await axios.get(`${BASE}/depots`, { headers });
  return res.data.depots;
}

async function fetchVehicles() {
  const headers = await authHeaders();
  const res = await axios.get(`${BASE}/vehicles`, { headers });
  return res.data.vehicles;
}

function knapsack(items, capacity) {
  const n = items.length;
  const dp = Array.from({ length: n + 1 }, () => new Array(capacity + 1).fill(0));
  for (let i = 1; i <= n; i++) {
    const w = items[i - 1].Duration;
    const v = items[i - 1].Impact;
    for (let j = 0; j <= capacity; j++) {
      dp[i][j] = dp[i - 1][j];
      if (w <= j && dp[i - 1][j - w] + v > dp[i][j]) {
        dp[i][j] = dp[i - 1][j - w] + v;
      }
    }
  }
  let selected = [];
  let j = capacity;
  for (let i = n; i > 0; i--) {
    if (dp[i][j] !== dp[i - 1][j]) {
      selected.push(items[i - 1]);
      j -= items[i - 1].Duration;
    }
  }
  return { maxImpact: dp[n][capacity], selected };
}

async function main() {
  await Log("backend", "info", "service", "Scheduler started");

  const depots = await fetchDepots();
  await Log("backend", "info", "service", `Fetched ${depots.length} depots`);

  const vehicles = await fetchVehicles();
  await Log("backend", "info", "service", `Fetched ${vehicles.length} vehicle tasks`);

  console.log("\n=== VEHICLE MAINTENANCE SCHEDULER ===\n");

  for (const depot of depots) {
    const budget = depot.MechanicHours;
    const { maxImpact, selected } = knapsack(vehicles, budget);
    const usedHours = selected.reduce((s, t) => s + t.Duration, 0);
    const ids = selected.map(t => t.TaskID.split("-")[0]).join(", ");

    console.log(`Depot ${depot.ID} | Budget: ${budget}h | Selected: ${selected.length}/${vehicles.length} tasks | Used: ${usedHours}/${budget}h | Impact: ${maxImpact}`);
    console.log(`  IDs: ${ids}\n`);

    await Log("backend", "info", "handler", `Depot ${depot.ID}: ${selected.length} tasks, imp=${maxImpact}`);
  }

  await Log("backend", "info", "service", "All depots processed");
  console.log("=== DONE ===");
}

main().catch(async err => {
  console.error("FATAL:", err.message);
  await Log("backend", "error", "handler", `Fatal: ${err.message}`);
});
