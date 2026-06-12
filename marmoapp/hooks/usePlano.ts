'use client'

import { useApp } from '@/contexts/AppContext'

export type PlanoTipo = 'trial' | 'basic' | 'pro' | 'enterprise'
export type Recurso = 'orcamentos' | 'pdf' | 'agente_whatsapp' | 'antonio' | 'relatorios' | 'multi_usuarios'

const PERMISSOES: Record<PlanoTipo, Recurso[]> = {
  trial:      ['orcamentos', 'pdf'],
  basic:      ['orcamentos', 'pdf', 'relatorios'],
  pro:        ['orcamentos', 'pdf', 'relatorios', 'agente_whatsapp', 'multi_usuarios'],
  enterprise: ['orcamentos', 'pdf', 'relatorios', 'agente_whatsapp', 'multi_usuarios', 'antonio'],
}

export function usePlano() {
  const { marmoraria } = useApp()

  const plano = ((marmoraria?.plano as PlanoTipo) ?? 'trial')
  const ativo = marmoraria?.ativo ?? false

  const trialExpira = marmoraria?.trial_expira ? new Date(marmoraria.trial_expira) : null
  const trialExpirado = trialExpira ? trialExpira < new Date() : false
  const diasParaExpirar = trialExpira
    ? Math.ceil((trialExpira.getTime() - Date.now()) / 86_400_000)
    : -1

  function podeAcessar(recurso: Recurso): boolean {
    return PERMISSOES[plano]?.includes(recurso) ?? false
  }

  return { plano, ativo, trialExpirado, diasParaExpirar, podeAcessar }
}
