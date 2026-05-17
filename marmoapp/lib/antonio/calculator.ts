/** Calcula área a partir de dimensões em cm ou m */
export function calcArea(largura: number, altura: number, unidade: 'cm' | 'm' = 'm'): number {
  if (unidade === 'cm') return (largura / 100) * (altura / 100)
  return largura * altura
}

/** Arredonda para 2 casas decimais */
export function round2(n: number): number {
  return Math.round(n * 100) / 100
}

export interface ItemCalc {
  quantidade: number
  preco_unitario: number
}

/** Subtotal de um item */
export function itemTotal(item: ItemCalc): number {
  return round2(item.quantidade * item.preco_unitario)
}

/** Total geral do orçamento */
export function orcamentoTotal(itens: ItemCalc[], maoObra = 0, desconto = 0): number {
  const subtotal = itens.reduce((s, i) => s + itemTotal(i), 0)
  return round2(subtotal + maoObra - desconto)
}
