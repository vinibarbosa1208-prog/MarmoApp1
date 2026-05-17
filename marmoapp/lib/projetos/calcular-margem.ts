export function calcularMargem(valorVenda: number, custos: { valor: number }[]) {
  const custoTotal = custos.reduce((acc, c) => acc + c.valor, 0)
  const margemValor = valorVenda - custoTotal
  const margemPercentual = valorVenda > 0
    ? Math.round((margemValor / valorVenda) * 10000) / 100
    : 0
  return { custoTotal, margemValor, margemPercentual }
}
