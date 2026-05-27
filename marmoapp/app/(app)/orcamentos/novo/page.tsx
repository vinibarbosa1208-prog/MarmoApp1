'use client'

import { useState, useMemo, Fragment } from 'react'
import { useRouter } from 'next/navigation'
import { useApp } from '@/contexts/AppContext'
import { fmt } from '@/lib/utils'
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
  variante: 'base' | 'A' | 'B' | 'C'
  dados_extras: Record<string, unknown>
}

const ITEM_DEFAULTS: ItemForm = {
  tipo: 'material', ambiente: '', descricao: '', largura: 0, altura: 0, area: 0,
  quantidade: 1, preco_unitario: 0, custo_m2: 0, markup: 3,
  tipo_peca: '', acabamento_esquerda: '', acabamento_direita: '',
  acabamento_frente: '', acabamento_fundo: '',
  tem_saia: false, altura_saia: 0, tem_frontao: false, altura_frontao: 0,
  variante: 'base',
  dados_extras: {},
}

function calcArea(item: ItemForm): number {
  const ex = item.dados_extras
  let base = 0
  let saia = 0
  let frontao = 0

  if (item.tipo_peca === 'pia_l') {
    base = ((ex.seg1_comprimento as number) || 0) * ((ex.seg1_profundidade as number) || 0)
         + ((ex.seg2_comprimento as number) || 0) * ((ex.seg2_profundidade as number) || 0)
  } else if (item.tipo_peca === 'pia_u') {
    base = ((ex.seg1_comprimento as number) || 0) * ((ex.seg1_profundidade as number) || 0)
         + ((ex.seg2_comprimento as number) || 0) * ((ex.seg2_profundidade as number) || 0)
         + ((ex.seg3_comprimento as number) || 0) * ((ex.seg3_profundidade as number) || 0)
  } else if (item.tipo_peca === 'escada') {
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
  if (area > 0) return area * item.quantidade * item.preco_unitario
  return item.quantidade * item.preco_unitario
}

function calcCusto(item: ItemForm): number {
  const area = calcArea(item)
  return area > 0 ? area * item.quantidade * item.custo_m2 : 0
}

function validarItem(item: ItemForm): boolean {
  if (!item.descricao) return false
  if (item.quantidade <= 0) return false
  if (!item.tipo_peca) return true

  const peca = item.tipo_peca
  const laterais = getLateraisDaPeca(peca)
  for (const lat of laterais) {
    const key = `acabamento_${lat}` as keyof ItemForm
    if (!item[key]) return false
  }

  const ex = item.dados_extras
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
    if (!((ex.altura_nicho as number) > 0)) return false
    if (!((ex.profundidade as number) > 0)) return false
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

export default function NovoOrcamentoPage() {
  const router = useRouter()
  const { clientes, materiais, servicos, marmoraria, loadOrcamentos, toast } = useApp()
  const [loading, setLoading] = useState(false)
  const [mostrarErros, setMostrarErros] = useState(false)

  const [form, setForm] = useState({
    cliente_id: '', descricao: '', status: 'rascunho',
    mao_obra: '', desconto_rs: '', observacoes: '', validade: '',
  })

  const [itens, setItens] = useState<ItemForm[]>([])
  const [novoItem, setNovoItem] = useState<ItemForm>({ ...ITEM_DEFAULTS })
  const [servicoIdSel, setServicodeIdSel] = useState('')
  const [temVariantes, setTemVariantes] = useState(false)
  const [varianteNomes, setVarianteNomes] = useState({ A: 'Opção A', B: 'Opção B', C: 'Opção C' })

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

  function adicionarItem() {
    setMostrarErros(true)
    if (!novoItem.descricao) { toast('Descrição do item é obrigatória', 'err'); return }
    if (!itemValido) { toast('Preencha todos os campos obrigatórios do item', 'err'); return }
    setItens(prev => [...prev, { ...novoItem }])
    setNovoItem({ ...ITEM_DEFAULTS })
    setServicodeIdSel('')
    setMostrarErros(false)
  }

  function removerItem(idx: number) {
    setItens(prev => prev.filter((_, i) => i !== idx))
  }

  function preencherMaterial(id: string) {
    const m = materiais.find(x => x.id === id)
    if (!m) return
    const custo = (m as unknown as Record<string, number>).custo_unitario || 0
    const markup = novoItem.markup || 3
    upItem({
      descricao: m.nome,
      custo_m2: custo,
      preco_unitario: custo > 0 ? custo * markup : (m.preco_padrao || m.preco || m.preco_unitario || 0),
    })
  }

  function preencherServico(id: string) {
    const s = servicos.find(x => x.id === id)
    if (s) { upItem({ descricao: s.nome, preco_unitario: s.preco_padrao || 0, tipo: 'servico' }); setServicodeIdSel(id) }
  }

  const servicoUnit = servicoIdSel ? (servicos.find(s => s.id === servicoIdSel)?.unidade || '') : ''

  const subtotal = itens.reduce((s, i) => s + calcTotal(i), 0)
  const maoObra = parseFloat(form.mao_obra) || 0
  const desconto = parseFloat(form.desconto_rs) || 0
  const totalFinal = subtotal + maoObra - desconto
  const descontoExcede = desconto > 0 && desconto > subtotal + maoObra

  const isMaterialComPeca = novoItem.tipo === 'material' && !!novoItem.tipo_peca

  async function salvar() {
    if (!marmoraria) return
    setLoading(true)
    try {
      const useVariantes = temVariantes && itens.some(i => i.variante !== 'base')
      const baseSubtotal = itens.filter(i => i.variante === 'base').reduce((s, i) => s + calcTotal(i), 0)
      const calcVarTotal = (v: 'A' | 'B' | 'C') => {
        const vItems = itens.filter(i => i.variante === v)
        if (!vItems.length) return null
        return baseSubtotal + vItems.reduce((s, i) => s + calcTotal(i), 0) + maoObra - desconto
      }

      const { data: orc, error: orcErr } = await supabase
        .from('orcamentos')
        .insert({
          marmoraria_id: marmoraria.id,
          cliente_id: form.cliente_id || null,
          titulo: form.descricao || 'Orçamento',
          status: form.status,
          subtotal: subtotal,
          mao_obra: maoObra,
          desconto_rs: desconto,
          total: totalFinal,
          observacoes: form.observacoes,
          data_validade: form.validade || null,
          crm_status: 'novo',
          producao_status: 'comercial',
          tem_variantes: useVariantes,
          ...(useVariantes ? {
            nome_variante_a: varianteNomes.A || 'Opção A',
            nome_variante_b: varianteNomes.B || 'Opção B',
            nome_variante_c: varianteNomes.C || 'Opção C',
            total_variante_a: calcVarTotal('A'),
            total_variante_b: calcVarTotal('B'),
            total_variante_c: calcVarTotal('C'),
          } : {}),
        })
        .select()
        .single()

      if (orcErr) throw orcErr

      if (itens.length > 0) {
        const payload = itens.map(i => ({
          orcamento_id: orc.id,
          marmoraria_id: marmoraria.id,
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
          variante: useVariantes && i.variante !== 'base' ? i.variante : null,
          nome_variante: useVariantes && i.variante !== 'base' ? (varianteNomes[i.variante as 'A' | 'B' | 'C'] || `Opção ${i.variante}`) : null,
        }))
        const { error: itensErr } = await supabase.from('orcamento_itens').insert(payload)
        if (itensErr) throw itensErr
      }

      await loadOrcamentos()
      toast('Orçamento salvo!', 'ok2')
      router.push('/orcamentos/' + orc.id)
    } catch (e: unknown) {
      toast(e instanceof Error ? e.message : 'Erro ao salvar', 'err')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="page-inner">
      <div className="page-header">
        <h1 className="page-title">Novo Orçamento</h1>
        <div style={{ display: 'flex', gap: 8 }}>
          <button className="btn btn-outline" onClick={() => router.push('/orcamentos')}>Cancelar</button>
          <button className="btn btn-gold" onClick={salvar} disabled={loading}>{loading ? 'Salvando...' : '💾 Salvar Orçamento'}</button>
        </div>
      </div>

      <div className="orcamento-form-grid">
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {/* Dados gerais */}
          <div className="card">
            <div className="card-header"><span className="card-title">Dados do Orçamento</span></div>
            <div className="card-body">
              <div className="form-row form-row-2">
                <div className="form-group">
                  <label className="form-label">CLIENTE</label>
                  <select className="form-select" value={form.cliente_id} onChange={e => up('cliente_id', e.target.value)}>
                    <option value="">Selecionar cliente...</option>
                    {clientes.map(c => <option key={c.id} value={c.id}>{c.nome}</option>)}
                  </select>
                </div>
                <div className="form-group">
                  <label className="form-label">STATUS</label>
                  <select className="form-select" value={form.status} onChange={e => up('status', e.target.value)}>
                    <option value="rascunho">Rascunho</option>
                    <option value="enviado">Enviado</option>
                    <option value="aprovado">Aprovado</option>
                  </select>
                </div>
              </div>
              <div className="form-group">
                <label className="form-label">DESCRIÇÃO / TÍTULO</label>
                <input className="form-input" placeholder="Ex: Bancada cozinha + banheiro" value={form.descricao} onChange={e => up('descricao', e.target.value)} />
              </div>
              <div className="form-row form-row-2">
                <div className="form-group">
                  <label className="form-label">VALIDADE</label>
                  <input className="form-input" type="date" value={form.validade} onChange={e => up('validade', e.target.value)} />
                </div>
              </div>
              <div className="form-group">
                <label className="form-label">OBSERVAÇÕES</label>
                <textarea className="form-textarea" placeholder="Condições, prazos, detalhes..." value={form.observacoes} onChange={e => up('observacoes', e.target.value)} style={{ minHeight: 80 }} />
              </div>
            </div>
          </div>

          {/* Itens */}
          <div className="card">
            <div className="card-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span className="card-title">Itens do Orçamento</span>
              <button
                type="button"
                onClick={() => {
                  if (temVariantes) setItens(itens.map(i => ({ ...i, variante: 'base' as const })))
                  setTemVariantes(v => !v)
                }}
                style={{
                  padding: '4px 14px', borderRadius: 20, fontSize: 12, fontWeight: 600, cursor: 'pointer',
                  border: `1.5px solid ${temVariantes ? 'var(--gold)' : '#ccc'}`,
                  background: temVariantes ? 'var(--gold)' : 'transparent',
                  color: temVariantes ? '#fff' : '#888',
                }}
              >
                {temVariantes ? '✦ Variantes Ativas' : '✦ Ativar Variantes'}
              </button>
            </div>
            <div className="card-body">
              {temVariantes && (
                <div style={{ background: '#f0f4ff', border: '1px solid #c5d4f0', borderRadius: 10, padding: 14, marginBottom: 16 }}>
                  <div style={{ fontSize: 12, fontWeight: 700, color: '#555', marginBottom: 10, textTransform: 'uppercase', letterSpacing: '0.5px' }}>Nomes das Variantes</div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10 }}>
                    {(['A', 'B', 'C'] as const).map(v => {
                      const c = { A: '#2980b9', B: '#27ae60', C: '#e67e22' }[v]
                      return (
                        <div key={v} className="form-group">
                          <label className="form-label" style={{ color: c }}>OPÇÃO {v}</label>
                          <input
                            className="form-input"
                            placeholder={`Opção ${v}`}
                            value={varianteNomes[v]}
                            onChange={e => setVarianteNomes(prev => ({ ...prev, [v]: e.target.value }))}
                          />
                        </div>
                      )
                    })}
                  </div>
                </div>
              )}

              <div style={{ background: '#f9f7f3', border: '1px solid #EDE9E2', borderRadius: 10, padding: 16, marginBottom: 16 }}>
                <div style={{ fontSize: 12, fontWeight: 700, color: '#888', marginBottom: 12, textTransform: 'uppercase', letterSpacing: '0.5px' }}>Adicionar Item</div>

                {temVariantes && (
                  <div className="form-group" style={{ marginBottom: 12 }}>
                    <label className="form-label">VARIANTE</label>
                    <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                      {(['base', 'A', 'B', 'C'] as const).map(v => {
                        const c = v === 'base' ? '#888' : { A: '#2980b9', B: '#27ae60', C: '#e67e22' }[v]
                        const lbl = v === 'base' ? 'Comum' : (varianteNomes[v] || `Opção ${v}`)
                        const sel = novoItem.variante === v
                        return (
                          <button key={v} type="button" onClick={() => upItem({ variante: v })} style={{
                            padding: '4px 14px', borderRadius: 20, border: `1.5px solid ${c}`,
                            background: sel ? c : 'transparent', color: sel ? '#fff' : c,
                            fontWeight: 600, fontSize: 12, cursor: 'pointer',
                          }}>{lbl}</button>
                        )
                      })}
                    </div>
                  </div>
                )}

                <div className="form-group" style={{ marginBottom: 12 }}>
                  <label className="form-label">AMBIENTE</label>
                  <input
                    className="form-input"
                    placeholder="Ex: Cozinha, Banheiro, Lavabo"
                    value={novoItem.ambiente}
                    onChange={e => upItem({ ambiente: e.target.value })}
                  />
                </div>

                {/* Tipo de item */}
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

                {/* Material: seletor de peças, acabamentos e dimensões */}
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
                    {novoItem.tipo_peca && (
                      <div style={{ marginTop: 12, padding: 14, background: '#f0f9f5', border: '1px solid #b8ddd0', borderRadius: 10 }}>
                        <div style={{ fontSize: 12, fontWeight: 700, color: '#555', marginBottom: 10, textTransform: 'uppercase', letterSpacing: '0.5px' }}>Dimensões da peça</div>
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
                            <div style={{ marginTop: 8, padding: '10px 12px', background: '#fff', borderRadius: 8, border: '1px solid #cce8df', fontSize: 13 }}>
                              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                                <span style={{ color: '#555' }}>Piso</span>
                                <span style={{ fontFamily: 'monospace' }}>{d(w)} × {d(lp / 100)} × {n} degraus = <strong>{d(piso)} m²</strong></span>
                              </div>
                              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4, color: '#777' }}>
                                <span>Espelho</span>
                                <span style={{ fontFamily: 'monospace' }}>{d(w)} × {d(ae / 100)} × {n} degraus = <strong>{d(espelho)} m²</strong></span>
                              </div>
                              <div style={{ borderTop: '1px solid #cce8df', paddingTop: 6, marginTop: 4, display: 'flex', justifyContent: 'space-between', fontWeight: 700 }}>
                                <span>Total</span>
                                <span style={{ color: 'var(--gold)', fontFamily: 'monospace' }}>{d(total)} m²</span>
                              </div>
                              {novoItem.custo_m2 > 0 && (
                                <div style={{ borderTop: '1px solid #cce8df', paddingTop: 6, marginTop: 4 }}>
                                  <div style={{ display: 'flex', justifyContent: 'space-between', color: '#888', fontSize: 12, marginBottom: 3 }}>
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
                            <div style={{ marginTop: 8, padding: '10px 12px', background: '#fff', borderRadius: 8, border: '1px solid #cce8df', fontSize: 13 }}>
                              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                                <span style={{ color: '#555' }}>Tampo</span>
                                <span style={{ fontFamily: 'monospace' }}>{d(novoItem.largura)} × {d(novoItem.altura)} = <strong>{d(tampo)} m²</strong></span>
                              </div>
                              {novoItem.tem_frontao && novoItem.altura_frontao > 0 && (
                                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4, color: '#777' }}>
                                  <span>Frontão</span>
                                  <span style={{ fontFamily: 'monospace' }}>{d(novoItem.largura)} × {d(novoItem.altura_frontao)} = <strong>{d(frontao)} m²</strong></span>
                                </div>
                              )}
                              {novoItem.tem_saia && novoItem.altura_saia > 0 && (
                                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4, color: '#777' }}>
                                  <span>Saia</span>
                                  <span style={{ fontFamily: 'monospace' }}>{d(novoItem.largura)} × {d(novoItem.altura_saia)} = <strong>{d(saia)} m²</strong></span>
                                </div>
                              )}
                              <div style={{ borderTop: '1px solid #cce8df', paddingTop: 6, marginTop: 4, display: 'flex', justifyContent: 'space-between', fontWeight: 700 }}>
                                <span>Total</span>
                                <span style={{ color: 'var(--gold)', fontFamily: 'monospace' }}>{d(total)} m²</span>
                              </div>
                              {novoItem.custo_m2 > 0 && (
                                <div style={{ borderTop: '1px solid #cce8df', paddingTop: 6, marginTop: 4 }}>
                                  <div style={{ display: 'flex', justifyContent: 'space-between', color: '#888', fontSize: 12, marginBottom: 3 }}>
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
                  </>
                )}

                {/* Serviço: dropdown de serviços */}
                {novoItem.tipo === 'servico' && (
                  <div className="form-group" style={{ marginBottom: 12 }}>
                    <label className="form-label">SERVIÇO</label>
                    <select className="form-select" value={servicoIdSel} onChange={e => preencherServico(e.target.value)}>
                      <option value="">Selecionar serviço...</option>
                      {servicos.map(s => <option key={s.id} value={s.id}>{s.nome}</option>)}
                    </select>
                  </div>
                )}

                {/* Descrição */}
                <div className="form-group" style={{ marginTop: 12 }}>
                  <label className="form-label">DESCRIÇÃO</label>
                  <input className="form-input" placeholder="Descreva o item" value={novoItem.descricao}
                    onChange={e => upItem({ descricao: e.target.value })} />
                  {mostrarErros && !novoItem.descricao && (
                    <p style={{ color: '#c0392b', fontSize: 11, marginTop: 3 }}>Descrição obrigatória.</p>
                  )}
                </div>

                {/* Preços: 3 campos quando material+peça, campo único caso contrário */}
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

                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 12 }}>
                  <span style={{ fontWeight: 700, color: 'var(--dark)' }}>Total: {fmt(calcTotal(novoItem))}</span>
                  <button
                    className="btn btn-gold"
                    onClick={adicionarItem}
                    disabled={mostrarErros && !itemValido}
                    title={mostrarErros && !itemValido ? 'Preencha todos os campos obrigatórios' : ''}
                  >
                    + Adicionar Item
                  </button>
                </div>
              </div>

              {/* Tabela de itens adicionados */}
              {itens.length > 0 && (
                <table>
                  <thead>
                    <tr>
                      {temVariantes && <th style={{ width: 90 }}>Variante</th>}
                      <th>Tipo</th><th>Descrição</th><th>Qtd</th><th>Preço/Un</th><th>Total</th><th></th>
                    </tr>
                  </thead>
                  <tbody>
                    {Object.entries(
                      itens.reduce<Record<string, { item: ItemForm; idx: number }[]>>((acc, item, i) => {
                        const key = item.ambiente || 'Sem ambiente'
                        ;(acc[key] = acc[key] || []).push({ item, idx: i })
                        return acc
                      }, {})
                    ).map(([amb, group]) => (
                      <Fragment key={amb}>
                        <tr>
                          <td colSpan={temVariantes ? 7 : 6} style={{ background: '#f5f3ef', fontWeight: 700, fontSize: 11, color: '#888', textTransform: 'uppercase', letterSpacing: '0.5px', padding: '6px 12px', borderBottom: '1px solid #EDE9E2' }}>
                            {amb}
                          </td>
                        </tr>
                        {group.map(({ item, idx }) => {
                          const vColor = item.variante && item.variante !== 'base'
                            ? { A: '#2980b9', B: '#27ae60', C: '#e67e22' }[item.variante] : null
                          const vName = item.variante && item.variante !== 'base'
                            ? (varianteNomes[item.variante as 'A'|'B'|'C'] || `Opção ${item.variante}`) : null
                          return (
                            <tr key={idx}>
                              {temVariantes && (
                                <td>
                                  {vColor ? (
                                    <span style={{ padding: '2px 8px', borderRadius: 12, fontSize: 11, fontWeight: 700, background: `${vColor}20`, color: vColor, border: `1px solid ${vColor}40` }}>
                                      {vName}
                                    </span>
                                  ) : (
                                    <span style={{ fontSize: 11, color: '#aaa' }}>Comum</span>
                                  )}
                                </td>
                              )}
                              <td><span className="badge badge-draft">{item.tipo}</span></td>
                              <td>
                                <div style={{ fontWeight: 500 }}>{item.descricao}</div>
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
                                <button className="btn btn-ghost btn-sm btn-icon" onClick={() => removerItem(idx)}>🗑️</button>
                              </td>
                            </tr>
                          )
                        })}
                      </Fragment>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        </div>

        {/* Sidebar totais */}
        <div>
          <div className="card" style={{ position: 'sticky', top: 20 }}>
            <div className="card-header"><span className="card-title">Resumo</span></div>
            <div className="card-body">
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 14 }}>
                  <span style={{ color: '#888' }}>Subtotal</span>
                  <strong>{fmt(subtotal)}</strong>
                </div>
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
                {(() => {
                  const activeVars = (['A', 'B', 'C'] as const).filter(v => itens.some(i => i.variante === v))
                  if (temVariantes && activeVars.length > 0) {
                    const baseTotal = itens.filter(i => !i.variante || i.variante === 'base').reduce((s, i) => s + calcTotal(i), 0)
                    const VCOLS: Record<string, string> = { A: '#2980b9', B: '#27ae60', C: '#e67e22' }
                    return (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                        {activeVars.map(v => {
                          const vTotal = baseTotal + itens.filter(i => i.variante === v).reduce((s, i) => s + calcTotal(i), 0) + maoObra - desconto
                          return (
                            <div key={v} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 16, fontWeight: 700 }}>
                              <span style={{ color: VCOLS[v] }}>{varianteNomes[v] || `Opção ${v}`}</span>
                              <span style={{ color: VCOLS[v] }}>{fmt(Math.max(0, vTotal))}</span>
                            </div>
                          )
                        })}
                      </div>
                    )
                  }
                  return (
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 18, fontWeight: 700 }}>
                      <span>TOTAL</span>
                      <span style={{ color: descontoExcede ? '#c0392b' : 'var(--gold)' }}>{fmt(Math.max(0, totalFinal))}</span>
                    </div>
                  )
                })()}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
