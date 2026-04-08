import assert from "node:assert/strict";
import test from "node:test";
import { createApp } from "../src/server.js";
import { IncidentStore } from "../src/domain.js";

async function invoke(
  method: string,
  path: string,
  body?: object,
  headers: Record<string, string> = {}
): Promise<{ status: number; payload: unknown }> {
  const store = invoke.store ?? (invoke.store = new IncidentStore());
  const handler = createApp(store);
  const chunks: Buffer[] = [];

  const request = {
    method,
    url: path,
    headers,
    [Symbol.asyncIterator]: async function* () {
      if (body) {
        yield Buffer.from(JSON.stringify(body));
      }
    },
  } as any;

  const response = {
    statusCode: 200,
    writeHead(statusCode: number) {
      this.statusCode = statusCode;
    },
    end(chunk?: string) {
      if (chunk) {
        chunks.push(Buffer.from(chunk));
      }
    },
  } as any;

  await handler(request, response);
  return {
    status: response.statusCode,
    payload: chunks.length ? JSON.parse(Buffer.concat(chunks).toString("utf-8")) : undefined,
  };
}

invoke.store = undefined as IncidentStore | undefined;

test("creates incidents idempotently", async () => {
  invoke.store = new IncidentStore();
  const body = { title: "API latency spike", service: "search-api", severity: "high" };
  const first = await invoke("POST", "/incidents", body, { "idempotency-key": "same-key" });
  const second = await invoke("POST", "/incidents", body, { "idempotency-key": "same-key" });
  assert.equal(first.status, 201);
  assert.equal((first.payload as any).data.id, (second.payload as any).data.id);
});

test("acknowledges incidents", async () => {
  invoke.store = new IncidentStore();
  const created = await invoke("POST", "/incidents", {
    title: "Worker backlog",
    service: "billing-worker",
    severity: "medium",
  });
  const id = (created.payload as any).data.id;
  const ack = await invoke("PATCH", `/incidents/${id}/ack`);
  assert.equal(ack.status, 200);
  assert.equal((ack.payload as any).data.status, "acknowledged");
});

test("filters incidents and reports summary metrics", async () => {
  invoke.store = new IncidentStore();
  await invoke("POST", "/incidents", {
    title: "Search issue",
    service: "search-api",
    severity: "high",
  });
  await invoke("POST", "/incidents", {
    title: "Billing delay",
    service: "billing-worker",
    severity: "medium",
  });

  const filtered = await invoke("GET", "/incidents?service=search-api");
  const summary = await invoke("GET", "/incidents/summary");

  assert.equal((filtered.payload as any).data.length, 1);
  assert.equal((summary.payload as any).data.total, 2);
  assert.equal((summary.payload as any).data.bySeverity.high, 1);
});

test("resolves incidents", async () => {
  invoke.store = new IncidentStore();
  const created = await invoke("POST", "/incidents", {
    title: "Gateway auth failure",
    service: "gateway",
    severity: "high",
  });
  const id = (created.payload as any).data.id;
  const resolved = await invoke("PATCH", `/incidents/${id}/resolve`);
  assert.equal(resolved.status, 200);
  assert.equal((resolved.payload as any).data.status, "resolved");
  assert.ok((resolved.payload as any).data.resolvedAt);
});
