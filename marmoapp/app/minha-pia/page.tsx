'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Bancada, Topo, guardarUtm, linkWhatsapp } from './_componentes'
import { fmtReais, mesesParaQuitar, vencimentoParcela, somarDias, hojeSP, fmtMesAno } from '@/lib/minha-pia/regras'
import { regrasDoPlano } from '@/lib/minha-pia/textos'

interface Kit {
  codigo: string; nome: string; grupo: 'medio' | 'alto'; material_nome: string; tom: 'clara' | 'escura'
  comprimento_m: number; descricao: string | null; inclui: string[]; preco_total: number; parcelas: number[]
}
interface Vitrine {
  ativo: boolean; nome_programa: string; marmoraria: string; prazo_entrega_dias: number
  prazo_baseado_em_entregas: boolean; pias_na_fila: number; cidades_atendidas: string[]
  whatsapp_contato: string | null; kits: Kit[]
}

const GRUPOS: { id: Kit['grupo']; nome: string; texto: string }[] = [
  { id: 'medio', nome: 'Médio padrão', texto: 'Verde Ubatuba ou Branco Dallas' },
  { id: 'alto', nome: 'Alto padrão', texto: 'Preto São Gabriel ou Branco Itaúnas' },
]

function previsaoInstalacao(meses: number, prazo: number): string {
  const hoje = hojeSP()
  return fmtMesAno(somarDias(vencimentoParcela(hoje, Number(hoje.slice(8, 10)), meses - 1), prazo))
}

export default function VitrinePage() {
  const router = useRouter()
  const [v, setV] = useState<Vitrine | null>(null)
  const [erro, setErro] = useState(false)
  const [kitSel, setKitSel] = useState<string>('')
  const [parcela, setParcela] = useState<number>(0)

  useEffect(() => {
    guardarUtm()
    fetch('/api/minha-pia/vitrine')
      .then(r => (r.ok ? r.json() : Promise.reject()))
      .then((d: Vitrine) => {
        setV(d)
        const primeiro = d.kits[0]
        if (primeiro) {
          setKitSel(primeiro.codigo)
          setParcela(primeiro.parcelas.includes(200) ? 200 : primeiro.parcelas[0])
        }
      })
      .catch(() => setErro(true))
  }, [])

  const kit = useMemo(() => v?.kits.find(k => k.codigo === kitSel) ?? null, [v, kitSel])

  function escolherKit(k: Kit) {
    setKitSel(k.codigo)
    if (!k.parcelas.includes(parcela)) setParcela(k.parcelas.includes(200) ? 200 : k.parcelas[0])
  }

  const menorParcela = v ? Math.min(...v.kits.flatMap(k => k.parcelas)) : 0
  const whats = linkWhatsapp(v?.whatsapp_contato, 'Olá! Tenho uma dúvida sobre a Pia Programada.')

  return (
    <>
      <Topo direita={<Link href="/minha-pia/entrar" className="mp-link-topo">Já tenho plano</Link>} />
      <main className="mp-coluna">
        <section className="mp-secao">
          <h1 className="mp-h1">Sua pia de granito instalada, pagando por mês.</h1>
          <p className="mp-lead">
            {menorParcela ? `A partir de ${fmtReais(menorParcela)} por mês no Pix. ` : ''}
            Sem cartão e sem consulta ao SPC.
          </p>
          <div style={{ margin: '28px 0 24px' }}>
            <Bancada codigo={kitSel || 'medio-ubatuba'} rotulo="Bancada de granito de 2,50 m com cuba" />
          </div>
          <a href="#escolher" className="mp-btn mp-btn-primario mp-btn-cheio">Escolher minha pia</a>
          {v && (
            <p className="mp-mini" style={{ marginTop: 12, textAlign: 'center' }}>
              Depois de quitar, instalamos em {v.prazo_baseado_em_entregas ? 'média de' : 'até'} {v.prazo_entrega_dias} dias
              {v.pias_na_fila > 0 ? `. ${v.pias_na_fila} ${v.pias_na_fila === 1 ? 'pia está' : 'pias estão'} em produção agora.` : '.'}
            </p>
          )}
        </section>

        <section className="mp-secao">
          <h2 className="mp-h2">Como funciona</h2>
          <ol className="mp-passos">
            <li><div><h3 className="mp-h3">Escolha a pedra e a parcela</h3><p className="mp-p">Quatro opções de granito, todas com cuba e instalação inclusas.</p></div></li>
            <li><div><h3 className="mp-h3">Pague por mês no Pix</h3><p className="mp-p">Acompanhe aqui quanto já pagou e quanto falta. Pode adiantar quando quiser.</p></div></li>
            <li><div><h3 className="mp-h3">Completou, a gente instala</h3><p className="mp-p">Medimos, produzimos e instalamos na sua casa. Você vê cada etapa pelo celular.</p></div></li>
          </ol>
        </section>

        <section className="mp-secao" id="escolher">
          <h2 className="mp-h2">Escolha sua pia</h2>
          <p className="mp-p">Todas têm 2,50 m de bancada. Muda a pedra.</p>

          {erro && <div className="mp-erro" style={{ marginTop: 16 }}>Não conseguimos carregar as opções. Atualize a página.</div>}
          {!v && !erro && <div className="mp-carregando">Carregando opções…</div>}

          {v && GRUPOS.map(g => {
            const kits = v.kits.filter(k => k.grupo === g.id)
            if (!kits.length) return null
            return (
              <div key={g.id} className="mp-grupo">
                <div className="mp-grupo-titulo">
                  <h3 className="mp-h3">{g.nome}</h3>
                  <span className="mp-mini num">{fmtReais(kits[0].preco_total)}</span>
                </div>
                <div className="mp-kits">
                  {kits.map(k => (
                    <button key={k.codigo} type="button" className="mp-kit" aria-pressed={kitSel === k.codigo} onClick={() => escolherKit(k)}>
                      <div className={`mp-kit-amostra pedra-${k.codigo}`} />
                      <div className="mp-kit-corpo">
                        <div className="mp-kit-nome">{k.material_nome}</div>
                        <div className="mp-kit-preco">{k.tom === 'clara' ? 'Pedra clara' : 'Pedra escura'}</div>
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            )
          })}

          {kit && (
            <div style={{ marginTop: 28 }}>
              <h3 className="mp-h3">Quanto quer pagar por mês?</h3>
              <p className="mp-mini" style={{ marginBottom: 12 }}>{kit.nome}: {fmtReais(kit.preco_total)} no total.</p>
              <div className="mp-fichas" role="group" aria-label="Valor da parcela">
                {kit.parcelas.map(p => (
                  <button key={p} type="button" className="mp-ficha num" aria-pressed={parcela === p} onClick={() => setParcela(p)}>
                    {fmtReais(p)}/mês
                    <small>{mesesParaQuitar(kit.preco_total, p)} meses</small>
                  </button>
                ))}
              </div>
              {parcela > 0 && (
                <p className="mp-p" style={{ marginTop: 14 }}>
                  Pagando {fmtReais(parcela)} por mês, sua pia fica pronta por volta de <strong>{previsaoInstalacao(mesesParaQuitar(kit.preco_total, parcela), v!.prazo_entrega_dias)}</strong>. Adiantando, chega antes.
                </p>
              )}

              <h3 className="mp-h3" style={{ marginTop: 24 }}>O que vem na sua pia</h3>
              <ul className="mp-inclui" style={{ marginTop: 8 }}>
                {kit.inclui.map(i => <li key={i}>{i}</li>)}
              </ul>
            </div>
          )}
        </section>

        <section className="mp-secao">
          <h2 className="mp-h2">Onde atendemos</h2>
          <p className="mp-p">{v ? v.cidades_atendidas.join(', ') + '.' : 'Carregando…'}</p>
          <p className="mp-mini" style={{ marginTop: 8 }}>Mora em outra cidade? Deixe seu contato no cadastro e avisamos quando chegar aí.</p>
        </section>

        <section className="mp-secao mp-perguntas" id="perguntas">
          <h2 className="mp-h2">Perguntas frequentes</h2>
          {regrasDoPlano(v?.prazo_entrega_dias ?? 20).map(r => (
            <details key={r.pergunta}><summary>{r.pergunta}</summary><div>{r.resposta}</div></details>
          ))}
          {whats && <p style={{ marginTop: 20 }}><a href={whats} target="_blank" rel="noopener noreferrer">Tirar dúvida no WhatsApp</a></p>}
        </section>

        {kit && parcela > 0 && v?.ativo && (
          <div className="mp-barra-fixa">
            <button type="button" className="mp-btn mp-btn-primario mp-btn-cheio num"
              onClick={() => router.push(`/minha-pia/aderir?kit=${kit.codigo}&parcela=${parcela}`)}>
              Começar com {fmtReais(parcela)}/mês
            </button>
          </div>
        )}
        {v && !v.ativo && <div className="mp-aviso mp-aviso-oferta" style={{ marginTop: 16 }}>As vagas deste mês estão preenchidas. Volte em breve.</div>}
      </main>
    </>
  )
}
