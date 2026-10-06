'use client'

import { useEffect, useState } from 'react'
import type { Pessoa, EtapaProducao } from '@/lib/producao/pessoas'
import { etapasDaPessoa } from '@/lib/producao/pessoas'
import { divergenteDemais } from '@/lib/producao/quantidade-sistema'
import { apiFetch, extractError, fmtNum, UNIDADE_LABEL, type PedidoBusca, type PecaDisponivel } from '@/lib/producao/ficha-client'

type Tipo = 'corte' | 'reto' | 'meia_esquadria' | 'inst'

const TIPO_LABEL: Record<Tipo, string> = { corte: 'CORTE', reto: 'R', meia_esquadria: 'ME', inst: 'INST' }
const TIPO_ETAPA: Record<Tipo, EtapaProducao> = { corte: 'corte', reto: 'acabamento', meia_esquadria: 'acabamento', inst: 'instalacao' }

// Linha de obra cadastrada: busca o pedido, escolhe o tipo (que determina a
// etapa), escolhe a peça pendente naquela etapa e digita o número da
// ficha — "ml sistema" aparece do lado pra conferência, com ⚠ acima de 10%
// de divergência, sem bloquear.

export default function FichaLinhaObraForm({
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

  const [busca, setBusca] = useState('')
  const [pedidos, setPedidos] = useState<PedidoBusca[]>([])
  const [buscando, setBuscando] = useState(false)
  const [pedido, setPedido] = useState<PedidoBusca | null>(null)

  const [tipo, setTipo] = useState<Tipo | null>(tiposDisponiveis.length === 1 ? tiposDisponiveis[0] : null)
  const etapa = tipo ? TIPO_ETAPA[tipo] : null

  const [pecas, setPecas] = useState<PecaDisponivel[]>([])
  const [carregandoPecas, setCarregandoPecas] = useState(false)
  const [pecaId, setPecaId] = useState('')
  const [quantidade, setQuantidade] = useState('')
  const [salvando, setSalvando] = useState(false)
  const [erro, setErro] = useState('')

  // Busca de pedido com debounce simples.
  useEffect(() => {
    if (pedido) return
    const termo = busca.trim()
    const t = setTimeout(() => {
      setBuscando(true)
      apiFetch(`/api/producao/ficha/pedidos?q=${encodeURIComponent(termo)}`)
        .then(r => r.ok ? r.json() : { pedidos: [] })
        .then(d => setPedidos(d.pedidos ?? []))
        .finally(() => setBuscando(false))
    }, 250)
    return () => clearTimeout(t)
  }, [busca, pedido])

  // Peças pendentes da etapa escolhida.
  useEffect(() => {
    setPecaId('')
    setPecas([])
    if (!pedido || !etapa) return
    setCarregandoPecas(true)
    apiFetch(`/api/producao/ficha/pecas?orcamento_id=${pedido.id}&etapa=${etapa}`)
      .then(r => r.ok ? r.json() : { pecas: [] })
      .then(d => setPecas(d.pecas ?? []))
      .finally(() => setCarregandoPecas(false))
  }, [pedido, etapa])

  const peca = pecas.find(p => p.id === pecaId) ?? null
  const qtdNum = parseFloat(quantidade.replace(',', '.')) || 0
  const divergente = peca ? divergenteDemais(qtdNum, peca.quantidade_sistema) : false

  async function salvar() {
    if (!pedido) { setErro('Busque e selecione o pedido'); return }
    if (!etapa) { setErro('Selecione o tipo'); return }
    if (!pecaId) { setErro('Selecione a peça'); return }
    if (!(qtdNum > 0)) { setErro(etapa === 'corte' ? 'Informe os m²' : 'Informe os metros lineares'); return }

    setSalvando(true)
    setErro('')
    const res = await apiFetch('/api/producao/ficha', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        pessoa_id: pessoa.pessoaId,
        etapa,
        data: dia,
        semana: semanaInicio,
        orcamento_item_id: pecaId,
        quantidade: qtdNum,
        tipo_acabamento: tipo === 'meia_esquadria' ? 'meia_esquadria' : 'reto',
      }),
    })
    setSalvando(false)
    if (!res.ok) { setErro(await extractError(res)); return }
    onSalvar()
  }

  return (
    <div style={{ background: 'var(--light)', borderRadius: 8, padding: 14, marginTop: 10 }}>
      {!pedido ? (
        <div className="form-group" style={{ marginBottom: 8 }}>
          <label className="form-label">CLIENTE OU Nº DO PEDIDO</label>
          <input
            className="form-input"
            placeholder="Digite o nome do cliente ou o número do pedido..."
            value={busca}
            onChange={e => setBusca(e.target.value)}
            autoFocus
          />
          {buscando && <div style={{ fontSize: 12, color: 'var(--gray)', marginTop: 4 }}>Buscando…</div>}
          {!buscando && busca.trim() && pedidos.length === 0 && (
            <div style={{ fontSize: 12, color: 'var(--gray)', marginTop: 4 }}>Nenhum pedido em produção encontrado.</div>
          )}
          {pedidos.length > 0 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4, marginTop: 6, maxHeight: 180, overflowY: 'auto' }}>
              {pedidos.map(p => (
                <button
                  key={p.id}
                  className="btn btn-outline btn-sm"
                  style={{ justifyContent: 'flex-start', textAlign: 'left' }}
                  onClick={() => setPedido(p)}
                >
                  <b>{p.cliente_nome || '— sem cliente —'}</b>
                  <span style={{ color: 'var(--gray)', marginLeft: 8 }}>
                    {p.titulo || `Orç. #${p.numero ?? ''}`}
                  </span>
                </button>
              ))}
            </div>
          )}
        </div>
      ) : (
        <>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10, fontSize: 13 }}>
            <span style={{ fontWeight: 700 }}>{pedido.cliente_nome || '— sem cliente —'}</span>
            <span style={{ color: 'var(--gray)' }}>{pedido.titulo || `Orç. #${pedido.numero ?? ''}`}</span>
            <button className="btn btn-outline btn-sm" style={{ marginLeft: 'auto' }} onClick={() => setPedido(null)}>Trocar pedido</button>
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

          {etapa && (
            <div className="form-group" style={{ marginBottom: 8 }}>
              <label className="form-label">PEÇA</label>
              {carregandoPecas ? (
                <div style={{ fontSize: 12, color: 'var(--gray)' }}>Carregando peças…</div>
              ) : pecas.length === 0 ? (
                <div style={{ fontSize: 12, color: 'var(--gray)' }}>Nenhuma peça pendente nessa etapa.</div>
              ) : (
                <select
                  className="form-select"
                  value={pecaId}
                  onChange={e => { setQuantidade(''); setPecaId(e.target.value) }}
                >
                  <option value="">— Selecionar —</option>
                  {pecas.map(p => (
                    <option key={p.id} value={p.id}>
                      {p.descricao}{p.ambiente ? ` (${p.ambiente})` : ''}
                    </option>
                  ))}
                </select>
              )}
              {peca?.registrada && (
                <div style={{ fontSize: 12, color: '#B9770E', marginTop: 4 }}>
                  ⚠ já registrada em {peca.registrada.data.split('-').reverse().slice(0, 2).join('/')}
                  {peca.registrada.funcionario_nome ? ` por ${peca.registrada.funcionario_nome}` : ''} — lançar de novo substitui esse registro.
                </div>
              )}
            </div>
          )}

          {peca && (
            <div className="form-row form-row-2">
              <div className="form-group">
                <label className="form-label">{etapa === 'corte' ? 'M² DA FICHA' : 'METROS LINEARES DA FICHA'}</label>
                <input
                  className="form-input" type="text" inputMode="decimal" placeholder="0,00"
                  value={quantidade} onChange={e => setQuantidade(e.target.value)}
                />
              </div>
              <div className="form-group">
                <label className="form-label">{etapa === 'corte' ? 'M² SISTEMA' : 'ML SISTEMA'}</label>
                <div
                  className="form-input"
                  style={{
                    background: divergente ? '#FEF9E7' : 'var(--light)',
                    color: divergente ? '#B9770E' : 'var(--text)',
                    fontWeight: 600, display: 'flex', alignItems: 'center', gap: 6,
                  }}
                >
                  {fmtNum(peca.quantidade_sistema)} {UNIDADE_LABEL[peca.unidade]}
                  {divergente && <span title="Divergência acima de 10% entre ficha e sistema">⚠</span>}
                </div>
              </div>
            </div>
          )}

          {erro && <div style={{ color: 'var(--red)', fontSize: 12, marginTop: 6 }}>{erro}</div>}

          <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
            <button className="btn btn-outline btn-sm" onClick={onCancelar}>Cancelar</button>
            <button className="btn btn-gold btn-sm" onClick={salvar} disabled={salvando || !peca}>
              {salvando ? 'Salvando…' : '💾 Lançar'}
            </button>
          </div>
        </>
      )}

      {!pedido && (
        <div style={{ marginTop: 6 }}>
          <button className="btn btn-outline btn-sm" onClick={onCancelar}>Cancelar</button>
        </div>
      )}
    </div>
  )
}
