'use client'

import { useState, useEffect, useMemo } from 'react'
import { useRouter, useParams } from 'next/navigation'
import { useApp } from '@/contexts/AppContext'
import { fmt } from '@/lib/utils'
import { supabase } from '@/lib/supabase'
import SeletorPeca, { getLateraisDaPeca, PECA_LABELS, type SeletorPecaState } from '@/components/orcamento/SeletorPeca'
import AcabamentosLaterais from '@/components/orcamento/AcabamentosLaterais'

interface ItemForm {
  id?: string
  tipo: 'material' | 'servico' | 'frete' | 'outro'
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
}

const ITEM_DEFAULTS: ItemForm = {
  tipo: 'material', descricao: '', largura: 0, altura: 0, area: 0,
  quantidade: 1, preco_unitario: 0, custo_m2: 0, markup: 3,
  tipo_peca: '', acabamento_esquerda: '', acabamento_direita: '',
  acabamento_frente: '', acabamento_fundo: '',
  tem_saia: false, altura_saia: 0, tem_frontao: false, altura_frontao: 0,
  dados_extras: {},
}

function calcArea(item: ItemForm): number {
  if (!item.largura || !item.altura) return 0
  const tampo = item.largura * item.altura
  const frontao = item.tem_frontao ? item.largura * item.altura_frontao : 0
  const saia = item.tem_saia ? item.largura * item.altura_saia : 0
  return tampo + frontao + saia
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
  if (item.tem_saia && !(item.altura_saia > 0)) return false
  if (item.tem_frontao && !(item.altura_frontao > 0)) return false
  return true
}

export default function EditarOrcamentoPage() {
  const router = useRouter()
  const params = useParams()
  const orcId = params.id as string
  const { orcamentos, clientes, materiais, servicos, marmoraria, loadOrcamentos, toast } = useApp()
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [mostrarErros, setMostrarErros] = useState(false)
  const [itens, setItens] = useState<ItemForm[]>([])
  const [novoItem, setNovoItem] = useState<ItemForm>({ ...ITEM_DEFAULTS })
  const [servicoIdSel, setServicodeIdSel] = useState('')

  const orc = orcamentos.find(o => o.id === orcId)
  const [form, setForm] = useState({
    cliente_id: '', descricao: '', status: 'rascunho',
    mao_obra: '', desconto_rs: '', observacoes: '', validade: '',
  })

  useEffect(() => {
    if (!orc) return
    setForm({
      cliente_id: orc.cliente_id || orc.clienteId || '',
      descricao: orc.titulo || orc.descricao || '',
      status: orc.status || 'rascunho',
      mao_obra: String(orc.mao_obra || orc.maoObra || ''),
      desconto_rs: String(orc.desconto_rs || orc.desconto || ''),
      observacoes: orc.observacoes || '',
      validade: orc.data_validade || orc.validade || '',
    })

    supabase.from('orcamento_itens').select('*').eq('orcamento_id', orcId).then(({ data }) => {
      if (data) setItens(data.map(i => ({
        id: i.id,
        tipo: i.tipo as ItemForm['tipo'],
        descricao: i.descricao,
        largura: i.largura || 0,
        altura: i.altura || 0,
        area: i.area || 0,
        quantidade: i.quantidade,
        preco_unitario: i.preco_unitario || 0,
        custo_m2: i.custo_m2 || 0,
        markup: i.markup || 3,
        tipo_peca: i.tipo_peca || '',
        acabamento_esquerda: i.acabamento_esquerda || '',
        acabamento_direita: i.acabamento_direita || '',
        acabamento_frente: i.acabamento_frente || '',
        acabamento_fundo: i.acabamento_fundo || '',
        tem_saia: i.tem_saia || false,
        altura_saia: i.altura_saia || 0,
        tem_frontao: i.tem_frontao || false,
        altura_frontao: i.altura_frontao || 0,
        dados_extras: i.dados_extras || {},
      })))
      setLoading(false)
    })
  }, [orc, orcId])

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

  function removerItem(idx: number) { setItens(prev => prev.filter((_, i) => i !== idx)) }

  function preencherMaterial(id: string) {
    const m = materiais.find(x => x.id === id)
    if (!m) return
    const custo = (m as unknown as Record<string, number>).custo_unitario || 0
    const markup = novoItem.markup || 3
    upItem({
      descricao: m.nome,
      custo_m2: custo,
      preco_unitario: custo > 0 ? custo * markup : (m.preco_padrao || m.preco || 0),
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
    setSaving(true)
    try {
      const { error: orcErr } = await supabase.from('orcamentos').update({
        cliente_id: form.cliente_id || null,
        titulo: form.descricao || 'Orçamento',
        status: form.status,
        subtotal: subtotal,
        mao_obra: maoObra,
        desconto_rs: desconto,
        total: totalFinal,
        observacoes: form.observacoes,
        data_validade: form.validade || null,
      }).eq('id', orcId)
      if (orcErr) throw orcErr

      const { error: delErr } = await supabase.from('orcamento_itens').delete().eq('orcamento_id', orcId)
      if (delErr) throw delErr

      if (itens.length > 0 && marmoraria) {
        const { error: insErr } = await supabase.from('orcamento_itens').insert(itens.map(i => ({
          orcamento_id: orcId,
          marmoraria_id: marmoraria.id,
          tipo: i.tipo,
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
        })))
        if (insErr) throw insErr
      }

      await loadOrcamentos()
      toast('Orçamento atualizado!', 'ok2')
      router.push('/orcamentos/' + orcId)
    } catch (e: unknown) {
      toast(e instanceof Error ? e.message : 'Erro ao salvar', 'err')
    } finally {
      setSaving(false)
    }
  }

  if (loading) return <div className="page-inner"><p>Carregando...</p></div>
  if (!orc) return <div className="page-inner"><p>Orçamento não encontrado</p></div>

  return (
    <div className="page-inner">
      <div className="page-header">
        <h1 className="page-title">Editar Orçamento #{orc.numero || orcId.slice(0, 6)}</h1>
        <div style={{ display: 'flex', gap: 8 }}>
          <button className="btn btn-outline" onClick={() => router.push('/orcamentos/' + orcId)}>Cancelar</button>
          <button className="btn btn-gold" onClick={salvar} disabled={saving}>{saving ? 'Salvando...' : '💾 Salvar'}</button>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 340px', gap: 20 }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
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
                    <option value="recusado">Recusado</option>
                  </select>
                </div>
              </div>
              <div className="form-group">
                <label className="form-label">DESCRIÇÃO</label>
                <input className="form-input" value={form.descricao} onChange={e => up('descricao', e.target.value)} />
              </div>
              <div className="form-row form-row-2">
                <div className="form-group">
                  <label className="form-label">VALIDADE</label>
                  <input className="form-input" type="date" value={form.validade} onChange={e => up('validade', e.target.value)} />
                </div>
              </div>
              <div className="form-group">
                <label className="form-label">OBSERVAÇÕES</label>
                <textarea className="form-textarea" value={form.observacoes} onChange={e => up('observacoes', e.target.value)} style={{ minHeight: 80 }} />
              </div>
            </div>
          </div>

          <div className="card">
            <div className="card-header"><span className="card-title">Itens</span></div>
            <div className="card-body">
              <div style={{ background: '#f9f7f3', border: '1px solid #EDE9E2', borderRadius: 10, padding: 16, marginBottom: 16 }}>
                <div style={{ fontSize: 12, fontWeight: 700, color: '#888', marginBottom: 12, textTransform: 'uppercase', letterSpacing: '0.5px' }}>Adicionar Item</div>

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
                  {novoItem.tipo === 'material' && (
                    <div className="form-group">
                      <label className="form-label">DO ESTOQUE</label>
                      <select className="form-select" onChange={e => preencherMaterial(e.target.value)}>
                        <option value="">Escolher...</option>
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
                          <div className="form-group">
                            <label className="form-label">PROFUNDIDADE (m)</label>
                            <input className="form-input" type="number" min="0" step="0.01" placeholder="Ex: 0.60"
                              value={novoItem.altura || ''}
                              onChange={e => upItem({ altura: parseFloat(e.target.value) || 0 })} />
                          </div>
                        </div>
                        {novoItem.largura > 0 && novoItem.altura > 0 && (() => {
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

                <div className="form-group" style={{ marginTop: 12 }}>
                  <label className="form-label">DESCRIÇÃO</label>
                  <input className="form-input" value={novoItem.descricao} onChange={e => upItem({ descricao: e.target.value })} />
                  {mostrarErros && !novoItem.descricao && (
                    <p style={{ color: '#c0392b', fontSize: 11, marginTop: 3 }}>Descrição obrigatória.</p>
                  )}
                </div>

                {/* Preços: 3 campos quando material+peça, campo único caso contrário */}
                {isMaterialComPeca ? (
                  <>
                    <div className="form-group" style={{ marginTop: 10 }}>
                      <label className="form-label">QUANTIDADE</label>
                      <input className="form-input" type="number" step="0.01" value={novoItem.quantidade}
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
                      <input className="form-input" type="number" step="0.01" value={novoItem.quantidade}
                        onChange={e => upItem({ quantidade: parseFloat(e.target.value) || 0 })} />
                    </div>
                    <div className="form-group">
                      <label className="form-label">{calcArea(novoItem) > 0 ? 'PREÇO POR M² (R$)' : 'PREÇO/UN (R$)'}</label>
                      <input className="form-input" type="number" step="0.01" value={novoItem.preco_unitario}
                        onChange={e => upItem({ preco_unitario: parseFloat(e.target.value) || 0 })} />
                    </div>
                  </div>
                )}

                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 12 }}>
                  <span style={{ fontWeight: 700 }}>Total: {fmt(calcTotal(novoItem))}</span>
                  <button className="btn btn-gold" onClick={adicionarItem}
                    disabled={mostrarErros && !itemValido}>+ Adicionar</button>
                </div>
              </div>

              {itens.length > 0 && (
                <table>
                  <thead><tr><th>Tipo</th><th>Descrição</th><th>Qtd</th><th>Preço/Un</th><th>Total</th><th></th></tr></thead>
                  <tbody>
                    {itens.map((item, idx) => (
                      <tr key={idx}>
                        <td><span className="badge badge-draft">{item.tipo}</span></td>
                        <td>
                          <div style={{ fontWeight: 500 }}>{item.descricao}</div>
                          {item.tipo_peca && (
                            <div style={{ fontSize: 11, color: 'var(--gray)', marginTop: 2 }}>
                              {PECA_LABELS[item.tipo_peca]}
                            </div>
                          )}
                        </td>
                        <td>{item.quantidade}</td>
                        <td>{fmt(item.preco_unitario)}</td>
                        <td className="font-bold">{fmt(calcTotal(item))}</td>
                        <td><button className="btn btn-ghost btn-sm btn-icon" onClick={() => removerItem(idx)}>🗑️</button></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        </div>

        <div>
          <div className="card" style={{ position: 'sticky', top: 20 }}>
            <div className="card-header"><span className="card-title">Resumo</span></div>
            <div className="card-body">
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 14, marginBottom: 12 }}>
                <span style={{ color: '#888' }}>Subtotal</span>
                <strong>{fmt(subtotal)}</strong>
              </div>
              <div className="form-group">
                <label className="form-label">MÃO DE OBRA (R$)</label>
                <input className="form-input" type="number" step="0.01" value={form.mao_obra} onChange={e => up('mao_obra', e.target.value)} />
              </div>
              <div className="form-group">
                <label className="form-label">DESCONTO (R$)</label>
                <input className="form-input" type="number" min="0" step="0.01" value={form.desconto_rs} onChange={e => up('desconto_rs', e.target.value)} />
                {descontoExcede && (
                  <p style={{ color: '#c0392b', fontSize: 11, marginTop: 3 }}>
                    Desconto não pode ser maior que o total.
                  </p>
                )}
              </div>
              <hr style={{ border: 'none', borderTop: '2px solid var(--gold)', margin: '8px 0' }} />
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 18, fontWeight: 700 }}>
                <span>TOTAL</span>
                <span style={{ color: descontoExcede ? '#c0392b' : 'var(--gold)' }}>{fmt(Math.max(0, totalFinal))}</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
