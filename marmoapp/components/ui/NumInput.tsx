'use client'

import { useEffect, useState, type InputHTMLAttributes } from 'react'
import { parseNumBR, parseIntBR } from '@/lib/utils'

type BaseProps = Omit<InputHTMLAttributes<HTMLInputElement>, 'value' | 'onChange' | 'type' | 'inputMode'>

interface NumInputProps extends BaseProps {
  value: number
  onChange: (value: number) => void
  /** Valor usado quando o campo fica vazio (padrão 0). */
  fallback?: number
}

/**
 * Campo numérico decimal (aceita vírgula ou ponto) que preserva exatamente o que
 * a pessoa está digitando — inclusive "0" no início, vírgula/ponto no fim e zeros
 * à direita — em vez de reconstruir o texto a partir do número a cada tecla.
 * O valor numérico (já convertido) sobe via onChange normalmente.
 */
export function NumInput({ value, onChange, fallback = 0, className, ...rest }: NumInputProps) {
  const [text, setText] = useState<string>(value ? String(value).replace('.', ',') : '')

  useEffect(() => {
    const parsedAtual = parseNumBR(text)
    if (parsedAtual !== (value || 0)) {
      setText(value ? String(value).replace('.', ',') : '')
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value])

  return (
    <input
      {...rest}
      type="text"
      inputMode="decimal"
      className={className}
      value={text}
      onChange={e => {
        const raw = e.target.value
        setText(raw)
        onChange(parseNumBR(raw) || fallback)
      }}
    />
  )
}

interface IntInputProps extends BaseProps {
  value: number
  onChange: (value: number) => void
  fallback?: number
}

/** Mesma ideia do NumInput, mas para quantidades inteiras (sem casas decimais). */
export function IntInput({ value, onChange, fallback = 0, className, ...rest }: IntInputProps) {
  const [text, setText] = useState<string>(value ? String(value) : '')

  useEffect(() => {
    const parsedAtual = parseIntBR(text)
    if (parsedAtual !== (value || 0)) {
      setText(value ? String(value) : '')
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value])

  return (
    <input
      {...rest}
      type="text"
      inputMode="decimal"
      className={className}
      value={text}
      onChange={e => {
        const raw = e.target.value
        setText(raw)
        onChange(parseIntBR(raw) || fallback)
      }}
    />
  )
}
