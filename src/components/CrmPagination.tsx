import Link from 'next/link'

export default function CrmPagination({
  path,
  page,
  pageSize,
  total,
  query = {},
}: {
  path: string
  page: number
  pageSize: number
  total: number
  query?: Record<string, string | undefined>
}) {
  const totalPages = Math.max(1, Math.ceil(total / pageSize))
  if (totalPages === 1) return null

  const href = (nextPage: number) => {
    const params = new URLSearchParams()
    for (const [key, value] of Object.entries(query)) if (value) params.set(key, value)
    params.set('page', String(nextPage))
    return `${path}?${params.toString()}`
  }

  return (
    <nav className="mt-4 flex items-center justify-between gap-3 text-sm" aria-label="Paginación CRM">
      <p className="text-slate-500">Mostrando {(page - 1) * pageSize + 1}–{Math.min(page * pageSize, total)} de {total}</p>
      <div className="flex gap-2">
        {page > 1 && <Link className="rounded border border-slate-300 px-3 py-1.5 hover:bg-slate-50" href={href(page - 1)}>Anterior</Link>}
        {page < totalPages && <Link className="rounded border border-slate-300 px-3 py-1.5 hover:bg-slate-50" href={href(page + 1)}>Siguiente</Link>}
      </div>
    </nav>
  )
}
