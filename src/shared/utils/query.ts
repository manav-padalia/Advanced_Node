export type ListQuery = {
  page: number;
  limit: number;
  sortBy?: string;
  sortOrder: 'asc' | 'desc';
  q?: string;
};

export function parseListQuery(
  raw: any,
  defaults: { page?: number; limit?: number; maxLimit?: number } = {}
): ListQuery {
  const page = Math.max(
    1,
    parseInt(raw?.page ?? `${defaults.page ?? 1}`, 10) || 1
  );
  const requestedLimit =
    parseInt(raw?.limit ?? `${defaults.limit ?? 20}`, 10) || 20;
  const maxLimit = defaults.maxLimit ?? 100;
  const limit = Math.min(Math.max(1, requestedLimit), maxLimit);

  const sortBy =
    typeof raw?.sortBy === 'string' && raw.sortBy.trim()
      ? raw.sortBy.trim()
      : undefined;
  const sortOrder =
    raw?.sortOrder === 'asc' || raw?.sortOrder === 'desc'
      ? raw.sortOrder
      : 'desc';

  const q =
    typeof raw?.q === 'string' && raw.q.trim() ? raw.q.trim() : undefined;

  return { page, limit, sortBy, sortOrder, q };
}
