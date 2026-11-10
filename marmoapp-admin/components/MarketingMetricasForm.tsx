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
        className="rounded-lg bg-gold px-4 py-2 text-xs font-semibold text-[#0D0D0D] hover:bg-gold2 transition-colors"
      >
        {open ? 'Fechar formulário' : 'Inserir métricas da semana'}
      </button>

      {open && (
        <form
          onSubmit={handleSubmit}
          className="mt-4 rounded-xl bg-white border border-gray-200 p-5"
        >
          <p className="text-xs font-semibold uppercase tracking-wider text-gray-500 mb-4">
            Métricas da semana — Instagram orgânico
          </p>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {fields.map((f) => (
              <div key={f.name}>
                <label className="block text-xs text-gray-600 mb-1" htmlFor={f.name}>
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
                  className="w-full rounded-lg bg-white border border-gray-300 px-3 py-2 text-sm text-gray-900 placeholder-gray-400 focus:border-gold focus:outline-none"
                />
              </div>
            ))}
          </div>

          {error && (
            <p className="mt-3 rounded-lg bg-red-50 border border-red-200 px-3 py-2 text-xs text-red-700">
              {error}
            </p>
          )}

          {success && (
            <p className="mt-3 rounded-lg bg-green-50 border border-green-200 px-3 py-2 text-xs text-green-700">
              Métricas salvas com sucesso! Dashboard atualizado.
            </p>
          )}

          <div className="mt-4 flex items-center gap-3">
            <button
              type="submit"
              disabled={loading}
              className="rounded-lg bg-gold px-5 py-2 text-sm font-semibold text-[#0D0D0D] hover:bg-gold2 disabled:opacity-50 transition-colors"
            >
              {loading ? 'Salvando...' : 'Salvar métricas'}
            </button>
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="text-xs text-gray-500 hover:text-gray-700 transition-colors"
            >
              Cancelar
            </button>
          </div>
        </form>
      )}
    </div>
  )
}
