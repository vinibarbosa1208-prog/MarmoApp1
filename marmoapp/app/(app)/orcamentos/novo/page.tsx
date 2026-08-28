'use client'

import { useState, useMemo, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useApp } from '@/contexts/AppContext'
import { fmt, formatPhone, sbSave } from '@/lib/utils'
import { supabase } from '@/lib/supabase'
import SeletorPeca, { getLateraisDaPeca, PECA_LABELS, type SeletorPecaState } from '@/components/orcamento/SeletorPeca'
import AcabamentosLaterais from '@/components/orcamento/AcabamentosLaterais'

interface ItemForm {
  tipo: 'material' | 'servico' | 'frete' | 'outro'
  ambiente: string
  descricao: string
  largura: number
  altura: number
  area: number
  quantidade: number
  preco_unitario: number
  custo_m2: number
  markup: number
  tipo_peca: string
  acabamento_esquerda: string
  acabamento_direita: string
  acabamento_frente: string
  acabamento_fundo: string
  tem_saia: boolean
  altura_saia: number
  tem_frontao: boolean
  altura_frontao: number
  dados_extras: Record<string, unknown>
  // Material comparison (Option A vs B)
  variante: '' | 'A' | 'B'
  mostrarAlternativa: boolean
  mat_alternativo: string
  preco_alternativo: number
}

const ITEM_DEFAULTS: ItemForm = {
  tipo: 'material', ambiente: '', descricao: '', largura: 0, altura: 0, area: 0,
  quantidade: 1, preco_unitario: 0, custo_m2: 0, markup: 3,
  tipo_peca: '', acabamento_esquerda: '', acabamento_direita: '',
  acabamento_frente: '', acabamento_fundo: '',
  tem_saia: false, altura_saia: 0, tem_frontao: false, altura_frontao: 0,
  dados_extras: {},
  variante: '', mostrarAlternativa: false, mat_alternativo: '', preco_alternativo: 0,
}

const AMBIENTE_SUGESTOES = ['Cozinha', 'Banheiro', 'Lavabo', 'Área Gourmet', 'Escada']

const ETAPAS = ['Cliente', 'Ambientes', 'Itens', 'Revisão']

function calcArea(item: ItemForm): number {
  const ex = item.dados_extras

  if (item.tipo_peca === 'lavatorio_simples') {
    const comprimento = (ex.comprimento as number) || 0
    const profundidade = (ex.profundidade as number) || 0
    if (!comprimento || !profundidade) return 0
    const base = comprimento * profundidade
    const dimMap: Record<string, number> = { frente: comprimento, fundo: comprimento, esquerda: profundidade, direita: profundidade }
    const acabs: Record<string, string> = { frente: item.acabamento_frente, fundo: item.acabamento_fundo, esquerda: item.acabamento_esquerda, direita: item.acabamento_direita }
    let lateralExtras = 0
    for (const [lat, len] of Object.entries(dimMap)) {
      const altSaia = (ex[`altura_saia_${lat}`] as number) || 0
      const altFrontao = (ex[`altura_frontao_${lat}`] as number) || 0
      if ((ex[`saia_${lat}`] as boolean) && altSaia > 0 && len > 0) lateralExtras += len * altSaia
      if (acabs[lat] === 'frontao' && altFrontao > 0 && len > 0) lateralExtras += len * altFrontao
    }
    return base + lateralExtras
  }

  if (item.tipo_peca === 'pia_retangular') {
    const largura = (ex.largura as number) || 0
    const profundidade = (ex.profundidade as number) || 0
    if (!largura || !profundidade) return 0
    const base = largura * profundidade
    const dimMap: Record<string, number> = { frente: largura, fundo: largura, esquerda: profundidade, direita: profundidade }
    const acabs: Record<string, string> = { frente: item.acabamento_frente, fundo: item.acabamento_fundo, esquerda: item.acabamento_esquerda, direita: item.acabamento_direita }
    let lateralExtras = 0
    for (const [lat, len] of Object.entries(dimMap)) {
      const altSaia = (ex[`altura_saia_${lat}`] as number) || 0
      const altFrontao = (ex[`altura_frontao_${lat}`] as number) || 0
      if ((ex[`saia_${lat}`] as boolean) && altSaia > 0 && len > 0) lateralExtras += len * altSaia
      if (acabs[lat] === 'frontao' && altFrontao > 0 && len > 0) lateralExtras += len * altFrontao
    }
    return base + lateralExtras
  }

  if (item.tipo_peca === 'lavatorio_extensao') {
    const compTampo = (ex.comp_tampo as number) || 0
    const compExtensao = (ex.comp_extensao as number) || 0
    const prof = (ex.profundidade as number) || 0
    if (!compTampo || !prof) return 0
    const totalWidth = compTampo + compExtensao
    const base = totalWidth * prof
    const dimMap: Record<string, number> = { frente: totalWidth, fundo: totalWidth, esquerda: prof, direita: prof }
    const acabs: Record<string, string> = { frente: item.acabamento_frente, fundo: item.acabamento_fundo, esquerda: item.acabamento_esquerda, direita: item.acabamento_direita }
    let lateralExtras = 0
    for (const [lat, len] of Object.entries(dimMap)) {
      const altSaia = (ex[`altura_saia_${lat}`] as number) || 0
      const altFrontao = (ex[`altura_frontao_${lat}`] as number) || 0
      if ((ex[`saia_${lat}`] as boolean) && altSaia > 0 && len > 0) lateralExtras += len * altSaia
      if (acabs[lat] === 'frontao' && altFrontao > 0 && len > 0) lateralExtras += len * altFrontao
    }
    return base + lateralExtras
  }

  if (item.tipo_peca === 'soleira') {
    const comp = (ex.comprimento as number) || 0
    const larg = (ex.largura as number) || 0
    return comp * larg
  }

  if (item.tipo_peca === 'nicho') {
    const l = (ex.largura as number) || 0
    const a = (ex.altura as number) || 0
    const p = (ex.profundidade as number) || 0
    if (!l || !a || !p) return 0
    const aLat = 2 * p * a
    const aTB = 2 * l * p
    const aFundo = (ex.tem_fundo as boolean) ? l * a : 0
    const altSaia = ((ex.altura_saia_nicho as number) || 0) / 100
    const aSaia = (ex.tem_saia_nicho as boolean) && altSaia > 0 ? l * altSaia : 0
    return aLat + aTB + aFundo + aSaia
  }

  if (item.tipo_peca === 'pia_l') {
    const seg1c = (ex.seg1_comprimento as number) || 0
    const seg1p = (ex.seg1_profundidade as number) || 0
    const seg2c = (ex.seg2_comprimento as number) || 0
    const seg2p = (ex.seg2_profundidade as number) || 0
    if (!seg1c || !seg1p || !seg2c || !seg2p) return 0
    const tampos = seg1c * seg1p + seg2c * seg2p

    const dimMap: Record<string, number> = {
      esquerda: seg1p,
      direita: seg2p,
      frente_seg1: seg1c,
      frente_seg2: seg2c,
      fundo: seg1c,
    }
    const acabs: Record<string, string> = {
      esquerda: item.acabamento_esquerda,
      direita: item.acabamento_direita,
      fundo: item.acabamento_fundo,
      frente_seg1: (ex.acabamento_frente_seg1 as string) || '',
      frente_seg2: (ex.acabamento_frente_seg2 as string) || '',
    }
    let lateralExtras = 0
    for (const [lat, len] of Object.entries(dimMap)) {
      const altSaia = (ex[`altura_saia_${lat}`] as number) || 0
      const altFrontao = (ex[`altura_frontao_${lat}`] as number) || 0
      if ((ex[`saia_${lat}`] as boolean) && altSaia > 0 && len > 0) lateralExtras += len * altSaia
      if (acabs[lat] === 'frontao' && altFrontao > 0 && len > 0) lateralExtras += len * altFrontao
    }
    return tampos + lateralExtras
  }

  if (item.tipo_peca === 'pia_u') {
    const seg1c = (ex.seg1_comprimento as number) || 0
    const seg1p = (ex.seg1_profundidade as number) || 0
    const seg2c = (ex.seg2_comprimento as number) || 0
    const seg2p = (ex.seg2_profundidade as number) || 0
    const seg3c = (ex.seg3_comprimento as number) || 0
    const seg3p = (ex.seg3_profundidade as number) || 0
    if (!seg1c || !seg1p || !seg2c || !seg2p || !seg3c || !seg3p) return 0
    const tampos = seg1c * seg1p + seg2c * seg2p + seg3c * seg3p

    const dimMap: Record<string, number> = {
      esquerda: seg1p,
      direita: seg3p,
      frente_seg1: seg1c,
      frente_seg2: seg2c,
      frente_seg3: seg3c,
      fundo: seg2c,
    }
    const acabs: Record<string, string> = {
      esquerda: item.acabamento_esquerda,
      direita: item.acabamento_direita,
      fundo: item.acabamento_fundo,
      frente_seg1: (ex.acabamento_frente_seg1 as string) || '',
      frente_seg2: (ex.acabamento_frente_seg2 as string) || '',
      frente_seg3: (ex.acabamento_frente_seg3 as string) || '',
    }
    let lateralExtras = 0
    for (const [lat, len] of Object.entries(dimMap)) {
      const altSaia = (ex[`altura_saia_${lat}`] as number) || 0
      const altFrontao = (ex[`altura_frontao_${lat}`] as number) || 0
      if ((ex[`saia_${lat}`] as boolean) && altSaia > 0 && len > 0) lateralExtras += len * altSaia
      if (acabs[lat] === 'frontao' && altFrontao > 0 && len > 0) lateralExtras += len * altFrontao
    }
    return tampos + lateralExtras
  }

  let base = 0
  let saia = 0
  let frontao = 0

  if (item.tipo_peca === 'escada') {
    const n = (ex.num_degraus as number) || 0
    const lp = (ex.largura_piso as number) || 0
    const ae = (ex.altura_espelho as number) || 0
    const w = item.largura || 0
    base = w * (lp / 100) * n + w * (ae / 100) * n
  } else {
    if (!item.largura || !item.altura) return 0
    base = item.largura * item.altura
    frontao = item.tem_frontao ? item.largura * item.altura_frontao : 0
    saia = item.tem_saia ? item.largura * item.altura_saia : 0
  }

  const dimMap: Record<string, number> = {
    frente: item.largura, fundo: item.largura,
    esquerda: item.altura, direita: item.altura,
    superior: item.largura, inferior: item.largura,
  }
  let lateralExtras = 0
  for (const [lat, len] of Object.entries(dimMap)) {
    const altSaia = (ex[`altura_saia_${lat}`] as number) || 0
    const altFrontao = (ex[`altura_frontao_${lat}`] as number) || 0
    if ((ex[`saia_${lat}`] as boolean) && altSaia > 0 && len > 0) lateralExtras += len * altSaia
    if ((ex[`frontao_${lat}`] as boolean) && altFrontao > 0 && len > 0) lateralExtras += len * altFrontao
  }

  return base + saia + frontao + lateralExtras
}

function calcTotal(item: ItemForm): number {
  const area = calcArea(item)
  const temCubaExtra = item.tipo_peca === 'lavatorio_extensao' || item.tipo_peca === 'lavatorio_simples' || item.tipo_peca === 'pia_retangular'
  const cubaExtra = temCubaExtra && (item.dados_extras.cuba_pedra as boolean)
    ? ((item.dados_extras.valor_cuba_pedra as number) || 350)
    : 0
  if (area > 0) return area * item.quantidade * item.preco_unitario + cubaExtra
  return item.quantidade * item.preco_unitario + cubaExtra
}

function calcCusto(item: ItemForm): number {
  const area = calcArea(item)
  return area > 0 ? area * item.quantidade * item.custo_m2 : 0
}

function calcAcabamentoLinear(item: ItemForm): number {
  if (item.tipo_peca !== 'bancada_simples') return 0
  const ex = item.dados_extras
  const dimMap: Record<string, number> = {
    frente: item.largura,
    fundo: item.largura,
    esquerda: item.altura,
    direita: item.altura,
  }
  let ml = 0
  for (const [lat, len] of Object.entries(dimMap)) {
    if (len <= 0) continue
    const ladoOpcao = (ex[`lado_${lat}`] as string) || 'nenhum'
    const temSaia = !!(ex[`saia_${lat}`] as boolean)
    const temFrontao = !!(ex[`frontao_${lat}`] as boolean)
    if (ladoOpcao === 'saia' || ladoOpcao === 'frontao' || temSaia || temFrontao) ml += len
  }
  return ml
}

function validarItem(item: ItemForm): boolean {
  if (!item.descricao) return false
  if (item.quantidade <= 0) return false
  if (!item.tipo_peca) return true

  const peca = item.tipo_peca
  const laterais = getLateraisDaPeca(peca, item.dados_extras)
  const PROP_LATERAIS = ['esquerda', 'direita', 'frente', 'fundo']
  for (const lat of laterais) {
    const acabamento = PROP_LATERAIS.includes(lat)
      ? item[`acabamento_${lat}` as keyof ItemForm]
      : item.dados_extras[`acabamento_${lat}`]
    if (!acabamento) return false
  }

  const ex = item.dados_extras
  if (peca === 'lavatorio_extensao') {
    if (!((ex.comp_tampo as number) > 0)) return false
    if (!((ex.profundidade as number) > 0)) return false
    if (!((ex.comp_extensao as number) > 0)) return false
  }
  if (peca === 'lavatorio_simples') {
    if (!((ex.comprimento as number) > 0)) return false
    if (!((ex.profundidade as number) > 0)) return false
  }
  if (peca === 'pia_retangular') {
    if (!((ex.largura as number) > 0)) return false
    if (!((ex.profundidade as number) > 0)) return false
  }
  if (peca === 'bancada_cuba' && !ex.tipo_cuba) return false
  if (peca === 'bancada_saia' && !((ex.altura_saia as number) > 0)) return false
  if (peca === 'bancada_frontao' && !((ex.altura_frontao as number) > 0)) return false
  if (peca === 'escada') {
    if (!((ex.num_degraus as number) > 0)) return false
    if (!((ex.largura_piso as number) > 0)) return false
    if (!((ex.altura_espelho as number) > 0)) return false
  }
  if (peca === 'soleira') {
    if (!((ex.comprimento as number) > 0)) return false
    if (!((ex.largura as number) > 0)) return false
  }
  if (peca === 'nicho') {
    if (!((ex.largura as number) > 0)) return false
    if (!((ex.altura as number) > 0)) return false
    if (!((ex.profundidade as number) > 0)) return false
    if ((ex.tem_saia_nicho as boolean) && !((ex.altura_saia_nicho as number) > 0)) return false
  }
  if (peca === 'pia_l') {
    if (!((ex.seg1_comprimento as number) > 0)) return false
    if (!((ex.seg1_profundidade as number) > 0)) return false
    if (!((ex.seg2_comprimento as number) > 0)) return false
    if (!((ex.seg2_profundidade as number) > 0)) return false
  }
  if (peca === 'pia_u') {
    if (!((ex.seg1_comprimento as number) > 0)) return false
    if (!((ex.seg1_profundidade as number) > 0)) return false
    if (!((ex.seg2_comprimento as number) > 0)) return false
    if (!((ex.seg2_profundidade as number) > 0)) return false
    if (!((ex.seg3_comprimento as number) > 0)) return false
    if (!((ex.seg3_profundidade as number) > 0)) return false
  }
  if (item.tem_saia && !(item.altura_saia > 0)) return false
  if (item.tem_frontao && !(item.altura_frontao > 0)) return false
  return true
}

function WizardProgress({ step, onJump }: { step: number; onJump: (s: number) => void }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 0, marginBottom: 24, flexWrap: 'wrap' }}>
      {ETAPAS.map((nome, i) => {
        const n = i + 1
        const ativo = step === n
        const concluido = step > n
        return (
          <div key={nome} style={{ display: 'flex', alignItems: 'center' }}>
            <button
              type="button"
              onClick={() => { if (n <= step) onJump(n) }}
              disabled={n > step}
              style={{
                display: 'flex', alignItems: 'center', gap: 8,
                background: 'none', border: 'none', cursor: n <= step ? 'pointer' : 'default', padding: '4px 8px',
              }}
            >
              <div style={{
                width: 28, height: 28, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 13, fontWeight: 700,
                background: ativo ? 'var(--gold)' : concluido ? 'rgba(201,168,76,0.2)' : 'var(--divider)',
                color: ativo ? '#fff' : concluido ? 'var(--dark)' : 'var(--text-muted)',
              }}>
                {concluido ? '✓' : n}
              </div>
              <span style={{ fontSize: 13, fontWeight: ativo ? 700 : 500, color: ativo ? 'var(--dark)' : 'var(--text-muted)' }}>
                {n}. {nome}
              </span>
            </button>
            {n < ETAPAS.length && (
              <span style={{ color: 'var(--text-faint)', margin: '0 6px' }}>→</span>
            )}
          </div>
        )
      })}
    </div>
  )
}

function NovoClienteModal({
  onClose, onCreated, marmorariaId,
}: {
  onClose: () => void
  onCreated: (clienteId: string) => void
  marmorariaId: string
}) {
  const [nome, setNome] = useState('')
  const [telefone, setTelefone] = useState('')
  const [email, setEmail] = useState('')
  const [tipo, setTipo] = useState<'pf' | 'pj'>('pf')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  async function salvar() {
    if (!nome.trim()) { setError('Nome é obrigatório'); return }
    try {
      setLoading(true)
      setError('')
      if (!marmorariaId) throw new Error('Sessão inválida — recarregue a página')
      const { data, error: err } = await sbSave(
        supabase
          .from('clientes')
          .insert({ marmoraria_id: marmorariaId, nome: nome.trim(), telefone, email, tipo })
          .select()
          .single()
      )
      if (err) throw err
      onCreated(data.id)
      onClose()
    } catch (err: any) {
      setError(err?.message || err?.details || 'Erro ao salvar cliente')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="modal-overlay open" style={{ zIndex: 9000 }}>
      <div className="modal">
        <div className="modal-header">
          <div className="modal-title">Novo Cliente</div>
          <button className="btn-close" onClick={onClose}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
          </button>
        </div>
        <div className="modal-body">
          <div className="form-row form-row-2">
            <div className="form-group">
              <label className="form-label">NOME / RAZÃO SOCIAL *</label>
              <input className="form-input" placeholder="Nome completo" value={nome} onChange={e => setNome(e.target.value)} autoFocus />
            </div>
            <div className="form-group">
              <label className="form-label">TIPO</label>
              <select className="form-select" value={tipo} onChange={e => setTipo(e.target.value as 'pf' | 'pj')}>
                <option value="pf">Pessoa Física</option>
                <option value="pj">Pessoa Jurídica</option>
              </select>
            </div>
          </div>
          <div className="form-row form-row-2">
            <div className="form-group">
              <label className="form-label">TELEFONE / WHATSAPP</label>
              <input className="form-input" placeholder="(11) 99999-0000" maxLength={15} value={telefone} onChange={e => setTelefone(formatPhone(e.target.value))} />
            </div>
            <div className="form-group">
              <label className="form-label">E-MAIL</label>
              <input className="form-input" type="email" placeholder="email@cliente.com" value={email} onChange={e => setEmail(e.target.value)} />
            </div>
          </div>
          {error && <div style={{ color: 'var(--red)', fontSize: 13 }}>{error}</div>}
        </div>
        <div className="modal-footer">
          <button className="btn btn-outline" onClick={onClose}>Cancelar</button>
          <button className="btn btn-gold" onClick={salvar} disabled={loading}>{loading ? 'Salvando...' : '💾 Salvar Cliente'}</button>
        </div>
      </div>
    </div>
  )
}

function ClienteCombobox({
  clientes, value, onChange, onNovoCliente,
}: {
  clientes: { id: string; nome: string }[]
  value: string
  onChange: (id: string) => void
  onNovoCliente: () => void
}) {
  const [query, setQuery] = useState('')
  const [open, setOpen] = useState(false)
  const selected = clientes.find(c => c.id === value)
  const filtered = query
    ? clientes.filter(c => c.nome.toLowerCase().includes(query.toLowerCase()))
    : clientes

  return (
    <div style={{ position: 'relative' }}>
      <input
        className="form-input"
        placeholder="Buscar cliente..."
        value={open ? query : (selected?.nome || '')}
        onFocus={() => { setOpen(true); setQuery('') }}
        onChange={e => setQuery(e.target.value)}
        onBlur={() => setTimeout(() => setOpen(false), 150)}
      />
      {open && (
        <div style={{
          position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 20, marginTop: 4,
          background: 'var(--card-bg)', border: '1px solid var(--card-border)', borderRadius: 8, maxHeight: 220, overflowY: 'auto',
          boxShadow: '0 4px 14px rgba(0,0,0,0.1)',
        }}>
          {filtered.length === 0 && (
            <div style={{ padding: 10, fontSize: 13, color: 'var(--text-muted)' }}>Nenhum cliente encontrado</div>
          )}
          {filtered.map(c => (
            <div
              key={c.id}
              onMouseDown={() => { onChange(c.id); setOpen(false) }}
              style={{ padding: '8px 12px', cursor: 'pointer', fontSize: 13, background: c.id === value ? 'rgba(201,168,76,0.08)' : 'transparent' }}
            >
              {c.nome}
            </div>
          ))}
          <div
            onMouseDown={() => { onNovoCliente(); setOpen(false) }}
            style={{ padding: '8px 12px', cursor: 'pointer', fontSize: 13, fontWeight: 700, color: 'var(--gold)', borderTop: '1px solid var(--divider)' }}
          >
            + Novo Cliente
          </div>
        </div>
      )}
    </div>
  )
}

export default function NovoOrcamentoPage() {
  const router = useRouter()
  const { clientes, materiais, servicos, marmoraria, loadOrcamentos, loadClientes, toast } = useApp()
  const [step, setStep] = useState(1)
  const [loading, setLoading] = useState(false)
  const [mostrarErros, setMostrarErros] = useState(false)
  const [erro, setErro] = useState('')
  const [showClienteModal, setShowClienteModal] = useState(false)

  const [form, setForm] = useState({
    cliente_id: '', descricao: '', condicao_pagamento: '',
    mao_obra: '', desconto_rs: '', observacoes: '', validade: '',
  })

  const [ambientes, setAmbientes] = useState<string[]>([])
  const [novoAmbiente, setNovoAmbiente] = useState('')
  const [openAmbiente, setOpenAmbiente] = useState<string | null>(null)

  const [itens, setItens] = useState<ItemForm[]>([])
  const [novoItem, setNovoItem] = useState<ItemForm>({ ...ITEM_DEFAULTS })
  const [servicoIdSel, setServicodeIdSel] = useState('')
  const [editandoIdx, setEditandoIdx] = useState<number | null>(null)

  // Rascunho automático local: salva o progresso do orçamento no navegador
  // pra não perder tudo se der erro ao salvar (timeout, sessão caiu, etc.)
  // ou se a aba for fechada sem querer no meio do preenchimento.
  const DRAFT_KEY = marmoraria?.id ? `marmoapp_orc_rascunho_${marmoraria.id}` : null

  const [draftDisponivel, setDraftDisponivel] = useState(() => {
    if (typeof window === 'undefined' || !DRAFT_KEY) return false
    try {
      const raw = localStorage.getItem(DRAFT_KEY)
      if (!raw) return false
      const draft = JSON.parse(raw)
      return !!(draft?.form?.cliente_id || draft?.ambientes?.length > 0 || draft?.itens?.length > 0)
    } catch {
      return false
    }
  })

  // Salva automaticamente (debounced) sempre que form/ambientes/itens/step mudam.
  // Só começa a salvar depois que o usuário decidiu sobre um rascunho anterior,
  // pra não sobrescrever esse rascunho com o estado vazio inicial da página.
  useEffect(() => {
    if (!DRAFT_KEY || draftDisponivel) return
    const temConteudo = form.cliente_id || ambientes.length > 0 || itens.length > 0
    if (!temConteudo) return
    const t = setTimeout(() => {
      try {
        localStorage.setItem(DRAFT_KEY, JSON.stringify({ form, ambientes, itens, step, savedAt: Date.now() }))
      } catch (err) {
        console.error('[Orçamento] Erro ao salvar rascunho local:', err)
      }
    }, 800)
    return () => clearTimeout(t)
  }, [DRAFT_KEY, form, ambientes, itens, step, draftDisponivel])

  function restaurarRascunho() {
    if (!DRAFT_KEY) return
    try {
      const raw = localStorage.getItem(DRAFT_KEY)
      if (raw) {
        const draft = JSON.parse(raw)
        if (draft.form) setForm(draft.form)
        if (draft.ambientes) setAmbientes(draft.ambientes)
        if (draft.itens) setItens(draft.itens)
        if (draft.step) setStep(draft.step)
      }
    } catch (err) {
      console.error('[Orçamento] Erro ao restaurar rascunho local:', err)
    }
    setDraftDisponivel(false)
  }

  function descartarRascunho() {
    if (DRAFT_KEY) localStorage.removeItem(DRAFT_KEY)
    setDraftDisponivel(false)
  }

  function limparRascunho() {
    if (DRAFT_KEY) localStorage.removeItem(DRAFT_KEY)
  }

  function up(k: string, v: string) { setForm(f => ({ ...f, [k]: v })) }

  function upItem(updates: Partial<ItemForm>) {
    setNovoItem(prev => ({ ...prev, ...updates }))
  }

  function upPeca(updates: Partial<SeletorPecaState>) {
    setNovoItem(prev => ({ ...prev, ...updates }))
  }

  function handleLateralChange(lateral: string, acabamento: string) {
    setNovoItem(prev => ({ ...prev, [`acabamento_${lateral}`]: acabamento }))
  }

  function handleRaioChange(lateral: string, raio: number) {
    setNovoItem(prev => ({ ...prev, dados_extras: { ...prev.dados_extras, [`raio_${lateral}`]: raio } }))
  }

  function handleLateralExtrasChange(lateral: string, key: string, value: unknown) {
    setNovoItem(prev => ({ ...prev, dados_extras: { ...prev.dados_extras, [`${key}_${lateral}`]: value } }))
  }

  const itemValido = useMemo(() => validarItem(novoItem), [novoItem])

  function addAmbiente(nome: string) {
    const trimmed = nome.trim()
    if (!trimmed) return
    if (ambientes.some(a => a.toLowerCase() === trimmed.toLowerCase())) {
      toast('Esse ambiente já foi adicionado', 'err')
      return
    }
    setAmbientes(prev => [...prev, trimmed])
    setNovoAmbiente('')
  }

  function removerAmbiente(nome: string) {
    if (itens.some(i => i.ambiente === nome)) {
      toast('Remova os itens deste ambiente antes de excluí-lo', 'err')
      return
    }
    setAmbientes(prev => prev.filter(a => a !== nome))
    if (openAmbiente === nome) setOpenAmbiente(null)
  }

  function abrirAddItem(ambiente: string) {
    if (openAmbiente === ambiente && editandoIdx === null) {
      setOpenAmbiente(null)
      return
    }
    setNovoItem({ ...ITEM_DEFAULTS, ambiente })
    setEditandoIdx(null)
    setServicodeIdSel('')
    setMostrarErros(false)
    setOpenAmbiente(ambiente)
  }

  function adicionarItem() {
    setMostrarErros(true)
    if (!novoItem.descricao) { toast('Descrição do item é obrigatória', 'err'); return }
    if (!itemValido) { toast('Preencha todos os campos obrigatórios do item', 'err'); return }
    if (editandoIdx !== null) {
      setItens(prev => prev.map((item, i) => i === editandoIdx ? { ...novoItem } : item))
    } else {
      const temAlt = novoItem.tipo === 'material' && novoItem.mostrarAlternativa && novoItem.mat_alternativo.trim() !== ''
      if (temAlt) {
        const itemA: ItemForm = { ...novoItem, variante: 'A', mostrarAlternativa: false, mat_alternativo: '', preco_alternativo: 0 }
        const itemB: ItemForm = {
          ...novoItem,
          variante: 'B',
          descricao: novoItem.mat_alternativo.trim(),
          preco_unitario: novoItem.preco_alternativo,
          custo_m2: 0,
          markup: 0,
          mostrarAlternativa: false,
          mat_alternativo: '',
          preco_alternativo: 0,
        }
        setItens(prev => [...prev, itemA, itemB])
      } else {
        setItens(prev => [...prev, { ...novoItem, variante: '', mostrarAlternativa: false }])
      }
    }
    const ambiente = novoItem.ambiente
    setNovoItem({ ...ITEM_DEFAULTS, ambiente })
    setEditandoIdx(null)
    setServicodeIdSel('')
    setMostrarErros(false)
  }

  function editarItem(idx: number) {
    setNovoItem({ ...itens[idx] })
    setEditandoIdx(idx)
    setServicodeIdSel('')
    setMostrarErros(false)
    setOpenAmbiente(itens[idx].ambiente || null)
  }

  function cancelarEdicao() {
    const ambiente = openAmbiente || ''
    setNovoItem({ ...ITEM_DEFAULTS, ambiente })
    setEditandoIdx(null)
    setServicodeIdSel('')
    setMostrarErros(false)
  }

  function removerItem(idx: number) {
    if (editandoIdx === idx) {
      const ambiente = openAmbiente || ''
      setNovoItem({ ...ITEM_DEFAULTS, ambiente })
      setEditandoIdx(null)
      setMostrarErros(false)
    } else if (editandoIdx !== null && idx < editandoIdx) {
      setEditandoIdx(editandoIdx - 1)
    }
    setItens(prev => prev.filter((_, i) => i !== idx))
  }

  function preencherMaterial(id: string) {
    const m = materiais.find(x => x.id === id)
    if (!m) return
    const mat = m as unknown as Record<string, number>
    const custo = mat.custo_unitario || 0
    const markupMat = mat.markup || 3
    const precVenda = mat.preco_venda || 0
    upItem({
      descricao: m.nome,
      custo_m2: custo,
      markup: markupMat,
      preco_unitario: precVenda > 0 ? precVenda : (custo > 0 ? custo * markupMat : 0),
    })
  }

  function preencherServico(id: string) {
    const s = servicos.find(x => x.id === id)
    if (s) { upItem({ descricao: s.nome, preco_unitario: s.preco_padrao || 0, tipo: 'servico' }); setServicodeIdSel(id) }
  }

  const servicoUnit = servicoIdSel ? (servicos.find(s => s.id === servicoIdSel)?.unidade || '') : ''

  const temVariantes = itens.some(i => i.variante === 'A' || i.variante === 'B')
  const subtotalA = itens.filter(i => i.variante !== 'B').reduce((s, i) => s + calcTotal(i), 0)
  const subtotalB = itens.filter(i => i.variante !== 'A').reduce((s, i) => s + calcTotal(i), 0)
  const subtotal = temVariantes ? subtotalA : itens.reduce((s, i) => s + calcTotal(i), 0)
  const maoObra = parseFloat(form.mao_obra) || 0
  const desconto = parseFloat(form.desconto_rs) || 0
  const totalFinal = subtotal + maoObra - desconto
  const totalFinalA = temVariantes ? subtotalA + maoObra - desconto : 0
  const totalFinalB = temVariantes ? subtotalB + maoObra - desconto : 0
  const descontoExcede = desconto > 0 && desconto > subtotal + maoObra

  const isMaterialComPeca = novoItem.tipo === 'material' && !!novoItem.tipo_peca

  const clienteSelecionado = clientes.find(c => c.id === form.cliente_id)

  function podeAvancar(s: number): boolean {
    if (s === 1) return !!form.cliente_id && !!form.descricao.trim()
    if (s === 2) return ambientes.length > 0
    return true
  }

  function nextStep() {
    if (!podeAvancar(step)) {
      if (step === 1) toast('Selecione o cliente e informe o título', 'err')
      if (step === 2) toast('Adicione ao menos um ambiente', 'err')
      return
    }
    setStep(s => Math.min(4, s + 1))
  }

  function prevStep() {
    setStep(s => Math.max(1, s - 1))
  }

  async function salvar() {
    try {
      setLoading(true)
      setErro('')

      if (!marmoraria?.id) throw new Error('Sessão inválida — recarregue a página')

      const observacoesFinal = [
        form.condicao_pagamento ? `Condição de pagamento: ${form.condicao_pagamento}` : '',
        form.observacoes,
      ].filter(Boolean).join('\n\n')

      const nomeVarianteA = itens.find(i => i.variante === 'A')?.descricao || 'Opção A'
      const nomeVarianteB = itens.find(i => i.variante === 'B')?.descricao || 'Opção B'

      const { data: orc, error: orcErr } = await sbSave(
        supabase
          .from('orcamentos')
          .insert({
            marmoraria_id: marmoraria!.id,
            cliente_id: form.cliente_id || null,
            titulo: form.descricao || 'Orçamento',
            status: 'rascunho',
            subtotal: subtotal,
            mao_obra: maoObra,
            desconto_rs: desconto,
            total: totalFinal,
            observacoes: observacoesFinal,
            data_validade: form.validade || null,
            crm_status: 'novo',
            producao_status: 'comercial',
            tem_variantes: temVariantes || null,
            total_variante_a: temVariantes ? totalFinalA : null,
            total_variante_b: temVariantes ? totalFinalB : null,
            nome_variante_a: temVariantes ? nomeVarianteA : null,
            nome_variante_b: temVariantes ? nomeVarianteB : null,
          })
          .select()
          .single()
      )

      if (orcErr) throw orcErr

      if (itens.length > 0) {
        const payload = itens.map(i => ({
          orcamento_id: orc.id,
          marmoraria_id: marmoraria!.id,
          tipo: i.tipo,
          ambiente: i.ambiente || null,
          descricao: i.descricao,
          largura: i.largura || null,
          altura: i.altura || null,
          area: calcArea(i) || null,
          quantidade: i.quantidade,
          preco_unitario: i.preco_unitario,
          custo_m2: i.custo_m2 || null,
          markup: i.markup || null,
          total_item: calcTotal(i),
          custo_item: calcCusto(i) || null,
          tipo_peca: i.tipo_peca || null,
          acabamento_esquerda: i.acabamento_esquerda || null,
          acabamento_direita: i.acabamento_direita || null,
          acabamento_frente: i.acabamento_frente || null,
          acabamento_fundo: i.acabamento_fundo || null,
          tem_saia: i.tem_saia,
          altura_saia: i.altura_saia || null,
          tem_frontao: i.tem_frontao,
          altura_frontao: i.altura_frontao || null,
          dados_extras: Object.keys(i.dados_extras).length > 0 ? i.dados_extras : null,
          variante: i.variante || null,
          // Snapshot pro desenho técnico (SVG gerado a partir dos dados) —
          // reaproveitável fora da tela de orçamento (ex: portal do instalador).
          desenho_tipo: i.tipo_peca || null,
          desenho_params: i.tipo_peca ? {
            largura: i.largura || null,
            altura: i.altura || null,
            dados_extras: i.dados_extras,
            acabamento_esquerda: i.acabamento_esquerda || null,
            acabamento_direita: i.acabamento_direita || null,
            acabamento_frente: i.acabamento_frente || null,
            acabamento_fundo: i.acabamento_fundo || null,
          } : null,
        }))
        const { error: itensErr } = await sbSave(supabase.from('orcamento_itens').insert(payload))
        if (itensErr) throw itensErr
      }

      await loadOrcamentos()
      limparRascunho()
      toast('Orçamento salvo!', 'ok2')
      router.push('/orcamentos/' + orc.id)
    } catch (err: any) {
      console.error('Erro ao salvar orçamento:', err)
      setErro(err?.message || err?.details || 'Erro ao salvar orçamento')
    } finally {
      setLoading(false)
    }
  }

  function renderFormItem() {
    return (
      <div style={{ background: 'var(--page-bg)', border: '1px solid var(--divider)', borderRadius: 10, padding: 16, marginTop: 12 }}>
        <div style={{ fontSize: 12, fontWeight: 700, color: editandoIdx !== null ? 'var(--gold)' : 'var(--text-muted)', marginBottom: 12, textTransform: 'uppercase', letterSpacing: '0.5px' }}>
          {editandoIdx !== null ? '✏️ Editando Item' : 'Adicionar Item'}
        </div>

        <div className="form-row form-row-2" style={{ marginBottom: 12 }}>
          <div className="form-group">
            <label className="form-label">TIPO</label>
            <select className="form-select" value={novoItem.tipo} onChange={e => {
              const tipo = e.target.value as ItemForm['tipo']
              const extras: Partial<ItemForm> = { tipo }
              if (tipo !== 'material') Object.assign(extras, { tipo_peca: '', largura: 0, altura: 0, area: 0, tem_saia: false, altura_saia: 0, tem_frontao: false, altura_frontao: 0, acabamento_esquerda: '', acabamento_direita: '', acabamento_frente: '', acabamento_fundo: '', dados_extras: {} })
              if (tipo !== 'servico') setServicodeIdSel('')
              upItem(extras)
            }}>
              <option value="material">Material</option>
              <option value="servico">Serviço</option>
              <option value="frete">Frete</option>
              <option value="outro">Outro</option>
            </select>
          </div>
          {novoItem.tipo === 'material' && materiais.length > 0 && (
            <div className="form-group">
              <label className="form-label">DO ESTOQUE</label>
              <select className="form-select" onChange={e => preencherMaterial(e.target.value)}>
                <option value="">Escolher material...</option>
                {materiais.map(m => <option key={m.id} value={m.id}>{m.nome}</option>)}
              </select>
            </div>
          )}
        </div>

        {novoItem.tipo === 'material' && (
          <>
            <div className="form-group" style={{ marginBottom: 12 }}>
              <label className="form-label">PEÇA DE MARMORARIA (opcional)</label>
              <SeletorPeca
                tipo_peca={novoItem.tipo_peca}
                tem_saia={novoItem.tem_saia}
                altura_saia={novoItem.altura_saia}
                tem_frontao={novoItem.tem_frontao}
                altura_frontao={novoItem.altura_frontao}
                dados_extras={novoItem.dados_extras}
                showErrors={mostrarErros}
                onChange={upPeca}
              />
            </div>
            {novoItem.tipo_peca && (
              <AcabamentosLaterais
                tipoPeca={novoItem.tipo_peca}
                esquerda={novoItem.acabamento_esquerda}
                direita={novoItem.acabamento_direita}
                frente={novoItem.acabamento_frente}
                fundo={novoItem.acabamento_fundo}
                dadosExtras={novoItem.dados_extras}
                showErrors={mostrarErros}
                onLateralChange={handleLateralChange}
                onRaioChange={handleRaioChange}
                onLateralExtrasChange={handleLateralExtrasChange}
              />
            )}
            {novoItem.tipo_peca && novoItem.tipo_peca !== 'lavatorio_extensao' && novoItem.tipo_peca !== 'lavatorio_simples' && novoItem.tipo_peca !== 'soleira' && novoItem.tipo_peca !== 'pia_l' && novoItem.tipo_peca !== 'pia_u' && (
              <div style={{ marginTop: 12, padding: 14, background: 'rgba(25,135,84,0.06)', border: '1px solid #b8ddd0', borderRadius: 10 }}>
                <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-secondary)', marginBottom: 10, textTransform: 'uppercase', letterSpacing: '0.5px' }}>Dimensões da peça</div>
                <div className="form-row form-row-2">
                  <div className="form-group">
                    <label className="form-label">LARGURA (m)</label>
                    <input className="form-input" type="number" min="0" step="0.01" placeholder="Ex: 2.00"
                      value={novoItem.largura || ''}
                      onChange={e => upItem({ largura: parseFloat(e.target.value) || 0 })} />
                  </div>
                  {novoItem.tipo_peca !== 'escada' && (
                    <div className="form-group">
                      <label className="form-label">PROFUNDIDADE (m)</label>
                      <input className="form-input" type="number" min="0" step="0.01" placeholder="Ex: 0.60"
                        value={novoItem.altura || ''}
                        onChange={e => upItem({ altura: parseFloat(e.target.value) || 0 })} />
                    </div>
                  )}
                </div>
                {novoItem.tipo_peca === 'escada' ? (() => {
                  const ex = novoItem.dados_extras
                  const n = (ex.num_degraus as number) || 0
                  const lp = (ex.largura_piso as number) || 0
                  const ae = (ex.altura_espelho as number) || 0
                  const w = novoItem.largura
                  if (!w || !n || !lp || !ae) return null
                  const d = (v: number) => v.toFixed(2).replace('.', ',')
                  const piso = w * (lp / 100) * n
                  const espelho = w * (ae / 100) * n
                  const total = piso + espelho
                  const totalVenda = total * novoItem.quantidade * novoItem.preco_unitario
                  const totalCusto = total * novoItem.quantidade * novoItem.custo_m2
                  return (
                    <div style={{ marginTop: 8, padding: '10px 12px', background: 'var(--card-bg)', borderRadius: 8, border: '1px solid rgba(25,135,84,0.2)', fontSize: 13 }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                        <span style={{ color: 'var(--text-secondary)' }}>Piso</span>
                        <span style={{ fontFamily: 'monospace' }}>{d(w)} × {d(lp / 100)} × {n} degraus = <strong>{d(piso)} m²</strong></span>
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4, color: 'var(--text-muted)' }}>
                        <span>Espelho</span>
                        <span style={{ fontFamily: 'monospace' }}>{d(w)} × {d(ae / 100)} × {n} degraus = <strong>{d(espelho)} m²</strong></span>
                      </div>
                      <div style={{ borderTop: '1px solid rgba(25,135,84,0.2)', paddingTop: 6, marginTop: 4, display: 'flex', justifyContent: 'space-between', fontWeight: 700 }}>
                        <span>Total</span>
                        <span style={{ color: 'var(--gold)', fontFamily: 'monospace' }}>{d(total)} m²</span>
                      </div>
                      {novoItem.custo_m2 > 0 && (
                        <div style={{ borderTop: '1px solid rgba(25,135,84,0.2)', paddingTop: 6, marginTop: 4 }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', color: 'var(--text-muted)', fontSize: 12, marginBottom: 3 }}>
                            <span>Custo</span>
                            <span style={{ fontFamily: 'monospace' }}>{d(total)} m² × R$ {novoItem.custo_m2.toFixed(2)} = <strong>{fmt(totalCusto)}</strong></span>
                          </div>
                          <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 700, color: 'var(--gold)' }}>
                            <span>Venda</span>
                            <span style={{ fontFamily: 'monospace' }}>{d(total)} m² × R$ {novoItem.preco_unitario.toFixed(2)} = <strong>{fmt(totalVenda)}</strong></span>
                          </div>
                        </div>
                      )}
                    </div>
                  )
                })() : novoItem.largura > 0 && novoItem.altura > 0 && (() => {
                  const d = (n: number) => n.toFixed(2).replace('.', ',')
                  const tampo = novoItem.largura * novoItem.altura
                  const frontao = novoItem.tem_frontao ? novoItem.largura * novoItem.altura_frontao : 0
                  const saia = novoItem.tem_saia ? novoItem.largura * novoItem.altura_saia : 0
                  const total = tampo + frontao + saia
                  const totalVenda = total * novoItem.quantidade * novoItem.preco_unitario
                  const totalCusto = total * novoItem.quantidade * novoItem.custo_m2
                  return (
                    <div style={{ marginTop: 8, padding: '10px 12px', background: 'var(--card-bg)', borderRadius: 8, border: '1px solid rgba(25,135,84,0.2)', fontSize: 13 }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                        <span style={{ color: 'var(--text-secondary)' }}>Tampo</span>
                        <span style={{ fontFamily: 'monospace' }}>{d(novoItem.largura)} × {d(novoItem.altura)} = <strong>{d(tampo)} m²</strong></span>
                      </div>
                      {novoItem.tem_frontao && novoItem.altura_frontao > 0 && (
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4, color: 'var(--text-muted)' }}>
                          <span>Frontão</span>
                          <span style={{ fontFamily: 'monospace' }}>{d(novoItem.largura)} × {d(novoItem.altura_frontao)} = <strong>{d(frontao)} m²</strong></span>
                        </div>
                      )}
                      {novoItem.tem_saia && novoItem.altura_saia > 0 && (
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4, color: 'var(--text-muted)' }}>
                          <span>Saia</span>
                          <span style={{ fontFamily: 'monospace' }}>{d(novoItem.largura)} × {d(novoItem.altura_saia)} = <strong>{d(saia)} m²</strong></span>
                        </div>
                      )}
                      <div style={{ borderTop: '1px solid rgba(25,135,84,0.2)', paddingTop: 6, marginTop: 4, display: 'flex', justifyContent: 'space-between', fontWeight: 700 }}>
                        <span>Total</span>
                        <span style={{ color: 'var(--gold)', fontFamily: 'monospace' }}>{d(total)} m²</span>
                      </div>
                      {(() => {
                        const ml = calcAcabamentoLinear(novoItem)
                        return ml > 0 ? (
                          <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 6, fontSize: 12, color: 'var(--gold)', background: 'rgba(201,168,76,0.06)', border: '1px solid #E8D9B0', borderRadius: 6, padding: '5px 10px' }}>
                            <span>Acabamento necessário</span>
                            <span style={{ fontFamily: 'monospace', fontWeight: 600 }}>{d(ml)} ml (meia esquadria)</span>
                          </div>
                        ) : null
                      })()}
                      {novoItem.custo_m2 > 0 && (
                        <div style={{ borderTop: '1px solid rgba(25,135,84,0.2)', paddingTop: 6, marginTop: 4 }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', color: 'var(--text-muted)', fontSize: 12, marginBottom: 3 }}>
                            <span>Custo</span>
                            <span style={{ fontFamily: 'monospace' }}>{d(total)} m² × R$ {novoItem.custo_m2.toFixed(2)} = <strong>{fmt(totalCusto)}</strong></span>
                          </div>
                          <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 700, color: 'var(--gold)' }}>
                            <span>Venda</span>
                            <span style={{ fontFamily: 'monospace' }}>{d(total)} m² × R$ {novoItem.preco_unitario.toFixed(2)} = <strong>{fmt(totalVenda)}</strong></span>
                          </div>
                        </div>
                      )}
                    </div>
                  )
                })()}
              </div>
            )}
            {(novoItem.tipo_peca === 'lavatorio_simples' || novoItem.tipo_peca === 'lavatorio_extensao') && (() => {
              const ex = novoItem.dados_extras
              const isSim = novoItem.tipo_peca === 'lavatorio_simples'
              const comp = isSim
                ? ((ex.comprimento as number) || 0)
                : ((ex.comp_tampo as number) || 0) + ((ex.comp_extensao as number) || 0)
              const prof = (ex.profundidade as number) || 0
              if (!comp || !prof) return null
              const tampo = comp * prof
              const d = (n: number) => n.toFixed(2).replace('.', ',')
              const dimMap: Record<string, number> = { frente: comp, fundo: comp, esquerda: prof, direita: prof }
              const acabs: Record<string, string> = { frente: novoItem.acabamento_frente, fundo: novoItem.acabamento_fundo, esquerda: novoItem.acabamento_esquerda, direita: novoItem.acabamento_direita }
              const latLabels: Record<string, string> = { frente: 'Frente', fundo: 'Fundo', esquerda: 'Esq.', direita: 'Dir.' }
              const extras: { label: string; area: number }[] = []
              let total = tampo
              for (const [lat, len] of Object.entries(dimMap)) {
                const altFrontao = (ex[`altura_frontao_${lat}`] as number) || 0
                const altSaia = (ex[`altura_saia_${lat}`] as number) || 0
                if (acabs[lat] === 'frontao' && altFrontao > 0) { const area = len * altFrontao; extras.push({ label: `Frontão ${latLabels[lat]}`, area }); total += area }
                if ((ex[`saia_${lat}`] as boolean) && altSaia > 0) { const area = len * altSaia; extras.push({ label: `Saia ${latLabels[lat]}`, area }); total += area }
              }
              return (
                <div style={{ margin: '8px 16px 0', padding: '10px 12px', background: 'var(--card-bg)', borderRadius: 8, border: '1px solid rgba(25,135,84,0.2)', fontSize: 13 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: extras.length ? 4 : 0 }}>
                    <span style={{ color: 'var(--text-secondary)' }}>Tampo</span>
                    <span style={{ fontFamily: 'monospace' }}>{d(comp)} × {d(prof)} = <strong>{d(tampo)} m²</strong></span>
                  </div>
                  {extras.map(({ label, area }, i) => (
                    <div key={i} style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4, color: 'var(--text-muted)' }}>
                      <span>{label}</span>
                      <span style={{ fontFamily: 'monospace' }}><strong>{d(area)} m²</strong></span>
                    </div>
                  ))}
                  <div style={{ borderTop: '1px solid rgba(25,135,84,0.2)', paddingTop: 6, marginTop: 4, display: 'flex', justifyContent: 'space-between', fontWeight: 700 }}>
                    <span>Total</span>
                    <span style={{ color: 'var(--gold)', fontFamily: 'monospace' }}>{d(total)} m²</span>
                  </div>
                  {novoItem.custo_m2 > 0 && (
                    <div style={{ borderTop: '1px solid rgba(25,135,84,0.2)', paddingTop: 6, marginTop: 4 }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', color: 'var(--text-muted)', fontSize: 12, marginBottom: 3 }}>
                        <span>Custo</span>
                        <span style={{ fontFamily: 'monospace' }}>{d(total)} m² × R$ {novoItem.custo_m2.toFixed(2)} = <strong>{fmt(total * novoItem.quantidade * novoItem.custo_m2)}</strong></span>
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 700, color: 'var(--gold)' }}>
                        <span>Venda</span>
                        <span style={{ fontFamily: 'monospace' }}>{d(total)} m² × R$ {novoItem.preco_unitario.toFixed(2)} = <strong>{fmt(total * novoItem.quantidade * novoItem.preco_unitario)}</strong></span>
                      </div>
                    </div>
                  )}
                </div>
              )
            })()}
            {(novoItem.tipo_peca === 'pia_l' || novoItem.tipo_peca === 'pia_u') && (() => {
              const ex = novoItem.dados_extras
              const isL = novoItem.tipo_peca === 'pia_l'
              const seg1c = (ex.seg1_comprimento as number) || 0
              const seg1p = (ex.seg1_profundidade as number) || 0
              const seg2c = (ex.seg2_comprimento as number) || 0
              const seg2p = (ex.seg2_profundidade as number) || 0
              const seg3c = (ex.seg3_comprimento as number) || 0
              const seg3p = (ex.seg3_profundidade as number) || 0
              if (!seg1c || !seg1p || !seg2c || !seg2p || (!isL && (!seg3c || !seg3p))) return null

              const d = (n: number) => n.toFixed(2).replace('.', ',')
              const segs = isL
                ? [{ label: 'Seg 1 tampo', c: seg1c, p: seg1p }, { label: 'Seg 2 tampo', c: seg2c, p: seg2p }]
                : [{ label: 'Seg 1 tampo', c: seg1c, p: seg1p }, { label: 'Seg 2 tampo', c: seg2c, p: seg2p }, { label: 'Seg 3 tampo', c: seg3c, p: seg3p }]

              const dimMap: Record<string, number> = isL
                ? { esquerda: seg1p, direita: seg2p, frente_seg1: seg1c, frente_seg2: seg2c, fundo: seg1c }
                : { esquerda: seg1p, direita: seg3p, frente_seg1: seg1c, frente_seg2: seg2c, frente_seg3: seg3c, fundo: seg2c }

              const acabs: Record<string, string> = {
                esquerda: novoItem.acabamento_esquerda,
                direita: novoItem.acabamento_direita,
                fundo: novoItem.acabamento_fundo,
                frente_seg1: (ex.acabamento_frente_seg1 as string) || '',
                frente_seg2: (ex.acabamento_frente_seg2 as string) || '',
                frente_seg3: (ex.acabamento_frente_seg3 as string) || '',
              }
              const latLabels: Record<string, string> = {
                esquerda: 'esq.', direita: 'dir.', fundo: 'fundo',
                frente_seg1: 'frente seg1', frente_seg2: 'frente seg2', frente_seg3: 'frente seg3',
              }

              const tampoTotal = segs.reduce((s, seg) => s + seg.c * seg.p, 0)
              const extras: { label: string; area: number }[] = []
              let mlEsquadria = 0
              let total = tampoTotal
              for (const [lat, len] of Object.entries(dimMap)) {
                const altSaia = (ex[`altura_saia_${lat}`] as number) || 0
                const altFrontao = (ex[`altura_frontao_${lat}`] as number) || 0
                if ((ex[`saia_${lat}`] as boolean) && altSaia > 0 && len > 0) {
                  const area = len * altSaia
                  extras.push({ label: `Saia ${latLabels[lat]}`, area })
                  total += area
                }
                if (acabs[lat] === 'frontao' && altFrontao > 0 && len > 0) {
                  const area = len * altFrontao
                  extras.push({ label: `Frontão ${latLabels[lat]}`, area })
                  total += area
                }
                if (acabs[lat] === 'meia_esquadria' && len > 0) mlEsquadria += len
              }

              return (
                <div style={{ margin: '8px 16px 0', padding: '10px 12px', background: 'var(--card-bg)', borderRadius: 8, border: '1px solid rgba(25,135,84,0.2)', fontSize: 13 }}>
                  {segs.map((seg, i) => (
                    <div key={i} style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                      <span style={{ color: 'var(--text-secondary)' }}>{seg.label}</span>
                      <span style={{ fontFamily: 'monospace' }}>{d(seg.c)} × {d(seg.p)} = <strong>{d(seg.c * seg.p)} m²</strong></span>
                    </div>
                  ))}
                  {extras.map(({ label, area }, i) => (
                    <div key={i} style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4, color: 'var(--text-muted)' }}>
                      <span>{label}</span>
                      <span style={{ fontFamily: 'monospace' }}><strong>{d(area)} m²</strong></span>
                    </div>
                  ))}
                  <div style={{ borderTop: '1px solid rgba(25,135,84,0.2)', paddingTop: 6, marginTop: 4, display: 'flex', justifyContent: 'space-between', fontWeight: 700 }}>
                    <span>Total</span>
                    <span style={{ color: 'var(--gold)', fontFamily: 'monospace' }}>{d(total)} m²</span>
                  </div>
                  {mlEsquadria > 0 && (
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 6, fontSize: 12, color: 'var(--gold)', background: 'rgba(201,168,76,0.06)', border: '1px solid #E8D9B0', borderRadius: 6, padding: '5px 10px' }}>
                      <span>Acabamento meia esquadria</span>
                      <span style={{ fontFamily: 'monospace', fontWeight: 600 }}>{d(mlEsquadria)} ml</span>
                    </div>
                  )}
                  {novoItem.custo_m2 > 0 && (
                    <div style={{ borderTop: '1px solid rgba(25,135,84,0.2)', paddingTop: 6, marginTop: 4 }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', color: 'var(--text-muted)', fontSize: 12, marginBottom: 3 }}>
                        <span>Custo</span>
                        <span style={{ fontFamily: 'monospace' }}>{d(total)} m² × R$ {novoItem.custo_m2.toFixed(2)} = <strong>{fmt(total * novoItem.quantidade * novoItem.custo_m2)}</strong></span>
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 700, color: 'var(--gold)' }}>
                        <span>Venda</span>
                        <span style={{ fontFamily: 'monospace' }}>{d(total)} m² × R$ {novoItem.preco_unitario.toFixed(2)} = <strong>{fmt(total * novoItem.quantidade * novoItem.preco_unitario)}</strong></span>
                      </div>
                    </div>
                  )}
                </div>
              )
            })()}
          </>
        )}

        {novoItem.tipo === 'servico' && (
          <div className="form-group" style={{ marginBottom: 12 }}>
            <label className="form-label">SERVIÇO</label>
            <select className="form-select" value={servicoIdSel} onChange={e => preencherServico(e.target.value)}>
              <option value="">Selecionar serviço...</option>
              {servicos.map(s => <option key={s.id} value={s.id}>{s.nome}</option>)}
            </select>
          </div>
        )}

        <div className="form-group" style={{ marginTop: 12 }}>
          <label className="form-label">DESCRIÇÃO</label>
          <input className="form-input" placeholder="Descreva o item" value={novoItem.descricao}
            onChange={e => upItem({ descricao: e.target.value })} />
          {mostrarErros && !novoItem.descricao && (
            <p style={{ color: '#c0392b', fontSize: 11, marginTop: 3 }}>Descrição obrigatória.</p>
          )}
        </div>

        {isMaterialComPeca ? (
          <>
            <div className="form-group" style={{ marginTop: 10 }}>
              <label className="form-label">{novoItem.tipo === 'servico' && servicoUnit ? `QUANTIDADE (${servicoUnit})` : 'QUANTIDADE'}</label>
              <input className="form-input" type="number" min="0" step="0.01" value={novoItem.quantidade}
                onChange={e => upItem({ quantidade: parseFloat(e.target.value) || 0 })} />
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10, marginTop: 10 }}>
              <div className="form-group">
                <label className="form-label">CUSTO DE COMPRA (R$/m²)</label>
                <input className="form-input" type="number" min="0" step="0.01" placeholder="0,00"
                  value={novoItem.custo_m2 || ''}
                  onChange={e => {
                    const custo = parseFloat(e.target.value) || 0
                    upItem({ custo_m2: custo, preco_unitario: custo * (novoItem.markup || 3) })
                  }} />
              </div>
              <div className="form-group">
                <label className="form-label">FATOR (×)</label>
                <input className="form-input" type="number" min="0.1" step="0.5" placeholder="3"
                  value={novoItem.markup || ''}
                  onChange={e => {
                    const markup = parseFloat(e.target.value) || 1
                    upItem({ markup, preco_unitario: (novoItem.custo_m2 || 0) * markup })
                  }} />
              </div>
              <div className="form-group">
                <label className="form-label">PREÇO DE VENDA (R$/m²)</label>
                <input className="form-input" type="number" min="0" step="0.01" placeholder="0,00"
                  value={novoItem.preco_unitario || ''}
                  style={{ color: 'var(--gold)', fontWeight: 700 }}
                  onChange={e => {
                    const venda = parseFloat(e.target.value) || 0
                    const markup = novoItem.custo_m2 > 0
                      ? Math.round((venda / novoItem.custo_m2) * 100) / 100
                      : novoItem.markup
                    upItem({ preco_unitario: venda, markup })
                  }} />
              </div>
            </div>
          </>
        ) : (
          <div className="form-row form-row-2" style={{ marginTop: 10 }}>
            <div className="form-group">
              <label className="form-label">{novoItem.tipo === 'servico' && servicoUnit ? `QUANTIDADE (${servicoUnit})` : 'QUANTIDADE'}</label>
              <input className="form-input" type="number" min="0" step="0.01" value={novoItem.quantidade}
                onChange={e => upItem({ quantidade: parseFloat(e.target.value) || 0 })} />
            </div>
            <div className="form-group">
              <label className="form-label">{calcArea(novoItem) > 0 ? 'PREÇO POR M² (R$)' : 'PREÇO UNITÁRIO (R$)'}</label>
              <input className="form-input" type="number" min="0" step="0.01" value={novoItem.preco_unitario}
                onChange={e => upItem({ preco_unitario: parseFloat(e.target.value) || 0 })} />
            </div>
          </div>
        )}

        {/* Alternativa de material (Opção B) */}
        {novoItem.tipo === 'material' && editandoIdx === null && (
          <div style={{ marginTop: 14, borderTop: '1px dashed var(--divider)', paddingTop: 12 }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', userSelect: 'none' }}>
              <input
                type="checkbox"
                checked={novoItem.mostrarAlternativa}
                onChange={e => upItem({ mostrarAlternativa: e.target.checked, mat_alternativo: '', preco_alternativo: 0 })}
                style={{ width: 'auto', accentColor: 'var(--gold)' }}
              />
              <span style={{ fontSize: 13, color: 'var(--text-secondary)', fontWeight: 500 }}>
                Incluir 2ª opção de material para comparação
              </span>
            </label>
            {novoItem.mostrarAlternativa && (
              <div style={{ marginTop: 10, background: 'rgba(201,168,76,0.06)', border: '1px solid rgba(201,168,76,0.2)', borderRadius: 8, padding: 12 }}>
                <div style={{ fontSize: 11, color: '#8B6914', fontWeight: 700, marginBottom: 8, textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                  Opção B — Material Alternativo
                </div>
                <div className="form-row form-row-2">
                  <div className="form-group">
                    <label className="form-label">NOME DO MATERIAL (Opção B)</label>
                    <input
                      className="form-input"
                      placeholder="Ex: Granito Preto Absoluto"
                      value={novoItem.mat_alternativo}
                      onChange={e => upItem({ mat_alternativo: e.target.value })}
                    />
                  </div>
                  <div className="form-group">
                    <label className="form-label">PREÇO DE VENDA (R$/m²)</label>
                    <input
                      className="form-input"
                      type="number"
                      min="0"
                      step="0.01"
                      placeholder="0,00"
                      value={novoItem.preco_alternativo || ''}
                      style={{ color: 'var(--gold)', fontWeight: 700 }}
                      onChange={e => upItem({ preco_alternativo: parseFloat(e.target.value) || 0 })}
                    />
                  </div>
                </div>
                <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 4 }}>
                  Mesmas dimensões, peça e acabamentos do item principal. Serão adicionados como Opção A e Opção B.
                </div>
              </div>
            )}
          </div>
        )}

        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 12 }}>
          <span style={{ fontWeight: 700, color: 'var(--dark)' }}>Total: {fmt(calcTotal(novoItem))}</span>
          <div style={{ display: 'flex', gap: 8 }}>
            {editandoIdx !== null && (
              <button type="button" className="btn btn-outline" onClick={cancelarEdicao}>Cancelar</button>
            )}
            <button
              className="btn btn-gold"
              onClick={adicionarItem}
              disabled={mostrarErros && !itemValido}
              title={mostrarErros && !itemValido ? 'Preencha todos os campos obrigatórios' : ''}
            >
              {editandoIdx !== null ? '💾 Salvar Alterações' : '+ Adicionar Item'}
            </button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="page-inner">
      <div className="page-header">
        <h1 className="page-title">Novo Orçamento</h1>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 6 }}>
          <button className="btn btn-outline" onClick={() => { limparRascunho(); router.push('/orcamentos') }}>Cancelar</button>
          {erro && <div style={{ color: 'var(--red)', fontSize: 13 }}>{erro}</div>}
        </div>
      </div>

      <WizardProgress step={step} onJump={setStep} />

      {draftDisponivel && (
        <div className="card" style={{ borderColor: 'var(--gold)', marginBottom: 16 }}>
          <div className="card-body" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
            <div>
              <strong>Encontramos um rascunho não finalizado</strong>
              <div style={{ fontSize: 13, color: 'var(--text-muted)' }}>Deseja continuar de onde parou ou começar um orçamento novo?</div>
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              <button className="btn btn-outline" onClick={descartarRascunho}>Descartar</button>
              <button className="btn btn-gold" onClick={restaurarRascunho}>Continuar rascunho</button>
            </div>
          </div>
        </div>
      )}

      {/* ETAPA 1 — Cliente e Dados Gerais */}
      {step === 1 && (
        <div className="card">
          <div className="card-header"><span className="card-title">Cliente e Dados Gerais</span></div>
          <div className="card-body">
            <div className="form-row form-row-2">
              <div className="form-group">
                <label className="form-label">CLIENTE *</label>
                <ClienteCombobox
                  clientes={clientes}
                  value={form.cliente_id}
                  onChange={id => up('cliente_id', id)}
                  onNovoCliente={() => setShowClienteModal(true)}
                />
              </div>
              <div className="form-group">
                <label className="form-label">&nbsp;</label>
                <button type="button" className="btn btn-outline" onClick={() => setShowClienteModal(true)}>+ Novo Cliente</button>
              </div>
            </div>
            <div className="form-group">
              <label className="form-label">TÍTULO / DESCRIÇÃO DO SERVIÇO *</label>
              <input className="form-input" placeholder="Ex: Bancada cozinha + banheiro" value={form.descricao} onChange={e => up('descricao', e.target.value)} />
            </div>
            <div className="form-row form-row-2">
              <div className="form-group">
                <label className="form-label">CONDIÇÃO DE PAGAMENTO</label>
                <input className="form-input" placeholder="Ex: 50% entrada + 50% na entrega" value={form.condicao_pagamento} onChange={e => up('condicao_pagamento', e.target.value)} />
              </div>
              <div className="form-group">
                <label className="form-label">VALIDADE DO ORÇAMENTO</label>
                <input className="form-input" type="date" value={form.validade} onChange={e => up('validade', e.target.value)} />
              </div>
            </div>
            <div className="form-group">
              <label className="form-label">OBSERVAÇÕES</label>
              <textarea className="form-textarea" placeholder="Condições, prazos, detalhes..." value={form.observacoes} onChange={e => up('observacoes', e.target.value)} style={{ minHeight: 80 }} />
            </div>
          </div>
        </div>
      )}

      {/* ETAPA 2 — Ambientes */}
      {step === 2 && (
        <div className="card">
          <div className="card-header"><span className="card-title">Ambientes do Projeto</span></div>
          <div className="card-body">
            {ambientes.length > 0 && (
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 16 }}>
                {ambientes.map(a => (
                  <span key={a} style={{
                    display: 'flex', alignItems: 'center', gap: 6, padding: '6px 12px', borderRadius: 20,
                    background: 'rgba(201,168,76,0.08)', border: '1.5px solid var(--gold)', fontSize: 13, fontWeight: 600, color: 'var(--dark)',
                  }}>
                    {a}
                    <button type="button" onClick={() => removerAmbiente(a)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#c0392b', fontWeight: 700, padding: 0, lineHeight: 1 }}>×</button>
                  </span>
                ))}
              </div>
            )}

            <div className="form-group">
              <label className="form-label">ADICIONAR AMBIENTE</label>
              <div style={{ display: 'flex', gap: 8 }}>
                <input
                  className="form-input"
                  placeholder="Ex: Cozinha, Banheiro Suíte..."
                  value={novoAmbiente}
                  onChange={e => setNovoAmbiente(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addAmbiente(novoAmbiente) } }}
                />
                <button type="button" className="btn btn-gold" onClick={() => addAmbiente(novoAmbiente)}>+ Adicionar</button>
              </div>
            </div>

            <div style={{ marginTop: 10 }}>
              <span style={{ fontSize: 12, color: 'var(--text-muted)', marginRight: 8 }}>Sugestões:</span>
              <div style={{ display: 'inline-flex', flexWrap: 'wrap', gap: 6, marginTop: 6 }}>
                {AMBIENTE_SUGESTOES.map(s => (
                  <button key={s} type="button" onClick={() => addAmbiente(s)} className="btn btn-outline btn-sm" disabled={ambientes.some(a => a.toLowerCase() === s.toLowerCase())}>
                    {s}
                  </button>
                ))}
              </div>
            </div>

            {ambientes.length === 0 && (
              <p style={{ color: '#c0392b', fontSize: 12, marginTop: 14 }}>Adicione pelo menos um ambiente para continuar.</p>
            )}
          </div>
        </div>
      )}

      {/* ETAPA 3 — Itens por Ambiente */}
      {step === 3 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {ambientes.map(amb => {
            const itensAmbiente = itens
              .map((item, idx) => ({ item, idx }))
              .filter(({ item }) => item.ambiente === amb)
            const subtotalAmbiente = itensAmbiente.reduce((s, { item }) => s + calcTotal(item), 0)
            return (
              <div key={amb} className="card">
                <div className="card-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span className="card-title">📍 {amb.toUpperCase()}</span>
                  <button type="button" className="btn btn-gold btn-sm" onClick={() => abrirAddItem(amb)}>
                    {openAmbiente === amb && editandoIdx === null ? '✕ Fechar' : '+ Adicionar Item'}
                  </button>
                </div>
                <div className="card-body">
                  {itensAmbiente.length === 0 ? (
                    <p style={{ color: 'var(--text-muted)', fontSize: 13, fontStyle: 'italic' }}>(vazio — clique em + Adicionar Item)</p>
                  ) : (
                    <table>
                      <thead>
                        <tr><th>Tipo</th><th>Descrição</th><th>Qtd</th><th>Preço/Un</th><th>Total</th><th></th></tr>
                      </thead>
                      <tbody>
                        {itensAmbiente.map(({ item, idx }) => (
                          <tr key={idx}>
                            <td><span className="badge badge-draft">{item.tipo}</span></td>
                            <td>
                              <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontWeight: 500 }}>
                                {item.descricao}
                                {item.variante && (
                                  <span style={{
                                    fontSize: 10, fontWeight: 700, padding: '1px 6px', borderRadius: 4,
                                    background: item.variante === 'A' ? '#e8f5e9' : '#fff3e0',
                                    color: item.variante === 'A' ? '#2e7d32' : '#e65100',
                                  }}>
                                    Opção {item.variante}
                                  </span>
                                )}
                              </div>
                              {item.tipo_peca && (
                                <div style={{ fontSize: 11, color: 'var(--gray)', marginTop: 2 }}>
                                  {PECA_LABELS[item.tipo_peca]}
                                  {(item.acabamento_frente || item.acabamento_esquerda) && ` · acabamentos selecionados`}
                                </div>
                              )}
                            </td>
                            <td>{item.quantidade}</td>
                            <td>{fmt(item.preco_unitario)}</td>
                            <td className="font-bold">{fmt(calcTotal(item))}</td>
                            <td>
                              <div className="flex gap-2">
                                <button className="btn btn-ghost btn-sm btn-icon" onClick={() => editarItem(idx)} disabled={editandoIdx === idx} title="Editar item">✏️</button>
                                <button className="btn btn-ghost btn-sm btn-icon" onClick={() => removerItem(idx)} title="Excluir item">🗑️</button>
                              </div>
                            </td>
                          </tr>
                        ))}
                        <tr>
                          <td colSpan={4} style={{ textAlign: 'right', fontWeight: 700, color: 'var(--text-muted)' }}>Subtotal {amb}:</td>
                          <td className="font-bold" colSpan={2}>{fmt(subtotalAmbiente)}</td>
                        </tr>
                      </tbody>
                    </table>
                  )}

                  {openAmbiente === amb && renderFormItem()}
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* ETAPA 4 — Revisão e Valores */}
      {step === 4 && (
        <div className="orcamento-form-grid">
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <div className="card">
              <div className="card-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span className="card-title">Resumo do Orçamento</span>
                <button type="button" className="btn btn-outline btn-sm" onClick={() => setStep(1)}>← Voltar e Editar</button>
              </div>
              <div className="card-body">
                <div style={{ marginBottom: 6 }}><strong>CLIENTE:</strong> {clienteSelecionado?.nome || '—'}</div>
                <div><strong>TÍTULO:</strong> {form.descricao || '—'}</div>
                {form.condicao_pagamento && <div style={{ marginTop: 6, fontSize: 13, color: 'var(--text-muted)' }}>Condição de pagamento: {form.condicao_pagamento}</div>}
                {form.validade && <div style={{ fontSize: 13, color: 'var(--text-muted)' }}>Validade: {form.validade}</div>}
              </div>
            </div>

            {ambientes.map(amb => {
              const itensAmbiente = itens.filter(i => i.ambiente === amb)
              if (itensAmbiente.length === 0) return null
              const subtotalAmbiente = itensAmbiente.reduce((s, i) => s + calcTotal(i), 0)
              return (
                <div key={amb} className="card">
                  <div className="card-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span className="card-title">📍 {amb.toUpperCase()}</span>
                    <button type="button" className="btn btn-outline btn-sm" onClick={() => setStep(3)}>← Voltar e Editar</button>
                  </div>
                  <div className="card-body">
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                      {itensAmbiente.map((item, i) => (
                        <div key={i} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 14 }}>
                          <span>{item.descricao}</span>
                          <span style={{ fontFamily: 'monospace' }}>{fmt(calcTotal(item))}</span>
                        </div>
                      ))}
                    </div>
                    <hr style={{ border: 'none', borderTop: '1px solid var(--divider)', margin: '10px 0' }} />
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 700 }}>
                      <span>Subtotal {amb}</span>
                      <span>{fmt(subtotalAmbiente)}</span>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>

          <div>
            <div className="card" style={{ position: 'sticky', top: 20 }}>
              <div className="card-header"><span className="card-title">Valores</span></div>
              <div className="card-body">
                <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                  {temVariantes ? (
                    <>
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 14 }}>
                        <span style={{ color: '#2e7d32', fontWeight: 600 }}>Subtotal Opção A</span>
                        <strong style={{ color: '#2e7d32' }}>{fmt(subtotalA)}</strong>
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 14 }}>
                        <span style={{ color: '#e65100', fontWeight: 600 }}>Subtotal Opção B</span>
                        <strong style={{ color: '#e65100' }}>{fmt(subtotalB)}</strong>
                      </div>
                    </>
                  ) : (
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 14 }}>
                      <span style={{ color: 'var(--text-muted)' }}>Subtotal</span>
                      <strong>{fmt(subtotal)}</strong>
                    </div>
                  )}
                  <div className="form-group">
                    <label className="form-label">MÃO DE OBRA (R$)</label>
                    <input className="form-input" type="number" min="0" step="0.01" placeholder="0.00"
                      value={form.mao_obra} onChange={e => up('mao_obra', e.target.value)} />
                  </div>
                  <div className="form-group">
                    <label className="form-label">DESCONTO (R$)</label>
                    <input className="form-input" type="number" min="0" step="0.01" placeholder="0.00"
                      value={form.desconto_rs} onChange={e => up('desconto_rs', e.target.value)} />
                    {descontoExcede && (
                      <p style={{ color: '#c0392b', fontSize: 11, marginTop: 3 }}>
                        Desconto não pode ser maior que o total.
                      </p>
                    )}
                  </div>
                  <hr style={{ border: 'none', borderTop: '2px solid var(--gold)', margin: '4px 0' }} />
                  {temVariantes ? (
                    <>
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 16, fontWeight: 700 }}>
                        <span style={{ color: '#2e7d32' }}>TOTAL Opção A</span>
                        <span style={{ color: '#2e7d32' }}>{fmt(Math.max(0, totalFinalA))}</span>
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 16, fontWeight: 700 }}>
                        <span style={{ color: '#e65100' }}>TOTAL Opção B</span>
                        <span style={{ color: '#e65100' }}>{fmt(Math.max(0, totalFinalB))}</span>
                      </div>
                    </>
                  ) : (
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 18, fontWeight: 700 }}>
                      <span>TOTAL</span>
                      <span style={{ color: descontoExcede ? '#c0392b' : 'var(--gold)' }}>{fmt(Math.max(0, totalFinal))}</span>
                    </div>
                  )}
                  <button className="btn btn-gold" onClick={salvar} disabled={loading} style={{ marginTop: 8 }}>
                    {loading ? 'Salvando...' : '💾 Salvar Orçamento'}
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Navegação entre etapas */}
      <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 20 }}>
        <button type="button" className="btn btn-outline" onClick={prevStep} disabled={step === 1}>← Anterior</button>
        {step < 4 && (
          <button type="button" className="btn btn-gold" onClick={nextStep}>Próximo →</button>
        )}
      </div>

      {showClienteModal && marmoraria && (
        <NovoClienteModal
          marmorariaId={marmoraria.id}
          onClose={() => setShowClienteModal(false)}
          onCreated={async id => {
            await loadClientes()
            up('cliente_id', id)
          }}
        />
      )}
    </div>
  )
}
