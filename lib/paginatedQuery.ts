export async function readAllRows<T>(
  query: (start: number, end: number) => PromiseLike<{ data: T[] | null; error: unknown }>,
): Promise<T[]> {
  const rows: T[] = []
  while (true) {
    const { data, error } = await query(rows.length, rows.length + 999)
    if (error) throw error
    if (!data?.length) return rows
    rows.push(...data)
  }
}
