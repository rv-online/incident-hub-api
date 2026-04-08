export type Severity = "low" | "medium" | "high";
export type IncidentStatus = "open" | "acknowledged" | "resolved";
export type IncidentEventType = "created" | "acknowledged" | "resolved" | "note_added";

export interface IncidentInput {
  title: string;
  service: string;
  severity: Severity;
  source?: string;
  summary?: string;
  owner?: string;
}

export interface IncidentNoteInput {
  body: string;
  author?: string;
}

export interface Incident extends IncidentInput {
  id: string;
  createdAt: string;
  status: IncidentStatus;
  acknowledgedAt?: string;
  resolvedAt?: string;
}

export interface IncidentNote {
  id: string;
  incidentId: string;
  body: string;
  author: string;
  createdAt: string;
}

export interface IncidentEvent {
  id: string;
  incidentId: string;
  type: IncidentEventType;
  createdAt: string;
  details: Record<string, unknown>;
}

export class IncidentStore {
  private incidents: Incident[] = [];
  private idempotencyCache = new Map<string, Incident>();
  private events: IncidentEvent[] = [];
  private notes: IncidentNote[] = [];

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

  private recordEvent(incidentId: string, type: IncidentEventType, details: Record<string, unknown> = {}): void {
    this.events.push({
      id: `evt_${this.events.length + 1}`,
      incidentId,
      type,
      createdAt: new Date().toISOString(),
      details,
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
    this.recordEvent(incident.id, "created", { severity: incident.severity, service: incident.service, owner: incident.owner });
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
      this.recordEvent(incident.id, "acknowledged");
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
      this.recordEvent(incident.id, "resolved");
    }
    return incident;
  }

  addNote(id: string, input: IncidentNoteInput): IncidentNote | undefined {
    const incident = this.incidents.find((item) => item.id === id);
    if (!incident) {
      return undefined;
    }
    const note: IncidentNote = {
      id: `note_${this.notes.length + 1}`,
      incidentId: id,
      body: input.body.trim(),
      author: input.author?.trim() || "system",
      createdAt: new Date().toISOString(),
    };
    this.notes.push(note);
    this.recordEvent(id, "note_added", { author: note.author, bodyLength: note.body.length });
    return note;
  }

  timeline(id: string): IncidentEvent[] {
    return this.events.filter((event) => event.incidentId === id);
  }

  notesFor(id: string): IncidentNote[] {
    return this.notes.filter((note) => note.incidentId === id);
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

  triage(): Array<{ incident: Incident; score: number; reasons: string[] }> {
    return [...this.incidents]
      .map((incident) => {
        const reasons: string[] = [];
        let score = 0;

        if (incident.severity === "high") {
          score += 50;
          reasons.push("high severity");
        } else if (incident.severity === "medium") {
          score += 25;
          reasons.push("medium severity");
        }

        if (incident.status === "open") {
          score += 20;
          reasons.push("still open");
        }

        if ((this.notesFor(incident.id).length ?? 0) > 0) {
          score += 5;
          reasons.push("recent operator attention");
        }

        if (incident.owner === "unassigned") {
          score += 10;
          reasons.push("unassigned owner");
        }

        return { incident, score, reasons };
      })
      .sort((left, right) => right.score - left.score || left.incident.createdAt.localeCompare(right.incident.createdAt));
  }
}
