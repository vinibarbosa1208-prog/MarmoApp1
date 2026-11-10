import { supabaseAdmin } from '@/lib/supabase-admin'
import { tokenValido } from './seguranca'

export const CAMPOS_PUBLICOS =
  'id, numero, status, plano, primeira_cobranca, contratante, texto, hash_sha256, token, otp_hash, otp_expira_em, otp_tentativas, otp_envios, assinado_em, assinatura, link_pagamento, asaas_payment_id'

export async function contratoPorToken(token: string) {
  if (!tokenValido(token)) return null
  const { data } = await supabaseAdmin.from('contratos').select(CAMPOS_PUBLICOS).eq('token', token).maybeSingle()
  return data
}
