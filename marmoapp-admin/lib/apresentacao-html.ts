// Gerado a partir da apresentação interativa da MarmorarIA. Para mudar os slides,
// edite o HTML de origem e gere este arquivo de novo.
export const APRESENTACAO_HTML = String.raw`<!DOCTYPE html>
<html lang="pt-BR">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>MarmorarIA — Apresentação interativa de diagnóstico</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link href="https://fonts.googleapis.com/css2?family=Playfair+Display:ital,wght@0,700;0,800;0,900;1,700;1,900&family=DM+Sans:wght@400;500;700;900&display=swap" rel="stylesheet">
<style>
:root{--ink:#2C2922;--gold:#C9A84C;--gold-dk:#8A6D1F;--muted:#6F6355;--bg:#FBF9F4;--cream:#F5F1E7;--black:#0D0D0D;--line:#E8E0CE}
*{box-sizing:border-box;margin:0;padding:0}
html,body{height:100%;background:#1A1814;font-family:'DM Sans',sans-serif;color:var(--ink);overflow:hidden}
#app{display:flex;height:100%}
#viewport{flex:1;position:relative;overflow:hidden;display:flex;align-items:center;justify-content:center}
#stage{width:1920px;height:1080px;position:absolute;left:50%;top:50%;transform-origin:center center;box-shadow:0 30px 80px rgba(0,0,0,.45)}
.slide{position:absolute;inset:0;padding:120px 128px 150px;display:flex;flex-direction:column;gap:44px;background:var(--bg);overflow:hidden}
.slide.dark{background:var(--black);color:var(--cream)}
.slide.gold{background:var(--gold);color:var(--black)}
.foot{position:absolute;left:128px;right:128px;bottom:56px;display:flex;justify-content:space-between;font-size:24px;color:#8F8372}
.dark .foot{color:#9B8F7E}.gold .foot{color:#3A2F14}
.serif{font-family:'Playfair Display',serif}
h1{font-family:'Playfair Display',serif;font-weight:900;font-size:116px;line-height:1.02}
h2{font-family:'Playfair Display',serif;font-weight:800;font-size:70px;line-height:1.1}
h3{font-size:36px;font-weight:700}
em{font-style:italic;color:var(--gold-dk)}.dark em{color:var(--gold)}
.kicker{font-size:25px;font-weight:700;letter-spacing:4px;color:var(--gold-dk)}.dark .kicker{color:var(--gold)}
.p{font-size:30px;line-height:1.45}
.mut{color:var(--muted)}.dark .mut{color:#D9CFBE}
.row{display:flex;gap:28px}.grid2{display:grid;grid-template-columns:1fr 1fr;gap:32px}.grid4{display:grid;grid-template-columns:repeat(4,1fr);gap:28px}.grid5{display:grid;grid-template-columns:repeat(5,1fr);gap:22px}
.card{background:#fff;border:1px solid var(--line);border-radius:24px;padding:40px;display:flex;flex-direction:column;gap:18px}
.card.blk{background:var(--black);border-color:var(--black);color:var(--cream)}
.card.sel{border:3px solid var(--gold);box-shadow:0 0 0 6px rgba(201,168,76,.18)}
.num{font-family:'Playfair Display',serif;font-weight:900;color:var(--gold-dk);line-height:1}
.dark .num,.card.blk .num{color:var(--gold)}
.fill{color:var(--gold-dk);font-weight:700;border-bottom:3px dashed var(--gold);padding:0 6px}
.dark .fill{color:var(--gold)}
.blank{color:#B5A88F}
.pill{display:inline-block;align-self:flex-start;padding:10px 26px;border-radius:999px;font-weight:900;letter-spacing:3px;font-size:26px}
table{width:100%;border-collapse:collapse}
th{font-size:23px;letter-spacing:2px;color:var(--gold-dk);text-align:left;padding:18px 26px;border-bottom:2px solid var(--gold)}
td{font-size:29px;padding:24px 26px;border-bottom:1px solid var(--line);vertical-align:top}
tr.hl td{background:var(--cream)}
.strike{color:#9B8F7E;text-decoration:line-through;margin-right:12px}
ul.l{padding-left:30px;font-size:26px;line-height:1.5}
.box{background:#1E1B16;border:2px solid var(--gold);border-radius:20px;padding:26px 30px;display:flex;flex-direction:column;align-items:center;gap:8px;text-align:center}
.box .v{font-family:'Playfair Display',serif;font-size:58px;font-weight:800;color:var(--cream)}
.box .k{font-size:23px;color:#D9CFBE}
.op{font-family:'Playfair Display',serif;font-size:64px;color:var(--gold)}
/* nav */
#nav{position:absolute;bottom:14px;left:50%;transform:translateX(-50%);display:flex;gap:8px;align-items:center;background:rgba(13,13,13,.75);padding:8px 12px;border-radius:999px;color:#F5F1E7;font-size:14px;z-index:5;opacity:.25;transition:opacity .2s}
#nav:hover{opacity:1}
#nav button,.btn{background:#2A2620;color:#F5F1E7;border:1px solid #3A352C;border-radius:999px;padding:7px 14px;font:600 13px 'DM Sans',sans-serif;cursor:pointer}
#nav button:hover,.btn:hover{border-color:var(--gold)}
.btn.gold{background:var(--gold);color:#0D0D0D;border-color:var(--gold)}
/* panel */
#panel{width:380px;background:#14120F;color:#EDE6D6;border-left:1px solid #2A2620;display:flex;flex-direction:column;transition:margin .25s;font-size:14px}
#panel.hide{margin-right:-380px}
#panel header{padding:16px 18px;border-bottom:1px solid #2A2620;display:flex;justify-content:space-between;align-items:center}
#panel header b{font-family:'Playfair Display',serif;font-size:19px}
#panel .scroll{overflow:auto;padding:14px 18px 24px;display:flex;flex-direction:column;gap:14px}
fieldset{border:1px solid #2A2620;border-radius:12px;padding:12px;display:flex;flex-direction:column;gap:9px}
legend{padding:0 6px;color:var(--gold);font-weight:700;font-size:12px;letter-spacing:1.5px;text-transform:uppercase}
label{display:flex;flex-direction:column;gap:4px;font-size:12.5px;color:#BDB3A0}
.two{display:grid;grid-template-columns:1fr 1fr;gap:8px}
input,select,textarea{background:#0D0D0D;color:#F5F1E7;border:1px solid #3A352C;border-radius:8px;padding:8px 10px;font:500 14px 'DM Sans',sans-serif;width:100%}
input:focus,select:focus,textarea:focus{outline:none;border-color:var(--gold)}
.calc{background:#1E1B16;border-radius:10px;padding:10px 12px;line-height:1.6;font-size:13px}
.calc b{color:var(--gold)}
#notes{background:#1E1B16;border-left:3px solid var(--gold);border-radius:8px;padding:10px 12px;line-height:1.5;color:#E8E0CE;font-size:13.5px}
.btns{display:flex;flex-wrap:wrap;gap:6px}
#toast{position:absolute;top:16px;left:50%;transform:translateX(-50%);background:var(--gold);color:#0D0D0D;padding:8px 16px;border-radius:999px;font-weight:700;font-size:14px;opacity:0;transition:opacity .2s;z-index:9}
#help{font-size:12px;color:#8F8372;line-height:1.5}
</style>
</head>
<body>
<div id="app">
  <div id="viewport">
    <div id="stage"></div>
    <div id="nav">
      <button id="prev" title="Anterior (←)">←</button>
      <span id="count">1 / 18</span>
      <button id="next" title="Próximo (→)">→</button>
      <button id="full" title="Tela cheia (F)">Tela cheia</button>
      <button id="togglePanel" title="Painel (E)">Painel</button>
    </div>
    <div id="toast"></div>
  </div>
  <aside id="panel">
    <header><b>Dados do cliente</b><button class="btn" id="closePanel">Ocultar (E)</button></header>
    <div class="scroll">
      <fieldset>
        <legend id="savedLegend">Clientes salvos</legend>
        <select id="saved"><option value="">— novo cliente —</option></select>
        <div class="btns"><button class="btn gold" id="save">Salvar</button><button class="btn" id="new">Novo</button><button class="btn" id="del">Excluir</button></div>
        <span id="saveInfo" style="font-size:12px;color:#8F8372"></span>
      </fieldset>
      <fieldset>
        <legend>Marmoraria</legend>
        <label>Nome da marmoraria<input data-k="empresa" placeholder="Ex.: Marmoraria São José"></label>
        <div class="two"><label>Responsável<input data-k="contato" placeholder="Nome do dono"></label><label>Cidade<input data-k="cidade" placeholder="Ex.: Guarulhos"></label></div>
        <div class="two"><label>WhatsApp<input data-k="whatsapp" placeholder="(11) 9...."></label><label>E-mail<input data-k="email" type="email"></label></div>
        <div class="two"><label>Pessoas na equipe<input data-k="equipe" type="number" min="0"></label><label>Data da call<input data-k="data" type="date"></label></div>
        <div class="two"><label>Faturamento médio/mês<select data-k="faturamento"><option value="">—</option><option value="ate_15">até R$ 15 mil</option><option value="15_40">R$ 15 a 40 mil</option><option value="40_80">R$ 40 a 80 mil</option><option value="80_150">R$ 80 a 150 mil</option><option value="150_300">R$ 150 a 300 mil</option><option value="300_mais">acima de R$ 300 mil</option></select></label><label>Quer resolver<select data-k="prazo"><option value="">—</option><option value="agora">agora, este mês</option><option value="tres_meses">em até 3 meses</option><option value="pesquisando">só pesquisando</option></select></label></div>
        <label>Dor principal (guia a apresentação)<select data-k="dor"><option value="">— escolher no slide 4 —</option><option value="1">O orçamento some</option><option value="2">O prazo é no olho</option><option value="3">A cobrança fica no caderno</option><option value="4">A chapa falta na hora</option></select></label>
      </fieldset>
      <fieldset>
        <legend>Orçamento</legend>
        <div class="two"><label>Orçamentos no último mês<input data-k="orc" type="number" min="0"></label><label>Quantos fecharam<input data-k="fech" type="number" min="0"></label></div>
        <label>Valor médio do orçamento (R$)<input data-k="medio" type="number" min="0" step="100"></label>
      </fieldset>
      <fieldset>
        <legend>Produção</legend>
        <div class="two"><label>Obras na fila<input data-k="fila" type="number" min="0"></label><label>Atrasaram no último mês<input data-k="atr" type="number" min="0"></label></div>
        <label>Sabe a entrega de cada obra?<select data-k="sabe"><option value="">—</option><option>sim</option><option>não</option></select></label>
      </fieldset>
      <fieldset>
        <legend>Estoque</legend>
        <div class="two"><label>Faltas de chapa/mês<input data-k="falta" type="number" min="0"></label><label>Custo extra por falta (R$)<input data-k="cf" type="number" min="0" step="50"></label></div>
      </fieldset>
      <fieldset>
        <legend>Financeiro</legend>
        <label>A receber até 31/12 (R$)<input data-k="receber" type="number" min="0" step="100"></label>
        <div class="two"><label>Já vencido (R$)<input data-k="venc" type="number" min="0" step="100"></label><label>Obras prontas sem cobrança (R$)<input data-k="semcob" type="number" min="0" step="100"></label></div>
      </fieldset>
      <div class="calc" id="calc"></div>
      <fieldset>
        <legend>Proposta e resultado</legend>
        <label>Plano<select data-k="plano"><option value="">Automático (pela dor e equipe)</option><option value="gestao">Gestão com IA</option><option value="operacao">Operação com IA</option><option value="crescimento">Operação + Crescimento</option></select></label>
        <div class="two"><label>Vagas restantes em dezembro<input data-k="vagas" type="number" min="0"></label><label>Ativação do Antônio<input data-k="ativacao" placeholder="15/01/2027"></label></div>
        <label>Resultado da call<select data-k="resultado"><option value="em_aberto">Em aberto</option><option value="fechou">Fechou</option><option value="vai_pensar">Vai pensar</option><option value="perdido">Perdido</option></select></label>
        <label>Observações da call<textarea data-k="obs" rows="3" placeholder="Objeções, combinados, próximo contato"></textarea></label>
        <button class="btn gold" id="copy">Copiar resumo para o WhatsApp</button>
        <button class="btn" id="gerarContrato" style="display:none">Gerar contrato deste cliente</button>
      </fieldset>
      <fieldset>
        <legend>Roteiro deste slide</legend>
        <div id="notes"></div>
      </fieldset>
      <p id="help">Atalhos: ← → ou espaço para navegar · F tela cheia · E mostra ou oculta este painel · Ctrl+S salva. Em tela cheia, o painel fica oculto para o cliente.</p>
    </div>
  </aside>
</div>
<script>window.MARMO_API = "/api/diagnosticos";</script>
<script>
(function(){
var API=window.MARMO_API||null;
var PLANS={
  gestao:{nome:'Gestão com IA',sub:'Para sair do caderno',cheio:297,fund:297,impl:1200,extra:'',itens:['Sistema MarmoApp completo','Cadastro de pedras, serviços e preços','Treino da equipe','Antônio para orçar por texto e áudio']},
  operacao:{nome:'Operação com IA',sub:'Agência + sistema',cheio:950,fund:790,impl:2400,extra:'',itens:['Tudo do Gestão com IA','Rotinas desenhadas com você','Antônio no WhatsApp, retomando orçamentos','Reunião mensal de indicadores']},
  crescimento:{nome:'Operação + Crescimento',sub:'Para trazer mais obras',cheio:1850,fund:1490,impl:3300,extra:' + R$ 60 por medição',itens:['Tudo do Operação com IA','Anúncios na sua região','Medição agendada pela IA','Exclusividade na sua cidade']}
};
/* Cada dor tem a sua conta, o seu título e a sua pergunta. */
var DOR={
  '1':{nome:'O orçamento some',curto:'o orçamento que some',area:'Orçamento',pilar:0,mesa:'em orçamentos que ninguém retomou',periodo:'em 3 meses',
       pergunta:'Se 1 em cada 10 desses orçamentos voltasse, o que mudaria aí?',
       frase:'Cada orçamento parado é uma obra que já tinha cliente interessado.'},
  '2':{nome:'O prazo é no olho',curto:'o prazo no olho',area:'Produção',pilar:1,mesa:'em obras atrasadas, com o recebimento adiado',periodo:'em 3 meses',
       pergunta:'Se toda obra saísse na data combinada, quanto entraria antes no caixa?',
       frase:'Obra atrasada é dinheiro que demora a entrar e cliente que não indica.'},
  '3':{nome:'A cobrança fica no caderno',curto:'a cobrança no caderno',area:'Financeiro',pilar:3,mesa:'que já é seu e ainda não entrou no caixa',periodo:'hoje',
       pergunta:'Se esse dinheiro entrasse este mês, o que você faria com ele?',
       frase:'É serviço entregue. Só falta cobrar.'},
  '4':{nome:'A chapa falta na hora',curto:'a chapa que falta na hora',area:'Estoque',pilar:2,mesa:'em compras de última hora e obra parada',periodo:'em 3 meses',
       pergunta:'Se a chapa nunca mais faltasse no meio da obra, quanto sobraria por mês?',
       frase:'Cada falta vira frete, preço maior e equipe parada esperando material.'}
};
var KEY='marmoraria-ia-clientes',cur=0,S;
function today(){return new Date().toISOString().slice(0,10)}
function blankState(){return {id:null,lead_id:null,empresa:'',contato:'',cidade:'',whatsapp:'',email:'',equipe:'',data:today(),dor:'',orc:'',fech:'',medio:'',fila:'',atr:'',sabe:'',falta:'',cf:'',receber:'',venc:'',semcob:'',plano:'',vagas:5,ativacao:'15/01/2027',resultado:'em_aberto',obs:'',faturamento:'',prazo:''}}
S=blankState();
var fmt=new Intl.NumberFormat('pt-BR',{style:'currency',currency:'BRL',maximumFractionDigits:0});
function n(v){var x=parseFloat(v);return isNaN(x)?null:x}
function brl(v){return v==null?'R$ ____':fmt.format(v)}
function esc(s){return String(s==null?'':s).replace(/[&<>"']/g,function(c){return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]})}
function F(v,blank){return v!=null&&v!==''?'<span class="fill">'+esc(v)+'</span>':'<span class="blank">'+(blank||'____')+'</span>'}
function FB(v){return n(v)!=null?'<span class="fill">'+brl(n(v))+'</span>':'<span class="blank">R$ ____</span>'}
function na(){return S.empresa?'na '+esc(S.empresa):'aí'}
function calc(){
  var orc=n(S.orc),fe=n(S.fech),md=n(S.medio),sc=n(S.semcob),vc=n(S.venc),atr=n(S.atr),fa=n(S.falta),cf=n(S.cf);
  var par=(orc!=null&&fe!=null)?Math.max(orc-fe,0):null;
  var A={};
  A['1']=(par!=null&&md!=null)?par*md*3:null;
  A['2']=(atr!=null&&md!=null)?atr*md*3:null;
  A['3']=(sc!=null||vc!=null)?(sc||0)+(vc||0):null;
  A['4']=(fa!=null&&cf!=null)?fa*cf*3:null;
  var dor=S.dor||(A['1']!=null?'1':'');
  var mesa=dor?A[dor]:null;
  var outros=[];['1','2','3','4'].forEach(function(k){if(k!==dor&&A[k])outros.push([DOR[k].area,A[k]])});
  var total=(mesa||0)+outros.reduce(function(a,b){return a+b[1]},0);
  var taxa=(orc&&fe!=null)?Math.round(fe/orc*100):null;
  var pk=S.plano||((dor==='1'||(n(S.equipe)||0)>=5)?'operacao':'gestao');
  var P=PLANS[pk],custo3=P.impl+3*P.cheio;
  var pct=mesa?Math.round(custo3/mesa*100):null;
  var rec10=(dor==='1'&&par!=null&&md!=null)?Math.max(1,Math.round(par*3*0.1))*md:null;
  return {A:A,par:par,md:md,taxa:taxa,dor:dor,D:DOR[dor]||null,mesa:mesa,outros:outros,total:total,pk:pk,P:P,custo3:custo3,pct:pct,rec10:rec10};
}
function foot(t){return '<div class="foot"><span>MarmorarIA · '+t+'</span><span>'+esc(S.empresa)+'</span></div>'}
var M='<svg width="72" height="72" viewBox="-8 -8 116 116" aria-label="Logo M"><path d="M4 2 L96 96 M3 33 V98 M3 33 L34 64 M97 2 V62 M97 2 L63 33" fill="none" stroke="#C9A84C" stroke-width="7" stroke-linecap="round" stroke-linejoin="round"/></svg>';
function dataBR(){if(!S.data)return '';var p=S.data.split('-');return p[2]+'/'+p[1]+'/'+p[0]}
function box(v,k,w){return '<div class="box" style="width:'+w+'px"><span class="v">'+v+'</span><span class="k">'+k+'</span></div>'}
var OP=function(o){return '<span class="op">'+o+'</span>'};
function formula(c){
  var d=c.dor;
  if(d==='2')return box(n(S.atr)!=null?S.atr:'____','obras que atrasaram no mês',330)+OP('×')+box(c.md!=null?brl(c.md):'R$ ____','valor médio da obra',360)+OP('×')+box('3','meses',200);
  if(d==='3')return box(n(S.semcob)!=null?brl(n(S.semcob)):'R$ ____','obras prontas sem cobrança',460)+OP('+')+box(n(S.venc)!=null?brl(n(S.venc)):'R$ ____','a receber já vencido',460);
  if(d==='4')return box(n(S.falta)!=null?S.falta:'____','faltas de chapa por mês',330)+OP('×')+box(n(S.cf)!=null?brl(n(S.cf)):'R$ ____','custo extra por falta',360)+OP('×')+box('3','meses',200);
  return box(c.par!=null?c.par:'____','orçamentos sem resposta no mês',330)+OP('×')+box(c.md!=null?brl(c.md):'R$ ____','valor médio do orçamento',360)+OP('×')+box('3','meses',200);
}
function outrosTxt(c,cor){if(!c.outros.length)return '';return '<p style="font-size:26px;color:'+cor+'">E ainda: '+c.outros.map(function(o){return o[0]+' '+brl(o[1])}).join(' · ')+'. Somando tudo, '+brl(c.total)+'.</p>'}
var SLIDES=[
{t:'Capa',n:'Abra com a câmera ligada. Diga que em 40 minutos ele sai com um número em reais do que está em cima da mesa, mesmo que não feche nada.',r:function(){return '<div class="slide dark" style="justify-content:space-between;padding:120px 128px"><div class="row" style="align-items:center;gap:22px">'+M+'<span class="serif" style="font-size:44px;font-weight:700">Marmorar<span style="color:var(--gold)">IA</span></span></div><div style="display:flex;flex-direction:column;gap:30px"><span class="kicker">DIAGNÓSTICO DA OPERAÇÃO</span><h1 style="width:1500px">Sua marmoraria rodando com IA, <em>do orçamento à instalação.</em></h1></div><div class="row" style="justify-content:space-between;align-items:flex-end"><p class="p mut">Preparado para <b style="color:var(--cream)">'+(S.empresa?esc(S.empresa):'[nome da marmoraria]')+'</b>'+(S.contato?' · '+esc(S.contato):'')+(S.data?' · '+dataBR():'')+'</p><p style="font-size:24px;color:#9B8F7E">Uma marca do ecossistema MarmoApp</p></div></div>'}},
{t:'Quem somos',n:'Conte a história do avô em 1 minuto. O objetivo é confiança: você é do setor, não um vendedor de software.',r:function(){return '<div class="slide"><span class="kicker">QUEM ESTÁ DO OUTRO LADO</span><div class="grid2" style="gap:96px"><h2 style="font-size:80px">Uma família no mármore <em>desde 1972.</em></h2><div style="display:flex;flex-direction:column;gap:30px"><p class="p">Meu avô, Antônio, trabalhou com mármore a vida inteira. Eu cresci vendo o que trava uma marmoraria: orçamento que some, obra que atrasa, dinheiro que fica na rua.</p><p class="p">Por isso criamos o <b>MarmoApp</b>, um sistema feito só para marmoraria, e a <b>MarmorarIA</b>, a agência que implanta o sistema e a inteligência artificial dentro da operação.</p></div></div>'+foot('Quem somos')+'</div>'}},
{t:'Agenda',n:'Peça um "combinado?" em voz alta. Deixe claro que a decisão vem no fim e é dele.',r:function(){var c=function(i,t,d,b){return '<div class="card'+(b?' blk':'')+'"><span class="num" style="font-size:64px;color:var(--gold)">0'+i+'</span><h3>'+t+'</h3><p style="font-size:26px;line-height:1.4'+(b?';color:#D9CFBE':'')+'" class="'+(b?'':'mut')+'">'+d+'</p></div>'};return '<div class="slide"><h2>Como vão ser os nossos 40 minutos'+(S.contato?', '+esc(S.contato.split(' ')[0]):'')+'</h2><div class="grid4">'+c(1,'Conhecer','Como '+(S.empresa?'a '+esc(S.empresa):'sua marmoraria')+' funciona hoje')+c(2,'Diagnosticar','Calcular juntos o que está em cima da mesa')+c(3,'Mostrar','O que fizemos numa marmoraria de Arujá')+c(4,'Decidir','Se fizer sentido, o caminho para começar',1)+'</div><p class="p">Combinado? No final, mesmo que a gente não trabalhe junto, você sai com um número em reais do que está parado aí.</p>'+foot('Agenda')+'</div>'}},
{t:'Validação 1 · Dores',n:'Pergunte "qual dessas mais pesa aí?" e marque a dor no painel. A partir daqui a apresentação inteira segue essa dor.',r:function(){var d=[['1','Cliente visualiza e ninguém volta a falar com ele.'],['2','Ninguém sabe a data de entrega sem perguntar ao encarregado.'],['3','Obra pronta que não foi cobrada, caixa que ninguém enxerga.'],['4','Compra de última hora, obra parada esperando material.']];return '<div class="slide"><div class="row" style="justify-content:space-between;align-items:flex-end"><h2>Qual dessas mais pesa '+na()+'?</h2><span class="kicker">VALIDAÇÃO 1</span></div><div class="grid2">'+d.map(function(x){var s=S.dor===x[0];return '<div class="card'+(s?' sel':'')+'"'+(S.dor&&!s?' style="opacity:.45"':'')+'><div class="row" style="justify-content:space-between"><h3>'+DOR[x[0]].nome+'</h3>'+(s?'<span class="pill" style="background:var(--gold);font-size:20px;padding:6px 16px">A MAIS URGENTE</span>':'')+'</div><p style="font-size:28px;line-height:1.4" class="mut">'+x[1]+'</p></div>'}).join('')+'</div>'+foot('Diagnóstico')+'</div>'}},
{t:'Perguntas',n:'Comece pela área da dor principal (destacada). Preencha no painel enquanto ele responde. Número que ele não sabe já é um achado.',r:function(){var c=calc();var R={'1':['Orçamento','Quantos saíram no último mês? Quantos fecharam? Qual o valor médio?',F(S.orc)+' saíram · '+F(S.fech)+' fecharam<br>médio '+FB(S.medio)+(c.taxa!=null?'<br><span class="mut" style="font-size:24px">Fechamento de '+c.taxa+'%</span>':'')],'2':['Produção','Quantas obras na fila? Quantas atrasaram no último mês? Sabe a entrega de cada uma?',F(S.fila)+' na fila · '+F(S.atr)+' atrasaram<br>sabe as entregas: '+F(S.sabe,'sim / não')],'4':['Estoque','Quantas vezes por mês falta chapa? Quanto custa cada falta (frete, preço, dia parado)?',F(S.falta)+' faltas · '+FB(S.cf)+' cada'],'3':['Financeiro','Quanto tem a receber até o fim do ano? Quanto já venceu? Tem obra pronta sem cobrança?',FB(S.receber)+' a receber<br>'+FB(S.venc)+' vencido · '+FB(S.semcob)+' sem cobrança']};var ord=['1','2','4','3'];if(c.dor){ord.splice(ord.indexOf(c.dor),1);ord.unshift(c.dor)}return '<div class="slide"><div class="row" style="justify-content:space-between;align-items:flex-end"><h2>Como está a operação hoje</h2>'+(c.dor?'<span class="kicker">COMEÇANDO POR '+DOR[c.dor].area.toUpperCase()+'</span>':'')+'</div><table><tr><th style="width:260px">ÁREA</th><th>PERGUNTA</th><th style="width:520px">RESPOSTA</th></tr>'+ord.map(function(k){return '<tr'+(k===c.dor?' class="hl"':'')+'><td><b>'+R[k][0]+'</b></td><td>'+R[k][1]+'</td><td>'+R[k][2]+'</td></tr>'}).join('')+'</table>'+foot('Diagnóstico')+'</div>'}},
{t:'Validação 2 · Conta',n:'Faça a conta em voz alta com os números dele e pergunte: "esse número faz sentido pra você?". Espere a resposta.',r:function(){var c=calc();var D=c.D||DOR['1'];return '<div class="slide dark" style="justify-content:center;gap:54px"><div class="row" style="justify-content:space-between;align-items:flex-end"><h2>A conta: <em>'+D.curto.charAt(0).toUpperCase()+D.curto.slice(1)+'</em></h2><span class="kicker">VALIDAÇÃO 2</span></div><div class="row" style="align-items:center;justify-content:space-between">'+formula(c)+'</div><div style="background:var(--gold);color:#0D0D0D;border-radius:24px;padding:36px 56px;display:flex;justify-content:space-between;align-items:center;gap:40px"><span style="font-size:34px;font-weight:700;line-height:1.3">Em cima da mesa '+na()+'<br><span style="font-size:26px;font-weight:500">'+D.mesa+', '+D.periodo+'</span></span><span class="serif" style="font-size:88px;font-weight:900;white-space:nowrap">'+(c.mesa!=null?brl(c.mesa):'R$ ______')+'</span></div>'+outrosTxt(c,'#D9CFBE')+foot('Diagnóstico')+'</div>'}},
{t:'Caso real',n:'Fale como "uma marmoraria aqui de Arujá"; a Real Pedras autorizou os números. O cartão destacado é o da dor dele.',r:function(){var c=calc();var hi={'1':0,'3':2}[c.dor];var s=function(i,v,t){return '<div class="card'+(hi===i?' sel':'')+'"><span class="num" style="font-size:84px">'+v+'</span><p style="font-size:28px;line-height:1.35">'+t+'</p></div>'};return '<div class="slide"><div style="display:flex;flex-direction:column;gap:14px"><span class="kicker">CASO REAL · MARMORARIA EM ARUJÁ-SP</span><h2>O que apareceu quando a operação entrou no sistema</h2></div><div class="grid4">'+s(0,'R$ 82 mil','em orçamentos parados, que ninguém tinha retomado')+s(1,'R$ 136,8 mil','a receber mapeados semana a semana até dezembro')+s(2,'R$ 13 mil','em obras prontas que ainda não tinham cobrança')+s(3,'67%','de margem sobre o material em outubro, medida por pedido')+'</div><p class="p">Nada disso era novo. O dinheiro já estava lá; faltava enxergar e agir.</p>'+foot('Dados do sistema MarmoApp em 03/11/2026')+'</div>'}},
{t:'Validação 3 · Em cima da mesa',n:'Deixe o número na tela, faça a pergunta e fique em silêncio. Repita com as palavras dele o valor que ele disser.',r:function(){var c=calc();var D=c.D||DOR['1'];return '<div class="slide gold" style="justify-content:center;gap:40px"><span class="kicker" style="color:#0D0D0D">VALIDAÇÃO 3 · '+(S.empresa?esc(S.empresa).toUpperCase():'SUA MARMORARIA')+'</span><span class="serif" style="font-size:200px;font-weight:900;line-height:1">'+(c.mesa!=null?brl(c.mesa):'R$ ______')+'</span><p style="font-size:40px;font-weight:700;color:#2A2312">'+D.mesa+', '+D.periodo+'. '+D.frase+'</p><h2 style="font-size:64px;width:1500px">'+D.pergunta+'</h2>'+(c.rec10!=null?'<p style="font-size:30px;color:#2A2312">Retomar 1 em cada 10 já seria cerca de <b>'+brl(c.rec10)+'</b>.</p>':'')+foot('Diagnóstico')+'</div>'}},
{t:'Método',n:'Reforce que não é só software: tem gente implantando junto e acompanhando todo mês.',r:function(){var c=function(k,t,d,b){return '<div class="card'+(b?' blk':'')+'" style="flex:1"><span class="kicker">'+k+'</span><h3 style="font-size:40px">'+t+'</h3><p style="font-size:28px;line-height:1.4'+(b?';color:#D9CFBE':'')+'" class="'+(b?'':'mut')+'">'+d+'</p></div>'};var a='<span class="serif" style="font-size:60px;color:var(--gold);align-self:center">→</span>';return '<div class="slide"><h2>A agência implanta. <em>O sistema sustenta.</em></h2><div class="row" style="align-items:stretch">'+c('PASSO 1 · HOJE','Diagnóstico','O que acabamos de fazer: o que está em cima da mesa e a prioridade.')+a+c('PASSO 2 · 3 SEMANAS','Implantação','Cadastro de pedras, serviços e preços, rotinas desenhadas e equipe treinada.')+a+c('PASSO 3 · TODO MÊS','Acompanhamento','Reunião com os números do mês: orçamentos, fila, caixa e o que ajustar.',1)+'</div><p class="p">Você não precisa aprender sistema sozinho nem trocar a equipe. A produção pode continuar na ficha de papel.</p>'+foot('Como funciona')+'</div>'}},
{t:'Pilares',n:'Aponte o pilar destacado: é o que resolve a dor dele. O atendimento no WhatsApp entra com data de ativação no contrato.',r:function(){var c=calc();var hi=c.D?c.D.pilar:-1;if(c.dor==='1')hi=-2;var p=[['Orçamento','Tabela da sua marmoraria. O Antônio orça por texto ou áudio.'],['Produção','Fila de obras, ficha semanal, previsão de entrega.'],['Estoque','Chapas e insumos por obra, pedidos da equipe, estoque mínimo.'],['Financeiro','A receber e a pagar, caixa semana a semana, margem por pedido.'],['Atendimento','O Antônio no seu WhatsApp: responde, pré-orça e retoma quem sumiu.']];return '<div class="slide"><h2>Onde a IA resolve '+(c.D?c.D.curto:'cada etapa')+'</h2><div class="grid5">'+p.map(function(x,i){var s=(hi===i)||(hi===-2&&(i===0||i===4));return '<div class="card'+(s?' sel':'')+'" style="padding:34px'+(c.D&&!s?';opacity:.5':'')+'"><h3 style="font-size:32px">'+x[0]+'</h3><p style="font-size:25px;line-height:1.4" class="mut">'+x[1]+'</p>'+(s?'<span class="kicker" style="font-size:20px">RESOLVE A SUA DOR</span>':'')+'</div>'}).join('')+'</div>'+foot('O que entra na operação')+'</div>'}},
{t:'Âncora de valor',n:'Mostre o preço cheio contra o que está em cima da mesa. Ainda não fale em desconto.',r:function(){var c=calc();var D=c.D||DOR['1'];return '<div class="slide"><h2>Quanto custa deixar como está?</h2><div class="grid2"><div class="card blk" style="padding:52px"><span class="kicker">EM CIMA DA MESA · '+D.periodo.toUpperCase()+'</span><span class="num" style="font-size:108px">'+(c.mesa!=null?brl(c.mesa):'R$ ______')+'</span><p class="p" style="color:#D9CFBE">'+D.mesa.charAt(0).toUpperCase()+D.mesa.slice(1)+(S.empresa?' na '+esc(S.empresa):'')+'.</p></div><div class="card" style="padding:52px"><span class="kicker">COM A MARMORARIA · 3 MESES</span><span class="num" style="font-size:108px">'+brl(c.custo3)+'</span><p class="p mut">'+c.P.nome+' na tabela cheia: implantação de '+brl(c.P.impl)+' + 3 mensalidades de '+brl(c.P.cheio)+'.</p></div></div><p class="p">'+(c.pct!=null?'O plano custa <b>'+c.pct+'%</b> do que está em cima da mesa. ':'')+'Resolver '+D.curto+' paga a conta; o resto é lucro que hoje fica na rua.</p>'+foot('Valor')+'</div>'}},
{t:'Planos (tabela cheia)',n:'Mostre a tabela cheia sem falar de desconto. Explique só o plano recomendado.',r:function(){var c=calc();return '<div class="slide" style="gap:36px"><h2>Três formas de começar</h2><div class="row" style="align-items:stretch">'+['gestao','operacao','crescimento'].map(function(k){var P=PLANS[k],s=k===c.pk;return '<div class="card'+(s?' blk sel':'')+'" style="flex:1;gap:20px"><div class="row" style="justify-content:space-between;align-items:center"><h3>'+P.nome+'</h3>'+(s?'<span class="pill" style="background:var(--gold);color:#0D0D0D;font-size:19px;padding:6px 14px">RECOMENDADO</span>':'')+'</div><p style="font-size:25px'+(s?';color:#D9CFBE':'')+'" class="'+(s?'':'mut')+'">'+P.sub+'</p><span class="num" style="font-size:70px'+(s?'':';color:var(--ink)')+'">'+brl(P.cheio)+'<span style="font-family:DM Sans,sans-serif;font-size:26px;font-weight:500">/mês</span></span><p style="font-size:24px'+(s?';color:#D9CFBE':'')+'" class="'+(s?'':'mut')+'">Implantação '+brl(P.impl)+P.extra+'</p><ul class="l">'+P.itens.map(function(i){return '<li>'+i+'</li>'}).join('')+'</ul></div>'}).join('')+'</div>'+foot('Planos · tabela a partir de janeiro de 2027')+'</div>'}},
{t:'Validação 4 · Escolha',n:'Recomende um plano só, com convicção, e pergunte "faz sentido?".',r:function(){var c=calc();var rw=function(k,t){return '<tr'+(k===c.pk?' class="hl"':'')+'><td>'+t+'</td><td><b'+(k===c.pk?' style="color:var(--gold-dk)"':'')+'>'+PLANS[k].nome+'</b></td></tr>'};return '<div class="slide"><div class="row" style="justify-content:space-between;align-items:flex-end"><h2>Qual resolve o que você me contou?</h2><span class="kicker">VALIDAÇÃO 4</span></div><table><tr><th>SE A SUA MARMORARIA…</th><th style="width:520px">O PLANO É</th></tr>'+rw('gestao','Tem até 4 pessoas e quer controle de produção, estoque e caixa')+rw('operacao','Tem 5 pessoas ou mais, ou perde orçamento que o cliente não responde')+rw('crescimento','Já é organizada, tem capacidade sobrando e quer mais obras')+'</table><p class="p">'+(c.D?'O que mais pesa '+na()+' é '+c.D.curto+(c.mesa!=null?', com <b>'+brl(c.mesa)+'</b> em cima da mesa':'')+'. ':'')+'Por isso eu iria de <b style="color:var(--gold-dk)">'+c.P.nome+'</b>. Faz sentido para você?</p>'+foot('Escolha')+'</div>'}},
{t:'Urgência',n:'A urgência é real: o prazo acaba em 30/11 e as vagas dependem da sua agenda. Atualize as vagas restantes no painel.',r:function(){var v=n(S.vagas);return '<div class="slide dark" style="justify-content:center;gap:52px"><span class="pill" style="background:var(--cream);color:#0D0D0D">BLACK FRIDAY · ATÉ 30/11</span><h1 style="font-size:96px;width:1600px">Condição de fundador '+(v!=null?'<em>— restam '+v+(v===1?' vaga':' vagas')+' em dezembro</em>':'<em>para as primeiras marmorarias</em>')+'</h1><div class="row">'+[['Implantação grátis','Para quem fechar até 30/11.'],['Preço travado 12 meses','A tabela nova vale a partir de janeiro; o seu não muda.'],['Vagas limitadas','Cada implantação leva 3 semanas de trabalho dedicado.']].map(function(x){return '<div style="flex:1;border-top:3px solid var(--gold);padding-top:22px;display:flex;flex-direction:column;gap:10px"><h3>'+x[0]+'</h3><p style="font-size:28px;line-height:1.4;color:#D9CFBE">'+x[1]+'</p></div>'}).join('')+'</div>'+foot('Condição válida até 30/11/2026')+'</div>'}},
{t:'Fechamento',n:'Diga o valor do plano recomendado, compare com o que está em cima da mesa e pergunte: "faz sentido a gente começar?". Depois fique em silêncio.',r:function(){var c=calc();var P=c.P;var eco=(P.cheio-P.fund)*12+P.impl;var rw=function(k){var Q=PLANS[k],s=k===c.pk,e=(Q.cheio-Q.fund)*12+Q.impl;return '<tr'+(s?' class="hl"':'')+'><td><b'+(s?' style="color:var(--gold-dk)"':'')+'>'+Q.nome+'</b></td><td>'+(Q.cheio!==Q.fund?'<span class="strike">'+brl(Q.cheio)+'</span>':'')+'<b>'+brl(Q.fund)+'</b>'+Q.extra.replace(' por ','/')+'</td><td><span class="strike">'+brl(Q.impl)+'</span><b>R$ 0</b></td><td'+(s?' style="font-weight:700;color:var(--gold-dk)"':'')+'>'+brl(e)+'</td></tr>'};var ano=P.fund*12;return '<div class="slide" style="gap:34px"><h2>'+(S.empresa?'Proposta para a '+esc(S.empresa):'Valores para fechar até 30/11')+'</h2><div style="background:var(--black);color:var(--cream);border-radius:24px;padding:32px 44px;display:flex;justify-content:space-between;align-items:center;gap:40px"><div style="display:flex;flex-direction:column;gap:8px"><span class="kicker" style="color:var(--gold)">'+P.nome.toUpperCase()+' · CONDIÇÃO DE FUNDADOR</span><span style="font-size:28px;color:#D9CFBE">'+(P.cheio!==P.fund?'De '+brl(P.cheio)+' por ':'')+'<b style="color:var(--cream)">'+brl(P.fund)+'/mês</b> travado por 12 meses · implantação de '+brl(P.impl)+' por <b style="color:var(--cream)">R$ 0</b></span>'+(c.mesa!=null?'<span style="font-size:26px;color:#D9CFBE">Um ano inteiro de plano custa '+brl(ano)+'. Em cima da mesa: <b style="color:var(--gold)">'+brl(c.mesa)+'</b>.</span>':'')+'</div><div style="text-align:right;flex-shrink:0"><span style="font-size:22px;color:#D9CFBE">Economia no 1º ano</span><br><span class="serif" style="font-size:72px;font-weight:900;color:var(--gold)">'+brl(eco)+'</span></div></div><table><tr><th>PLANO</th><th>MENSAL (12 MESES)</th><th>IMPLANTAÇÃO</th><th>ECONOMIA NO 1º ANO</th></tr>'+rw('gestao')+rw('operacao')+rw('crescimento')+'</table><p style="font-size:25px" class="mut">Bônus nos planos Operação: Raio-X do caixa semana a semana até março e lançamento no sistema dos orçamentos e obras em aberto.</p>'+foot('Fechamento')+'</div>'}},
{t:'Garantia',n:'Use para responder "e se não der certo?". Confira a data de ativação do Antônio no painel.',r:function(){var c=function(t,d){return '<div class="card" style="flex:1;padding:48px"><h3 style="font-size:40px">'+t+'</h3><p style="font-size:28px;line-height:1.45" class="mut">'+d+'</p></div>'};return '<div class="slide"><h2>O risco fica com a gente</h2><div class="row" style="align-items:stretch">'+c('30 dias para desistir','Nos planos com fidelidade de 3 meses, você cancela no primeiro mês sem multa.')+c('Antônio no WhatsApp com data','Ativação até '+(S.ativacao?esc(S.ativacao):'[data]')+', escrita no contrato. Até lá, você paga R$ 297 por mês.')+c('Implantação feita por nós','Cadastro, rotinas e treino da equipe. Você não precisa parar a produção.')+'</div>'+foot('Garantia')+'</div>'}},
{t:'Próximos passos',n:'Marque a reunião de início antes de desligar. Se ele for pensar, salve com "Vai pensar", copie o resumo e mande hoje.',r:function(){var s=function(k,t,d){return '<div style="flex:1;border-top:3px solid var(--gold);padding-top:26px;display:flex;flex-direction:column;gap:14px"><span class="kicker">'+k+'</span><h3>'+t+'</h3><p style="font-size:28px;line-height:1.4" class="mut">'+d+'</p></div>'};return '<div class="slide"><h2>Se fizer sentido, começamos assim</h2><div class="row" style="gap:32px">'+s('HOJE','Confirmação','Link de pagamento da 1ª mensalidade e contrato de 1 página, pelo WhatsApp.')+s('SEMANA 1','Reunião de início','Levantamos pedras, serviços, preços e quem faz o quê.')+s('SEMANAS 1 A 3','Implantação','Sistema configurado, orçamentos e obras em aberto lançados, equipe treinada.')+s('FIM DO 1º MÊS','Primeiros números','Reunião de indicadores: o que saiu de cima da mesa.')+'</div><p class="p">'+(S.contato?esc(S.contato.split(' ')[0])+', p':'P')+'osso te mandar o link agora e já marcamos a reunião de início?</p>'+foot('Próximos passos')+'</div>'}},
{t:'Encerramento',n:'Agradeça e reforce: a condição de fundador vale até 30/11.',r:function(){return '<div class="slide dark" style="justify-content:space-between;padding:120px 128px">'+M+'<h1>Orçou. Produziu. <em>Recebeu.</em></h1><div class="row" style="justify-content:space-between;align-items:flex-end"><div style="display:flex;flex-direction:column;gap:10px"><span class="serif" style="font-size:48px;font-weight:700">Marmorar<span style="color:var(--gold)">IA</span></span><span style="font-size:28px;color:#D9CFBE">Vinicius · WhatsApp (11) 94734-0955 · marmoapp.com</span></div><span style="font-size:24px;color:#9B8F7E">Uma família no mármore desde 1972</span></div></div>'}}
];
var stage=document.getElementById('stage');
function fit(){var vp=document.getElementById('viewport');var s=Math.min(vp.clientWidth/1920,vp.clientHeight/1080)*0.96;stage.style.transform='translate(-50%,-50%) scale('+s+')'}
function render(){stage.innerHTML=SLIDES[cur].r();document.getElementById('count').textContent=(cur+1)+' / '+SLIDES.length+' · '+SLIDES[cur].t;document.getElementById('notes').textContent=SLIDES[cur].n;renderCalc()}
function renderCalc(){var c=calc();var h='<b>Em cima da mesa</b>'+(c.D?' ('+c.D.area+')':'')+': <b>'+(c.mesa!=null?brl(c.mesa):'—')+'</b>';if(c.outros.length)h+='<br>Outras áreas: '+c.outros.map(function(o){return o[0]+' '+brl(o[1])}).join(' · ');if(c.taxa!=null)h+='<br>Fechamento de orçamentos: <b>'+c.taxa+'%</b>';var FX={ate_15:'até R$ 15 mil','15_40':'R$ 15–40 mil','40_80':'R$ 40–80 mil','80_150':'R$ 80–150 mil','150_300':'R$ 150–300 mil','300_mais':'+ R$ 300 mil'};if(S.faturamento||S.score!=null)h+='<br>Perfil: '+(S.faturamento?'faturamento <b>'+FX[S.faturamento]+'</b>':'')+(S.encaixe?' · '+({agencia:'encaixa na agência',gestao:'perfil Gestão com IA',cedo:'ainda cedo'}[S.encaixe]||''):'')+(S.score!=null?' · nota <b>'+S.score+'/100</b>':'');if(S.origem_formulario)h+='<br><span style="color:#8F8372">Veio do formulário do site</span>';h+='<br>Plano recomendado: <b>'+c.P.nome+'</b>'+(c.pct!=null?' ('+c.pct+'% do que está na mesa em 3 meses)':'');document.getElementById('calc').innerHTML=h}
function go(i){cur=Math.max(0,Math.min(SLIDES.length-1,i));render();try{history.replaceState(null,'','#slide-'+(cur+1))}catch(e){}}
var fields=document.querySelectorAll('[data-k]');
function fillForm(){fields.forEach(function(el){el.value=S[el.dataset.k]==null?'':S[el.dataset.k]})}
fields.forEach(function(el){el.addEventListener('input',function(){S[el.dataset.k]=el.value;dirty=true;render()})});
var dirty=false;
function toast(t){var el=document.getElementById('toast');el.textContent=t;el.style.opacity=1;clearTimeout(toast._t);toast._t=setTimeout(function(){el.style.opacity=0},2200)}
function info(t){document.getElementById('saveInfo').textContent=t}
/* Guardar: no painel do MarmoApp grava no banco; fora dele, só neste navegador. */
var store=API?{
  list:function(){return fetch(API,{credentials:'same-origin'}).then(function(r){if(!r.ok)throw new Error(r.status);return r.json()}).then(function(j){return j.diagnosticos||[]})},
  get:function(id){return fetch(API+'?id='+encodeURIComponent(id),{credentials:'same-origin'}).then(function(r){if(!r.ok)throw new Error(r.status);return r.json()}).then(function(j){return j.diagnostico})},
  save:function(st){var c=calc();return fetch(API,{method:'POST',credentials:'same-origin',headers:{'Content-Type':'application/json'},body:JSON.stringify({estado:st,calculo:{dor:c.dor,valor_na_mesa:c.mesa,valor_total:c.total,plano:c.pk,taxa_fechamento:c.taxa}})}).then(function(r){return r.json().then(function(j){if(!r.ok)throw new Error(j.error||r.status);return j})})},
  del:null
}:{
  all:function(){try{return JSON.parse(localStorage.getItem(KEY)||'{}')}catch(e){return {}}},
  list:function(){var o=this.all();return Promise.resolve(Object.keys(o).sort().map(function(k){return {id:k,empresa:k,resultado:o[k].resultado}}))},
  get:function(id){return Promise.resolve(this.all()[id]||null)},
  save:function(st){var o=this.all();st.id=st.empresa;o[st.empresa]=st;try{localStorage.setItem(KEY,JSON.stringify(o))}catch(e){return Promise.reject(new Error('Este navegador não permite salvar'))}return Promise.resolve({id:st.empresa})},
  del:function(id){var o=this.all();delete o[id];try{localStorage.setItem(KEY,JSON.stringify(o))}catch(e){}return Promise.resolve()}
};
var RES={em_aberto:'',fechou:' · fechou',vai_pensar:' · vai pensar',perdido:' · perdido'};
function refreshSaved(sel){store.list().then(function(L){var s=document.getElementById('saved');s.innerHTML='<option value="">— novo cliente —</option>'+L.map(function(x){return '<option value="'+esc(x.id)+'"'+(String(x.id)===String(sel)?' selected':'')+'>'+esc(x.empresa||'(sem nome)')+(RES[x.resultado]||'')+(x.formulario?' · formulário'+(x.score!=null?' '+x.score:''):'')+'</option>'}).join('')}).catch(function(e){info('Não consegui carregar os clientes: '+e.message)})}
document.getElementById('savedLegend').textContent=API?'Clientes no banco do MarmoApp':'Clientes salvos neste navegador';
if(!store.del)document.getElementById('del').style.display='none';
if(API){var gc=document.getElementById('gerarContrato');gc.style.display='';gc.onclick=function(){if(!S.id){toast('Salve o cliente antes de gerar o contrato');return}if(dirty){doSave()}window.open('/contratos/novo?diagnostico='+encodeURIComponent(S.id),'_blank')}}
function doSave(){if(!S.empresa){toast('Preencha o nome da marmoraria');return}info('Salvando…');store.save(S).then(function(r){if(r.id)S.id=r.id;if(r.lead_id)S.lead_id=r.lead_id;dirty=false;toast(API?'Salvo no banco do MarmoApp':'Cliente salvo neste navegador');info('Salvo às '+new Date().toLocaleTimeString('pt-BR',{hour:'2-digit',minute:'2-digit'}));refreshSaved(S.id)}).catch(function(e){toast('Não salvou: '+e.message);info('Erro ao salvar: '+e.message)})}
document.getElementById('save').onclick=doSave;
document.getElementById('new').onclick=function(){S=blankState();dirty=false;fillForm();refreshSaved('');info('');go(0)};
document.getElementById('del').onclick=function(){var k=document.getElementById('saved').value;if(!k||!store.del)return;store.del(k).then(function(){refreshSaved('');toast('Cliente excluído')})};
document.getElementById('saved').onchange=function(){var k=this.value;if(!k){S=blankState();fillForm();render();return}store.get(k).then(function(d){S=Object.assign(blankState(),d||{});dirty=false;fillForm();render();info('')}).catch(function(e){toast('Não abriu: '+e.message)})};
document.getElementById('copy').onclick=function(){var c=calc();var t='Oi'+(S.contato?', '+S.contato.split(' ')[0]:'')+'! Segue o resumo do diagnóstico da '+(S.empresa||'marmoraria')+':\n\n'+(c.D?'• O que mais pesa hoje: '+c.D.curto+'\n':'')+(c.mesa!=null?'• Em cima da mesa: '+brl(c.mesa)+' '+(c.D?c.D.mesa+', '+c.D.periodo:'')+'\n':'')+c.outros.map(function(o){return '• '+o[0]+': '+brl(o[1])+'\n'}).join('')+(c.taxa!=null?'• Fechamento de orçamentos: '+c.taxa+'%\n':'')+'\nPlano recomendado: '+c.P.nome+'\nCondição de fundador até 30/11: '+brl(c.P.fund)+'/mês travado por 12 meses'+c.P.extra+' e implantação de '+brl(c.P.impl)+' por R$ 0.'+(n(S.vagas)!=null?'\nRestam '+n(S.vagas)+' vagas de implantação em dezembro.':'')+'\n\nQualquer dúvida, é só me chamar. Vinicius — MarmorarIA';var fb=function(){var ta=document.querySelector('[data-k="obs"]');ta.value=t;ta.select();toast('Copie o texto do campo Observações')};try{navigator.clipboard.writeText(t).then(function(){toast('Resumo copiado')},fb)}catch(e){fb()}};
function toggleP(){document.getElementById('panel').classList.toggle('hide');setTimeout(fit,260)}
document.getElementById('prev').onclick=function(){go(cur-1)};document.getElementById('next').onclick=function(){go(cur+1)};
document.getElementById('togglePanel').onclick=toggleP;document.getElementById('closePanel').onclick=toggleP;
function full(){var d=document.documentElement;try{if(!document.fullscreenElement){document.getElementById('panel').classList.add('hide');var p=d.requestFullscreen&&d.requestFullscreen();if(p&&p.catch)p.catch(function(){toast('Tela cheia indisponível aqui')})}else document.exitFullscreen()}catch(e){toast('Tela cheia indisponível aqui')}setTimeout(fit,300)}
document.getElementById('full').onclick=full;
document.addEventListener('keydown',function(e){if((e.ctrlKey||e.metaKey)&&(e.key==='s'||e.key==='S')){e.preventDefault();doSave();return}var tg=e.target.tagName;if(tg==='INPUT'||tg==='TEXTAREA'||tg==='SELECT')return;if(e.key==='ArrowRight'||e.key===' '||e.key==='PageDown'){e.preventDefault();go(cur+1)}else if(e.key==='ArrowLeft'||e.key==='PageUp'){go(cur-1)}else if(e.key==='f'||e.key==='F'){full()}else if(e.key==='e'||e.key==='E'){toggleP()}});
stage.addEventListener('click',function(e){var r=stage.getBoundingClientRect();if(e.clientX>r.left+r.width/2)go(cur+1);else go(cur-1)});
window.addEventListener('resize',fit);document.addEventListener('fullscreenchange',function(){setTimeout(fit,100)});
window.addEventListener('beforeunload',function(e){if(dirty&&S.empresa){e.preventDefault();e.returnValue=''}});
fillForm();refreshSaved('');var h=(location.hash.match(/slide-(\d+)/)||[])[1];fit();go(h?parseInt(h,10)-1:0);
})();
</script>
</body>
</html>
`
