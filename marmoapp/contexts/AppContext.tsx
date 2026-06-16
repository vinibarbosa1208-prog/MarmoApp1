'use client'

import { createContext, useContext, useState, useEffect, useCallback, type ReactNode } from 'react'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/lib/auth/AuthContext'
import type { AppState, Cliente, Orcamento, OrdemServico, Material, Servico, Marmoraria, OrcamentoItem } from '@/lib/types'

interface AppContextValue extends AppState {
  loadAll: () => Promise<void>
  loadClientes: () => Promise<void>
  loadOrcamentos: () => Promise<void>
  loadMateriais: () => Promise<void>
  loadServicos: () => Promise<void>
  setEditingOrcId: (id: string | null) => void
  setOrcItems: (items: OrcamentoItem[]) => void
  toast: (msg: string, type?: 'ok' | 'err' | 'ok2') => void
  toastMsg: { msg: string; type: string } | null
}

const AppContext = createContext<AppContextValue | null>(null)

export function AppProvider({ children }: { children: ReactNode }) {
  const { user: authUser, marmorariaId } = useAuth()
  const [state, setState] = useState<AppState>({
    user: null,
    marmoraria: null,
    clientes: [],
    orcamentos: [],
    os: [],
    materiais: [],
    servicos: [],
    editingOrcId: null,
    orcItems: [],
  })
  const [toastMsg, setToastMsg] = useState<{ msg: string; type: string } | null>(null)

  const toast = useCallback((msg: string, type: 'ok' | 'err' | 'ok2' = 'ok') => {
    setToastMsg({ msg, type })
    setTimeout(() => setToastMsg(null), 2800)
  }, [])

  const loadClientes = useCallback(async () => {
    if (!state.marmoraria?.id) return
    const { data } = await supabase
      .from('clientes')
      .select('*')
      .eq('marmoraria_id', state.marmoraria.id)
      .order('created_at', { ascending: false })
    if (data) setState(s => ({ ...s, clientes: data as Cliente[] }))
  }, [state.marmoraria?.id])

  const loadOrcamentos = useCallback(async () => {
    if (!state.marmoraria?.id) return
    const { data: orcs } = await supabase
      .from('orcamentos')
      .select('*')
      .eq('marmoraria_id', state.marmoraria.id)
      .order('created_at', { ascending: false })
    if (!orcs) return
    const ids = orcs.map(o => o.id)
    const { data: itens } = ids.length
      ? await supabase.from('orcamento_itens').select('*').in('orcamento_id', ids)
      : { data: [] }

    const orcamentos: Orcamento[] = orcs.map(o => ({
      ...o,
      clienteId: o.cliente_id,
      maoObra: o.mao_obra,
      desconto: o.desconto_rs,
      descricao: o.titulo,
      validade: o.data_validade,
      producao_status: o.producao_status || 'comercial',
      total: o.total || 0,
      itens: (itens || []).filter(i => i.orcamento_id === o.id).map(i => ({
        ...i,
        total: i.total_item || i.total || 0,
      })),
    }))
    setState(s => ({ ...s, orcamentos }))
  }, [state.marmoraria?.id])

  const loadMateriais = useCallback(async () => {
    if (!state.marmoraria?.id) return
    const { data } = await supabase
      .from('materiais')
      .select('*')
      .eq('marmoraria_id', state.marmoraria.id)
      .order('nome')
    if (data) setState(s => ({ ...s, materiais: data as Material[] }))
  }, [state.marmoraria?.id])

  const loadServicos = useCallback(async () => {
    if (!state.marmoraria?.id) return
    const { data } = await supabase
      .from('servicos')
      .select('*')
      .eq('marmoraria_id', state.marmoraria.id)
      .order('nome')
    if (data) setState(s => ({ ...s, servicos: data as Servico[] }))
  }, [state.marmoraria?.id])

  const loadAll = useCallback(async () => {
    await Promise.all([loadClientes(), loadOrcamentos(), loadMateriais(), loadServicos()])
  }, [loadClientes, loadOrcamentos, loadMateriais, loadServicos])

  // Sincroniza user do AuthContext (única fonte de verdade de autenticação)
  useEffect(() => {
    setState(s => ({
      ...s,
      user: authUser ? { id: authUser.id, email: authUser.email! } : null,
    }))
  }, [authUser?.id])

  // Carrega marmoraria completa quando marmorariaId muda
  useEffect(() => {
    if (!marmorariaId) {
      setState(s => ({ ...s, marmoraria: null }))
      return
    }
    supabase
      .from('marmorarias')
      .select('*')
      .eq('id', marmorariaId)
      .single()
      .then(({ data }) => setState(s => ({ ...s, marmoraria: data as Marmoraria | null })))
  }, [marmorariaId])

  useEffect(() => {
    if (state.marmoraria?.id) loadAll()
  }, [state.marmoraria?.id])

  return (
    <AppContext.Provider value={{
      ...state,
      loadAll,
      loadClientes,
      loadOrcamentos,
      loadMateriais,
      loadServicos,
      setEditingOrcId: (id) => setState(s => ({ ...s, editingOrcId: id })),
      setOrcItems: (items) => setState(s => ({ ...s, orcItems: items })),
      toast,
      toastMsg,
    }}>
      {children}
    </AppContext.Provider>
  )
}

export function useApp() {
  const ctx = useContext(AppContext)
  if (!ctx) throw new Error('useApp must be used within AppProvider')
  return ctx
}
