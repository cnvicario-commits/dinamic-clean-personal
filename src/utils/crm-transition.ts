/** Reconciles optimistic card data with the authoritative transition response. */
export function reconcileCrmTransition<T extends { id: string }>(previous: T, response: { id: string } & Record<string, unknown>): T {
  return { ...previous, ...response } as T
}
