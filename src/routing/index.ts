export function resolveScope(
  requestedScope: "auto" | "project" | "global" | "all",
  project: string
): { whereClause: string; params: any[] } {
  switch (requestedScope) {
    case "project":
      return {
        whereClause: "WHERE (project = ? OR scope = 'global')",
        params: [project]
      };
    case "global":
      return {
        whereClause: "WHERE scope = 'global'",
        params: []
      };
    case "all":
      return { whereClause: "", params: [] };
    case "auto":
    default:
      return {
        whereClause: "WHERE (project = ? OR scope = 'global')",
        params: [project]
      };
  }
}

export function determineWriteScope(
  content: string,
  appliesWhen: string
): "project" | "global" {
  const groundedPatterns = [
    /\.[a-z]+:\d+/,           // file:line
    /[a-zA-Z_][\w.]*(?:\(\)|\[|\.)/, // function calls, property access
    /[a-f0-9]{7,40}/,         // git SHAs
    /(?:src|lib|app|test)\//, // common project paths
  ];

  const isGrounded = groundedPatterns.some(p =>
    p.test(content) || p.test(appliesWhen)
  );

  return isGrounded ? "project" : "global";
}

export function buildOrderByClause(scope: "auto" | "project" | "global" | "all", project: string): string {
  if (scope === "project" || scope === "auto") {
    return `ORDER BY CASE WHEN project = '${project.replace(/'/g, "''")}' THEN 1 ELSE 0 END DESC, trust_score DESC, updated_at DESC`;
  }
  return "ORDER BY trust_score DESC, updated_at DESC";
}