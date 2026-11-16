'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useApp } from '@/contexts/AppContext'

// Tela de pagamento da assinatura (Asaas). Gera a fatura do plano MarmoApp e manda o cliente
// para ela; o acesso é liberado pelo webhook assim que o pagamento é confirmado.

function mascaraDoc(v: string) {
  const d = v.replace(/\D/g, '').slice(0, 14)
  if (d.length <= 11) {
    if (d.length > 9) return `${d.slice(0, 3)}.${d.slice(3, 6)}.${d.slice(6, 9)}-${d.slice(9)}`
    if (d.length > 6) return `${d.slice(0, 3)}.${d.slice(3, 6)}.${d.slice(6)}`
    if (d.length > 3) return `${d.slice(0, 3)}.${d.slice(3)}`
    return d
  }
  return `${d.slice(0, 2)}.${d.slice(2, 5)}.${d.slice(5, 8)}/${d.slice(8, 12)}-${d.slice(12)}`
}

export default function CheckoutPage() {
  const { marmoraria } = useApp()
  const router = useRouter()
  const [docDigitado, setDoc] = useState<string | null>(null)
  const doc = docDigitado ?? (marmoraria?.cnpj ? mascaraDoc(marmoraria.cnpj) : '')
  const [erro, setErro] = useState('')
  const [carregando, setCarregando] = useState(false)

  useEffect(() => {
    if (!marmoraria) return
    // Pagamento já confirmado (ou cliente liberado pelo time) → vai pro dashboard
    if (marmoraria.trial_expira && marmoraria.plano !== 'trial') {
      router.replace('/dashboard')
      return
    }
  }, [marmoraria, router])

  async function pagar() {
    const d = doc.replace(/\D/g, '')
    if (d.length !== 11 && d.length !== 14) {
      setErro('Informe um CPF ou CNPJ válido para emitir a cobrança.')
      return
    }
    setCarregando(true)
    setErro('')
    try {
      const r = await fetch('/api/asaas/assinar', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ cnpj: doc }),
      })
      const j = await r.json()
      if (!r.ok || !j.url) throw new Error(j.error || 'Erro ao gerar a cobrança.')
      window.location.assign(j.url)
    } catch (e) {
      setErro(e instanceof Error ? e.message : 'Erro de conexão. Tente novamente.')
      setCarregando(false)
    }
  }

  const caixa: React.CSSProperties = {
    width: '100%', maxWidth: 400, background: '#fff', borderRadius: 16, padding: 28,
    display: 'flex', flexDirection: 'column', gap: 14, boxSizing: 'border-box',
  }

  return (
    <div style={{
      minHeight: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
      background: '#0a0a0a', fontFamily: "'DM Sans', sans-serif", gap: 20, padding: 20,
    }}>
      <div style={{ fontFamily: "'Playfair Display', serif", fontSize: 26, color: '#fff' }}>
        Marmo<span style={{ color: '#C9A84C' }}>App</span>
      </div>

      <div style={caixa}>
        <div>
          <div style={{ fontSize: 13, color: '#9B8A7A', fontWeight: 600 }}>Plano MarmoApp</div>
          <div style={{ fontSize: 30, fontWeight: 700, color: '#2C2922' }}>
            R$ 297<span style={{ fontSize: 14, color: '#9B8A7A', fontWeight: 400 }}>/mês</span>
          </div>
          <div style={{ fontSize: 13, color: '#6B7280', marginTop: 4 }}>
            Pague por Pix, boleto ou cartão. Sem fidelidade: cancele quando quiser, sem multa.
          </div>
        </div>

        <label style={{ fontSize: 11, fontWeight: 700, color: '#9B8A7A', letterSpacing: '0.8px', textTransform: 'uppercase' }}>
          CPF ou CNPJ (para a nota da cobrança)
        </label>
        <input
          inputMode="numeric"
          placeholder="000.000.000-00 ou 00.000.000/0001-00"
          value={doc}
          onChange={e => { setDoc(mascaraDoc(e.target.value)); setErro('') }}
          style={{ background: '#F8F6F2', border: '1px solid #EDE9E2', borderRadius: 10, padding: '12px 14px', fontSize: 15, color: '#2C2922' }}
        />

        {erro && <div style={{ color: '#DC2626', fontSize: 13 }}>{erro}</div>}

        <button
          type="button"
          onClick={pagar}
          disabled={carregando || !marmoraria}
          style={{
            background: '#C9A84C', color: '#2C2922', fontWeight: 700, fontSize: 15, border: 'none',
            borderRadius: 10, padding: 14, cursor: carregando ? 'wait' : 'pointer',
          }}
        >
          {carregando ? 'Gerando a cobrança…' : 'Ir para o pagamento →'}
        </button>

        <div style={{ fontSize: 12, color: '#9B8A7A', lineHeight: 1.5, textAlign: 'center' }}>
          Pix libera o acesso em poucos minutos. Boleto leva até 1 dia útil para compensar.
          <br />
          Já pagou?{' '}
          <button
            type="button"
            onClick={() => window.location.reload()}
            style={{ color: '#C9A84C', background: 'none', border: 'none', padding: 0, cursor: 'pointer', fontSize: 12, fontWeight: 600 }}
          >
            Atualizar
          </button>
        </div>
      </div>
    </div>
  )
}
