import type { Metadata } from 'next'
import { contratoPorToken } from '@/lib/contrato/publico'
import { formatarDocumento } from '@/lib/contrato/modelo'
import TextoContrato from '@/components/contrato/TextoContrato'
import BotaoImprimir from './BotaoImprimir'

export const metadata: Metadata = { title: 'Contrato assinado — MarmorarIA', robots: { index: false, follow: false } }
export const dynamic = 'force-dynamic'

interface Registro {
  metodo: string
  nome: string
  cpf: string
  email: string
  ip: string
  navegador: string
  hash_sha256: string
  texto_aceite: string
  assinado_em: string
}

function cpfParcial(cpf: string) {
  const f = formatarDocumento(cpf)
  return f.length === 14 ? `***.${f.slice(4, 11)}-**` : '***'
}

export default async function DocumentoPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params
  const c = await contratoPorToken(token)
  const r = c?.assinatura as Registro | null

  return (
    <div className="min-h-full bg-white text-[#2C2922]">
      <div className="mx-auto max-w-3xl px-6 py-8 print:px-0 print:py-0">
        {!c || !c.texto ? (
          <p>Documento não encontrado.</p>
        ) : (
          <>
            <div className="mb-6 flex items-center justify-between print:hidden">
              <p className="font-serif text-xl font-bold">
                Marmorar<span className="text-[#8A6D1F]">IA</span>
              </p>
              <BotaoImprimir />
            </div>
            <TextoContrato texto={c.texto} />

            <section className="mt-8 break-inside-avoid rounded-xl border-2 border-[#2C2922] p-5 text-sm">
              <h2 className="text-sm font-bold uppercase tracking-widest">Registro da assinatura eletrônica</h2>
              {c.status === 'assinado' && r ? (
                <dl className="mt-3 grid grid-cols-[170px_1fr] gap-x-3 gap-y-1.5">
                  <dt className="font-bold">Contrato</dt>
                  <dd>{c.numero}</dd>
                  <dt className="font-bold">Assinado por</dt>
                  <dd>
                    {r.nome}, CPF {cpfParcial(r.cpf)}, em nome da CONTRATANTE
                  </dd>
                  <dt className="font-bold">Data e hora</dt>
                  <dd>{new Date(r.assinado_em).toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' })} (horário de Brasília)</dd>
                  <dt className="font-bold">Confirmação</dt>
                  <dd>{r.metodo}</dd>
                  <dt className="font-bold">Endereço IP</dt>
                  <dd>{r.ip}</dd>
                  <dt className="font-bold">Navegador</dt>
                  <dd className="break-all">{r.navegador}</dd>
                  <dt className="font-bold">Aceite</dt>
                  <dd>{r.texto_aceite}</dd>
                  <dt className="font-bold">Integridade (SHA-256)</dt>
                  <dd className="break-all font-mono text-xs">{r.hash_sha256}</dd>
                </dl>
              ) : (
                <p className="mt-2">Aguardando assinatura da CONTRATANTE.</p>
              )}
              <p className="mt-3 text-xs text-[#6F6355]">
                Assinatura eletrônica nos termos do art. 10, § 2º, da MP 2.200-2/2001. Qualquer alteração no texto acima muda o código de integridade.
                A CONTRATADA assina ao emitir e enviar este contrato pela plataforma MarmoApp.
              </p>
            </section>
          </>
        )}
      </div>
    </div>
  )
}
