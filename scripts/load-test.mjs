const BASE_URL = process.env.LOAD_TEST_URL ?? "http://127.0.0.1:3000";
const REQUESTS = Number(process.env.LOAD_TEST_REQUESTS ?? 100);
const CONCURRENCY = Number(process.env.LOAD_TEST_CONCURRENCY ?? 20);
const DRIVER_ID =
  process.env.TEST_AUTH_BYPASS_DRIVER_ID ?? "11111111-1111-4111-8111-111111111111";

function jitter(base, amount) {
  return base + (Math.random() * 2 - 1) * amount;
}

function payloadFactory(index) {
  const start = { lat: jitter(33.3152, 0.015), lng: jitter(44.3661, 0.015) };
  const end = { lat: jitter(33.33, 0.015), lng: jitter(44.39, 0.015) };
  return {
    driver_id: DRIVER_ID,
    client_request_id: `load-${Date.now()}-${index}`,
    start,
    end,
    price: 6000 + (index % 8) * 500,
    vehicle_type: "sedan",
    traffic_level: 2 + (index % 3),
  };
}

async function runBatch(startIndex, count) {
  const tasks = [];
  for (let i = 0; i < count; i += 1) {
    const payload = payloadFactory(startIndex + i);
    tasks.push(
      fetch(`${BASE_URL}/api/submit-route`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      }).then(async (response) => {
        if (!response.ok) {
          const body = await response.text();
          throw new Error(`HTTP ${response.status}: ${body}`);
        }
      }),
    );
  }
  await Promise.all(tasks);
}

const started = Date.now();
let completed = 0;

while (completed < REQUESTS) {
  const batchSize = Math.min(CONCURRENCY, REQUESTS - completed);
  await runBatch(completed, batchSize);
  completed += batchSize;
}

const elapsed = Date.now() - started;
console.log({
  requests: REQUESTS,
  concurrency: CONCURRENCY,
  elapsed_ms: elapsed,
  requests_per_minute: Math.round((REQUESTS / elapsed) * 60_000),
});
