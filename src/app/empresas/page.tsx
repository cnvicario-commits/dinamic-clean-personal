import { createAuthenticatedServerApiClient } from '@/lib/api/server'
import { canManageCompanies } from '@/lib/empresas/company-writes'
import { createClient } from '@/utils/supabase/server'
import EmpresasPanel from '@/components/EmpresasPanel'

export default async function EmpresasPage() {
  const supabase = await createClient()
  const { data: empresas } = await supabase
    .from('empresas')
    .select('*')
    .order('nombre')

  let canWrite = false
  try {
    const me = await (await createAuthenticatedServerApiClient()).getMe()
    canWrite = canManageCompanies(me.role)
  } catch {
    canWrite = false
  }

  return (
    <div className="max-w-4xl mx-auto px-6 py-10">
      <h1 className="text-2xl font-bold text-slate-900 mb-6">Empresas</h1>
      <EmpresasPanel empresas={empresas ?? []} canWrite={canWrite} />
    </div>
  )
}
