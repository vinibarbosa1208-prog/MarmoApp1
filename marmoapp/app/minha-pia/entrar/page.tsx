'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Topo } from '../_componentes'
import { fmtCpf, soDigitos } from '@/lib/minha-pia/regras'

export default function EntrarPage() {
  const router = useRouter()
  const [cpf, setCpf] = useState('')
  const [pin, setPin] = useState('')
  const [erro, setErro] = useState('')
  const [enviando, setEnviando] = useState(false)

  async function entrar(e: React.FormEvent) {
    e.preventDefault()
    setErro('')
    if (cpf.length !== 11 || pin.length !== 4) return setErro('Digite o CPF completo e o PIN de 4 números.')
    setEnviando(true)
    try {
      const r = await fetch('/api/minha-pia/entrar', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ cpf, pin }),
      })
      if (!r.ok) throw new Error((await r.json()).error)
      router.replace('/minha-pia/painel')
    } catch (er) {
      setErro(er instanceof Error && er.message ? er.message : 'Não foi possível entrar.')
      setEnviando(false)
    }
  }

  return (
    <>
      <Topo />
      <main className="mp-coluna">
        <section className="mp-secao">
          <h1 className="mp-h2">Acompanhar minha pia</h1>
          <p className="mp-p" style={{ marginBottom: 20 }}>Entre com o CPF e o PIN que você criou no cadastro.</p>
          {erro && <div className="mp-erro" role="alert">{erro}</div>}
          <form onSubmit={entrar}>
            <label className="mp-campo">
              <span className="mp-rotulo">CPF</span>
              <input className="mp-input num" inputMode="numeric" autoComplete="username" value={fmtCpf(cpf)} onChange={e => setCpf(soDigitos(e.target.value).slice(0, 11))} />
            </label>
            <label className="mp-campo">
              <span className="mp-rotulo">PIN</span>
              <input className="mp-input num" type="password" inputMode="numeric" maxLength={4} autoComplete="current-password" value={pin} onChange={e => setPin(soDigitos(e.target.value).slice(0, 4))} />
              <span className="mp-dica">Esqueceu o PIN? Fale com a gente pelo WhatsApp que criamos um novo.</span>
            </label>
            <button className="mp-btn mp-btn-primario mp-btn-cheio" disabled={enviando}>{enviando ? 'Entrando…' : 'Entrar'}</button>
          </form>
          <p className="mp-mini" style={{ marginTop: 24, textAlign: 'center' }}>
            Ainda não tem plano? <Link href="/minha-pia">Escolher minha pia</Link>
          </p>
        </section>
      </main>
    </>
  )
}
