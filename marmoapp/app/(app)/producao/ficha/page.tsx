'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { useApp } from '@/contexts/AppContext'
import { agruparPessoas, type FuncionarioPessoa } from '@/lib/producao/pessoas'
import { DIAS_SEMANA_CURTO, diasDaSemana, ddmm, segundaDaSemana } from '@/lib/producao/semana'
import { apiFetch, type FichaGetResponse, type SemanaResumo } from '@/lib/producao/ficha-client'
import FichaSeletor from '@/components/producao/FichaSeletor'
import FichaDiaAba from '@/components/producao/FichaDiaAba'
import FichaResumoSemana from '@/components/producao/FichaResumoSemana'

export default function FichaProducaoPage() {
  const { toast } = useApp()

  const [funcionarios, setFuncionarios] = useState<FuncionarioPessoa[]>([])
  const [carregandoFuncionarios, setCarregandoFuncionarios] = useState(true)
  const pessoas = useMemo(() => agruparPessoas(funcionarios, { incluirInativos: true }), [funcionarios])

  const [pessoaId, setPessoaId] = useState('')
  const [semanaInicio, setSemanaInicio] = useState(segundaDaSemana())
  const [semanas, setSemanas] = useState<SemanaResumo[]>([])

  const [ficha, setFicha] = useState<FichaGetResponse | null>(null)
  const [carregandoFicha, setCarregandoFicha] = useState(false)
  const [erroFicha, setErroFicha] = useState('')

  const [diariasPorDia, setDiariasPorDia] = useState<Map<string, number>>(new Map())
  const [aba, setAba] = useState(0) // índice 0-5 (Seg-Sáb)
  const [imprimindo, setImprimindo] = useState(false)

  // ── Carrega funcionários uma vez, agrupa em pessoas ────────────────
  useEffect(() => {
    apiFetch('/api/funcionarios')
      .then(r => r.ok ? r.json() : [])
      .then((data: FuncionarioPessoa[]) => setFuncionarios(Array.isArray(data) ? data : []))
      .finally(() => setCarregandoFuncionarios(false))
  }, [])

  // Pessoa ativa padrão: a primeira pessoa ativa da lista, só na primeira carga.
  useEffect(() => {
    if (pessoaId || pessoas.length === 0) return
    const primeiraAtiva = pessoas.find(p => p.cadastros.some(c => c.ativo !== false)) ?? pessoas[0]
    setPessoaId(primeiraAtiva.pessoaId)
  }, [pessoas, pessoaId])

  const pessoa = pessoas.find(p => p.pessoaId === pessoaId) ?? null

  // ── Semanas disponíveis (seletor + status fechada/aberta) ──────────
  const carregarSemanas = useCallback(() => {
    apiFetch('/api/producao/fichas/semanas')
      .then(r => r.ok ? r.json() : { semanas: [] })
      .then(d => setSemanas(d.semanas ?? []))
  }, [])
  useEffect(() => { carregarSemanas() }, [carregarSemanas])

  // ── Linhas da pessoa+semana ─────────────────────────────────────
  const carregarFicha = useCallback(async () => {
    if (!pessoaId) return
    setCarregandoFicha(true)
    setErroFicha('')
    try {
      const res = await apiFetch(`/api/producao/ficha?pessoa=${pessoaId}&semana=${semanaInicio}`)
      if (!res.ok) {
        const d = await res.json().catch(() => ({}))
        setErroFicha(d.error || 'Erro ao carregar a ficha')
        setFicha(null)
        return
      }
      setFicha(await res.json())
    } finally {
      setCarregandoFicha(false)
    }
  }, [pessoaId, semanaInicio])
  useEffect(() => { carregarFicha() }, [carregarFicha])

  // ── Presenças da semana (só pro custo por ml do resumo) ────────────
  useEffect(() => {
    if (!pessoa) { setDiariasPorDia(new Map()); return }
    const cadastroIds = new Set(pessoa.cadastros.map(c => c.id))
    apiFetch(`/api/funcionarios/presencas?semana=${semanaInicio}`)
      .then(r => r.ok ? r.json() : [])
      .then((presencas: { funcionario_id: string; data: string; presente: boolean; valor_diaria: number }[]) => {
        const mapa = new Map<string, number>()
        for (const p of presencas) {
          if (!p.presente || !cadastroIds.has(p.funcionario_id)) continue
          mapa.set(p.data, Math.max(mapa.get(p.data) ?? 0, Number(p.valor_diaria ?? 0)))
        }
        setDiariasPorDia(mapa)
      })
  }, [pessoa, semanaInicio])

  const dias = diasDaSemana(semanaInicio)

  // Dia de hoje selecionado por padrão, se estiver dentro da semana aberta.
  useEffect(() => {
    const hoje = new Date().toISOString().split('T')[0]
    const idx = dias.indexOf(hoje)
    setAba(idx >= 0 ? idx : 0)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [semanaInicio])

  const hojeStr = new Date().toISOString().split('T')[0]

  async function imprimirFichasSemana() {
    setImprimindo(true)
    try {
      const res = await apiFetch(`/api/producao/ficha/pdf?semana=${semanaInicio}`)
      if (!res.ok) { toast('Erro ao gerar as fichas', 'err'); return }
      const data = await res.json()
      const { gerarFichaSemanalPDF } = await import('@/lib/pdf/gerar-ficha-semanal-pdf')
      const doc = gerarFichaSemanalPDF(data.pessoas, semanaInicio, data.marmoraria)
      abrirPdf(doc)
    } finally {
      setImprimindo(false)
    }
  }

  async function imprimirFichaPreenchida() {
    if (!pessoaId) return
    setImprimindo(true)
    try {
      const res = await apiFetch(`/api/producao/ficha/pdf?semana=${semanaInicio}&preenchida=1&pessoa=${pessoaId}`)
      if (!res.ok) { toast('Erro ao gerar a ficha', 'err'); return }
      const data = await res.json()
      const { gerarFichaSemanalPDF } = await import('@/lib/pdf/gerar-ficha-semanal-pdf')
      const doc = gerarFichaSemanalPDF(data.pessoas, semanaInicio, data.marmoraria)
      abrirPdf(doc)
    } finally {
      setImprimindo(false)
    }
  }

  function abrirPdf(doc: { output: (type: 'blob') => Blob }) {
    const blob = doc.output('blob')
    const url = URL.createObjectURL(blob)
    window.open(url, '_blank')
  }

  if (carregandoFuncionarios) {
    return (
      <div className="page-inner">
        <div className="page-header"><h1 className="page-title">Ficha de Produção</h1></div>
        <div style={{ padding: 40, textAlign: 'center', color: 'var(--gray)' }}>Carregando…</div>
      </div>
    )
  }

  return (
    <div className="page-inner">
      <div className="page-header">
        <h1 className="page-title">Ficha de Produção</h1>
      </div>

      {pessoas.length === 0 ? (
        <div className="empty-state">
          <h3>Nenhum serrador, acabador ou instalador cadastrado</h3>
          <p>Cadastre em Funcionários antes de lançar a ficha semanal.</p>
        </div>
      ) : (
        <>
          <FichaSeletor
            pessoas={pessoas}
            pessoaId={pessoaId}
            onPessoaChange={setPessoaId}
            semanaInicio={semanaInicio}
            onSemanaChange={setSemanaInicio}
            semanas={semanas}
            onImprimirFichasSemana={imprimirFichasSemana}
            onImprimirPreenchida={imprimirFichaPreenchida}
            imprimindo={imprimindo}
          />

          {erroFicha && (
            <div className="card" style={{ marginBottom: 20, borderLeft: '3px solid var(--red)' }}>
              <div className="card-body" style={{ color: 'var(--red)' }}>{erroFicha}</div>
            </div>
          )}

          {carregandoFicha && !ficha ? (
            <div style={{ padding: 40, textAlign: 'center', color: 'var(--gray)' }}>Carregando ficha…</div>
          ) : ficha && pessoa ? (
            <div className="card">
              <div className="card-body" style={{ padding: 0 }}>
                <div className="tabs" style={{ padding: '12px 16px 0', flexWrap: 'wrap' }}>
                  {dias.map((dia, i) => {
                    const temLancamento = ficha.linhas.some(l => l.data === dia)
                    const diaPassado = dia <= hojeStr
                    return (
                      <button
                        key={dia}
                        className={`tab${aba === i ? ' active' : ''}`}
                        onClick={() => setAba(i)}
                      >
                        {DIAS_SEMANA_CURTO[i]} {ddmm(dia)}
                        {diaPassado && !temLancamento && <span style={{ color: '#B9770E', marginLeft: 4 }}>●</span>}
                      </button>
                    )
                  })}
                </div>

                {ficha.ficha.status === 'fechada' && (
                  <div style={{ padding: '10px 16px', background: '#FBF3E3', fontSize: 13, color: '#8A6212' }}>
                    🔒 Semana fechada em {ficha.ficha.fechada_em ? new Date(ficha.ficha.fechada_em).toLocaleDateString('pt-BR') : ''} — somente leitura.
                  </div>
                )}

                <div style={{ padding: '0 16px' }}>
                  <FichaDiaAba
                    pessoa={pessoa}
                    dia={dias[aba]}
                    semanaInicio={semanaInicio}
                    linhas={ficha.linhas.filter(l => l.data === dias[aba])}
                    fichaFechada={ficha.ficha.status === 'fechada'}
                    onMudou={() => { carregarFicha(); carregarSemanas() }}
                  />
                </div>
              </div>
            </div>
          ) : null}

          {ficha && (
            <FichaResumoSemana
              linhas={ficha.linhas}
              fatorME={ficha.fator_meia_esquadria}
              presencasPorDia={diariasPorDia}
            />
          )}
        </>
      )}
    </div>
  )
}
