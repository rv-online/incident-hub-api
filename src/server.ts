import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import { pathToFileURL } from "node:url";
import { IncidentStore, type IncidentInput, type IncidentStatus, type Severity } from "./domain.js";

function sendJson(response: ServerResponse, statusCode: number, payload: unknown): void {
  response.writeHead(statusCode, { "content-type": "application/json" });
  response.end(JSON.stringify(payload));
}

async function readBody(request: IncomingMessage): Promise<unknown> {
  const chunks: Buffer[] = [];
  for await (const chunk of request) {
    chunks.push(Buffer.from(chunk));
  }
  return chunks.length === 0 ? {} : JSON.parse(Buffer.concat(chunks).toString("utf-8"));
}

function queryValue(url: URL, key: string): string | undefined {
  const value = url.searchParams.get(key);
  return value ? value : undefined;
}

export function createApp(store = new IncidentStore()) {
  return async (request: IncomingMessage, response: ServerResponse) => {
    const method = request.method ?? "GET";
    const url = new URL(request.url ?? "/", "http://localhost");

    if (method === "GET" && url.pathname === "/health") {
      return sendJson(response, 200, { ok: true });
    }

    if (method === "GET" && url.pathname === "/incidents/summary") {
      return sendJson(response, 200, { data: store.summary() });
    }

    if (method === "GET" && url.pathname === "/incidents") {
      const filters = {
        status: queryValue(url, "status") as IncidentStatus | undefined,
        service: queryValue(url, "service"),
        severity: queryValue(url, "severity") as Severity | undefined,
      };
      return sendJson(response, 200, { data: store.list(filters) });
    }

    if (method === "POST" && url.pathname === "/incidents") {
      const payload = (await readBody(request)) as IncidentInput;
      if (!payload.title || !payload.service || !payload.severity) {
        return sendJson(response, 400, { error: "title, service, and severity are required" });
      }
      const incident = store.create(payload, request.headers["idempotency-key"]?.toString());
      return sendJson(response, 201, { data: incident });
    }

    if (method === "PATCH" && url.pathname.startsWith("/incidents/") && url.pathname.endsWith("/ack")) {
      const id = url.pathname.replace("/incidents/", "").replace("/ack", "");
      const incident = store.acknowledge(id.replaceAll("/", ""));
      if (!incident) {
        return sendJson(response, 404, { error: "incident not found" });
      }
      return sendJson(response, 200, { data: incident });
    }

    if (method === "PATCH" && url.pathname.startsWith("/incidents/") && url.pathname.endsWith("/resolve")) {
      const id = url.pathname.replace("/incidents/", "").replace("/resolve", "");
      const incident = store.resolve(id.replaceAll("/", ""));
      if (!incident) {
        return sendJson(response, 404, { error: "incident not found" });
      }
      return sendJson(response, 200, { data: incident });
    }

    return sendJson(response, 404, { error: "route not found" });
  };
}

const isEntrypoint = process.argv[1] ? import.meta.url === pathToFileURL(process.argv[1]).href : false;

if (isEntrypoint) {
  const port = Number(process.env.PORT ?? 4000);
  createServer(createApp()).listen(port, () => {
    console.log(`incident-hub-api listening on ${port}`);
  });
}
