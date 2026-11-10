import { createHash, randomBytes, randomInt, timingSafeEqual } from 'crypto'
import type { NextRequest } from 'next/server'

// Link de assinatura: 32 bytes aleatórios (não dá para adivinhar).
export function novoToken(): string {
  return randomBytes(32).toString('base64url')
}

export function tokenValido(t: string): boolean {
  return /^[A-Za-z0-9_-]{40,60}$/.test(t)
}

// Código de 6 dígitos enviado ao e-mail. Guardamos só o hash, amarrado ao contrato.
export function novoCodigo(): string {
  return String(randomInt(0, 1_000_000)).padStart(6, '0')
}

export function hashCodigo(codigo: string, contratoId: string): string {
  return createHash('sha256').update(`${contratoId}:${codigo}`).digest('hex')
}

export function codigoConfere(codigo: string, contratoId: string, hashGuardado: string): boolean {
  const a = Buffer.from(hashCodigo(codigo, contratoId), 'hex')
  const b = Buffer.from(hashGuardado, 'hex')
  return a.length === b.length && timingSafeEqual(a, b)
}

export const CODIGO_VALIDADE_MIN = 10
export const CODIGO_MAX_TENTATIVAS = 5
export const CODIGO_MAX_ENVIOS = 5

export function ipDaRequisicao(req: NextRequest): string {
  const xff = req.headers.get('x-forwarded-for')
  if (xff) return xff.split(',')[0].trim()
  return req.headers.get('x-real-ip') ?? 'desconhecido'
}

export function mascararEmail(email: string): string {
  const [u, d] = email.split('@')
  if (!d) return email
  return `${u.slice(0, 2)}${'*'.repeat(Math.max(u.length - 2, 1))}@${d}`
}
