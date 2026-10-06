'use client'

import type { Pessoa } from '@/lib/producao/pessoas'
import { rotuloPeriodo, segundaDaSemana, somarDias } from '@/lib/producao/semana'
import type { SemanaResumo } from '@/lib/producao/ficha-client'

// Topo da tela da ficha: pessoa, semana e os botões de impressão. Espelha
// o papel — a semana corrente já aparece pronta pra imprimir, sem
// configurar nada (basta trocar a semana no seletor pra ver o histórico).

export default function FichaSeletor({
  pessoas, pessoaId, onPessoaChange,
  semanaInicio, onSemanaChange, semanas,
  onImprimirFichasSemana, onImprimirPreenchida, imprimindo,
}: {
  pessoas: Pessoa[]
  pessoaId: string
  onPessoaChange: (id: string) => void
  semanaInicio: string
  onSemanaChange: (semana: string) => void
  semanas: SemanaResumo[]
  onImprimirFichasSemana: () => void
  onImprimirPreenchida: () => void
  imprimindo: boolean
}) {
  const corrente = segundaDaSemana()
  const semanaAtualNaLista = semanas.some(s => s.semana_inicio === semanaInicio)

  function irParaSemana(delta: number) {
    onSemanaChange(somarDias(semanaInicio, delta * 7))
  }

  return (
    <div className="card" style={{ marginBottom: 20 }}>
      <div className="card-body" style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'flex-end', gap: 16 }}>
        <div className="form-group" style={{ marginBottom: 0, minWidth: 220 }}>
          <label className="form-label">PESSOA</label>
          <select className="form-select" value={pessoaId} onChange={e => onPessoaChange(e.target.value)}>
            {pessoas.length === 0 && <option value="">Nenhum serrador/acabador/instalador cadastrado</option>}
            {pessoas.map(p => {
              const inativo = p.cadastros.every(c => c.ativo === false)
              return (
                <option key={p.pessoaId} value={p.pessoaId}>
                  {p.nome}{inativo ? ' (inativo)' : ''} — {p.cadastros.map(c => c.cargo).join(' + ')}
                </option>
              )
            })}
          </select>
        </div>

        <div className="form-group" style={{ marginBottom: 0 }}>
          <label className="form-label">SEMANA</label>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <button className="btn btn-outline btn-sm" onClick={() => irParaSemana(-1)}>‹</button>
            <select
              className="form-select"
              style={{ minWidth: 190 }}
              value={semanaInicio}
              onChange={e => onSemanaChange(e.target.value)}
            >
              {!semanaAtualNaLista && (
                <option value={semanaInicio}>{rotuloPeriodo(semanaInicio)}</option>
              )}
              {semanas.map(s => (
                <option key={s.semana_inicio} value={s.semana_inicio}>
                  {rotuloPeriodo(s.semana_inicio)}
                  {s.semana_inicio === corrente ? ' (atual)' : ''}
                  {s.status === 'fechada' ? ' 🔒' : ''}
                </option>
              ))}
            </select>
            <button className="btn btn-outline btn-sm" onClick={() => irParaSemana(1)}>›</button>
          </div>
        </div>

        <div style={{ display: 'flex', gap: 8, marginLeft: 'auto' }}>
          <button className="btn btn-outline btn-sm" onClick={onImprimirPreenchida} disabled={imprimindo}>
            🖨️ Imprimir ficha preenchida
          </button>
          <button className="btn btn-gold btn-sm" onClick={onImprimirFichasSemana} disabled={imprimindo}>
            🖨️ Fichas da semana
          </button>
        </div>
      </div>
    </div>
  )
}
