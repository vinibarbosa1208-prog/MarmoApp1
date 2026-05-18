'use client'

import { useState, useEffect } from 'react'
import { useRouter, useParams } from 'next/navigation'
import { useApp } from '@/contexts/AppContext'
import { fmt } from '@/lib/utils'
import { supabase } from '@/lib/supabase'

interface ItemForm {
  id?: string
  tipo: 'material' | 'servico' | 'frete' | 'outro'
  descricao: string
  quantidade: number
  preco_unitario: number
}

function calcTotal(item: ItemForm): number {
  return item.quantidade * item.preco_unitario
}

export default function EditarOrcamentoPage() {
  const router = useRouter()
  const params = useParams()
  const orcId = params.id as string
  const { orcamentos, clientes, materiais, servicos, marmoraria, loadOrcamentos, toast } = useApp()
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [itens, setItens] = useState<ItemForm[]>([])
  const [novoItem, setNovoItem] = useState<ItemForm>({ tipo: 'material', descricao: '', quantidade: 1, preco_unitario: 0 })

  const orc = orcamentos.find(o => o.id === orcId)
  const [form, setForm] = useState({
    cliente_id: '', descricao: '', status: 'rascunho',
    mao_obra: '', desconto_rs: '', observacoes: '', validade: '',
  })

  useEffect(() => {
    if (!orc) return
    setForm({
      cliente_id: orc.cliente_id || orc.clienteId || '',
      descricao: orc.descricao || '',
      status: orc.status || 'rascunho',
      mao_obra: String(orc.mao_obra || orc.maoObra || ''),
      desconto_rs: String(orc.desconto_rs || orc.desconto || ''),
      observacoes: orc.observacoes || '',
      validade: orc.validade || '',
    })

    supabase.from('orcamento_itens').select('*').eq('orcamento_id', orcId).then(({ data }) => {
      if (data) setItens(data.map(i => ({
        id: i.id,
        tipo: i.tipo as ItemForm['tipo'],
        descricao: i.descricao,
        quantidade: i.quantidade,
        preco_unitario: i.preco_unitario || 0,
      })))
      setLoading(false)
    })
  }, [orc, orcId])

  function up(k: string, v: string) { setForm(f => ({ ...f, [k]: v })) }

  function adicionarItem() {
    if (!novoItem.descricao) { toast('Descrição obrigatória', 'err'); return }
    setItens(prev => [...prev, { ...novoItem }])
    setNovoItem({ tipo: 'material', descricao: '', quantidade: 1, preco_unitario: 0 })
  }

  function removerItem(idx: number) { setItens(prev => prev.filter((_, i) => i !== idx)) }

  function preencherMaterial(id: string) {
    const m = materiais.find(x => x.id === id)
    if (m) setNovoItem(i => ({ ...i, descricao: m.nome, preco_unitario: m.preco_padrao || m.preco || 0 }))
  }

  function preencherServico(id: string) {
    const s = servicos.find(x => x.id === id)
    if (s) setNovoItem(i => ({ ...i, descricao: s.nome, preco_unitario: s.preco_padrao || 0, tipo: 'servico' }))
  }

  const subtotal = itens.reduce((s, i) => s + calcTotal(i), 0)
  const maoObra = parseFloat(form.mao_obra) || 0
  const desconto = parseFloat(form.desconto_rs) || 0
  const totalFinal = subtotal + maoObra - desconto

  async function salvar() {
    setSaving(true)
    try {
      await supabase.from('orcamentos').update({
        cliente_id: form.cliente_id || null,
        descricao: form.descricao,
        status: form.status,
        mao_obra: maoObra,
        desconto_rs: desconto,
        total: totalFinal,
        observacoes: form.observacoes,
        validade: form.validade || null,
      }).eq('id', orcId)

      await supabase.from('orcamento_itens').delete().eq('orcamento_id', orcId)

      if (itens.length > 0) {
        await supabase.from('orcamento_itens').insert(itens.map(i => ({
          orcamento_id: orcId,
          tipo: i.tipo,
          descricao: i.descricao,
          quantidade: i.quantidade,
          preco_unitario: i.preco_unitario,
          total_item: calcTotal(i),
        })))
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
                <div className="form-row form-row-2">
                  <div className="form-group">
                    <label className="form-label">TIPO</label>
                    <select className="form-select" value={novoItem.tipo} onChange={e => setNovoItem(i => ({ ...i, tipo: e.target.value as ItemForm['tipo'] }))}>
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
                  {novoItem.tipo === 'servico' && (
                    <div className="form-group">
                      <label className="form-label">SERVIÇO</label>
                      <select className="form-select" onChange={e => preencherServico(e.target.value)}>
                        <option value="">Escolher...</option>
                        {servicos.map(s => <option key={s.id} value={s.id}>{s.nome}</option>)}
                      </select>
                    </div>
                  )}
                </div>
                <div className="form-group">
                  <label className="form-label">DESCRIÇÃO</label>
                  <input className="form-input" value={novoItem.descricao} onChange={e => setNovoItem(i => ({ ...i, descricao: e.target.value }))} />
                </div>
                <div className="form-row form-row-2">
                  <div className="form-group">
                    <label className="form-label">QUANTIDADE</label>
                    <input className="form-input" type="number" step="0.01" value={novoItem.quantidade} onChange={e => setNovoItem(i => ({ ...i, quantidade: parseFloat(e.target.value) || 0 }))} />
                  </div>
                  <div className="form-group">
                    <label className="form-label">PREÇO/UN (R$)</label>
                    <input className="form-input" type="number" step="0.01" value={novoItem.preco_unitario} onChange={e => setNovoItem(i => ({ ...i, preco_unitario: parseFloat(e.target.value) || 0 }))} />
                  </div>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontWeight: 700 }}>Total: {fmt(calcTotal(novoItem))}</span>
                  <button className="btn btn-gold" onClick={adicionarItem}>+ Adicionar</button>
                </div>
              </div>

              {itens.length > 0 && (
                <table>
                  <thead><tr><th>Tipo</th><th>Descrição</th><th>Qtd</th><th>Preço/Un</th><th>Total</th><th></th></tr></thead>
                  <tbody>
                    {itens.map((item, idx) => (
                      <tr key={idx}>
                        <td><span className="badge badge-draft">{item.tipo}</span></td>
                        <td style={{ fontWeight: 500 }}>{item.descricao}</td>
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
                <input className="form-input" type="number" step="0.01" value={form.desconto_rs} onChange={e => up('desconto_rs', e.target.value)} />
              </div>
              <hr style={{ border: 'none', borderTop: '2px solid var(--gold)', margin: '8px 0' }} />
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 18, fontWeight: 700 }}>
                <span>TOTAL</span>
                <span style={{ color: 'var(--gold)' }}>{fmt(totalFinal)}</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
