export interface MemoryEntry {
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
  supersededBy?: string;
  sessionId?: string;
}

export interface SessionEntry {
  id: string;
  project: string;
  startedAt: number;
  lastActiveAt: number;
  metadata: Record<string, unknown>;
}

export interface TrustCalibrationEntry {
  memoryId: string;
  outcome: "success" | "failure" | "neutral";
  recordedAt: number;
}

export interface SearchOptions {
  query: string;
  scope?: "auto" | "project" | "global" | "all";
  project?: string;
  limit?: number;
  minTrust?: number;
  tags?: string[];
}

export interface WriteOptions {
  project: string;
  content: string;
  appliesWhen: string;
  tags?: string[];
  scope?: "project" | "global";
  sessionId?: string;
}

export interface UpdateOptions {
  id: string;
  content?: string;
  appliesWhen?: string;
  tags?: string[];
  trustScore?: number;
  status?: "active" | "archived" | "superseded";
  supersededBy?: string;
}

export interface SynthesizeOptions {
  memoryIds: string[];
  project: string;
  question: string;
}

export interface WakeupOptions {
  project: string;
  sessionId: string;
}

export interface StatsOptions {
  project?: string;
}

export interface TuneOptions {
  project?: string;
  highThreshold?: number;
  lowThreshold?: number;
}

export interface InvalidateOptions {
  id: string;
  supersededBy: string;
  reason: string;
}

export interface MergeOptions {
  memoryIds: string[];
  newContent: string;
  newAppliesWhen: string;
  project: string;
}

export interface SetStatusOptions {
  id: string;
  status: "active" | "archived" | "superseded";
}