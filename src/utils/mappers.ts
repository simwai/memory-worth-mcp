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

export function rowToMemory(row: MemoryRowLike) {
  return {
    id: row.id,
    project: row.project,
    scope: row.scope as "project" | "global",
    content: row.content,
    appliesWhen: row.applies_when,
    tags: JSON.parse(row.tags) as string[],
    trustScore: row.trust_score,
    trustLabel: row.trust_label as "high" | "low" | "unproven",
    evidenceRefs: JSON.parse(row.evidence_refs) as string[],
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    status: row.status as "active" | "archived" | "superseded",
    supersededBy: row.superseded_by,
    sessionId: row.session_id,
  };
}
