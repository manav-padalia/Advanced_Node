import { parseListQuery } from '../src/shared/utils/query';

describe('parseListQuery', () => {
  it('applies defaults and clamps limit', () => {
    const q = parseListQuery({ page: '0', limit: '999', sortOrder: 'asc' }, { maxLimit: 50 });
    expect(q.page).toBe(1);
    expect(q.limit).toBe(50);
    expect(q.sortOrder).toBe('asc');
  });

  it('handles sortBy, q and invalid sortOrder', () => {
    const q = parseListQuery({ sortBy: 'name', sortOrder: 'nope', q: ' hi ' });
    expect(q.sortBy).toBe('name');
    expect(q.sortOrder).toBe('desc');
    expect(q.q).toBe('hi');
  });
});

