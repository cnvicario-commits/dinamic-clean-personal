/** Supabase embed selects often type many-to-one joins as T[] even when runtime returns T. */
export type RelOne<T> = T | T[] | null | undefined

export function relOne<T>(value: RelOne<T>): T | null {
  if (value == null) return null
  return Array.isArray(value) ? (value[0] ?? null) : value
}
