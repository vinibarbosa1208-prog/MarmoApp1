'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

interface Props {
  defaultValues?: {
    alcance_total: number
    novos_seguidores: number
    engajamento_medio: number
    cliques_bio: number
    leads_gerados: number
  }
}

export default function MarketingMetricasForm({ defaultValues }: Props) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [success, setSuccess] = useState(false)
  const [error, setError] = useState('')

  const [form, setForm] = useState({
    alcance_total: defaultValues?.alcance_total ?? '',
    novos_seguidores: defaultValues?.novos_seguidores ?? '',
    engajamento_medio: defaultValues?.engajamento_medio ?? '',
    cliques_bio: defaultValues?.cliques_bio ?? '',
    leads_gerados: defaultValues?.leads_gerados ?? '',
  })

  function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    setForm((prev) => ({ ...prev, [e.target.name]: e.target.value }))
    setSuccess(false)
    setError('')
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError('')
    setSuccess(false)

    const res = await fetch('/api/metricas/marketing', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        alcance_total: Number(form.alcance_total),
        novos_seguidores: Number(form.novos_seguidores),
        engajamento_medio: Number(form.engajamento_medio),
        cliques_bio: Number(form.cliques_bio),
        leads_gerados: Number(form.leads_gerados),
      }),
    })

    setLoading(false)

    if (!res.ok) {
      const json = await res.json().catch(() => ({}))
      setError(json.error ?? 'Erro ao salvar métricas.')
      return
    }

    setSuccess(true)
    router.refresh()
    setTimeout(() => setOpen(false), 1200)
  }

  const fields: { name: keyof typeof form; label: string; placeholder: string; step?: string }[] = [
    { name: 'alcance_total', label: 'Alcance total', placeholder: 'ex: 4800' },
    { name: 'novos_seguidores', label: 'Novos seguidores', placeholder: 'ex: 23' },
    { name: 'engajamento_medio', label: 'Engajamento médio (%)', placeholder: 'ex: 4.7', step: '0.01' },
    { name: 'cliques_bio', label: 'Cliques no link da bio', placeholder: 'ex: 61' },
    { name: 'leads_gerados', label: 'Leads gerados', placeholder: 'ex: 5' },
  ]

  return (
    <div>
      <button
        onClick={() => setOpen((v) => !v)}
        className="rounded-lg bg-indigo-600 px-4 py-2 text-xs font-semibold text-white hover:bg-indigo-500 transition-colors"
      >
        {open ? 'Fechar formulário' : 'Inserir métricas da semana'}
      </button>

      {open && (
        <form
          onSubmit={handleSubmit}
          className="mt-4 rounded-xl bg-slate-800 border border-slate-700 p-5"
        >
          <p className="text-xs font-semibold uppercase tracking-wider text-slate-500 mb-4">
            Métricas da semana — Instagram orgânico
          </p>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {fields.map((f) => (
              <div key={f.name}>
                <label className="block text-xs text-slate-400 mb-1" htmlFor={f.name}>
                  {f.label}
                </label>
                <input
                  id={f.name}
                  name={f.name}
                  type="number"
                  step={f.step ?? '1'}
                  min="0"
                  required
                  value={form[f.name]}
                  onChange={handleChange}
                  placeholder={f.placeholder}
                  className="w-full rounded-lg bg-slate-900 border border-slate-600 px-3 py-2 text-sm text-white placeholder-slate-600 focus:border-indigo-500 focus:outline-none"
                />
              </div>
            ))}
          </div>

          {error && (
            <p className="mt-3 rounded-lg bg-red-900/40 border border-red-800 px-3 py-2 text-xs text-red-400">
              {error}
            </p>
          )}

          {success && (
            <p className="mt-3 rounded-lg bg-green-900/40 border border-green-800 px-3 py-2 text-xs text-green-400">
              Métricas salvas com sucesso! Dashboard atualizado.
            </p>
          )}

          <div className="mt-4 flex items-center gap-3">
            <button
              type="submit"
              disabled={loading}
              className="rounded-lg bg-indigo-600 px-5 py-2 text-sm font-semibold text-white hover:bg-indigo-500 disabled:opacity-50 transition-colors"
            >
              {loading ? 'Salvando...' : 'Salvar métricas'}
            </button>
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="text-xs text-slate-500 hover:text-slate-300 transition-colors"
            >
              Cancelar
            </button>
          </div>
        </form>
      )}
    </div>
  )
}
