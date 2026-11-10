import { createHash } from 'crypto'

// Código de integridade do texto do contrato (só no servidor).
export function hashTexto(texto: string): string {
  return createHash('sha256').update(texto, 'utf8').digest('hex')
}
