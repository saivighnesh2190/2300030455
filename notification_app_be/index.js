  const axios = require("axios");
const path = require("path");
const { Log, authHeaders } = require(path.join(__dirname, "..", "logging_middleware", "logger"));

const BASE = "http://4.224.186.213/evaluation-service";
const PRIORITY = { Placement: 1, Result: 2, Event: 3 };

async function fetchByType(type) {
  const headers = await authHeaders();
  const res = await axios.get(`${BASE}/notifications?notification_type=${type}&limit=10&page=1`, { headers });
  return res.data.notifications;
}

async function main() {
  await Log("backend", "info", "service", "Priority Inbox started");

  const placements = await fetchByType("Placement");
  await Log("backend", "info", "service", `Fetched ${placements.length} Placements`);

  const results = await fetchByType("Result");
  await Log("backend", "info", "service", `Fetched ${results.length} Results`);

  const events = await fetchByType("Event");
  await Log("backend", "info", "service", `Fetched ${events.length} Events`);

  const all = [...placements, ...results, ...events];

  all.sort((a, b) => {
    if (PRIORITY[a.Type] !== PRIORITY[b.Type]) return PRIORITY[a.Type] - PRIORITY[b.Type];
    return new Date(b.Timestamp) - new Date(a.Timestamp);
  });

  const top10 = all.slice(0, 10);

  console.log("\n=== PRIORITY INBOX (Top 10) ===\n");
  top10.forEach((n, i) => {
    console.log(`${i + 1}. [${n.Type}] ${n.Message} — ${n.Timestamp}`);
  });
  console.log("\n=== END ===");

  await Log("backend", "info", "handler", `Top 10 built from ${all.length} notifs`);
}

main().catch(async err => {
  console.error("FATAL:", err.message);
  await Log("backend", "error", "handler", `Fatal: ${err.message}`);
});
