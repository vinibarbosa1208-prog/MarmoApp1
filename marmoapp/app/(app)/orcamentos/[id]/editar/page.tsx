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
  const temCubaExtra = item.tipo_peca === 'lavatorio_extensao' || item.tipo_peca === 'lavatorio_simples'
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

export default function EditarOrcamentoPage() {
  const router = useRouter()
  const params = useParams()
  const orcId = params.id as string
  const { orcamentos, clientes, materiais, servicos, marmoraria, loadOrcamentos, toast } = useApp()
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [mostrarErros, setMostrarErros] = useState(false)
  const [itens, setItens] = useState<ItemForm[]>([])
  // IDs dos itens originais carregados do banco — usados para DELETE seguro no salvar()
  const [originalIds, setOriginalIds] = useState<string[]>([])
  const [novoItem, setNovoItem] = useState<ItemForm>({ ...ITEM_DEFAULTS })
  const [servicoIdSel, setServicodeIdSel] = useState('')
  const [editandoIdx, setEditandoIdx] = useState<number | null>(null)
  // Alteração em lote
  const [selecionados, setSelecionados] = useState<Set<number>>(new Set())
  const [lote, setLote] = useState({ novoMaterial: '', custo_m2: '', markup: '', preco_unitario: '' })

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
      if (data) {
        const mapped = data.map(i => ({
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
        }))
        setItens(mapped)
        setOriginalIds(data.map(i => i.id))
      }
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

  function handleLateralExtrasChange(lateral: string, key: string, value: unknown) {
    setNovoItem(prev => ({ ...prev, dados_extras: { ...prev.dados_extras, [`${key}_${lateral}`]: value } }))
  }

  const itemValido = useMemo(() => validarItem(novoItem), [novoItem])

  function adicionarItem() {
    setMostrarErros(true)
    if (!novoItem.descricao) { toast('Descrição do item é obrigatória', 'err'); return }
    if (!itemValido) { toast('Preencha todos os campos obrigatórios do item', 'err'); return }
    if (editandoIdx !== null) {
      setItens(prev => prev.map((item, i) => i === editandoIdx ? { ...novoItem } : item))
      setEditandoIdx(null)
    } else {
      setItens(prev => [...prev, { ...novoItem }])
    }
    setNovoItem({ ...ITEM_DEFAULTS })
    setServicodeIdSel('')
    setMostrarErros(false)
  }

  function editarItem(idx: number) {
    setNovoItem({ ...itens[idx] })
    setEditandoIdx(idx)
    setMostrarErros(false)
    // Scroll form into view
    setTimeout(() => document.querySelector('.card-title')?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 50)
  }

  function cancelarEdicao() {
    setNovoItem({ ...ITEM_DEFAULTS })
    setEditandoIdx(null)
    setServicodeIdSel('')
    setMostrarErros(false)
  }

  function removerItem(idx: number) {
    if (editandoIdx === idx) cancelarEdicao()
    setItens(prev => prev.filter((_, i) => i !== idx))
    setSelecionados(prev => {
      const next = new Set<number>()
      prev.forEach(i => { if (i < idx) next.add(i); else if (i > idx) next.add(i - 1) })
      return next
    })
  }

  // Lote: toggle individual
  function toggleSelecionado(idx: number) {
    setSelecionados(prev => {
      const next = new Set(prev)
      if (next.has(idx)) next.delete(idx); else next.add(idx)
      return next
    })
  }

  // Lote: selecionar todos com mesmo material (descrição)
  function selecionarMesmoMaterial(descricao: string) {
    const indices = itens.reduce<number[]>((acc, item, i) => {
      if (item.tipo === 'material' && item.descricao === descricao) acc.push(i)
      return acc
    }, [])
    setSelecionados(prev => {
      const next = new Set(prev)
      const allAlreadySel = indices.every(i => next.has(i))
      if (allAlreadySel) indices.forEach(i => next.delete(i))
      else indices.forEach(i => next.add(i))
      return next
    })
  }

  // Lote: selecionar / desselecionar todos
  function toggleTodos() {
    if (selecionados.size === itens.length) setSelecionados(new Set())
    else setSelecionados(new Set(itens.map((_, i) => i)))
  }

  // Lote: aplicar alterações
  function aplicarLote() {
    if (selecionados.size === 0) return
    setItens(prev => prev.map((item, i) => {
      if (!selecionados.has(i)) return item
      const updates: Partial<ItemForm> = {}
      if (lote.novoMaterial.trim()) updates.descricao = lote.novoMaterial.trim()
      if (lote.custo_m2 !== '') updates.custo_m2 = parseFloat(lote.custo_m2) || 0
      if (lote.markup !== '') updates.markup = parseFloat(lote.markup) || 1
      if (lote.preco_unitario !== '') updates.preco_unitario = parseFloat(lote.preco_unitario) || 0
      // Recalcular preço se custo+markup informados mas preço não
      if ((lote.custo_m2 !== '' || lote.markup !== '') && lote.preco_unitario === '') {
        const custo = updates.custo_m2 ?? item.custo_m2
        const mk = updates.markup ?? item.markup
        if (custo > 0 && mk > 0) updates.preco_unitario = custo * mk
      }
      return { ...item, ...updates }
    }))
    setSelecionados(new Set())
    setLote({ novoMaterial: '', custo_m2: '', markup: '', preco_unitario: '' })
    toast(`${selecionados.size} item(s) atualizado(s)`, 'ok2')
  }

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
    if (!marmoraria) { toast('Dados da marmoraria não carregados. Aguarde e tente novamente.', 'err'); return }
    setSaving(true)
    try {
      // 1. Atualiza cabeçalho do orçamento
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

      // 2. INSERT dos itens PRIMEIRO — se falhar, os itens originais continuam no banco
      let newIds: string[] = []
      if (itens.length > 0) {
        const { data: inserted, error: insErr } = await supabase
          .from('orcamento_itens')
          .insert(itens.map(i => ({
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
          .select('id')
        if (insErr) throw insErr
        newIds = (inserted ?? []).map(r => r.id)
      }

      // 3. DELETE dos itens antigos SOMENTE após INSERT bem-sucedido
      if (originalIds.length > 0) {
        const { error: delErr } = await supabase
          .from('orcamento_itens')
          .delete()
          .in('id', originalIds)
        if (delErr) {
          // Compensação: remove os itens recém-inseridos para evitar duplicatas
          if (newIds.length > 0) {
            await supabase.from('orcamento_itens').delete().in('id', newIds)
          }
          throw delErr
        }
      }

      // Atualiza os IDs originais para o próximo save
      setOriginalIds(newIds)

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
              <div style={{ background: 'var(--page-bg)', border: '1px solid var(--card-border)', borderRadius: 10, padding: 16, marginBottom: 16 }}>
                <div style={{ fontSize: 12, fontWeight: 700, color: editandoIdx !== null ? 'var(--gold)' : '#888', marginBottom: 12, textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                  {editandoIdx !== null ? `✏️ Editando item ${editandoIdx + 1}` : 'Adicionar Item'}
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
                  <div style={{ display: 'flex', gap: 8 }}>
                    {editandoIdx !== null && (
                      <button className="btn btn-outline" onClick={cancelarEdicao}>Cancelar</button>
                    )}
                    <button className="btn btn-gold" onClick={adicionarItem}
                      disabled={mostrarErros && !itemValido}>
                      {editandoIdx !== null ? '💾 Salvar Alterações' : '+ Adicionar'}
                    </button>
                  </div>
                </div>
              </div>

              {itens.length > 0 && (
                <>
                  {/* Barra de seleção rápida por material */}
                  {(() => {
                    const materiaisDistintos = Array.from(
                      new Set(itens.filter(i => i.tipo === 'material').map(i => i.descricao))
                    )
                    if (materiaisDistintos.length === 0) return null
                    return (
                      <div style={{ marginBottom: 10, display: 'flex', flexWrap: 'wrap', gap: 6, alignItems: 'center' }}>
                        <span style={{ fontSize: 11, color: '#888', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.5px' }}>Selecionar:</span>
                        {materiaisDistintos.map(desc => {
                          const indices = itens.reduce<number[]>((acc, item, i) => {
                            if (item.tipo === 'material' && item.descricao === desc) acc.push(i)
                            return acc
                          }, [])
                          const allSel = indices.every(i => selecionados.has(i))
                          return (
                            <button key={desc} onClick={() => selecionarMesmoMaterial(desc)}
                              style={{ fontSize: 11, padding: '3px 10px', borderRadius: 20, border: allSel ? '1.5px solid var(--gold)' : '1.5px solid var(--card-border)', background: allSel ? 'rgba(201,168,76,0.06)' : 'var(--card-bg)', color: allSel ? 'var(--gold)' : 'var(--text-muted)', cursor: 'pointer', fontWeight: allSel ? 700 : 400 }}>
                              {desc} ({indices.length})
                            </button>
                          )
                        })}
                        {selecionados.size > 0 && (
                          <button onClick={() => setSelecionados(new Set())}
                            style={{ fontSize: 11, padding: '3px 10px', borderRadius: 20, border: '1.5px solid var(--card-border)', background: 'var(--card-bg)', color: 'var(--text-muted)', cursor: 'pointer' }}>
                            Limpar seleção
                          </button>
                        )}
                      </div>
                    )
                  })()}

                  <table>
                    <thead>
                      <tr>
                        <th style={{ width: 36, textAlign: 'center' }}>
                          <input type="checkbox"
                            checked={itens.length > 0 && selecionados.size === itens.length}
                            onChange={toggleTodos}
                            title="Selecionar todos"
                            style={{ cursor: 'pointer' }} />
                        </th>
                        <th>Tipo</th><th>Descrição</th><th>Qtd</th><th>Preço/Un</th><th>Total</th><th></th>
                      </tr>
                    </thead>
                    <tbody>
                      {itens.map((item, idx) => (
                        <tr key={idx} style={{ background: editandoIdx === idx ? '#fffbf0' : selecionados.has(idx) ? '#f5f0ff' : undefined }}>
                          <td style={{ textAlign: 'center' }}>
                            <input type="checkbox"
                              checked={selecionados.has(idx)}
                              onChange={() => toggleSelecionado(idx)}
                              style={{ cursor: 'pointer' }} />
                          </td>
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
                          <td>
                            <div style={{ display: 'flex', gap: 4 }}>
                              <button className="btn btn-ghost btn-sm btn-icon" onClick={() => editarItem(idx)}
                                disabled={editandoIdx === idx} title="Editar item">✏️</button>
                              <button className="btn btn-ghost btn-sm btn-icon" onClick={() => removerItem(idx)} title="Excluir item">🗑️</button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </>
              )}

              {/* Barra flutuante de alteração em lote */}
              {selecionados.size > 0 && (
                <div style={{
                  position: 'fixed', bottom: 24, left: '50%', transform: 'translateX(-50%)',
                  background: 'var(--sidebar-bg)', color: '#fff', borderRadius: 16, padding: '14px 20px',
                  boxShadow: '0 8px 32px rgba(0,0,0,0.35)', zIndex: 1000,
                  display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap', maxWidth: 780,
                }}>
                  <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--gold)', whiteSpace: 'nowrap' }}>
                    {selecionados.size} item(s) selecionado(s)
                  </span>
                  <input
                    placeholder="Novo material"
                    value={lote.novoMaterial}
                    onChange={e => setLote(l => ({ ...l, novoMaterial: e.target.value }))}
                    style={{ padding: '6px 10px', borderRadius: 8, border: 'none', fontSize: 13, width: 150, background: 'rgba(255,255,255,0.08)', color: '#fff' }}
                  />
                  <input
                    placeholder="Custo R$/m²"
                    type="number"
                    min="0"
                    step="0.01"
                    value={lote.custo_m2}
                    onChange={e => setLote(l => ({ ...l, custo_m2: e.target.value }))}
                    style={{ padding: '6px 10px', borderRadius: 8, border: 'none', fontSize: 13, width: 110, background: 'rgba(255,255,255,0.08)', color: '#fff' }}
                  />
                  <input
                    placeholder="Fator (×)"
                    type="number"
                    min="0.1"
                    step="0.5"
                    value={lote.markup}
                    onChange={e => setLote(l => ({ ...l, markup: e.target.value }))}
                    style={{ padding: '6px 10px', borderRadius: 8, border: 'none', fontSize: 13, width: 90, background: 'rgba(255,255,255,0.08)', color: '#fff' }}
                  />
                  <input
                    placeholder="Preço venda"
                    type="number"
                    min="0"
                    step="0.01"
                    value={lote.preco_unitario}
                    onChange={e => setLote(l => ({ ...l, preco_unitario: e.target.value }))}
                    style={{ padding: '6px 10px', borderRadius: 8, border: 'none', fontSize: 13, width: 110, background: 'rgba(255,255,255,0.08)', color: '#fff' }}
                  />
                  <button onClick={aplicarLote}
                    style={{ padding: '7px 18px', borderRadius: 10, background: 'var(--gold)', color: '#fff', border: 'none', fontWeight: 700, fontSize: 13, cursor: 'pointer', whiteSpace: 'nowrap' }}>
                    Aplicar
                  </button>
                  <button onClick={() => { setSelecionados(new Set()); setLote({ novoMaterial: '', custo_m2: '', markup: '', preco_unitario: '' }) }}
                    style={{ padding: '7px 14px', borderRadius: 10, background: 'transparent', color: 'rgba(255,255,255,0.6)', border: '1.5px solid rgba(255,255,255,0.2)', fontWeight: 600, fontSize: 13, cursor: 'pointer', whiteSpace: 'nowrap' }}>
                    Cancelar
                  </button>
                </div>
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
