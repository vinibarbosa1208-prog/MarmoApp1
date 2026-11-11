'use client'

import { hojeBR, somarDias } from '@/lib/financeiro'

import { useCallback, useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import TextoContrato from '@/components/contrato/TextoContrato'
import { calcularValores, condicaoPadrao, PLANOS, type Condicao, type PlanoKey } from '@/lib/contrato/modelo'

export interface Inicial {
  diagnostico_id?: string
  lead_id?: string
  plano?: PlanoKey
  contratante?: Partial<Contratante>
}

interface Contratante {
  razao_social: string
  documento: string
  endereco: string
  cidade: string
  representante: string
  cpf_representante: string
  email: string
  whatsapp: string
}

interface Registro {
  nome: string
  cpf: string
  email: string
  ip: string
  assinado_em: string
}

const VAZIO: Contratante = {
  razao_social: '',
  documento: '',
  endereco: '',
  cidade: '',
  representante: '',
  cpf_representante: '',
  email: '',
  whatsapp: '',
}
const brl = (v: number) => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
const campo = 'w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-gray-900 outline-none focus:border-gold'
const rotulo = 'mb-1 block text-xs text-gray-600'

export default function ContratoEditor({ id, inicial }: { id?: string; inicial?: Inicial }) {
  const router = useRouter()
  const [ct, setCt] = useState<Contratante>({ ...VAZIO, ...(inicial?.contratante ?? {}) })
  const [plano, setPlano] = useState<PlanoKey>(inicial?.plano ?? 'operacao')
  const [condicao, setCondicao] = useState<Condicao>(condicaoPadrao())
  const [dia, setDia] = useState(10)
  const [antonioAtivo, setAntonioAtivo] = useState(false)
  // Ativação do Antônio no WhatsApp: padrão de 14 dias depois de hoje (horário de Brasília).
  const [dataAtivacao, setDataAtivacao] = useState(() => somarDias(hojeBR(), 14))
  const [status, setStatus] = useState('rascunho')
  const [numero, setNumero] = useState('')
  const [previa, setPrevia] = useState('')
  const [pendencias, setPendencias] = useState<string[]>([])
  const [contratadaPendente, setContratadaPendente] = useState<string | null>(null)
  const [link, setLink] = useState<string | null>(null)
  const [registro, setRegistro] = useState<Registro | null>(null)
  const [linkPagamento, setLinkPagamento] = useState<string | null>(null)
  const [msg, setMsg] = useState('')
  const [ocupado, setOcupado] = useState(false)

  const carregar = useCallback(async () => {
    if (!id) return
    const r = await fetch(`/api/contratos/${id}`)
    const j = await r.json()
    if (!r.ok) return setMsg(j.error || 'Contrato não encontrado.')
    const c = j.contrato
    setCt({ ...VAZIO, ...c.contratante })
    setPlano(c.plano)
    setCondicao(c.condicao)
    setDia(c.dia_vencimento)
    setAntonioAtivo(PLANOS[c.plano as PlanoKey].temAntonioWhatsapp && !c.data_ativacao_antonio)
    if (c.data_ativacao_antonio) setDataAtivacao(c.data_ativacao_antonio)
    setStatus(c.status)
    setNumero(c.numero)
    setPrevia(j.previa ?? '')
    setPendencias(j.pendencias ?? [])
    setContratadaPendente(j.contratada_pendente ?? null)
    setLink(j.link)
    setRegistro(c.assinatura ?? null)
    setLinkPagamento(c.link_pagamento ?? null)
  }, [id])

  useEffect(() => {
    // Carrega fora do ciclo de render (dados vêm da API).
    Promise.resolve().then(carregar)
  }, [carregar])

  const v = calcularValores(plano, condicao, antonioAtivo)
  const P = PLANOS[plano]
  const editavel = status === 'rascunho'

  function corpo() {
    return {
      plano,
      condicao,
      dia_vencimento: dia,
      antonio_ativo: antonioAtivo,
      data_ativacao_antonio: P.temAntonioWhatsapp && !antonioAtivo ? dataAtivacao : null,
      contratante: ct,
      lead_id: inicial?.lead_id,
      diagnostico_id: inicial?.diagnostico_id,
    }
  }

  async function salvar() {
    setOcupado(true)
    setMsg('')
    const r = await fetch(id ? `/api/contratos/${id}` : '/api/contratos', {
      method: id ? 'PATCH' : 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(corpo()),
    })
    const j = await r.json()
    setOcupado(false)
    if (!r.ok) return setMsg(j.error || 'Não salvou.')
    if (!id) return router.push(`/contratos/${j.id}`)
    setMsg('Rascunho salvo.')
    carregar()
  }

  async function acao(nome: 'enviar' | 'cancelar') {
    if (nome === 'cancelar' && !window.confirm('Cancelar este contrato? O link de assinatura deixa de funcionar.')) return
    setOcupado(true)
    setMsg('')
    const r = await fetch(`/api/contratos/${id}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ acao: nome }),
    })
    const j = await r.json()
    setOcupado(false)
    if (!r.ok) return setMsg(j.error || 'Não deu certo.')
    if (nome === 'enviar') setMsg(j.email_enviado ? 'Enviado! O link também foi por e-mail.' : 'Enviado! Mande o link pelo WhatsApp (o e-mail não saiu).')
    carregar()
  }

  const zap = link && ct.whatsapp
    ? `https://wa.me/55${ct.whatsapp.replace(/\D/g, '').replace(/^55/, '')}?text=${encodeURIComponent(
        `Oi, ${ct.representante.split(' ')[0]}! Segue o contrato da MarmorarIA para você ler e assinar online: ${link}\nNa página você confirma seus dados e recebe um código no e-mail para assinar.`
      )}`
    : null

  const set = (k: keyof Contratante) => (e: React.ChangeEvent<HTMLInputElement>) => setCt({ ...ct, [k]: e.target.value })

  return (
    <div className="grid gap-6 xl:grid-cols-[440px_1fr]">
      <div className="space-y-5">
        {numero && (
          <p className="text-sm text-gray-600">
            Contrato <b className="text-gray-900">{numero}</b> · status <b className="text-gray-900">{status}</b>
          </p>
        )}

        <fieldset disabled={!editavel} className="space-y-3 rounded-xl border border-gray-200 p-4">
          <legend className="px-1 text-xs font-bold uppercase text-gold-dk">Marmoraria (contratante)</legend>
          <label className="block"><span className={rotulo}>Razão social</span><input className={campo} value={ct.razao_social} onChange={set('razao_social')} /></label>
          <div className="grid grid-cols-2 gap-3">
            <label className="block"><span className={rotulo}>CNPJ ou CPF</span><input className={campo} value={ct.documento} onChange={set('documento')} /></label>
            <label className="block"><span className={rotulo}>Cidade</span><input className={campo} value={ct.cidade} onChange={set('cidade')} /></label>
          </div>
          <label className="block"><span className={rotulo}>Endereço completo</span><input className={campo} value={ct.endereco} onChange={set('endereco')} /></label>
          <div className="grid grid-cols-2 gap-3">
            <label className="block"><span className={rotulo}>Quem assina</span><input className={campo} value={ct.representante} onChange={set('representante')} /></label>
            <label className="block"><span className={rotulo}>CPF de quem assina</span><input className={campo} value={ct.cpf_representante} onChange={set('cpf_representante')} /></label>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <label className="block"><span className={rotulo}>E-mail (recebe o código)</span><input className={campo} type="email" value={ct.email} onChange={set('email')} /></label>
            <label className="block"><span className={rotulo}>WhatsApp</span><input className={campo} value={ct.whatsapp} onChange={set('whatsapp')} /></label>
          </div>
        </fieldset>

        <fieldset disabled={!editavel} className="space-y-3 rounded-xl border border-gray-200 p-4">
          <legend className="px-1 text-xs font-bold uppercase text-gold-dk">Plano</legend>
          <div className="grid grid-cols-2 gap-3">
            <label className="block">
              <span className={rotulo}>Plano</span>
              <select className={campo} value={plano} onChange={(e) => setPlano(e.target.value as PlanoKey)}>
                {(Object.keys(PLANOS) as PlanoKey[]).map((k) => (
                  <option key={k} value={k}>{PLANOS[k].nome}</option>
                ))}
              </select>
            </label>
            <label className="block">
              <span className={rotulo}>Condição</span>
              <select className={campo} value={condicao} onChange={(e) => setCondicao(e.target.value as Condicao)}>
                <option value="fundador">Fundador (até 30/11)</option>
                <option value="tabela">Tabela</option>
              </select>
            </label>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <label className="block"><span className={rotulo}>Dia de vencimento (1 a 28)</span><input className={campo} type="number" min={1} max={28} value={dia} onChange={(e) => setDia(parseInt(e.target.value || '1', 10))} /></label>
            {P.temAntonioWhatsapp && !antonioAtivo && (
              <label className="block"><span className={rotulo}>Ativação do Antônio até</span><input className={campo} type="date" value={dataAtivacao} onChange={(e) => setDataAtivacao(e.target.value)} /></label>
            )}
          </div>
          {P.temAntonioWhatsapp && (
            <label className="flex items-center gap-2 text-sm text-gray-700">
              <input type="checkbox" checked={antonioAtivo} onChange={(e) => setAntonioAtivo(e.target.checked)} />
              O Antônio no WhatsApp já está funcionando para este cliente
            </label>
          )}
          <div className="rounded-lg bg-white p-3 text-sm leading-6 text-gray-700">
            Mensalidade <b className="text-gray-900">{brl(v.mensalidade)}</b>
            {v.mensalidade_ate_ativacao != null && <> ({brl(v.mensalidade_ate_ativacao)} até ativar o Antônio)</>}
            {v.valor_por_medicao ? <> + {brl(v.valor_por_medicao)} por medição</> : null}
            <br />
            Implantação <b className="text-gray-900">{brl(v.implantacao)}</b>
            {v.implantacao === 0 && <> (tabela {brl(v.implantacao_tabela)})</>} · Fidelidade {v.fidelidade_meses ? `${v.fidelidade_meses} meses` : 'nenhuma'}
            <br />
            1ª cobrança no Asaas: <b className="text-amber-700">{brl(v.primeira_cobranca)}</b>
          </div>
        </fieldset>

        {editavel && (
          <div className="flex flex-wrap gap-2">
            <button onClick={salvar} disabled={ocupado} className="rounded-lg bg-gray-100 px-4 py-2 text-sm font-medium hover:bg-gray-200 disabled:opacity-50">
              {id ? 'Salvar e atualizar a prévia' : 'Criar rascunho'}
            </button>
            {id && (
              <button
                onClick={() => acao('enviar')}
                disabled={ocupado || pendencias.length > 0 || !!contratadaPendente}
                className="rounded-lg bg-gold px-4 py-2 text-sm font-medium hover:bg-gold2 disabled:opacity-40"
              >
                Enviar para assinatura
              </button>
            )}
          </div>
        )}
        {editavel && id && (pendencias.length > 0 || contratadaPendente) && (
          <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-700">
            Para enviar, falta:
            <ul className="ml-5 list-disc">
              {contratadaPendente && <li>{contratadaPendente}</li>}
              {pendencias.map((p) => <li key={p}>{p}</li>)}
            </ul>
            <span className="text-xs text-amber-700/80">Salve depois de preencher para atualizar esta lista.</span>
          </div>
        )}

        {link && status !== 'cancelado' && (
          <div className="space-y-2 rounded-xl border border-gray-200 p-4 text-sm">
            <p className="text-xs font-bold uppercase text-gold-dk">Link de assinatura</p>
            <p className="break-all text-gray-700">{link}</p>
            <div className="flex flex-wrap gap-2">
              <button onClick={() => navigator.clipboard?.writeText(link).then(() => setMsg('Link copiado.'))} className="rounded-lg bg-gray-100 px-3 py-1.5 hover:bg-gray-200">Copiar link</button>
              {zap && <a href={zap} target="_blank" rel="noopener noreferrer" className="rounded-lg bg-emerald-700 px-3 py-1.5 hover:bg-emerald-600">Mandar no WhatsApp</a>}
              <a href={`${link}/documento`} target="_blank" rel="noopener noreferrer" className="rounded-lg bg-gray-100 px-3 py-1.5 hover:bg-gray-200">Ver documento</a>
            </div>
          </div>
        )}

        {registro && (
          <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-100">
            <p className="text-xs font-bold uppercase text-emerald-700">Assinado</p>
            <p>{registro.nome} · CPF {registro.cpf} · {registro.email}</p>
            <p>{new Date(registro.assinado_em).toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' })} · IP {registro.ip}</p>
            {linkPagamento ? (
              <a href={linkPagamento} target="_blank" rel="noopener noreferrer" className="mt-2 inline-block underline">Cobrança no Asaas</a>
            ) : (
              <p className="mt-2 text-amber-700">Cobrança não criada no Asaas (confira ASAAS_API_KEY no painel e gere a cobrança manualmente).</p>
            )}
          </div>
        )}

        {(status === 'rascunho' || status === 'enviado') && id && (
          <button onClick={() => acao('cancelar')} disabled={ocupado} className="text-sm text-red-700 underline">
            Cancelar contrato
          </button>
        )}
        {msg && <p className="text-sm text-amber-700">{msg}</p>}
      </div>

      <div className="rounded-xl bg-[#FBF9F4] p-6">
        {previa ? (
          <TextoContrato texto={previa} />
        ) : (
          <p className="text-[#6F6355]">A prévia do contrato aparece aqui depois de criar o rascunho.</p>
        )}
      </div>
    </div>
  )
}
