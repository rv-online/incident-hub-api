import { performance } from "node:perf_hooks";
import { createApp } from "../src/server.js";
import { IncidentStore } from "../src/domain.js";

async function invoke(
  handler: ReturnType<typeof createApp>,
  method: string,
  path: string,
  body?: unknown,
  headers: Record<string, string> = {}
): Promise<number> {
  let statusCode = 200;
  const request = {
    method,
    url: path,
    headers,
    [Symbol.asyncIterator]: async function* () {
      if (body !== undefined) {
        yield Buffer.from(JSON.stringify(body));
      }
    },
  } as any;
  const response = {
    writeHead(code: number) {
      statusCode = code;
    },
    end() {
      return undefined;
    },
  } as any;
  await handler(request, response);
  return statusCode;
}

async function main(): Promise<void> {
  const store = new IncidentStore();
  const handler = createApp(store);
  const iterations = 250;
  const start = performance.now();

  for (let index = 0; index < iterations; index += 1) {
    const service = index % 2 === 0 ? "search-api" : "billing-worker";
    const severity = index % 3 === 0 ? "high" : "medium";
    const idempotencyKey = `bench-${index}`;

    await invoke(handler, "POST", "/incidents", {
      title: `Synthetic incident ${index}`,
      service,
      severity,
      summary: "benchmark load",
      owner: index % 4 === 0 ? "platform" : "unassigned",
    }, { "idempotency-key": idempotencyKey });

    if (index % 5 === 0) {
      await invoke(handler, "GET", "/incidents?service=search-api");
      await invoke(handler, "GET", "/incidents/summary");
      await invoke(handler, "GET", "/incidents/triage");
    }
  }

  const elapsed = performance.now() - start;
  const operations = iterations + Math.floor(iterations / 5) * 3;
  console.log(
    JSON.stringify(
      {
        iterations,
        operations,
        elapsedMs: Number(elapsed.toFixed(2)),
        opsPerSecond: Number((operations / (elapsed / 1000)).toFixed(2)),
        incidentCount: store.list().length,
        summary: store.summary(),
      },
      null,
      2
    )
  );
}

void main();
