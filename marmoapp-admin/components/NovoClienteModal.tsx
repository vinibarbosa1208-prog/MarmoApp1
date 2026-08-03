'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

interface NovoClienteModalProps {
  onClose: () => void
}

export default function NovoClienteModal({ onClose }: NovoClienteModalProps) {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState(false)
  const [form, setForm] = useState({
    nome: '',
    email: '',
    plano: 'trial',
  })

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError('')

    const res = await fetch('/api/clientes', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(form),
    })

    const data = await res.json()
    setLoading(false)

    if (!res.ok) {
      setError(data.error ?? 'Erro ao criar cliente')
      return
    }

    setSuccess(true)
    setTimeout(() => {
      onClose()
      router.refresh()
    }, 2000)
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60">
      <div className="w-full max-w-md rounded-2xl bg-slate-800 border border-slate-700 p-6 shadow-xl">
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-lg font-semibold text-white">Novo Cliente</h2>
          <button onClick={onClose} className="text-slate-400 hover:text-white">✕</button>
        </div>

        {success ? (
          <div className="rounded-lg bg-emerald-900 border border-emerald-700 p-4 text-emerald-300 text-sm">
            ✓ Marmoraria criada! Lembre de criar o usuário no Supabase Auth manualmente.
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm text-slate-400 mb-1">Nome da marmoraria</label>
              <input
                required
                value={form.nome}
                onChange={(e) => setForm({ ...form, nome: e.target.value })}
                className="w-full rounded-lg bg-slate-900 border border-slate-600 px-3 py-2 text-sm text-white placeholder-slate-500 focus:border-indigo-500 focus:outline-none"
                placeholder="Ex: Marmoraria Silva"
              />
            </div>

            <div>
              <label className="block text-sm text-slate-400 mb-1">Email do admin</label>
              <input
                required
                type="email"
                value={form.email}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
                className="w-full rounded-lg bg-slate-900 border border-slate-600 px-3 py-2 text-sm text-white placeholder-slate-500 focus:border-indigo-500 focus:outline-none"
                placeholder="admin@empresa.com"
              />
            </div>

            <div>
              <label className="block text-sm text-slate-400 mb-1">Plano</label>
              <select
                value={form.plano}
                onChange={(e) => setForm({ ...form, plano: e.target.value })}
                className="w-full rounded-lg bg-slate-900 border border-slate-600 px-3 py-2 text-sm text-white focus:border-indigo-500 focus:outline-none"
              >
                <option value="trial">Trial (14 dias)</option>
                <option value="basic">Basic — R$147/mês</option>
                <option value="pro">Pro — R$297/mês</option>
                <option value="enterprise">Enterprise — R$497/mês</option>
              </select>
            </div>

            {error && (
              <p className="text-sm text-red-400">{error}</p>
            )}

            <div className="rounded-lg bg-slate-900 border border-slate-700 p-3 text-xs text-slate-500">
              ⚠️ Após criar, acesse o Supabase Dashboard → Authentication → Users para criar o usuário com o email informado.
            </div>

            <div className="flex gap-3 pt-1">
              <button
                type="button"
                onClick={onClose}
                className="flex-1 rounded-lg border border-slate-600 px-4 py-2 text-sm text-slate-300 hover:bg-slate-700"
              >
                Cancelar
              </button>
              <button
                type="submit"
                disabled={loading}
                className="flex-1 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-500 disabled:opacity-50"
              >
                {loading ? 'Criando...' : 'Criar marmoraria'}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  )
}
