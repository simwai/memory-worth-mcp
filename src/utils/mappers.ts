export interface MemoryRowLike {
  id: string;
  project: string;
  scope: string;
  content: string;
  applies_when: string;
  tags: string;
  trust_score: number;
  trust_label: string;
  evidence_refs: string;
  created_at: number;
  updated_at: number;
  status: string;
  superseded_by: string | null;
  session_id: string | null;
}

export interface Memory {
  id: string;
  project: string;
  scope: "project" | "global";
  content: string;
  appliesWhen: string;
  tags: string[];
  trustScore: number;
  trustLabel: "high" | "low" | "unproven";
  evidenceRefs: string[];
  createdAt: number;
  updatedAt: number;
  status: "active" | "archived" | "superseded";
  supersededBy: string | null;
  sessionId: string | null;
}

function parseStringArray(value: string, field: string): string[] {
  try {
    const parsed = JSON.parse(value);
    if (!Array.isArray(parsed) || parsed.some((item) => typeof item !== "string")) {
      throw new Error(`Invalid ${field}: expected array of strings`);
    }
    return parsed;
  } catch {
    return [];
  }
}

export function rowToMemory(row: MemoryRowLike): Memory {
  return {
    id: row.id,
    project: row.project,
    scope: row.scope as "project" | "global",
    content: row.content,
    appliesWhen: row.applies_when,
    tags: parseStringArray(row.tags, "tags"),
    trustScore: row.trust_score,
    trustLabel: row.trust_label as "high" | "low" | "unproven",
    evidenceRefs: parseStringArray(row.evidence_refs, "evidence_refs"),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    status: row.status as "active" | "archived" | "superseded",
    supersededBy: row.superseded_by,
    sessionId: row.session_id,
  };
}
