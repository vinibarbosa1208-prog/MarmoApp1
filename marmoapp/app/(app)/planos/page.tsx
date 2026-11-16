'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { useApp } from '@/contexts/AppContext'
import { usePlano } from '@/hooks/usePlano'

// Plano vendido pelo site. Internamente segue 'pro' (preço do Stripe de R$ 297).
// O MarmoApp Plus (com o Antônio no WhatsApp) é vendido por contrato.
const PLANOS: { id: 'basic' | 'pro' | 'enterprise'; nome: string; preco: number; destaque?: boolean; descricao: string; recursos: string[] }[] = [
  {
    id: 'pro',
    nome: 'MarmoApp',
    preco: 297,
    destaque: true,
    descricao: 'O sistema completo para organizar a sua marmoraria',
    recursos: [
      'Orçamentos ilimitados',
      'Orçamento em PDF com a sua marca',
      'Markup automático',
      'Controle de estoque e materiais',
      'Fila de serviços e produção',
      'Relatórios de desempenho',
      'Até 3 usuários',
    ],
  },
]

export default function PlanosPage() {
  const { marmoraria, toast, user } = useApp()
  const { plano: planoAtual, trialExpirado, diasParaExpirar } = usePlano()
  const router = useRouter()
  const [loadingPlano, setLoadingPlano] = useState<string | null>(null)
  const [loadingPortal, setLoadingPortal] = useState(false)

  const temAssinatura = planoAtual !== 'trial' && marmoraria?.plano !== 'trial'
  const trialAindaAtivo = planoAtual === 'trial' && !trialExpirado && diasParaExpirar > 0

  async function assinar(planoId: string) {
    if (!user) {
      router.push(`/register?plano=${planoId}`)
      return
    }
    setLoadingPlano(planoId)
    try {
      const res = await fetch('/api/stripe/checkout', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ plano: planoId }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Erro ao criar sessão')
      window.location.href = data.url
    } catch (e) {
      toast(e instanceof Error ? e.message : 'Erro ao iniciar checkout', 'err')
      setLoadingPlano(null)
    }
  }

  async function gerenciarAssinatura() {
    setLoadingPortal(true)
    try {
      const res = await fetch('/api/stripe/portal', {
        method: 'POST',
        credentials: 'include',
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Erro ao abrir portal')
      window.location.href = data.url
    } catch (e) {
      toast(e instanceof Error ? e.message : 'Erro ao abrir portal', 'err')
      setLoadingPortal(false)
    }
  }

  return (
    <div className="page-inner">
      <div className="page-header">
        <button type="button" className="btn btn-outline" style={{ marginRight: 12 }} onClick={() => router.back()}>← Voltar</button>
        <h1 className="page-title">Planos e Assinatura</h1>
      </div>

      <div style={{ textAlign: 'center', marginBottom: 32 }}>
        <p style={{ color: 'var(--gray)', fontSize: 15, margin: 0 }}>
          Um plano, tudo incluso · cancele quando quiser, sem multa
        </p>
        {trialAindaAtivo && (
          <div style={{
            display: 'inline-block', marginTop: 10,
            background: '#FDF8F0', border: '1px solid var(--gold)',
            borderRadius: 8, padding: '6px 16px', fontSize: 13, color: '#7A6A4A',
          }}>
            Seu acesso atual termina em {diasParaExpirar} dia{diasParaExpirar !== 1 ? 's' : ''} · assine para continuar
          </div>
        )}
        {temAssinatura && (
          <div style={{ marginTop: 12 }}>
            <button
              type="button"
              className="btn btn-outline"
              onClick={gerenciarAssinatura}
              disabled={loadingPortal}
              style={{ fontSize: 13 }}
            >
              {loadingPortal ? 'Carregando...' : '⚙️ Gerenciar assinatura atual'}
            </button>
          </div>
        )}
      </div>

      <div style={{
        display: 'grid',
        gridTemplateColumns: 'minmax(280px, 420px)',
          justifyContent: 'center',
        gap: 20,
        maxWidth: 980,
        margin: '0 auto',
      }}>
        {PLANOS.map(p => {
          const isAtual = planoAtual === p.id
          const isLoading = loadingPlano === p.id

          return (
            <div
              key={p.id}
              className="card"
              style={{
                padding: 28,
                border: p.destaque
                  ? '2px solid var(--gold)'
                  : isAtual
                    ? '2px solid var(--green)'
                    : '1px solid #EDE9E2',
                position: 'relative',
                transition: 'box-shadow 0.2s',
              }}
            >
              {p.destaque && (
                <div style={{
                  position: 'absolute', top: -13, left: '50%', transform: 'translateX(-50%)',
                  background: 'var(--gold)', color: '#2C2922',
                  padding: '3px 14px', borderRadius: 12, fontSize: 11, fontWeight: 700, whiteSpace: 'nowrap',
                }}>
                  SEM FIDELIDADE
                </div>
              )}
              {isAtual && (
                <div style={{
                  position: 'absolute', top: -13, right: 16,
                  background: 'var(--green)', color: '#fff',
                  padding: '3px 12px', borderRadius: 12, fontSize: 11, fontWeight: 700,
                }}>
                  SEU PLANO
                </div>
              )}

              <div style={{ marginBottom: 16 }}>
                <div style={{ fontSize: 18, fontWeight: 700, fontFamily: "'Playfair Display', serif", color: 'var(--dark)' }}>
                  {p.nome}
                </div>
                <div style={{ fontSize: 13, color: 'var(--gray)', marginTop: 4 }}>{p.descricao}</div>
              </div>

              <div style={{ marginBottom: 20 }}>
                <span style={{ fontSize: 32, fontWeight: 700, color: 'var(--dark)' }}>
                  R$ {p.preco.toLocaleString('pt-BR')}
                </span>
                <span style={{ fontSize: 13, color: 'var(--gray)' }}>/mês</span>
              </div>

              <ul style={{ listStyle: 'none', padding: 0, margin: '0 0 24px', display: 'flex', flexDirection: 'column', gap: 8 }}>
                {p.recursos.map(r => (
                  <li key={r} style={{ fontSize: 13, color: 'var(--dark)', display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span style={{ color: 'var(--green)', fontWeight: 700, flexShrink: 0 }}>✓</span>
                    {r}
                  </li>
                ))}
              </ul>

              {isAtual ? (
                <button
                  type="button"
                  className="btn btn-outline"
                  style={{ width: '100%', opacity: 0.7, cursor: 'default' }}
                  disabled
                >
                  Plano atual
                </button>
              ) : (
                <button
                  type="button"
                  className={`btn ${p.destaque ? 'btn-gold' : 'btn-outline'}`}
                  style={{ width: '100%' }}
                  onClick={() => assinar(p.id)}
                  disabled={isLoading || loadingPortal}
                >
                  {isLoading ? 'Aguarde...' : temAssinatura ? `Mudar para ${p.nome}` : `Assinar ${p.nome}`}
                </button>
              )}
            </div>
          )
        })}
      </div>

      <div style={{ textAlign: 'center', marginTop: 32, fontSize: 12, color: 'var(--gray)' }}>
        Pagamento seguro no cartão via Stripe · Cancele quando quiser, sem multa · Suporte incluso
      </div>
    </div>
  )
}
