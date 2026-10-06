'use client'

import { useState } from 'react'
import type { Pessoa } from '@/lib/producao/pessoas'
import { divergenteDemais } from '@/lib/producao/quantidade-sistema'
import { fmt as fmtMoeda } from '@/lib/utils'
import { apiFetch, extractError, fmtNum, UNIDADE_LABEL, type LinhaFicha } from '@/lib/producao/ficha-client'
import FichaLinhaObraForm from './FichaLinhaObraForm'
import FichaLinhaAvulsaForm from './FichaLinhaAvulsaForm'

type ModoAdd = null | 'obra' | 'avulsa'

// Conteúdo de uma aba de dia: linhas já lançadas (com edição/exclusão
// inline) e os botões pra adicionar mais. Cada linha mostra "ficha" ×
// "sistema" com ⚠ quando a divergência passa de 10%.

export default function FichaDiaAba({
  pessoa, dia, semanaInicio, linhas, fichaFechada, onMudou,
}: {
  pessoa: Pessoa
  dia: string
  semanaInicio: string
  linhas: LinhaFicha[]
  fichaFechada: boolean
  onMudou: () => void
}) {
  const [modoAdd, setModoAdd] = useState<ModoAdd>(null)
  const temCorte = pessoa.cadastroPorEtapa.corte
  const temOutras = pessoa.cadastroPorEtapa.acabamento || pessoa.cadastroPorEtapa.instalacao

  return (
    <div style={{ padding: '16px 4px' }}>
      {linhas.length === 0 ? (
        <div className="empty-state" style={{ padding: '24px 0' }}>
          <p>Nenhum lançamento neste dia ainda.</p>
        </div>
      ) : (
        <div className="table-wrap" style={{ marginBottom: 12 }}>
          <table>
            <thead>
              <tr>
                <th>Cliente</th>
                <th>Peça</th>
                <th>Tipo</th>
                <th style={{ textAlign: 'right' }}>Ficha</th>
                <th style={{ textAlign: 'right' }}>Sistema</th>
                <th style={{ textAlign: 'right' }}>Valor</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {linhas.map(l => (
                <LinhaRow key={l.id} linha={l} fichaFechada={fichaFechada} onMudou={onMudou} />
              ))}
            </tbody>
          </table>
        </div>
      )}

      {modoAdd === 'obra' && (
        <FichaLinhaObraForm
          pessoa={pessoa} dia={dia} semanaInicio={semanaInicio}
          onSalvar={() => { setModoAdd(null); onMudou() }}
          onCancelar={() => setModoAdd(null)}
        />
      )}
      {modoAdd === 'avulsa' && (
        <FichaLinhaAvulsaForm
          pessoa={pessoa} dia={dia} semanaInicio={semanaInicio}
          onSalvar={() => { setModoAdd(null); onMudou() }}
          onCancelar={() => setModoAdd(null)}
        />
      )}

      {!modoAdd && !fichaFechada && (temCorte || temOutras) && (
        <div style={{ display: 'flex', gap: 8 }}>
          <button className="btn btn-outline btn-sm" onClick={() => setModoAdd('obra')}>
            + Peça de pedido
          </button>
          <button className="btn btn-outline btn-sm" onClick={() => setModoAdd('avulsa')}>
            + Obra avulsa
          </button>
        </div>
      )}
      {fichaFechada && (
        <div style={{ fontSize: 12, color: 'var(--gray)' }}>🔒 Semana fechada — somente leitura.</div>
      )}
    </div>
  )
}

function tipoLabel(l: LinhaFicha): string {
  if (l.etapa === 'instalacao') return 'INST'
  if (l.etapa === 'corte') return '—'
  return l.tipo_acabamento === 'meia_esquadria' ? 'ME' : 'R'
}

function LinhaRow({ linha, fichaFechada, onMudou }: { linha: LinhaFicha; fichaFechada: boolean; onMudou: () => void }) {
  const [editando, setEditando] = useState(false)
  const [valor, setValor] = useState(String(linha.quantidade))
  const [salvando, setSalvando] = useState(false)
  const [erro, setErro] = useState('')

  const divergente = divergenteDemais(linha.quantidade, linha.quantidade_sistema)
  const podeEditar = linha.editavel && !fichaFechada

  async function salvarEdicao() {
    const q = parseFloat(valor.replace(',', '.'))
    if (!(q > 0)) { setErro('Quantidade inválida'); return }
    setSalvando(true)
    setErro('')
    const res = await apiFetch(`/api/producao/ficha/${linha.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ quantidade: q }),
    })
    setSalvando(false)
    if (!res.ok) { setErro(await extractError(res)); return }
    setEditando(false)
    onMudou()
  }

  async function excluir() {
    if (!confirm('Excluir este lançamento?')) return
    const res = await apiFetch(`/api/producao/ficha/${linha.id}`, { method: 'DELETE' })
    if (!res.ok) { alert(await extractError(res, 'Erro ao excluir')); return }
    onMudou()
  }

  return (
    <tr>
      <td style={{ fontWeight: 500 }}>{linha.cliente_nome || '—'}</td>
      <td className="text-sm">
        {linha.peca_descricao}
        {linha.is_retroativo && <span style={{ color: 'var(--gray)', marginLeft: 6, fontSize: 11 }}>(avulso)</span>}
      </td>
      <td className="text-sm">{tipoLabel(linha)}</td>
      <td style={{ textAlign: 'right' }}>
        {editando ? (
          <input
            className="form-input" style={{ width: 90, textAlign: 'right', display: 'inline-block' }}
            type="text" inputMode="decimal" value={valor} onChange={e => setValor(e.target.value)}
          />
        ) : (
          <span>{fmtNum(linha.quantidade)} {UNIDADE_LABEL[linha.unidade]}</span>
        )}
      </td>
      <td style={{ textAlign: 'right', color: divergente ? '#B9770E' : 'var(--gray)' }} className="text-sm">
        {fmtNum(linha.quantidade_sistema)} {divergente && '⚠'}
      </td>
      <td style={{ textAlign: 'right' }} className="text-sm">
        {linha.etapa === 'instalacao' ? fmtMoeda(linha.valor_calculado) : 'diária'}
      </td>
      <td style={{ textAlign: 'right', whiteSpace: 'nowrap' }}>
        {podeEditar && (
          editando ? (
            <>
              <button className="btn btn-outline btn-sm" onClick={() => setEditando(false)} disabled={salvando}>✕</button>
              <button className="btn btn-gold btn-sm" onClick={salvarEdicao} disabled={salvando} style={{ marginLeft: 4 }}>✓</button>
            </>
          ) : (
            <>
              <button className="btn btn-outline btn-sm" onClick={() => setEditando(true)}>✏️</button>
              <button className="btn btn-outline btn-sm" onClick={excluir} style={{ marginLeft: 4, color: 'var(--red)' }}>🗑️</button>
            </>
          )
        )}
        {erro && <div style={{ color: 'var(--red)', fontSize: 11 }}>{erro}</div>}
      </td>
    </tr>
  )
}
