import { requireAdminAuth } from '@/lib/auth-admin'
import Header from '@/components/Header'
import ContratoEditor from '../ContratoEditor'

export default async function ContratoPage({ params }: { params: Promise<{ id: string }> }) {
  await requireAdminAuth()
  const { id } = await params
  return (
    <div className="flex h-full flex-col">
      <Header title="Contrato" subtitle="Rascunho, envio e registro da assinatura" />
      <div className="flex-1 overflow-auto p-6">
        <ContratoEditor id={id} />
      </div>
    </div>
  )
}
