'use client'

import { useState } from 'react'
import type { Pessoa, EtapaProducao } from '@/lib/producao/pessoas'
import { etapasDaPessoa } from '@/lib/producao/pessoas'
import { apiFetch, extractError } from '@/lib/producao/ficha-client'

type Tipo = 'corte' | 'reto' | 'meia_esquadria' | 'inst'

const TIPO_LABEL: Record<Tipo, string> = { corte: 'CORTE', reto: 'R', meia_esquadria: 'ME', inst: 'INST' }
const TIPO_ETAPA: Record<Tipo, EtapaProducao> = { corte: 'corte', reto: 'acabamento', meia_esquadria: 'acabamento', inst: 'instalacao' }

// "+ Obra avulsa" — obra que nunca vai ter orçamento no sistema (cliente
// atendido fora do MarmoApp). Cliente e peça são texto livre; sem foto (a
// ficha substitui a exigência de foto do portal do instalador).

export default function FichaLinhaAvulsaForm({
  pessoa, dia, semanaInicio, onSalvar, onCancelar,
}: {
  pessoa: Pessoa
  dia: string
  semanaInicio: string
  onSalvar: () => void
  onCancelar: () => void
}) {
  const etapasDisponiveis = etapasDaPessoa(pessoa)
  const tiposDisponiveis: Tipo[] = [
    ...(etapasDisponiveis.includes('corte') ? (['corte'] as Tipo[]) : []),
    ...(etapasDisponiveis.includes('acabamento') ? (['reto', 'meia_esquadria'] as Tipo[]) : []),
    ...(etapasDisponiveis.includes('instalacao') ? (['inst'] as Tipo[]) : []),
  ]

  const [tipo, setTipo] = useState<Tipo | null>(tiposDisponiveis.length === 1 ? tiposDisponiveis[0] : null)
  const etapa = tipo ? TIPO_ETAPA[tipo] : null

  const [cliente, setCliente] = useState('')
  const [peca, setPeca] = useState('')
  const [comprimento, setComprimento] = useState('')
  const [largura, setLargura] = useState('')
  const [quantidade, setQuantidade] = useState('')
  const [salvando, setSalvando] = useState(false)
  const [erro, setErro] = useState('')

  async function salvar() {
    if (!etapa) { setErro('Selecione o tipo'); return }
    if (!cliente.trim()) { setErro('Nome do cliente obrigatório'); return }
    if (!peca.trim()) { setErro('Nome da peça obrigatório'); return }

    const body: Record<string, unknown> = {
      pessoa_id: pessoa.pessoaId,
      etapa,
      data: dia,
      semana: semanaInicio,
      avulso: true,
      cliente_nome: cliente.trim(),
      peca_descricao: peca.trim(),
      tipo_acabamento: tipo === 'meia_esquadria' ? 'meia_esquadria' : 'reto',
    }

    if (etapa === 'corte') {
      const c = parseFloat(comprimento.replace(',', '.'))
      const l = parseFloat(largura.replace(',', '.'))
      if (!(c > 0) || !(l > 0)) { setErro('Informe comprimento e largura'); return }
      body.medida_comprimento = c
      body.medida_largura = l
    } else {
      const q = parseFloat(quantidade.replace(',', '.'))
      if (!(q > 0)) { setErro('Informe os metros lineares'); return }
      body.quantidade = q
    }

    setSalvando(true)
    setErro('')
    const res = await apiFetch('/api/producao/ficha', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })
    setSalvando(false)
    if (!res.ok) { setErro(await extractError(res)); return }
    onSalvar()
  }

  return (
    <div style={{ background: '#FBF3E3', borderRadius: 8, padding: 14, marginTop: 10 }}>
      <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--gray)', textTransform: 'uppercase', marginBottom: 8 }}>
        Obra avulsa — sem orçamento no sistema
      </div>

      {tiposDisponiveis.length > 1 && (
        <div className="form-group" style={{ marginBottom: 8 }}>
          <label className="form-label">TIPO</label>
          <div style={{ display: 'flex', gap: 6 }}>
            {tiposDisponiveis.map(t => (
              <button
                key={t}
                className={`btn btn-sm ${tipo === t ? 'btn-gold' : 'btn-outline'}`}
                onClick={() => setTipo(t)}
              >
                {TIPO_LABEL[t]}
              </button>
            ))}
          </div>
        </div>
      )}

      <div className="form-row form-row-2">
        <div className="form-group">
          <label className="form-label">CLIENTE</label>
          <input className="form-input" placeholder="Nome do cliente" value={cliente} onChange={e => setCliente(e.target.value)} />
        </div>
        <div className="form-group">
          <label className="form-label">PEÇA</label>
          <input className="form-input" placeholder="Ex: Soleira banheiro" value={peca} onChange={e => setPeca(e.target.value)} />
        </div>
      </div>

      {etapa === 'corte' ? (
        <div className="form-row form-row-2">
          <div className="form-group">
            <label className="form-label">COMPRIMENTO (M)</label>
            <input className="form-input" type="text" inputMode="decimal" placeholder="0,00" value={comprimento} onChange={e => setComprimento(e.target.value)} />
          </div>
          <div className="form-group">
            <label className="form-label">LARGURA (M)</label>
            <input className="form-input" type="text" inputMode="decimal" placeholder="0,00" value={largura} onChange={e => setLargura(e.target.value)} />
          </div>
        </div>
      ) : etapa && (
        <div className="form-group">
          <label className="form-label">METROS LINEARES</label>
          <input className="form-input" type="text" inputMode="decimal" placeholder="0,00" value={quantidade} onChange={e => setQuantidade(e.target.value)} />
        </div>
      )}

      {erro && <div style={{ color: 'var(--red)', fontSize: 12, marginTop: 6 }}>{erro}</div>}

      <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
        <button className="btn btn-outline btn-sm" onClick={onCancelar}>Cancelar</button>
        <button className="btn btn-gold btn-sm" onClick={salvar} disabled={salvando}>
          {salvando ? 'Salvando…' : '💾 Lançar'}
        </button>
      </div>
    </div>
  )
}
