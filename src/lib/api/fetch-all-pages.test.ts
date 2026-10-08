import { describe, expect, it, vi } from 'vitest'
import { fetchAllPages } from './fetch-all-pages'

describe('fetchAllPages', () => {
  it('aggregates all pages when total exceeds page size', async () => {
    const list = vi.fn(async ({ page, pageSize }: { page: number; pageSize: number }) => {
      expect(pageSize).toBe(2)
      if (page === 1) return { items: [1, 2], total: 5 }
      if (page === 2) return { items: [3, 4], total: 5 }
      return { items: [5], total: 5 }
    })
    await expect(fetchAllPages(list, 2)).resolves.toEqual([1, 2, 3, 4, 5])
    expect(list).toHaveBeenCalledTimes(3)
  })

  it('returns first page only when total fits one page', async () => {
    const list = vi.fn(async ({ page }: { page: number; pageSize: number }) => {
      expect(page).toBe(1)
      return {
        items: ['a'],
        total: 1,
      }
    })
    await expect(fetchAllPages(list)).resolves.toEqual(['a'])
    expect(list).toHaveBeenCalledTimes(1)
  })
})
