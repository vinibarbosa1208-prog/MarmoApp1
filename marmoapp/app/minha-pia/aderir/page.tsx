'use client'

import { Suspense, useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import { Bancada, Topo, WhatsFlutuante, lerUtm } from '../_componentes'
import { cpfValido, whatsappValido, fmtCpf, fmtFone, fmtReais, mesesParaQuitar, soDigitos } from '@/lib/minha-pia/regras'

interface Kit { codigo: string; nome: string; preco_total: number; parcelas: number[] }
interface Vitrine { cidades_atendidas: string[]; kits: Kit[]; prazo_entrega_dias: number; whatsapp_contato: string | null }

const OUTRA = '__outra__'
const DIAS = [5, 10, 15, 20, 25]

function Formulario() {
  const router = useRouter()
  const sp = useSearchParams()
  const [v, setV] = useState<Vitrine | null>(null)
  const [etapa, setEtapa] = useState(1)
  const [erro, setErro] = useState('')
  const [jaCadastrado, setJaCadastrado] = useState(false)
  const [enviando, setEnviando] = useState(false)
  const [esperaOk, setEsperaOk] = useState(false)
  const [f, setF] = useState({
    kit: sp.get('kit') || '', parcela: Number(sp.get('parcela')) || 0,
    nome: '', cpf: '', whatsapp: '', email: '',
    cidade: '', outraCidade: '', cep: '', endereco: '', numero: '', complemento: '', bairro: '',
    dia: 10, pin: '', pin2: '', aceite: false,
  })
  const set = <K extends keyof typeof f>(k: K, val: (typeof f)[K]) => setF(p => ({ ...p, [k]: val }))

  useEffect(() => {
    fetch('/api/minha-pia/vitrine').then(r => r.json()).then((d: Vitrine) => {
      setV(d)
      setF(p => {
        const kit = d.kits.find(k => k.codigo === p.kit) ?? d.kits[0]
        const parcela = kit?.parcelas.includes(p.parcela) ? p.parcela : (kit?.parcelas.includes(200) ? 200 : kit?.parcelas[0] ?? 0)
        return { ...p, kit: kit?.codigo ?? '', parcela }
      })
    }).catch(() => setErro('Não conseguimos carregar as opções. Atualize a página.'))
  }, [])

  const kit = v?.kits.find(k => k.codigo === f.kit)

  async function buscarCep(cep: string) {
    const d = soDigitos(cep)
    if (d.length !== 8) return
    try {
      const r = await fetch(`https://viacep.com.br/ws/${d}/json/`)
      const j = await r.json()
      if (j.erro) return
      setF(p => ({ ...p, endereco: p.endereco || j.logradouro || '', bairro: p.bairro || j.bairro || '' }))
    } catch { /* digita à mão */ }
  }

  function avancar() {
    setErro('')
    if (etapa === 1) {
      if (f.nome.trim().split(/\s+/).length < 2) return setErro('Escreva seu nome completo.')
      if (!cpfValido(f.cpf)) return setErro('Confira o CPF. Ele precisa ter 11 números válidos.')
      if (!whatsappValido(f.whatsapp)) return setErro('Confira o WhatsApp: DDD + número com 9 dígitos.')
    }
    if (etapa === 2) {
      if (!f.cidade) return setErro('Escolha sua cidade.')
      if (!f.endereco.trim() || !f.numero.trim() || !f.bairro.trim()) return setErro('Preencha rua, número e bairro.')
    }
    setEtapa(e => e + 1)
    window.scrollTo({ top: 0 })
  }

  async function entrarNaEspera() {
    setErro('')
    if (!f.outraCidade.trim()) return setErro('Escreva o nome da sua cidade.')
    setEnviando(true)
    try {
      const r = await fetch('/api/minha-pia/lista-espera', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ nome: f.nome, whatsapp: f.whatsapp, cidade: f.outraCidade, kit_codigo: f.kit, utm: lerUtm() }),
      })
      if (!r.ok) throw new Error((await r.json()).error)
      setEsperaOk(true)
    } catch (e) {
      setErro(e instanceof Error && e.message ? e.message : 'Não foi possível salvar. Tente de novo.')
    } finally {
      setEnviando(false)
    }
  }

  async function concluir() {
    setErro('')
    setJaCadastrado(false)
    if (!/^\d{4}$/.test(f.pin)) return setErro('O PIN precisa ter 4 números.')
    if (f.pin !== f.pin2) return setErro('Os dois PINs não são iguais.')
    if (!f.aceite) return setErro('Para continuar, aceite as regras do plano.')
    setEnviando(true)
    try {
      const r = await fetch('/api/minha-pia/aderir', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          kit_codigo: f.kit, valor_parcela: f.parcela, dia_vencimento: f.dia,
          nome: f.nome, cpf: f.cpf, whatsapp: f.whatsapp, email: f.email,
          cidade: f.cidade, cep: f.cep, endereco: f.endereco, numero_endereco: f.numero, complemento: f.complemento, bairro: f.bairro,
          pin: f.pin, aceite: true, utm: lerUtm(),
        }),
      })
      const j = await r.json()
      if (!r.ok) {
        if (j.codigo === 'ja_cadastrado') setJaCadastrado(true)
        throw new Error(j.error)
      }
      router.replace('/minha-pia/painel?novo=1')
    } catch (e) {
      setErro(e instanceof Error && e.message ? e.message : 'Não foi possível concluir. Tente de novo.')
      setEnviando(false)
    }
  }

  const foraDaArea = f.cidade === OUTRA

  return (
    <main className="mp-coluna">
      <div className="mp-etapas" aria-label={`Etapa ${etapa} de 3`}>
        {[1, 2, 3].map(n => <span key={n} className={n <= etapa ? 'on' : ''} />)}
      </div>

      {kit && (
        <div style={{ display: 'grid', gridTemplateColumns: '96px 1fr', gap: 14, alignItems: 'center', marginBottom: 24 }}>
          <Bancada codigo={kit.codigo} />
          <div>
            <div style={{ fontWeight: 700 }}>{kit.nome}</div>
            <div className="mp-mini num">{fmtReais(f.parcela)}/mês, {mesesParaQuitar(kit.preco_total, f.parcela)} meses</div>
          </div>
        </div>
      )}

      {erro && (
        <div className="mp-erro" role="alert">
          {erro}{' '}
          {jaCadastrado && <Link href="/minha-pia/entrar">Entrar no meu plano</Link>}
        </div>
      )}

      {etapa === 1 && (
        <section>
          <h1 className="mp-h2">Seus dados</h1>
          <label className="mp-campo">
            <span className="mp-rotulo">Nome completo</span>
            <input className="mp-input" autoComplete="name" value={f.nome} onChange={e => set('nome', e.target.value)} />
          </label>
          <label className="mp-campo">
            <span className="mp-rotulo">CPF</span>
            <input className="mp-input num" inputMode="numeric" autoComplete="off" value={fmtCpf(f.cpf)} onChange={e => set('cpf', soDigitos(e.target.value))} />
            <span className="mp-dica">Você vai usar o CPF para entrar e acompanhar sua pia.</span>
          </label>
          <label className="mp-campo">
            <span className="mp-rotulo">WhatsApp</span>
            <input className="mp-input num" inputMode="tel" autoComplete="tel-national" value={fmtFone(f.whatsapp)} onChange={e => set('whatsapp', soDigitos(e.target.value))} />
            <span className="mp-dica">Avisamos por aqui sobre parcelas, medição e instalação.</span>
          </label>
          <label className="mp-campo">
            <span className="mp-rotulo">E-mail (opcional)</span>
            <input className="mp-input" type="email" autoComplete="email" value={f.email} onChange={e => set('email', e.target.value)} />
          </label>
          <button type="button" className="mp-btn mp-btn-primario mp-btn-cheio" onClick={avancar}>Continuar</button>
        </section>
      )}

      {etapa === 2 && (
        <section>
          <h1 className="mp-h2">Onde a pia vai ser instalada</h1>
          <label className="mp-campo">
            <span className="mp-rotulo">Cidade</span>
            <select className="mp-select" value={f.cidade} onChange={e => set('cidade', e.target.value)}>
              <option value="">Escolha</option>
              {v?.cidades_atendidas.map(c => <option key={c} value={c}>{c}</option>)}
              <option value={OUTRA}>Outra cidade</option>
            </select>
          </label>

          {foraDaArea ? (
            esperaOk ? (
              <div className="mp-aviso mp-aviso-ok" role="status">
                Pronto, {f.nome.split(' ')[0] || 'você'} está na lista. Avisamos pelo WhatsApp quando começarmos a atender {f.outraCidade}.
              </div>
            ) : (
              <>
                <p className="mp-p" style={{ marginBottom: 16 }}>Ainda não instalamos na sua cidade. Deixe o nome dela e avisamos assim que chegarmos aí.</p>
                <label className="mp-campo">
                  <span className="mp-rotulo">Sua cidade</span>
                  <input className="mp-input" value={f.outraCidade} onChange={e => set('outraCidade', e.target.value)} />
                </label>
                <button type="button" className="mp-btn mp-btn-primario mp-btn-cheio" disabled={enviando} onClick={entrarNaEspera}>
                  {enviando ? 'Salvando…' : 'Entrar na lista de espera'}
                </button>
              </>
            )
          ) : (
            <>
              <label className="mp-campo">
                <span className="mp-rotulo">CEP</span>
                <input className="mp-input num" inputMode="numeric" value={f.cep} maxLength={9}
                  onChange={e => set('cep', e.target.value)} onBlur={e => buscarCep(e.target.value)} />
              </label>
              <label className="mp-campo">
                <span className="mp-rotulo">Rua</span>
                <input className="mp-input" autoComplete="address-line1" value={f.endereco} onChange={e => set('endereco', e.target.value)} />
              </label>
              <div className="mp-linha-num">
                <label className="mp-campo">
                  <span className="mp-rotulo">Bairro</span>
                  <input className="mp-input" value={f.bairro} onChange={e => set('bairro', e.target.value)} />
                </label>
                <label className="mp-campo">
                  <span className="mp-rotulo">Número</span>
                  <input className="mp-input" inputMode="numeric" value={f.numero} onChange={e => set('numero', e.target.value)} />
                </label>
              </div>
              <label className="mp-campo">
                <span className="mp-rotulo">Complemento (opcional)</span>
                <input className="mp-input" placeholder="Casa 2, bloco B…" value={f.complemento} onChange={e => set('complemento', e.target.value)} />
              </label>
              <button type="button" className="mp-btn mp-btn-primario mp-btn-cheio" onClick={avancar}>Continuar</button>
            </>
          )}
          <p style={{ marginTop: 12, textAlign: 'center' }}><button type="button" className="mp-btn-texto" onClick={() => setEtapa(1)}>Voltar</button></p>
        </section>
      )}

      {etapa === 3 && kit && (
        <section>
          <h1 className="mp-h2">Seu plano</h1>

          <div className="mp-campo">
            <span className="mp-rotulo">Parcela</span>
            <div className="mp-fichas" role="group" aria-label="Valor da parcela">
              {kit.parcelas.map(p => (
                <button key={p} type="button" className="mp-ficha num" aria-pressed={f.parcela === p} onClick={() => set('parcela', p)}>
                  {fmtReais(p)}/mês<small>{mesesParaQuitar(kit.preco_total, p)} meses</small>
                </button>
              ))}
            </div>
          </div>

          <div className="mp-campo">
            <span className="mp-rotulo">Dia para pagar todo mês</span>
            <div className="mp-fichas" role="group" aria-label="Dia de vencimento">
              {DIAS.map(d => (
                <button key={d} type="button" className="mp-ficha num" style={{ minWidth: 56, textAlign: 'center' }} aria-pressed={f.dia === d} onClick={() => set('dia', d)}>{d}</button>
              ))}
            </div>
            <span className="mp-dica">A primeira parcela é paga hoje, no Pix. As próximas vencem todo dia {f.dia}.</span>
          </div>

          <div className="mp-linha-2">
            <label className="mp-campo">
              <span className="mp-rotulo">Crie um PIN</span>
              <input className="mp-input num" type="password" inputMode="numeric" maxLength={4} autoComplete="new-password"
                value={f.pin} onChange={e => set('pin', soDigitos(e.target.value).slice(0, 4))} />
            </label>
            <label className="mp-campo">
              <span className="mp-rotulo">Repita o PIN</span>
              <input className="mp-input num" type="password" inputMode="numeric" maxLength={4} autoComplete="new-password"
                value={f.pin2} onChange={e => set('pin2', soDigitos(e.target.value).slice(0, 4))} />
            </label>
          </div>
          <p className="mp-dica" style={{ marginTop: -8, marginBottom: 20 }}>4 números para entrar no seu painel junto com o CPF.</p>

          <dl className="mp-dados mp-placa" style={{ marginBottom: 20 }}>
            <dt>Valor total da pia</dt><dd className="num">{fmtReais(kit.preco_total)}</dd>
            <dt>Parcela</dt><dd className="num">{fmtReais(f.parcela)}</dd>
            <dt>Pagar hoje</dt><dd className="num">{fmtReais(Math.min(f.parcela, kit.preco_total))}</dd>
            <dt>Instalação</dt><dd>até {v?.prazo_entrega_dias ?? 20} dias após quitar</dd>
          </dl>

          <label className="mp-check" style={{ marginBottom: 20 }}>
            <input type="checkbox" checked={f.aceite} onChange={e => set('aceite', e.target.checked)} />
            <span>
              Li e aceito as <Link href="/minha-pia#perguntas" target="_blank">regras do plano</Link>: a pia é produzida e instalada depois que o valor total for pago.
            </span>
          </label>

          <button type="button" className="mp-btn mp-btn-primario mp-btn-cheio" disabled={enviando} onClick={concluir}>
            {enviando ? 'Criando seu plano…' : 'Criar meu plano e pagar a 1ª parcela'}
          </button>
          <p style={{ marginTop: 12, textAlign: 'center' }}><button type="button" className="mp-btn-texto" onClick={() => setEtapa(2)}>Voltar</button></p>
        </section>
      )}
      <div style={{ height: 72 }} />
      <WhatsFlutuante numero={v?.whatsapp_contato}
        mensagem={`Olá! Estou fazendo o cadastro da Pia Programada${kit ? ` (${kit.nome}, ${fmtReais(f.parcela)}/mês)` : ''} e tenho uma dúvida.`} />
    </main>
  )
}

export default function AderirPage() {
  return (
    <>
      <Topo direita={<Link href="/minha-pia/entrar" className="mp-link-topo">Já tenho plano</Link>} />
      <Suspense fallback={<div className="mp-carregando">Carregando…</div>}>
        <Formulario />
      </Suspense>
    </>
  )
}
