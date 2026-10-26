'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Bancada, Topo, WhatsFlutuante, guardarUtm, linkWhatsapp } from './_componentes'
import { fmtReais, mesesParaQuitar, vencimentoParcela, somarDias, hojeSP, fmtMesAno } from '@/lib/minha-pia/regras'
import { regrasDoPlano } from '@/lib/minha-pia/textos'

interface Kit {
  codigo: string; nome: string; grupo: 'medio' | 'alto'; material_nome: string; tom: 'clara' | 'escura'
  comprimento_m: number; descricao: string | null; inclui: string[]; preco_total: number; parcelas: number[]
}
interface Loja {
  nome: string; cnpj: string | null; endereco: string | null; cidade: string | null; estado: string | null; cep: string | null
  telefone: string | null; instagram: string | null; fundada_ano: number | null; garantia_meses: number | null; horario_atendimento: string | null
}
interface Vitrine {
  ativo: boolean; nome_programa: string; marmoraria: string; prazo_entrega_dias: number
  prazo_baseado_em_entregas: boolean; pias_na_fila: number; pias_instaladas: number; cidades_atendidas: string[]
  whatsapp_contato: string | null; loja: Loja; fotos: { url: string; legenda: string | null; destaque: boolean }[]; kits: Kit[]
}

function previsaoInstalacao(meses: number, prazo: number): string {
  const hoje = hojeSP()
  return fmtMesAno(somarDias(vencimentoParcela(hoje, Number(hoje.slice(8, 10)), meses - 1), prazo))
}

function fmtCnpj(d: string) {
  return d.replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/, '$1.$2.$3/$4-$5')
}

export default function VitrinePage() {
  const router = useRouter()
  const [v, setV] = useState<Vitrine | null>(null)
  const [erro, setErro] = useState(false)
  const [kitSel, setKitSel] = useState('')
  const [parcela, setParcela] = useState(0)
  const [barra, setBarra] = useState(false)
  const ctaRef = useRef<HTMLButtonElement>(null)

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

  // A barra fixa só aparece quando o botão principal sai da tela.
  useEffect(() => {
    const el = ctaRef.current
    if (!el || typeof IntersectionObserver === 'undefined') return
    const io = new IntersectionObserver(([e]) => setBarra(!e.isIntersecting && e.boundingClientRect.top < 0))
    io.observe(el)
    return () => io.disconnect()
  }, [v])

  const kit = useMemo(() => v?.kits.find(k => k.codigo === kitSel) ?? null, [v, kitSel])
  const meses = kit && parcela ? mesesParaQuitar(kit.preco_total, parcela) : 0
  const destaque = v?.fotos.find(f => f.destaque) ?? null
  const galeria = v?.fotos.filter(f => f !== destaque) ?? []
  const loja = v?.loja

  function escolherKit(k: Kit) {
    setKitSel(k.codigo)
    if (!k.parcelas.includes(parcela)) setParcela(k.parcelas.includes(200) ? 200 : k.parcelas[0])
  }
  function comecar() {
    if (kit && parcela) router.push(`/minha-pia/aderir?kit=${kit.codigo}&parcela=${parcela}`)
  }

  const msgWhats = kit
    ? `Olá! Vi a Pia Programada e tenho interesse na ${kit.nome} em ${fmtReais(parcela)}/mês. Pode me ajudar?`
    : 'Olá! Tenho uma dúvida sobre a Pia Programada.'
  const anosMercado = loja?.fundada_ano ? new Date().getFullYear() - loja.fundada_ano : null
  const mapa = loja?.endereco ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${loja.nome}, ${loja.endereco}, ${loja.cidade ?? ''} ${loja.estado ?? ''}`)}` : null

  return (
    <>
      <Topo direita={<Link href="/minha-pia/entrar" className="mp-link-topo">Já tenho plano</Link>} />
      <main className="mp-coluna">
        {/* ── Primeira tela: simulador ── */}
        <section style={{ paddingTop: 8, paddingBottom: 32 }}>
          {destaque && (
            <figure className="mp-hero-foto">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={destaque.url} alt={destaque.legenda ?? 'Pia de granito instalada pela marmoraria'} />
              {destaque.legenda && <figcaption>{destaque.legenda}</figcaption>}
            </figure>
          )}
          <h1 className="mp-h1">Sua pia de granito instalada, pagando por mês.</h1>
          <p className="mp-lead">Escolha a pedra e a parcela. Quando completar o valor, a gente mede, produz e instala na sua casa.</p>

          {erro && <div className="mp-erro" style={{ marginTop: 16 }}>Não conseguimos carregar as opções. Atualize a página.</div>}
          {!v && !erro && <div className="mp-carregando">Carregando…</div>}

          {v && kit && (
            <div className="mp-simulador">
              {!destaque && <div style={{ marginBottom: 22 }}><Bancada codigo={kit.codigo} rotulo={`Bancada de ${kit.material_nome} de 2,50 m com cuba`} /></div>}

              <div className="mp-pedras" role="group" aria-label="Escolha a pedra">
                {v.kits.map(k => (
                  <button key={k.codigo} type="button" className="mp-pedra-op" aria-pressed={kitSel === k.codigo} onClick={() => escolherKit(k)}>
                    <span className={`amostra pedra-${k.codigo}`} />
                    <span className="nome">{k.material_nome}</span>
                    <span className="grupo">{k.grupo === 'alto' ? 'Alto padrão' : 'Médio padrão'}</span>
                  </button>
                ))}
              </div>

              <div className="mp-preco-mes num">
                <strong>{fmtReais(parcela)}</strong><span>por mês</span>
              </div>
              <p className="mp-mini" style={{ marginBottom: 14 }}>
                {kit.nome}, {fmtReais(kit.preco_total)} no total em {meses} meses.
              </p>

              <div className={kit.parcelas.length === 4 ? 'mp-fichas-4' : 'mp-fichas'} role="group" aria-label="Valor da parcela">
                {kit.parcelas.map(p => (
                  <button key={p} type="button" className="mp-ficha num" aria-pressed={parcela === p} onClick={() => setParcela(p)}>
                    {fmtReais(p)}<small>{mesesParaQuitar(kit.preco_total, p)} meses</small>
                  </button>
                ))}
              </div>

              <p className="mp-p" style={{ margin: '16px 0 18px' }}>
                Sua pia fica pronta por volta de <strong>{previsaoInstalacao(meses, v.prazo_entrega_dias)}</strong>. Adiantando parcelas, chega antes.
              </p>

              {v.ativo ? (
                <button ref={ctaRef} type="button" className="mp-btn mp-btn-primario mp-btn-cheio num" onClick={comecar}>
                  Começar com {fmtReais(parcela)}/mês
                </button>
              ) : (
                <div className="mp-aviso mp-aviso-oferta">As vagas deste mês estão preenchidas. Fale com a gente no WhatsApp para entrar na próxima turma.</div>
              )}

              <ul className="mp-selos">
                <li>Sem cartão</li>
                <li>Sem consulta ao SPC</li>
                <li>Pagamento no Pix</li>
                <li>Sem juros</li>
              </ul>
            </div>
          )}
        </section>

        {/* ── Quem faz a sua pia ── */}
        {loja && (
          <section className="mp-secao mp-loja">
            <h2 className="mp-h2" style={{ marginBottom: 0 }}>Quem faz a sua pia</h2>
            <p className="mp-p">
              A {loja.nome} fabrica e instala sua pia. Você paga direto para a marmoraria, sem intermediário, e acompanha cada pagamento e cada etapa da obra pelo celular.
            </p>
            {(anosMercado || loja.garantia_meses || v!.pias_instaladas > 0 || v!.prazo_entrega_dias) && (
              <div className="mp-loja-fatos">
                {anosMercado != null && anosMercado > 0 && <div><strong className="num">{anosMercado} anos</strong><span>trabalhando com pedra, desde {loja.fundada_ano}</span></div>}
                {loja.garantia_meses && <div><strong className="num">{loja.garantia_meses} meses</strong><span>de garantia na instalação</span></div>}
                {v!.pias_instaladas > 0 && <div><strong className="num">{v!.pias_instaladas}</strong><span>{v!.pias_instaladas === 1 ? 'pia instalada' : 'pias instaladas'} pelo programa</span></div>}
                <div><strong className="num">{v!.prazo_entrega_dias} dias</strong><span>{v!.prazo_baseado_em_entregas ? 'em média' : 'no máximo'} da quitação à instalação</span></div>
              </div>
            )}
            <address className="mp-endereco">
              <strong>{loja.nome}</strong><br />
              {loja.endereco && <>{loja.endereco}, {loja.cidade}–{loja.estado}<br /></>}
              {loja.cnpj && <>CNPJ {fmtCnpj(loja.cnpj)}<br /></>}
              {loja.horario_atendimento && <>{loja.horario_atendimento}<br /></>}
              {mapa && <a href={mapa} target="_blank" rel="noopener noreferrer">Ver no mapa</a>}
              {loja.instagram && <>{mapa ? ', ' : ''}<a href={`https://instagram.com/${loja.instagram}`} target="_blank" rel="noopener noreferrer">@{loja.instagram} no Instagram</a></>}
            </address>
            <p className="mp-mini">Pode visitar a loja e ver as pedras de perto antes de começar.</p>
          </section>
        )}

        {/* ── Galeria (aparece quando houver fotos) ── */}
        {galeria.length > 0 && (
          <section className="mp-secao">
            <h2 className="mp-h2">Pias que já instalamos</h2>
            <div className="mp-galeria">
              {galeria.map(f => (
                <figure key={f.url}>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={f.url} alt={f.legenda ?? 'Pia instalada'} loading="lazy" />
                  {f.legenda && <figcaption>{f.legenda}</figcaption>}
                </figure>
              ))}
            </div>
          </section>
        )}

        <section className="mp-secao">
          <h2 className="mp-h2">Como funciona</h2>
          <ol className="mp-passos">
            <li><div><h3 className="mp-h3">Escolha a pedra e a parcela</h3><p className="mp-p">O cadastro leva uns 3 minutos. A primeira parcela é paga no Pix na hora.</p></div></li>
            <li><div><h3 className="mp-h3">Pague por mês e acompanhe</h3><p className="mp-p">No seu painel você vê quanto já pagou, quanto falta e pode adiantar quando quiser.</p></div></li>
            <li><div><h3 className="mp-h3">Completou, a gente instala</h3><p className="mp-p">Medimos, produzimos e instalamos em até {v?.prazo_entrega_dias ?? 20} dias. Você acompanha cada etapa.</p></div></li>
          </ol>
        </section>

        {kit && (
          <section className="mp-secao">
            <h2 className="mp-h2">O que vem na sua pia</h2>
            <ul className="mp-inclui">{kit.inclui.map(i => <li key={i}>{i}</li>)}</ul>
            <p className="mp-mini" style={{ marginTop: 12 }}>
              Sua cozinha é maior, em L ou precisa de outro recorte? Na medição a gente orça a diferença, e você aprova antes de produzir.
            </p>
          </section>
        )}

        <section className="mp-secao">
          <h2 className="mp-h2">Onde atendemos</h2>
          <p className="mp-p">{v ? v.cidades_atendidas.join(', ') + '.' : 'Carregando…'}</p>
          <p className="mp-mini" style={{ marginTop: 8 }}>Mora em outra cidade? Deixe seu contato no cadastro e avisamos quando chegarmos aí.</p>
        </section>

        <section className="mp-secao mp-perguntas" id="perguntas">
          <h2 className="mp-h2">Perguntas frequentes</h2>
          {regrasDoPlano(v?.prazo_entrega_dias ?? 20).map(r => (
            <details key={r.pergunta}><summary>{r.pergunta}</summary><div>{r.resposta}</div></details>
          ))}
          {v && linkWhatsapp(v.whatsapp_contato, msgWhats) && (
            <p style={{ marginTop: 20 }}>Ficou alguma dúvida? <a href={linkWhatsapp(v.whatsapp_contato, msgWhats)!} target="_blank" rel="noopener noreferrer">Fale com a gente no WhatsApp</a>.</p>
          )}
        </section>

        {v?.ativo && kit && (
          <section className="mp-secao" style={{ paddingBottom: 96 }}>
            <button type="button" className="mp-btn mp-btn-primario mp-btn-cheio num" onClick={comecar}>Começar com {fmtReais(parcela)}/mês</button>
          </section>
        )}
      </main>

      {v?.ativo && kit && (
        <div className={`mp-barra-fixa-v2${barra ? ' on' : ''}`} aria-hidden={!barra}>
          <div>
            <div className="info num"><strong>{fmtReais(parcela)}/mês</strong>{kit.material_nome}, {meses} meses</div>
            <button type="button" className="mp-btn mp-btn-primario" tabIndex={barra ? 0 : -1} onClick={comecar}>Começar</button>
          </div>
        </div>
      )}
      <WhatsFlutuante numero={v?.whatsapp_contato} mensagem={msgWhats} acimaDaBarra={barra} />
    </>
  )
}
