import type { Metadata } from 'next'
import { contratoPorToken } from '@/lib/contrato/publico'
import { mascararEmail } from '@/lib/contrato/seguranca'
import { TEXTO_ACEITE, type Parte } from '@/lib/contrato/modelo'
import TextoContrato from '@/components/contrato/TextoContrato'
import AssinarForm from './AssinarForm'

export const metadata: Metadata = { title: 'Assinatura do contrato — MarmorarIA', robots: { index: false, follow: false } }
export const dynamic = 'force-dynamic'

export default async function AssinarPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params
  const c = await contratoPorToken(token)

  return (
    <div className="min-h-full bg-[#FBF9F4] text-[#2C2922]">
      <div className="mx-auto max-w-3xl px-5 py-8">
        <p className="font-serif text-xl font-bold">
          Marmorar<span className="text-[#8A6D1F]">IA</span>
        </p>
        {!c || !c.texto ? (
          <div className="mt-10 rounded-2xl border border-[#E8E0CE] bg-white p-8">
            <h1 className="font-serif text-2xl font-bold">Link inválido</h1>
            <p className="mt-2 text-[#6F6355]">Este contrato não existe mais ou foi cancelado. Fale com a MarmorarIA pelo WhatsApp (11) 94734-0955.</p>
          </div>
        ) : (
          <>
            <div className="mt-6 rounded-2xl border border-[#E8E0CE] bg-white p-6 sm:p-8">
              <TextoContrato texto={c.texto} />
              <p className="mt-6 break-all border-t border-[#E8E0CE] pt-4 text-xs text-[#6F6355]">
                Código de integridade (SHA-256) deste texto: {c.hash_sha256}
              </p>
            </div>
            <div className="mt-6">
              <AssinarForm
                token={token}
                status={c.status as string}
                emailMascarado={(c.contratante as Parte).email ? mascararEmail((c.contratante as Parte).email!) : ''}
                representante={(c.contratante as Parte).representante}
                textoAceite={TEXTO_ACEITE}
                assinadoEm={c.assinado_em as string | null}
                linkPagamento={c.link_pagamento as string | null}
              />
            </div>
          </>
        )}
        <p className="mt-10 text-center text-xs text-[#6F6355]">MarmorarIA · uma marca do ecossistema MarmoApp · Arujá-SP</p>
      </div>
    </div>
  )
}
