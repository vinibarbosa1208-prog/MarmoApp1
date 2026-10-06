// Semana de produção: segunda a sábado, igual à ficha de papel e à grade de
// presença (`funcionario_presencas`). Tudo em 'YYYY-MM-DD' local — nunca
// `new Date(iso)` sem hora, que o navegador interpreta como UTC e
// retrocede um dia nos fusos negativos.

export const DIAS_SEMANA = ['Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado'] as const
export const DIAS_SEMANA_CURTO = ['Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'] as const

/** Segunda-feira da semana de uma data (ou de hoje). */
export function segundaDaSemana(data: Date | string = new Date()): string {
  const d = typeof data === 'string' ? new Date(data + 'T12:00:00') : new Date(data)
  d.setHours(12, 0, 0, 0)
  const dow = d.getDay() // 0 = domingo
  d.setDate(d.getDate() - (dow === 0 ? 6 : dow - 1))
  return isoLocal(d)
}

/** Os seis dias (seg a sáb) de uma semana, em 'YYYY-MM-DD'. */
export function diasDaSemana(semanaInicio: string): string[] {
  const dias: string[] = []
  for (let i = 0; i < 6; i++) dias.push(somarDias(semanaInicio, i))
  return dias
}

/** Domingo seguinte — limite superior exclusivo das consultas da semana. */
export function fimExclusivoDaSemana(semanaInicio: string): string {
  return somarDias(semanaInicio, 7)
}

export function somarDias(iso: string, dias: number): string {
  const d = new Date(iso + 'T12:00:00')
  d.setDate(d.getDate() + dias)
  return isoLocal(d)
}

export function isoLocal(d: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}

/** '2026-10-05' → '05/10' */
export function ddmm(iso: string): string {
  const [, m, d] = iso.split('-')
  return `${d}/${m}`
}

/** '2026-10-05' → '05/10/2026' */
export function ddmmaaaa(iso: string): string {
  const [a, m, d] = iso.split('-')
  return `${d}/${m}/${a}`
}

/** '05/10 a 10/10/2026' — o período impresso no cabeçalho da ficha. */
export function rotuloPeriodo(semanaInicio: string): string {
  const dias = diasDaSemana(semanaInicio)
  return `${ddmm(dias[0])} a ${ddmmaaaa(dias[5])}`
}

export function ehSemanaValida(iso: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(iso) && segundaDaSemana(iso) === iso
}

/** Semana corrente? (usado pra liberar edição de corte/acabamento) */
export function ehSemanaCorrente(semanaInicio: string): boolean {
  return segundaDaSemana() === semanaInicio
}
