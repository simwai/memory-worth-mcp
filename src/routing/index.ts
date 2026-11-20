export function resolveScope(
  requestedScope: 'auto' | 'project' | 'global' | 'all',
  project: string,
): { whereClause: string; params: (string | number)[] } {
  switch (requestedScope) {
    case 'project':
      return {
        whereClause: "WHERE (project = ? OR scope = 'global')",
        params: [project],
      }
    case 'global':
      return {
        whereClause: "WHERE scope = 'global'",
        params: [],
      }
    case 'all':
      return { whereClause: '', params: [] }
    default:
      return {
        whereClause: "WHERE (project = ? OR scope = 'global')",
        params: [project],
      }
  }
}

export function determineWriteScope(content: string, appliesWhen: string): 'project' | 'global' {
  const groundedPatterns = [
    /\.[a-z]+:\d+/, // file:line
    /[a-zA-Z_][\w.]*(?:\(\)|\[|\.)/, // function calls, property access
    /[a-f0-9]{7,40}/, // git SHAs
    /(?:src|lib|app|test)\//, // common project paths
  ]

  const isGrounded = groundedPatterns.some((p) => p.test(content) || p.test(appliesWhen))

  return isGrounded ? 'project' : 'global'
}

export function buildOrderByClause(
  scope: 'auto' | 'project' | 'global' | 'all',
  project: string,
): { orderBy: string; params: (string | number)[] } {
  if (scope === 'project' || scope === 'auto') {
    return {
      orderBy:
        'ORDER BY CASE WHEN project = ? THEN 1 ELSE 0 END DESC, trust_score DESC, updated_at DESC',
      params: [project],
    }
  }
  return { orderBy: 'ORDER BY trust_score DESC, updated_at DESC', params: [] }
}
