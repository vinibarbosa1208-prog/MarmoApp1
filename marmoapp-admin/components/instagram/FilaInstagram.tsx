'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import type { PostIG } from '@/lib/instagram'

const ROTULO: Record<PostIG['status'], { t: string; c: string }> = {
  rascunho: { t: 'Aguardando aprovação', c: 'bg-gray-100 text-gray-700 border-gray-200' },
  aprovado: { t: 'Aprovado: sai sozinho', c: 'bg-[rgba(201,168,76,0.15)] text-gold-dk border-[rgba(201,168,76,0.45)]' },
  publicando: { t: 'Publicando…', c: 'bg-blue-50 text-blue-700 border-blue-200' },
  publicado: { t: 'Publicado', c: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
  erro: { t: 'Erro', c: 'bg-red-50 text-red-700 border-red-200' },
  cancelado: { t: 'Cancelado', c: 'bg-gray-50 text-gray-400 border-gray-200' },
}

const fmt = (d: string) =>
  new Intl.DateTimeFormat('pt-BR', { timeZone: 'America/Sao_Paulo', weekday: 'short', day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }).format(new Date(d))

// datetime-local em horário de Brasília
const paraCampo = (d: string) => {
  const p = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Sao_Paulo', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hour12: false }).formatToParts(new Date(d))
  const g = (t: string) => p.find((x) => x.type === t)?.value ?? ''
  return `${g('year')}-${g('month')}-${g('day')}T${g('hour')}:${g('minute')}`
}

export default function FilaInstagram({ posts, agora }: { posts: PostIG[]; agora: string }) {
  const router = useRouter()
  const [ocupado, setOcupado] = useState<string | null>(null)
  const [erro, setErro] = useState('')
  const [editando, setEditando] = useState<string | null>(null)
  const [legenda, setLegenda] = useState('')
  const [quando, setQuando] = useState('')

  async function patch(id: string, corpo: Record<string, unknown>) {
    setOcupado(id)
    setErro('')
    const r = await fetch(`/api/instagram/posts/${id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(corpo) })
    const j = await r.json().catch(() => ({}))
    setOcupado(null)
    if (!r.ok) setErro(j.error ?? 'Não foi possível salvar.')
    else {
      setEditando(null)
      router.refresh()
    }
    return r.ok
  }

  const pendentes = posts.filter((p) => p.status === 'rascunho' && Date.parse(p.publicar_em) > Date.parse(agora))
  async function aprovarTodos() {
    for (const p of pendentes) if (!(await patch(p.id, { acao: 'aprovar' }))) break
  }

  if (!posts.length) return <div className="card p-6 text-sm text-gray-500">Nenhum post na fila.</div>

  return (
    <div className="space-y-4">
      {erro && <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{erro}</p>}
      {pendentes.length > 0 && (
        <div className="card flex flex-wrap items-center justify-between gap-3 p-4">
          <p className="text-sm text-gray-700">
            <b>{pendentes.length}</b> post(s) esperando a sua aprovação.
          </p>
          <button className="btn-gold" disabled={!!ocupado} onClick={aprovarTodos}>
            Aprovar todos
          </button>
        </div>
      )}
      {posts.map((p) => {
        const r = ROTULO[p.status]
        const mutavel = p.status !== 'publicado' && p.status !== 'publicando'
        return (
          <div key={p.id} className="card flex flex-col gap-4 p-4 md:flex-row">
            <div className="w-full shrink-0 md:w-40">
              {/\.(mp4|mov)(\?|$)/i.test(p.midia_url) ? (
                <video src={p.midia_url} controls preload="metadata" className="aspect-[9/16] w-full rounded-lg bg-black object-cover" />
              ) : (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={p.midia_url} alt="" className="aspect-[9/16] w-full rounded-lg object-cover" />
              )}
            </div>
            <div className="min-w-0 flex-1 space-y-2">
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-xs font-bold uppercase tracking-wider text-gray-400">{p.tipo === 'reels' ? 'Reels' : p.tipo === 'story' ? 'Stories' : 'Imagem'}</span>
                <span className={`rounded-full border px-2.5 py-0.5 text-xs font-medium ${r.c}`}>{r.t}</span>
                <span className="text-sm font-semibold text-gray-900">{fmt(p.publicar_em)}</span>
              </div>
              <h3 className="font-serif text-lg font-semibold text-gray-900">{p.titulo}</h3>
              {editando === p.id ? (
                <div className="space-y-2">
                  <input type="datetime-local" className="campo w-60" value={quando} onChange={(e) => setQuando(e.target.value)} />
                  <textarea className="campo min-h-40" value={legenda} onChange={(e) => setLegenda(e.target.value)} />
                  <div className="flex gap-2">
                    <button className="btn-gold btn-sm" disabled={ocupado === p.id} onClick={() => patch(p.id, { legenda, publicar_em: new Date(quando + ':00-03:00').toISOString() })}>
                      Salvar
                    </button>
                    <button className="btn-outline btn-sm" onClick={() => setEditando(null)}>
                      Voltar
                    </button>
                  </div>
                </div>
              ) : (
                <p className="whitespace-pre-wrap text-sm text-gray-600">{p.legenda || <i className="text-gray-400">sem legenda</i>}</p>
              )}
              {p.erro && <p className="rounded border border-red-200 bg-red-50 px-2 py-1 text-xs text-red-700">{p.erro}</p>}
              {p.permalink && (
                <a href={p.permalink} target="_blank" rel="noopener" className="text-sm font-medium text-gold-dk hover:underline">
                  Ver no Instagram →
                </a>
              )}
              {mutavel && editando !== p.id && (
                <div className="flex flex-wrap gap-2 pt-1">
                  {p.status !== 'aprovado' && p.status !== 'cancelado' && (
                    <button className="btn-gold btn-sm" disabled={ocupado === p.id} onClick={() => patch(p.id, { acao: 'aprovar' })}>
                      Aprovar
                    </button>
                  )}
                  {p.status === 'cancelado' && (
                    <button className="btn-outline btn-sm" disabled={ocupado === p.id} onClick={() => patch(p.id, { acao: 'rascunho' })}>
                      Reativar
                    </button>
                  )}
                  {p.status === 'aprovado' && (
                    <button className="btn-outline btn-sm" disabled={ocupado === p.id} onClick={() => patch(p.id, { acao: 'rascunho' })}>
                      Segurar
                    </button>
                  )}
                  <button
                    className="btn-outline btn-sm"
                    onClick={() => {
                      setEditando(p.id)
                      setLegenda(p.legenda)
                      setQuando(paraCampo(p.publicar_em))
                    }}
                  >
                    Editar
                  </button>
                  <button
                    className="btn-outline btn-sm"
                    disabled={ocupado === p.id}
                    onClick={() => {
                      if (confirm(`Publicar "${p.titulo}" agora?`)) patch(p.id, { acao: 'agora' })
                    }}
                  >
                    Publicar agora
                  </button>
                  {p.status !== 'cancelado' && (
                    <button className="btn-outline btn-sm" disabled={ocupado === p.id} onClick={() => patch(p.id, { acao: 'cancelar' })}>
                      Cancelar
                    </button>
                  )}
                </div>
              )}
            </div>
          </div>
        )
      })}
    </div>
  )
}
