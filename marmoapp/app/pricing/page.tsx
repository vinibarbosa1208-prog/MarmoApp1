'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'

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

export default function PricingPage() {
  const router = useRouter()
  const [loadingPlano, setLoadingPlano] = useState<string | null>(null)
  const [erro, setErro] = useState<string | null>(null)

  async function assinar(planoId: string) {
    setLoadingPlano(planoId)
    setErro(null)
    try {
      const { data: { user } } = await supabase.auth.getUser()

      if (!user) {
        router.push(`/register?plano=${planoId}`)
        return
      }

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
      setErro(e instanceof Error ? e.message : 'Erro ao iniciar checkout')
      setLoadingPlano(null)
    }
  }

  return (
    <div style={{ minHeight: '100vh', background: '#FAF9F7', padding: '40px 20px' }}>
      <div style={{ maxWidth: 980, margin: '0 auto' }}>

        <div style={{ textAlign: 'center', marginBottom: 40 }}>
          <Link href="/">
            <img src="/logo-marmoapp.jpg" alt="MarmoApp" style={{ height: 48, objectFit: 'contain', marginBottom: 16, display: 'block', margin: '0 auto 16px' }} />
          </Link>
          <h1 style={{ fontFamily: "'Playfair Display', serif", fontSize: 32, fontWeight: 700, color: '#2C2922', margin: '0 0 8px' }}>
            Planos e Preços
          </h1>
          <p style={{ color: '#9B8A7A', fontSize: 15, margin: 0 }}>
            Um plano, tudo incluso · cancele quando quiser, sem multa
          </p>
        </div>

        {erro && (
          <div style={{
            background: '#FEF2F2', border: '1px solid #FECACA', borderRadius: 8,
            padding: '10px 16px', marginBottom: 24, textAlign: 'center',
            fontSize: 14, color: '#DC2626',
          }}>
            {erro}
          </div>
        )}

        <div style={{
          display: 'grid',
          gridTemplateColumns: 'minmax(280px, 420px)',
          justifyContent: 'center',
          gap: 20,
        }}>
          {PLANOS.map(p => {
            const isLoading = loadingPlano === p.id
            return (
              <div
                key={p.id}
                style={{
                  background: '#fff',
                  borderRadius: 12,
                  padding: 28,
                  border: p.destaque ? '2px solid #C9A84C' : '1px solid #EDE9E2',
                  position: 'relative',
                  boxShadow: p.destaque
                    ? '0 4px 24px rgba(201,168,76,0.12)'
                    : '0 1px 4px rgba(0,0,0,0.04)',
                }}
              >
                {p.destaque && (
                  <div style={{
                    position: 'absolute', top: -13, left: '50%', transform: 'translateX(-50%)',
                    background: '#C9A84C', color: '#2C2922',
                    padding: '3px 14px', borderRadius: 12, fontSize: 11, fontWeight: 700, whiteSpace: 'nowrap',
                  }}>
                    SEM FIDELIDADE
                  </div>
                )}


                <div style={{ marginBottom: 16, }}>
                  <div style={{ fontSize: 18, fontWeight: 700, fontFamily: "'Playfair Display', serif", color: '#2C2922' }}>
                    {p.nome}
                  </div>
                  <div style={{ fontSize: 13, color: '#9B8A7A', marginTop: 4 }}>{p.descricao}</div>
                </div>

                <div style={{ marginBottom: 20 }}>
                  <span style={{ fontSize: 32, fontWeight: 700, color: '#2C2922' }}>
                    R$ {p.preco.toLocaleString('pt-BR')}
                  </span>
                  <span style={{ fontSize: 13, color: '#9B8A7A' }}>/mês</span>
                </div>

                <ul style={{ listStyle: 'none', padding: 0, margin: '0 0 24px', display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {p.recursos.map(r => (
                    <li key={r} style={{ fontSize: 13, color: '#2C2922', display: 'flex', alignItems: 'center', gap: 8 }}>
                      <span style={{ color: '#27AE60', fontWeight: 700, flexShrink: 0 }}>✓</span>
                      {r}
                    </li>
                  ))}
                </ul>

                <button
                  type="button"
                  onClick={() => assinar(p.id)}
                  disabled={!!loadingPlano}
                  style={{
                    width: '100%',
                    padding: '12px 0',
                    background: p.destaque ? '#C9A84C' : 'transparent',
                    color: '#2C2922',
                    border: p.destaque ? '2px solid #C9A84C' : '2px solid #2C2922',
                    borderRadius: 8,
                    fontSize: 14,
                    fontWeight: 700,
                    cursor: loadingPlano ? 'wait' : 'pointer',
                    opacity: loadingPlano && !isLoading ? 0.6 : 1,
                    transition: 'opacity 0.15s',
                  }}
                >
                  {isLoading ? 'Aguarde...' : `Assinar ${p.nome}`}
                </button>
              </div>
            )
          })}
        </div>

        <div style={{ textAlign: 'center', marginTop: 32, fontSize: 12, color: '#9B8A7A' }}>
          Pagamento seguro no cartão via Stripe · Cancele quando quiser, sem multa · Suporte incluso<br />Quer o Antônio atendendo seus clientes no WhatsApp? <a href="https://www.marmoapp.com/marmoraria-ia/" style={{ color: '#C9A84C' }}>Conheça o MarmoApp Plus</a>
        </div>

        <div style={{ textAlign: 'center', marginTop: 16, display: 'flex', justifyContent: 'center', gap: 20 }}>
          <Link href="/login" style={{ fontSize: 13, color: '#C9A84C', textDecoration: 'none', fontWeight: 600 }}>
            Já tenho conta →
          </Link>
          <Link href="/register" style={{ fontSize: 13, color: '#9B8A7A', textDecoration: 'none' }}>
            Criar conta
          </Link>
        </div>
      </div>
    </div>
  )
}
