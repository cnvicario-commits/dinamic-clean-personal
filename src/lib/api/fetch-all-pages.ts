export async function fetchAllPages<TItem>(
  list: (query: { page: number; pageSize: number }) => Promise<{ items: TItem[]; total: number }>,
  pageSize = 100,
): Promise<TItem[]> {
  const first = await list({ page: 1, pageSize })
  const pages = Math.max(1, Math.ceil(first.total / pageSize))
  const rows = [...first.items]
  for (let page = 2; page <= pages; page += 1) {
    const next = await list({ page, pageSize })
    rows.push(...next.items)
  }
  return rows
}
