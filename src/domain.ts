export type Severity = "low" | "medium" | "high";
export type IncidentStatus = "open" | "acknowledged" | "resolved";

export interface IncidentInput {
  title: string;
  service: string;
  severity: Severity;
  source?: string;
  summary?: string;
  owner?: string;
}

export interface Incident extends IncidentInput {
  id: string;
  createdAt: string;
  status: IncidentStatus;
  acknowledgedAt?: string;
  resolvedAt?: string;
}

export class IncidentStore {
  private incidents: Incident[] = [];
  private idempotencyCache = new Map<string, Incident>();

  list(filters?: { status?: IncidentStatus; service?: string; severity?: Severity }): Incident[] {
    return this.incidents.filter((incident) => {
      if (filters?.status && incident.status !== filters.status) {
        return false;
      }
      if (filters?.service && incident.service !== filters.service) {
        return false;
      }
      if (filters?.severity && incident.severity !== filters.severity) {
        return false;
      }
      return true;
    });
  }

  create(input: IncidentInput, idempotencyKey?: string): Incident {
    if (idempotencyKey && this.idempotencyCache.has(idempotencyKey)) {
      return this.idempotencyCache.get(idempotencyKey)!;
    }
    const incident: Incident = {
      id: `inc_${this.incidents.length + 1}`,
      createdAt: new Date().toISOString(),
      status: "open",
      source: input.source ?? "api",
      summary: input.summary ?? "",
      owner: input.owner ?? "unassigned",
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

  resolve(id: string): Incident | undefined {
    const incident = this.incidents.find((item) => item.id === id);
    if (!incident) {
      return undefined;
    }
    if (incident.status !== "resolved") {
      incident.status = "resolved";
      incident.resolvedAt = new Date().toISOString();
    }
    return incident;
  }

  summary(): { total: number; byStatus: Record<string, number>; bySeverity: Record<string, number> } {
    const byStatus: Record<string, number> = {};
    const bySeverity: Record<string, number> = {};
    for (const incident of this.incidents) {
      byStatus[incident.status] = (byStatus[incident.status] ?? 0) + 1;
      bySeverity[incident.severity] = (bySeverity[incident.severity] ?? 0) + 1;
    }
    return {
      total: this.incidents.length,
      byStatus,
      bySeverity,
    };
  }
}
