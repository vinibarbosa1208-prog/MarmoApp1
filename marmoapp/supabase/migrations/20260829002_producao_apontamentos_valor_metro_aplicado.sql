-- Decisão de 29/08: o valor por metro linear no registro de instalação
-- deixa de ser sempre o cadastro fixo do funcionário. Peças menores
-- (pingadeira, soleira etc.) valem menos, então o instalador sugere o
-- valor daquela peça (pré-preenchido com o cadastro, mas editável), e o
-- gestor pode ajustar no fechamento semanal antes de aprovar.
--
-- Guarda o valor por metro efetivamente aplicado nesse registro, separado
-- do valor_metro_linear do cadastro do funcionário (que pode mudar depois
-- sem afetar registros antigos) -- ajuda a aba Aprovações a sinalizar
-- quando o valor sugerido foge do padrão do funcionário.
alter table public.producao_apontamentos
  add column valor_metro_linear_aplicado numeric;
