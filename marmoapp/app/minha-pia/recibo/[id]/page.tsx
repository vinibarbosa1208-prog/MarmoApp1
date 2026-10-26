'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useParams, useRouter } from 'next/navigation'
import { fmtReais, fmtData } from '@/lib/minha-pia/regras'

interface Recibo {
  codigo: string
  pagamento: { tipo: string; valor: number; desconto: number; forma: string; pago_em: string }
  plano: { numero: number; kit_nome: string; valor_total: number; acumulado: number }
  cliente: { nome: string; cpf_final: string }
  loja: { nome: string; cnpj: string | null; endereco: string | null; telefone: string | null }
  programa: string
}

const TIPO: Record<string, string> = { parcela: 'à parcela', antecipacao: 'ao valor adiantado', quitacao: 'à quitação', ajuste: 'ao ajuste' }
const FORMA: Record<string, string> = { pix: 'Pix', manual: 'Pix', dinheiro: 'dinheiro', cartao: 'cartão', boleto: 'boleto' }

function fmtCnpj(d: string) { return d.replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/, '$1.$2.$3/$4-$5') }

export default function ReciboPage() {
  const { id } = useParams<{ id: string }>()
  const router = useRouter()
  const [r, setR] = useState<Recibo | null>(null)
  const [erro, setErro] = useState('')

  useEffect(() => {
    fetch(`/api/minha-pia/recibo/${id}`, { cache: 'no-store' }).then(async res => {
      if (res.status === 401) return router.replace('/minha-pia/entrar')
      if (!res.ok) return setErro('Recibo não encontrado.')
      setR(await res.json())
    }).catch(() => setErro('Não foi possível carregar o recibo.'))
  }, [id, router])

  if (!r) return <main className="mp-coluna"><div className="mp-carregando">{erro || 'Carregando recibo…'}</div></main>

  return (
    <main className="mp-coluna mp-recibo">
      <div className="mp-nao-imprime" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '14px 0' }}>
        <Link href="/minha-pia/painel" className="mp-link-topo">Voltar ao painel</Link>
        <button type="button" className="mp-btn mp-btn-sec" style={{ minHeight: 44 }} onClick={() => window.print()}>Salvar PDF</button>
      </div>

      <article className="mp-placa" style={{ padding: 24 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'flex-start' }}>
          <h1 className="mp-h2" style={{ margin: 0 }}>Recibo</h1>
          <span className="mp-mini num">Nº {r.codigo}</span>
        </div>

        <p className="mp-p" style={{ margin: '18px 0', fontSize: 17 }}>
          Recebemos de <strong>{r.cliente.nome}</strong> (CPF ***.***.{r.cliente.cpf_final}) o valor de{' '}
          <strong className="num">{fmtReais(r.pagamento.valor, true)}</strong>, pago em {FORMA[r.pagamento.forma] ?? r.pagamento.forma} no dia {fmtData(r.pagamento.pago_em)},
          referente {TIPO[r.pagamento.tipo] ?? r.pagamento.tipo} do plano #{r.plano.numero} da {r.programa} ({r.plano.kit_nome}).
          {r.pagamento.desconto > 0 && <> Foi concedido desconto de {fmtReais(r.pagamento.desconto, true)} na quitação.</>}
        </p>

        <dl className="mp-dados" style={{ borderTop: '1px solid var(--mp-linha)', paddingTop: 14 }}>
          <dt>Valor da pia</dt><dd className="num">{fmtReais(r.plano.valor_total, true)}</dd>
          <dt>Total pago até esta data</dt><dd className="num">{fmtReais(r.plano.acumulado, true)}</dd>
          <dt>Saldo</dt><dd className="num">{fmtReais(Math.max(0, r.plano.valor_total - r.plano.acumulado), true)}</dd>
        </dl>

        <footer style={{ marginTop: 24, paddingTop: 14, borderTop: '1px solid var(--mp-linha)', fontSize: 14, color: 'var(--mp-tinta-2)', lineHeight: 1.6 }}>
          <strong style={{ color: 'var(--mp-tinta)' }}>{r.loja.nome}</strong><br />
          {r.loja.cnpj && <>CNPJ {fmtCnpj(r.loja.cnpj)}<br /></>}
          {r.loja.endereco && <>{r.loja.endereco}<br /></>}
          {r.loja.telefone}
        </footer>
      </article>
    </main>
  )
}
