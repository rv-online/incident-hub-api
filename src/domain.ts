export type Severity = "low" | "medium" | "high";
export type IncidentStatus = "open" | "acknowledged";

export interface IncidentInput {
  title: string;
  service: string;
  severity: Severity;
}

export interface Incident extends IncidentInput {
  id: string;
  createdAt: string;
  status: IncidentStatus;
  acknowledgedAt?: string;
}

export class IncidentStore {
  private incidents: Incident[] = [];
  private idempotencyCache = new Map<string, Incident>();

  list(): Incident[] {
    return [...this.incidents];
  }

  create(input: IncidentInput, idempotencyKey?: string): Incident {
    if (idempotencyKey && this.idempotencyCache.has(idempotencyKey)) {
      return this.idempotencyCache.get(idempotencyKey)!;
    }
    const incident: Incident = {
      id: `inc_${this.incidents.length + 1}`,
      createdAt: new Date().toISOString(),
      status: "open",
      ...input,
    };
    this.incidents.push(incident);
    if (idempotencyKey) {
      this.idempotencyCache.set(idempotencyKey, incident);
    }
    return incident;
  }

  acknowledge(id: string): Incident | undefined {
    const incident = this.incidents.find((item) => item.id === id);
    if (!incident) {
      return undefined;
    }
    if (incident.status === "open") {
      incident.status = "acknowledged";
      incident.acknowledgedAt = new Date().toISOString();
    }
    return incident;
  }
}
