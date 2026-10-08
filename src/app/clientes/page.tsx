import { createClient } from '@/utils/supabase/server'
import { createDinamicApiClient, type ClientRecord } from '@/lib/api/generated'
import ClienteForm from '@/components/ClienteForm'
import ClientesTabla from '@/components/ClientesTabla'

export default async function ClientesPage() {
  const supabase = await createClient()
  const {data:{session}}=await supabase.auth.getSession()
  const baseUrl=process.env.API_URL??process.env.NEXT_PUBLIC_API_URL
  let clientes:ClientRecord[]=[]
  if(session?.access_token&&baseUrl)clientes=await createDinamicApiClient({baseUrl,accessToken:session.access_token}).listClients()

  return (
    <div className="max-w-4xl mx-auto px-6 py-10">
      <h1 className="text-2xl font-bold text-slate-900 mb-6">Clientes</h1>

      <ClienteForm />

      <div className="mt-8">
        <ClientesTabla clientes={clientes} />
      </div>
    </div>
  )
}
