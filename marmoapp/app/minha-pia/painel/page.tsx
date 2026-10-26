'use client'

import { Suspense, useCallback, useEffect, useRef, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { Bancada, Topo, linkWhatsapp } from '../_componentes'
import {
  fmtReais, fmtData, fmtMesAno, STATUS_PAGANDO, ETAPAS_OBRA, ANTECIPACAO_MINIMA,
  type StatusAdesao, type ResumoAdesao,
} from '@/lib/minha-pia/regras'

interface Cobranca {
  id: string; tipo: 'parcela' | 'antecipacao' | 'quitacao'; valor: number; vencimento: string
  forma: string; pix_copia_cola: string | null; pix_qr_base64: string | null; invoice_url: string | null
}
interface Painel {
  marmoraria: string
  config: { nome_programa: string; whatsapp_contato: string | null; prazo_entrega_dias: number; modo_pagamento: 'asaas' | 'manual'; pix_chave: string | null; pix_favorecido: string | null }
  adesao: {
    numero: number; primeiro_nome: string; kit_nome: string; valor_total: number; valor_parcela: number; dia_vencimento: number
    status: StatusAdesao; bairro: string | null; cidade: string; created_at: string; quitada_em: string | null
    medicao_data: string | null; instalacao_data: string | null; instalada_em: string | null
    antecipacao_solicitada_em: string | null; oferta_mensagem: string | null; oferta_validade: string | null
  }
  kit: { codigo: string; material_nome: string; inclui: string[] } | null
  resumo: ResumoAdesao
  antecipacao_disponivel: boolean
  posicao_fila: number | null
  cobranca_aberta: Cobranca | null
  pagamentos: { id: string; tipo: string; valor: number; desconto_aplicado: number; pago_em: string | null }[]
}

const TIPO_LABEL: Record<string, string> = { parcela: 'Parcela', antecipacao: 'Valor adiantado', quitacao: 'Quitação', ajuste: 'Ajuste' }

function PixBox({ c, painel, onAtualizar }: { c: Cobranca; painel: Painel; onAtualizar: () => void }) {
  const [copiado, setCopiado] = useState(false)
  const manual = c.forma === 'manual'
  const chave = manual ? painel.config.pix_chave : c.pix_copia_cola
  const whats = linkWhatsapp(painel.config.whatsapp_contato,
    `Olá! Segue o comprovante do Pix de ${fmtReais(c.valor, true)} do meu plano #${painel.adesao.numero} (${painel.adesao.primeiro_nome}).`)

  async function copiar() {
    if (!chave) return
    try { await navigator.clipboard.writeText(chave); setCopiado(true); setTimeout(() => setCopiado(false), 2500) } catch { /* sem permissão */ }
  }

  return (
    <div style={{ marginTop: 16 }}>
      <p style={{ fontWeight: 700 }} className="num">Pix de {fmtReais(c.valor, true)}</p>
      {!manual && c.pix_qr_base64 && (
        // eslint-disable-next-line @next/next/no-img-element -- QR em base64 vindo do Asaas
        <img className="mp-pix-qr" src={`data:image/png;base64,${c.pix_qr_base64}`} alt="QR Code do Pix" />
      )}
      {chave ? (
        <>
          <p className="mp-mini" style={{ margin: '8px 0 6px' }}>
            {manual ? `Chave Pix${painel.config.pix_favorecido ? ` (${painel.config.pix_favorecido})` : ''}:` : 'Ou copie o código e cole no app do seu banco, em “Pix copia e cola”:'}
          </p>
          <div className="mp-copia">
            <input className="mp-input" readOnly value={chave} onFocus={e => e.currentTarget.select()} aria-label="Código Pix" />
            <button type="button" className="mp-btn mp-btn-sec" onClick={copiar}>{copiado ? 'Copiado' : 'Copiar'}</button>
          </div>
        </>
      ) : (
        <p className="mp-mini">O código do Pix está sendo gerado. Toque em “Atualizar” em alguns segundos.</p>
      )}
      {manual ? (
        <p className="mp-mini" style={{ marginTop: 12 }}>
          Depois de pagar, envie o comprovante no WhatsApp. Confirmamos e o valor aparece aqui no seu painel.
          {whats && <><br /><a href={whats} target="_blank" rel="noopener noreferrer">Enviar comprovante</a></>}
        </p>
      ) : (
        <p className="mp-mini" style={{ marginTop: 12 }}>Assim que o banco confirmar, o valor aparece aqui sozinho.</p>
      )}
      <button type="button" className="mp-btn-texto" onClick={onAtualizar}>Atualizar</button>
    </div>
  )
}

function Conteudo() {
  const router = useRouter()
  const sp = useSearchParams()
  const [p, setP] = useState<Painel | null>(null)
  const [erro, setErro] = useState('')
  const [gerando, setGerando] = useState(false)
  const [adiantar, setAdiantar] = useState('')
  const [mostrarAdiantar, setMostrarAdiantar] = useState(false)
  const [pediuAntecipar, setPediuAntecipar] = useState(false)
  const inicioPoll = useRef(0)

  const carregar = useCallback(async () => {
    const r = await fetch('/api/minha-pia/painel', { cache: 'no-store' })
    if (r.status === 401) { router.replace('/minha-pia/entrar'); return }
    if (!r.ok) { setErro('Não conseguimos carregar seu plano. Atualize a página.'); return }
    setP(await r.json())
  }, [router])

  useEffect(() => { carregar() }, [carregar])

  // Enquanto há um Pix em aberto, confere a cada 8 s (por até 15 min).
  useEffect(() => {
    if (!p?.cobranca_aberta || p.cobranca_aberta.forma === 'manual') return
    if (!inicioPoll.current) inicioPoll.current = Date.now()
    const t = setInterval(() => {
      if (Date.now() - inicioPoll.current > 15 * 60_000) return clearInterval(t)
      carregar()
    }, 8000)
    return () => clearInterval(t)
  }, [p?.cobranca_aberta, carregar])

  async function gerar(tipo: 'parcela' | 'antecipacao' | 'quitacao', valor?: number) {
    setErro('')
    setGerando(true)
    try {
      const r = await fetch('/api/minha-pia/cobranca', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ tipo, valor }),
      })
      const j = await r.json()
      if (!r.ok) throw new Error(j.error)
      inicioPoll.current = Date.now()
      setMostrarAdiantar(false)
      await carregar()
      setTimeout(() => document.getElementById('pagar')?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 50)
    } catch (e) {
      setErro(e instanceof Error && e.message ? e.message : 'Não foi possível gerar o Pix.')
    } finally {
      setGerando(false)
    }
  }

  async function pedirAntecipacao() {
    const r = await fetch('/api/minha-pia/antecipar', { method: 'POST' })
    if (r.ok) { setPediuAntecipar(true); carregar() }
  }

  async function sair() {
    await fetch('/api/minha-pia/sair', { method: 'POST' })
    router.replace('/minha-pia/entrar')
  }

  if (!p) return <main className="mp-coluna"><div className="mp-carregando">{erro || 'Carregando seu plano…'}</div></main>

  const { adesao: a, resumo: r } = p
  const pagando = STATUS_PAGANDO.includes(a.status)
  const aberta = p.cobranca_aberta
  const whats = linkWhatsapp(p.config.whatsapp_contato, `Olá! Sou ${a.primeiro_nome}, plano #${a.numero} da Pia Programada.`)
  const idxEtapa = ETAPAS_OBRA.findIndex(e => e.status === a.status)
  const dataEtapa: Partial<Record<StatusAdesao, string | null>> = {
    quitada: a.quitada_em, medicao_agendada: a.medicao_data, instalacao_agendada: a.instalacao_data, instalada: a.instalada_em,
  }

  return (
    <main className="mp-coluna">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 12, marginTop: 8 }}>
        <h1 className="mp-h2" style={{ margin: 0 }}>Olá, {a.primeiro_nome}</h1>
        <button type="button" className="mp-btn-texto" onClick={sair}>Sair</button>
      </div>
      <p className="mp-mini">{a.kit_nome}, plano #{a.numero}</p>

      {sp.get('novo') && a.status === 'aguardando_pagamento' && (
        <div className="mp-aviso mp-aviso-ok" style={{ marginTop: 16 }}>Seu plano foi criado. Pague a 1ª parcela abaixo para garantir o preço.</div>
      )}

      <section style={{ margin: '24px 0 8px' }}>
        <Bancada codigo={p.kit?.codigo ?? 'medio-ubatuba'} progresso={r.progresso} rotulo={`Sua pia: ${r.progresso}% paga`} />
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', gap: 12, marginTop: 20 }}>
          <div>
            <div className="mp-mini">Você já pagou</div>
            <div className="mp-valor-grande num">{fmtReais(r.pago)}</div>
          </div>
          <div style={{ textAlign: 'right' }}>
            <div className="mp-mini">de {fmtReais(a.valor_total)}</div>
            <div style={{ fontWeight: 700, fontSize: 20 }} className="num">{r.progresso}%</div>
          </div>
        </div>
        {pagando && r.saldo > 0 && (
          <p className="mp-p" style={{ marginTop: 8 }}>
            Faltam <strong className="num">{fmtReais(r.saldo)}</strong> para sua pia.
            {r.previsaoInstalacao && <> No ritmo atual, ela fica pronta em <strong>{fmtMesAno(r.previsaoInstalacao)}</strong>.</>}
          </p>
        )}
      </section>

      {erro && <div className="mp-erro" role="alert" style={{ marginTop: 16 }}>{erro}</div>}

      {pagando && (
        <>
          {r.ofertaAtiva && (
            <div className="mp-aviso mp-aviso-oferta" style={{ marginTop: 20 }}>
              <strong>Oferta para você:</strong> quite hoje por <strong className="num">{fmtReais(r.valorQuitarHoje)}</strong> em vez de {fmtReais(r.saldo)}.
              {a.oferta_mensagem && <> {a.oferta_mensagem}</>}
              {a.oferta_validade && <> Válida até {fmtData(a.oferta_validade)}.</>}
            </div>
          )}

          {p.antecipacao_disponivel && (
            <div className="mp-aviso mp-aviso-ok" style={{ marginTop: 14 }}>
              {a.antecipacao_solicitada_em || pediuAntecipar ? (
                <>Recebemos seu pedido para antecipar a pia. Vamos falar com você pelo WhatsApp.</>
              ) : (
                <>
                  <strong>Você já pode pedir para antecipar sua pia.</strong> Com o que já pagou, conseguimos avaliar uma condição especial para instalar antes.
                  <div><button type="button" className="mp-btn-texto" onClick={pedirAntecipacao}>Quero antecipar minha pia</button></div>
                </>
              )}
            </div>
          )}

          <div className="mp-placa" id="pagar" style={{ marginTop: 20 }}>
            {aberta ? (
              <>
                <h2 className="mp-h3">{aberta.tipo === 'parcela' ? 'Pagar parcela' : aberta.tipo === 'quitacao' ? 'Quitar minha pia' : 'Adiantar valor'}</h2>
                <PixBox c={aberta} painel={p} onAtualizar={carregar} />
              </>
            ) : r.proximaParcelaValor > 0 ? (
              <>
                <h2 className="mp-h3">Próxima parcela</h2>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', margin: '8px 0 14px' }}>
                  <span style={{ fontSize: 26, fontWeight: 800 }} className="num">{fmtReais(r.proximaParcelaValor, true)}</span>
                  <span className={r.atrasada ? '' : 'mp-mini'} style={r.atrasada ? { color: 'var(--mp-alerta)', fontWeight: 700 } : undefined}>
                    {r.atrasada ? `Venceu em ${fmtData(r.proximaParcelaVencimento, false)}` : `Vence em ${fmtData(r.proximaParcelaVencimento, false)}`}
                  </span>
                </div>
                <button type="button" className="mp-btn mp-btn-primario mp-btn-cheio" disabled={gerando} onClick={() => gerar('parcela')}>
                  {gerando ? 'Gerando Pix…' : 'Pagar com Pix'}
                </button>
                {r.atrasada && <p className="mp-mini" style={{ marginTop: 10 }}>Sem multa e sem juros. Sua pia só é instalada quando o valor completar.</p>}
              </>
            ) : null}
          </div>

          {r.saldo > 0 && (
            <div className="mp-placa">
              <h2 className="mp-h3">Quer sua pia antes?</h2>
              <p className="mp-mini" style={{ marginBottom: 14 }}>Quem paga antes entra antes na fila de produção.</p>
              <button type="button" className="mp-btn mp-btn-primario mp-btn-cheio num" disabled={gerando} onClick={() => gerar('quitacao')}>
                Quitar agora por {fmtReais(r.valorQuitarHoje, true)}
              </button>
              {mostrarAdiantar ? (
                <div style={{ marginTop: 14 }}>
                  <label className="mp-campo">
                    <span className="mp-rotulo">Quanto quer adiantar?</span>
                    <input className="mp-input num" inputMode="decimal" placeholder={`A partir de R$ ${ANTECIPACAO_MINIMA}`} value={adiantar}
                      onChange={e => setAdiantar(e.target.value.replace(/[^\d,]/g, ''))} />
                  </label>
                  <button type="button" className="mp-btn mp-btn-sec mp-btn-cheio" disabled={gerando}
                    onClick={() => gerar('antecipacao', Number(adiantar.replace(',', '.')))}>
                    Gerar Pix do valor
                  </button>
                </div>
              ) : (
                <button type="button" className="mp-btn mp-btn-sec mp-btn-cheio" style={{ marginTop: 10 }} onClick={() => setMostrarAdiantar(true)}>
                  Adiantar um valor
                </button>
              )}
            </div>
          )}

          <dl className="mp-dados mp-placa">
            <dt>Parcelas pagas</dt><dd className="num">{r.parcelasPagas} de {r.parcelasTotal}</dd>
            <dt>Valor da parcela</dt><dd className="num">{fmtReais(a.valor_parcela)}</dd>
            <dt>Vencimento</dt><dd>todo dia {a.dia_vencimento}</dd>
            {r.previsaoQuitacao && <><dt>Previsão de quitação</dt><dd>{fmtMesAno(r.previsaoQuitacao)}</dd></>}
            <dt>Instalação</dt><dd>até {p.config.prazo_entrega_dias} dias após quitar</dd>
          </dl>
        </>
      )}

      {!pagando && a.status !== 'cancelada' && (
        <section className="mp-placa" style={{ marginTop: 20 }}>
          <h2 className="mp-h3" style={{ marginBottom: 16 }}>Andamento da sua pia</h2>
          {p.posicao_fila && <p className="mp-aviso mp-aviso-ok" style={{ marginBottom: 18 }}>Você é o {p.posicao_fila}º da fila de produção.</p>}
          <ol className="mp-tempo">
            {ETAPAS_OBRA.map((e, i) => {
              const estado = i < idxEtapa || a.status === 'instalada' ? 'feito' : i === idxEtapa ? 'atual' : 'futuro'
              const data = dataEtapa[e.status]
              return (
                <li key={e.status} className={estado}>
                  <span className="mp-tempo-marca" aria-hidden />
                  <div style={{ fontWeight: 700 }}>{e.titulo}{data ? `, ${fmtData(data)}` : ''}</div>
                  <div className="mp-mini">{e.texto}</div>
                </li>
              )
            })}
          </ol>
        </section>
      )}

      {a.status === 'cancelada' && <div className="mp-aviso mp-aviso-atraso" style={{ marginTop: 20 }}>Este plano foi cancelado. Fale com a gente se tiver dúvidas.</div>}

      <section className="mp-secao" style={{ marginTop: 24 }}>
        <h2 className="mp-h3" style={{ marginBottom: 8 }}>Pagamentos</h2>
        {p.pagamentos.length === 0 ? (
          <p className="mp-mini">Nenhum pagamento confirmado ainda.</p>
        ) : (
          <ul className="mp-historico">
            {p.pagamentos.map(pg => (
              <li key={pg.id}>
                <span>{TIPO_LABEL[pg.tipo] ?? pg.tipo}<br /><span className="mp-mini">{fmtData(pg.pago_em)}</span></span>
                <span className="num" style={{ fontWeight: 650, textAlign: 'right' }}>
                  {fmtReais(pg.valor, true)}
                  {pg.desconto_aplicado > 0 && <><br /><span className="mp-mini">+ {fmtReais(pg.desconto_aplicado, true)} de desconto</span></>}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>

      {p.kit && (
        <section className="mp-secao">
          <h2 className="mp-h3" style={{ marginBottom: 8 }}>Sua pia</h2>
          <ul className="mp-inclui">{p.kit.inclui.map(i => <li key={i}>{i}</li>)}</ul>
          <p className="mp-mini" style={{ marginTop: 10 }}>Instalação em {a.bairro ? `${a.bairro}, ` : ''}{a.cidade}.</p>
        </section>
      )}

      {whats && (
        <section className="mp-secao">
          <a className="mp-btn mp-btn-sec mp-btn-cheio" href={whats} target="_blank" rel="noopener noreferrer">Falar com a {p.marmoraria || 'marmoraria'} no WhatsApp</a>
        </section>
      )}
    </main>
  )
}

export default function PainelPage() {
  return (
    <>
      <Topo />
      <Suspense fallback={<div className="mp-carregando">Carregando…</div>}>
        <Conteudo />
      </Suspense>
    </>
  )
}
