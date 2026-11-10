'use client'

import { useState } from 'react'

interface Props {
  token: string
  status: string
  emailMascarado: string
  representante: string
  textoAceite: string
  assinadoEm: string | null
  linkPagamento: string | null
}

function mascaraCpf(v: string) {
  const d = v.replace(/\D/g, '').slice(0, 11)
  return d
    .replace(/(\d{3})(\d)/, '$1.$2')
    .replace(/(\d{3})(\d)/, '$1.$2')
    .replace(/(\d{3})(\d{1,2})$/, '$1-$2')
}

const botao = 'rounded-full bg-[#C9A84C] px-6 py-3 font-bold text-[#0D0D0D] disabled:opacity-50'
const campo = 'w-full rounded-xl border border-[#E8E0CE] bg-[#FBF9F4] px-4 py-3 text-base text-[#2C2922] outline-none focus:border-[#C9A84C]'

export default function AssinarForm(p: Props) {
  const [nome, setNome] = useState('')
  const [cpf, setCpf] = useState('')
  const [aceite, setAceite] = useState(false)
  const [codigo, setCodigo] = useState('')
  const [etapa, setEtapa] = useState<'dados' | 'codigo' | 'feito'>(p.status === 'assinado' ? 'feito' : 'dados')
  const [msg, setMsg] = useState('')
  const [info, setInfo] = useState('')
  const [carregando, setCarregando] = useState(false)
  const [resultado, setResultado] = useState<{ documento: string; link_pagamento: string | null } | null>(
    p.status === 'assinado' ? { documento: `/assinar/${p.token}/documento`, link_pagamento: p.linkPagamento } : null
  )

  async function chamar(rota: string, corpo: object) {
    setCarregando(true)
    setMsg('')
    try {
      const r = await fetch(`/api/publico/contratos/${p.token}/${rota}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(corpo),
      })
      const j = await r.json().catch(() => ({}))
      if (!r.ok) throw new Error(j.error || 'Não deu certo. Tente de novo.')
      return j
    } catch (e) {
      setMsg(e instanceof Error ? e.message : 'Não deu certo. Tente de novo.')
      return null
    } finally {
      setCarregando(false)
    }
  }

  async function pedirCodigo() {
    if (nome.trim().split(/\s+/).length < 2) return setMsg('Escreva seu nome completo.')
    if (cpf.replace(/\D/g, '').length !== 11) return setMsg('Confira o CPF.')
    if (!aceite) return setMsg('Marque que leu e concorda com o contrato.')
    const j = await chamar('codigo', { cpf })
    if (j) {
      setInfo(`Enviamos um código de 6 dígitos para ${j.email}. Ele vale por ${j.validade_min} minutos.`)
      setEtapa('codigo')
    }
  }

  async function assinar() {
    const j = await chamar('assinar', { nome, cpf, codigo, aceite })
    if (j) {
      setResultado({ documento: j.documento, link_pagamento: j.link_pagamento })
      setEtapa('feito')
    }
  }

  if (p.status !== 'enviado' && p.status !== 'assinado')
    return (
      <div className="rounded-2xl border border-[#E8E0CE] bg-white p-6">
        <p className="font-bold">Este contrato não está disponível para assinatura.</p>
      </div>
    )

  if (etapa === 'feito' && resultado)
    return (
      <div className="rounded-2xl bg-[#0D0D0D] p-6 text-[#F5F1E7] sm:p-8">
        <p className="text-xs font-bold tracking-[3px] text-[#C9A84C]">CONTRATO ASSINADO</p>
        <h2 className="mt-2 font-serif text-2xl font-bold">Tudo certo! O contrato foi assinado.</h2>
        <p className="mt-2 text-[#D9CFBE]">
          {p.assinadoEm
            ? `Assinado em ${new Date(p.assinadoEm).toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' })}. `
            : ''}
          Uma cópia foi enviada para o seu e-mail.
        </p>
        <div className="mt-5 flex flex-wrap gap-3">
          {resultado.link_pagamento && (
            <a className={botao} href={resultado.link_pagamento} target="_blank" rel="noopener noreferrer">
              Pagar a primeira cobrança
            </a>
          )}
          <a className="rounded-full border border-[#F5F1E7] px-6 py-3 font-bold" href={resultado.documento}>
            Ver a via assinada
          </a>
        </div>
        {!resultado.link_pagamento && (
          <p className="mt-4 text-sm text-[#D9CFBE]">O link de pagamento chega pelo WhatsApp em seguida.</p>
        )}
      </div>
    )

  return (
    <div className="rounded-2xl border border-[#E8E0CE] bg-white p-6 sm:p-8">
      <h2 className="font-serif text-2xl font-bold">Assinar o contrato</h2>
      <p className="mt-1 text-sm text-[#6F6355]">Quem assina: {p.representante}. O código vai para o e-mail {p.emailMascarado}.</p>

      {etapa === 'dados' && (
        <div className="mt-5 space-y-4">
          <label className="block">
            <span className="mb-1 block text-sm font-bold">Nome completo</span>
            <input className={campo} value={nome} onChange={(e) => setNome(e.target.value)} autoComplete="name" maxLength={120} />
          </label>
          <label className="block">
            <span className="mb-1 block text-sm font-bold">CPF</span>
            <input className={campo} value={cpf} onChange={(e) => setCpf(mascaraCpf(e.target.value))} inputMode="numeric" placeholder="000.000.000-00" />
          </label>
          <label className="flex items-start gap-3 text-sm">
            <input type="checkbox" className="mt-1 h-5 w-5 accent-[#C9A84C]" checked={aceite} onChange={(e) => setAceite(e.target.checked)} />
            <span>{p.textoAceite}</span>
          </label>
          <button className={botao} disabled={carregando} onClick={pedirCodigo}>
            {carregando ? 'Enviando…' : 'Receber o código por e-mail'}
          </button>
        </div>
      )}

      {etapa === 'codigo' && (
        <div className="mt-5 space-y-4">
          <p className="text-sm">{info}</p>
          <label className="block">
            <span className="mb-1 block text-sm font-bold">Código de 6 dígitos</span>
            <input
              className={`${campo} tracking-[6px]`}
              value={codigo}
              onChange={(e) => setCodigo(e.target.value.replace(/\D/g, '').slice(0, 6))}
              inputMode="numeric"
              autoComplete="one-time-code"
            />
          </label>
          <div className="flex flex-wrap gap-3">
            <button className={botao} disabled={carregando || codigo.length !== 6} onClick={assinar}>
              {carregando ? 'Assinando…' : 'Assinar contrato'}
            </button>
            <button className="text-sm font-bold underline" disabled={carregando} onClick={pedirCodigo}>
              Mandar outro código
            </button>
          </div>
        </div>
      )}

      {msg && <p className="mt-4 font-bold text-[#A33A2B]">{msg}</p>}
      <p className="mt-6 text-xs text-[#6F6355]">
        Ao assinar, registramos seu nome, CPF, e-mail, data, hora, endereço IP, navegador e o código de integridade do texto, só para comprovar a assinatura.
      </p>
    </div>
  )
}
