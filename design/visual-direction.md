# Bravy Lives v2 — referência visual aprovada

Registrado em 04/11/2026 a pedido do JP. Esta é a memória de projeto para futuros trabalhos de design.

## Referência principal

Fintpay — Minimal Finance Dashboard UI, Real-Time Income & SaaS Expense, de Imrul Kayes / Taqwah.

Fonte: https://dribbble.com/shots/26280320-Minimal-Finance-Dashboard-UI-Real-Time-Income-SaaS-Expense

Imagens fornecidas pelo JP, preservadas sem edição:

- `references/fintpay/01-overview-perspective.png`
- `references/fintpay/02-full-dashboard.png` — guia principal para composição e proporções.
- `references/fintpay/03-chart-details.png`
- `references/fintpay/04-lower-panels.png`
- `references/fintpay/05-laptop-context.png`

## Decisões

- Tema claro: branco predominante, cinzas neutros leves, bordas discretas.
- JP pediu diferenciar os cards brancos do fundo e depois suavizar ainda mais: usar cinza quase branco `#F8F9F7` no container principal do dashboard, mantendo os cards brancos e preservando o tema escuro.
- Tipografia sans-serif neutra, títulos de UI fortes, números em destaque. Não copiar a inclinação dos mockups em perspectiva como itálico.
- Verde floresta como cor de destaque e verde-lima nos gráficos e sinais de atividade; gradiente localizado no módulo principal, como na referência.
- Sidebar branca, ampla o suficiente para rótulos legíveis, com ícones outline e estado ativo discreto.
- Composição fluida para telas largas; evitar o container de 1.400 px que deixa grandes faixas vazias.
- Hierarquia assimétrica: um módulo principal de destaque, uma região analítica ampla e módulos secundários compactos. Não dar o mesmo peso a todas as métricas.
- Cantos suaves, sombras mínimas, espaçamento consistente; UI de produto, não peça editorial.
- Preservar o domínio de webinars do Bravy Lives. A referência financeira orienta a linguagem visual, não os rótulos, dados ou funções do produto.

## Rejeições explícitas

O JP rejeitou o primeiro estudo visual com a skill Bravy Design System: terracota, marfim, serifas e a identidade editorial não devem ser reutilizados como padrão desta UI. O estudo de Tempo real exportado anteriormente em `exports/QVDXd.png` é uma proposta rejeitada, não uma fonte de verdade.

## Escopo da primeira tela

### Revisão de conteúdo — 04/11/2026

JP aprovou o estilo da implementação (cores, tipografia e sidebar), mas rejeitou o conteúdo dos cards e a distribuição inicial. Prioridade: **resultado do webinar — público, vendas e conversão**. A menção inicial a leads foi corrigida pelo JP: a captação acontece fora da plataforma. O resumo deve ser compacto, o funil deve ter destaque e a evolução temporal complementa a análise. Público ao vivo é um atalho; calendário, dispositivos, regiões e ranking de atendimento não devem disputar espaço na primeira tela. Não voltar ao hero gigante de faturamento ou repetir o mesmo total em vários cards. A nova distribuição ainda está em avaliação.

Métricas do dashboard principal usam eventos registrados (OPTIN, VIDEO_TICK, PITCH_REACHED, OFFER_CLICK) e vendas, não `Lead.sessionStart`/flags mutáveis como supostas sessões. A base é de acessos identificados na plataforma no período, deduplicados por pessoa/webinar; ela não representa inscrições ou captação externa. Conversão relaciona compradores identificados a essa base. Receita inclui somente BRL e data de registro. Fuso de exibição: Brasília; período inicial: últimos sete dias.

Dashboard principal + sidebar, implementados no frontend Next.js existente. Em 04/11/2026, JP corrigiu explicitamente a entrega estática: usar Tailwind, Tremor, Framer Motion e o catálogo `@/components/icons` (ClickUp Icons). Filtros, navegação e gráficos precisam ser interativos, com os dados e funções reais do aplicativo. Respeitar movimento reduzido. Não criar métricas ou séries fictícias para preencher o layout.

Os arquivos `v2/dashboard-sidebar-v2.png`, `v2/dashboard.html` e `v2/design-manifest.json` são estudos históricos. O HTML foi rejeitado como formato de entrega. A implementação interativa fica em `apps/web/src/app/dashboard` e `apps/web/src/components/{admin,dashboard,tremor}`. Não publicar em produção sem solicitação.


### Correção de contexto: webinar único e captação externa

JP esclareceu que mantém apenas um webinar rodando e capta leads fora desta plataforma. A tabela comparativa foi rejeitada para a primeira tela. **Não apresentar acessos observados na plataforma como leads captados ou como total da audiência externa.** O dashboard abre no webinar publicado; um único webinar exibe título, múltiplos permitem seleção, sempre preservando o período.

Nova referência: `references/funnel/original-information-reference.png`. JP aprovou as informações e a geometria afunilada, não o estilo escuro/vermelho. Manter visual claro verde da v2. Funil central de cinco etapas: acessos registrados → reprodução → pitch → clique na oferta → compra. Interação por clique, hover, toque e teclado; detalhe da etapa e alternância de percentuais sobre acessos ou etapa anterior. Comparações entre quantidades não devem ser descritas como perdas individuais comprovadas, pois compra pode ocorrer por outro caminho.

O resumo é comercial (faturamento, pedidos, conversão dos acessos), sem hero gigante. Evolução temporal vem abaixo. A base de acessos é a união de eventos identificados dentro da plataforma, incluindo quem retorna por cookie; captação externa permanece desconhecida. As estruturas de tabela/leads criadas no estudo anterior estão superadas para a página principal.

### Funil: primeira interpretação rejeitada

JP rejeitou o funil horizontal com cinco trapézios verdes e números acima: ficou praticamente igual ao original. Não repetir esse desenho apenas recolorindo-o. A nova proposta em avaliação usa uma composição vertical contínua com bordas curvas, lista de etapas à esquerda e painel de inspeção à direita. A largura em cada marcador permanece proporcional à contagem real. Hover antecipa detalhes; clique fixa a seleção; teclado e toque oferecem as mesmas informações. A aprovação do estilo geral do dashboard não significa aprovação deste novo desenho do funil.

### Direção atual: esboço do JP

Referência de composição mais recente: `references/sketches/dashboard-layout-jp.png`. JP pediu para iterar e profissionalizar, não copiar literalmente. Este pedido substitui a exclusão anterior do mapa e dos indicadores de atendimento da primeira tela.

- Topo assimétrico: resultado financeiro compacto (faturamento, ticket médio, comparação com período anterior, vendas e conversão) e gráfico de engajamento no vídeo à direita.
- Centro: funil em barras horizontais arredondadas, centralizadas e progressivamente menores, empilhadas verticalmente; cinco etapas com quantidade e percentual ao lado. Seleção persistente, preview por hover e detalhe comparativo no rodapé. Ao lado, mapa interativo do Brasil por UF, com ranking e localização desconhecida explícita.
- Base: atendimento humano e agentes de IA lado a lado, com conversas respondidas, respostas enviadas e tempo médio de primeira resposta.
- Preservar visual Fintpay e filtros por webinar/período. Não reintroduzir leads captados externamente ou comparação tabular entre webinars.
- Tempo assistido: `Lead.watchedSec` é acumulado por pessoa/webinar; mostrar como média acumulada do público observado. A curva mostra posição máxima registrada no período, não tempo histórico exato nem prova de reprodução contínua. O tracking não persiste deltas históricos de tempo assistido.
- Mapa usa última localização aproximada conhecida da pessoa, não snapshot histórico nem localização ao vivo. Atendimento conta mensagens reais do período; uma conversa pode ter respostas dos dois canais.
- Prévia local usa conta isolada identificada como demonstração. Fixtures sintéticas ficam separadas das consultas de produção; não preencher lacunas reais com valores fictícios na UI.

### Funil: referência de fluxo em camadas — 05/11/2026

JP rejeitou o funil de barras arredondadas e forneceu `references/funnel/layered-flow-reference.png`. Esta referência substitui o desenho de barras no centro do esboço. Usar fluxo horizontal contínuo, faixas aninhadas, curvas suaves com pequenos platôs e checkpoints verticais com contagens em pílulas sobre o fluxo. Preservar a composição geral do dashboard e o visual claro/verde.

A espessura externa corresponde à quantidade de cada etapa. As faixas internas são tratamento visual da mesma série, não categorias ou coortes inventadas. Permitir alargamentos quando os dados reais aumentarem. No celular, preservar rótulos legíveis com rolagem horizontal interna; teclado e toque selecionam as mesmas etapas. Esta interpretação permanece em avaliação pelo JP.

### Prévia preenchida — 05/11/2026

JP pediu explicitamente dados mockados para visualizar o dashboard completo. Esta autorização substitui a restrição a dados fictícios **na prévia de desenvolvimento**, não nas consultas reais. `src/lib/dashboard-demo.ts` fornece um cenário determinístico para o webinar Dominando Claude Code, com faturamento, funil, alcance no vídeo, localização e atendimento coerentes entre si. O filtro de período recalcula o cenário.

- Em `NODE_ENV=development`, `/dashboard` abre com dados de demonstração; `?demo=0` volta às consultas reais. O seletor de período preserva o modo.
- A UI identifica os dados e a audiência simulada. Nenhuma mensagem, venda, acesso ou webinar de demonstração é gravado no banco.
- Em produção, o modo demonstração fica desativado inclusive com `?demo=1`; autenticação permanece obrigatória.
- Na revisão seguinte, JP pediu remover o selo "Dados de demonstração" e o link "Ver dados reais". Não reintroduzir esses controles na interface; o cenário local e a proteção de produção permanecem.

### Cabeçalho mínimo

Na revisão do shell, JP pediu remover o header global com breadcrumb e menu de usuário. O conteúdo principal começa no topo; avatar, nome/e-mail, configurações da conta e saída ficam no rodapé da sidebar, inclusive recolhida e no menu mobile. Tema e recolhimento permanecem na sidebar. No celular, usar um botão flutuante discreto para abrir a navegação, sem recriar uma faixa de header. Preservar o link acessível para pular ao conteúdo. Essa remoção não elimina os controles locais de audiência e período abaixo.

JP pediu reduzir a informação no topo e depois remover também "Visão geral": manter somente o seletor de período compacto à direita, com datas abreviadas legíveis. Remover título, subtítulo explicativo, badge de audiência, status e linha do webinar único. Quando houver mais de um webinar, manter um seletor discreto junto ao período. "Criar webinar" fica na listagem de Webinars, acessível pela sidebar.

Na revisão seguinte, JP pediu ocupar o espaço à esquerda com uma **prévia compacta de tempo real, na mesma linha da data**. Mostrar audiência atual e atalho ao painel; não reintroduzir título, subtítulo ou card adicional. A contagem real vem de `/api/dashboard/online`, escopada ao webinar selecionado, e não depende do período histórico. Falha de conexão não significa audiência zero. A prévia local mockada usa o cenário existente; nunca apontar para um ID de webinar fictício.

JP acrescentou um minigráfico junto à audiência atual e indicadores discretos de média e pico. A curva Tremor e as duas estatísticas usam as mesmas amostras registradas nos últimos 60 minutos, independentemente do filtro de datas. Sem amostras, exibir ausência de histórico e `—`; intervalos não observados permanecem lacunas. Em telas estreitas, preservar número, minicurva e data na mesma linha; média/pico continuam na descrição acessível e no tooltip. Sem eixos, grade ou card adicional.

O gráfico agora é uma área de inspeção independente dos atalhos: hover, toque e setas mostram o horário exato da observação (Brasília, com segundos) e sua contagem; lacunas não geram valor. Tooltip abaixo da curva; Escape fecha. JP rejeitou o ícone de antena com halo pulsante. Usar indicador geométrico pequeno com ponto central e ondas finas; animar somente a opacidade das ondas, sem zoom ou halo, respeitando movimento reduzido.

### Seleção de localização

JP pediu remover o seletor "Todas as UFs": o próprio mapa já permite escolher o estado. Manter clique, toque e teclado nos estados, com botão discreto para restaurar a visão do Brasil quando houver seleção. Não reintroduzir um dropdown de UF redundante.

### Refinamento interativo do funil — 05/11/2026

JP pediu um funil menos estático e com informações mais relevantes. O refinamento mantém o fluxo horizontal em camadas, com revelação inicial, marcador que acompanha a inspeção e painel contextual. Hover antecipa; clique/toque fixa; setas exploram; Escape restaura a etapa fixada. Respeitar movimento reduzido, sem movimento contínuo que sugira tráfego ao vivo.

Na revisão seguinte, JP rejeitou o traço vertical contínuo com bolinha na ponta como marcador ativo. Não reintroduzir esse indicador; destacar a etapa pela pílula e pelo fundo suave.

- As pílulas continuam mostrando o total independente de cada etapa. O modo “Sobre acessos” mantém a base de acessos identificados.
- `funnelTransitions` cruza os conjuntos de pessoas de etapas adjacentes no mesmo período e webinar, a partir dos registros já consultados. “Entre etapas” usa a interseção dividida pela população anterior; não a simples razão entre totais. Esse cruzamento não demonstra ordem cronológica.
- O painel mostra pessoas em comum, pessoas da etapa anterior sem registro na atual e registros exclusivos da atual, incluindo compradores sem clique registrado. Nunca chamar ausência de registro de abandono comprovado.
- JP rejeitou e pediu remover o bloco “Ponto de atenção” acima do fluxo. Não reintroduzir esse alerta ou atalho automático; preservar a exploração das etapas e os detalhes selecionados.
- Dados de transições ausentes, incompletos ou incompatíveis usam integralmente a comparação explícita entre contagens, sem apresentar essa razão como interseção.
- O funil não deve exibir barras de rolagem internas nem mudar de altura ao explorar etapas. Conter overflow vertical e reservar espaço responsivo para os detalhes; manter deslize horizontal e navegação por teclado em telas estreitas, com a barra visual oculta.
- A prévia sintética inclui etapas não aninhadas; produção calcula as interseções reais sem consultas adicionais. Esta revisão visual permanece em avaliação pelo JP.

### Sidebar flutuante e compacta — 05/11/2026

JP considerou a sidebar grande e pesada e pediu um polish com navegação flutuante. A revisão usa um painel branco com margem externa de 12 px, cantos de 16 px, borda e sombra discretas sobre o fundo cinza-claro. No desktop, largura de 208 px (64 px recolhida), links de 38 px, texto de 13 px e ícones de 17 px. Logo, avatar e intervalos entre grupos acompanham a escala menor; evitar voltar ao cabeçalho alto e aos botões largos de 48 px.

Manter navegação, menu da conta, tema, recolhimento persistido, teclado e movimento reduzido. No mobile, o menu também abre como painel flutuante com margens seguras e área de navegação rolável em telas baixas. O refinamento permanece em avaliação pelo JP.

Na revisão seguinte, JP pediu remover os títulos “Principal”, “Operação” e “Gestão” e todos os divisores internos da sidebar. Os links principais formam uma lista contínua; consumo e configurações seguem próximos da conta, separados apenas por espaço. A mudança de tema fica exclusivamente no popover do avatar. O toggle de recolhimento fica no topo, junto à marca quando expandida e centralizado quando recolhida, usando o ícone de painel lateral `PanelLeft` do catálogo. Não recolocar controles de tema ou recolhimento no rodapé.

### Acabamento e movimento da sidebar — 07/11/2026

JP pediu efeitos e acabamento mais premium. O refinamento usa Framer Motion para deslocar os fundos de seleção/hover, revelar os textos e suavizar o recolhimento. Os ícones mantêm sua posição horizontal; hover dá uma resposta pequena ao ícone e ao texto. A superfície ganha gradiente quase imperceptível, luz interna e sombra difusa; o tema escuro usa verde profundo. Avatar e popover recebem o mesmo acabamento, com chevron indicando abertura.

Preservar a escala compacta, ausência de títulos/divisores, toggle no topo e tema no menu da conta. Tooltips aparecem apenas na navegação recolhida, inclusive por foco de teclado, fora do recorte do painel. Não usar animação contínua. A preferência por movimento reduzido remove deslocamentos, escalas e transições. Esta revisão permanece em avaliação pelo JP.

### Cards compactos e acabamento compartilhado — 07/11/2026

JP pediu aplicar o mesmo polish da sidebar aos cards do dashboard. Os cinco cards usam `dashboard-card.module.css`: padding de 16–18 px, cantos de 16 px, borda fina, luz interna e sombra difusa. Hover/foco refinam borda e sombra sem mover o card, preservando os alvos dos gráficos. Tema escuro usa superfícies verde-profundo, mantendo o faturamento como destaque. Entrada curta em Framer Motion; sem movimento contínuo e respeitando movimento reduzido.

Cabeçalhos em 13 px, faturamento em 30–32 px e métricas secundárias em 18–24 px. Intervalos entre cards de 16 px; funil visual de 180 px com geometria, pílulas e detalhes alinhados. Em desktop de 1440 px, os cards centrais passam de aproximadamente 524 para 420 px. Reservar espaço para a maior descrição do funil em cada breakpoint: nenhuma etapa pode alterar a altura ou produzir rolagem vertical interna. No mobile, o fluxo continua com deslize horizontal e barra visual oculta. O mapa combina desenho e ranking lado a lado quando houver espaço, mantendo seleção direta por UF.

Preservar métricas, bases de cálculo, avisos de dados indisponíveis, controles de período, tooltips e navegação por teclado. O tooltip explicativo do funil usa portal para não ser cortado pelo card. Este refinamento visual permanece em avaliação pelo JP.

### Atendimento: menos ruído, mesma operação — 07/11/2026

JP aprovou a melhora visual inicial e pediu uma segunda revisão mais limpa, com balões menores e distinção imediata entre público e equipe, sem perder funções.

- Manter o atendimento como workspace próprio para admin e atendente, com painéis leves e compactos. Tema/saída ficam no menu do avatar.
- Cabeçalho único na conversa; assumir/reabrir em destaque. Cópia de print/link, transferência, encerramento, configuração do agente e retomada da IA permanecem no menu de ações.
- Período visível na lista; filtros de webinar/responsável em popover, com indicador quando ativos. Aviso de conversa fora dos filtros acessível no cabeçalho sem ocupar uma faixa inteira.
- Público à esquerda com balão neutro; equipe à direita em verde floresta. Identificar explicitamente Público/Equipe e o autor no início de cada sequência. Não repetir nome em cada mensagem consecutiva do mesmo autor/dia.
- Mensagens de uma linha têm cerca de 31 px, horário de Brasília junto ao conteúdo, intervalo de 4 px entre mensagens da mesma sequência. Preservar texto, links/prévias, remetente acessível e histórico completo na captura.
- Captura de print congela variáveis de tema e desativa animações dos clones. Preservar drafts, envio/retry idempotentes, scroll, realtime, permissões e ações existentes.

JP rejeitou os quatro status espremidos na mesma linha. A revisão distribui Todos/Pendentes/Respondidos/Finalizados em grade 2×2, com alvos de 34 px, espaços de 6 px e contadores em badges à direita. Preservar todos os rótulos e a seleção em um clique; não voltar a comprimir os quatro no espaço de 320 px.

### Extensão da v2 à área administrativa — 07/11/2026

JP pediu refazer as demais telas seguindo o padrão da sidebar, dashboard e atendimento. A migração abrange listagem/criação e todas as etapas do editor de webinars; operações de métricas, público, mapas, tempo real, vendas, IA e webhooks; biblioteca de vídeos, atendentes, consumo e configurações. Login e seus estados de 2FA acompanham a mesma linguagem visual.

- `components/admin/admin-page.tsx` e `admin-page.module.css` centralizam moldura, cabeçalho, superfícies e estados vazios das telas operacionais. Manter fundo quase branco, superfícies brancas, verde floresta/lima discreto e tipografia sans-serif.
- Títulos de 20–22 px, conteúdo de 12–13 px, controles em torno de 34 px, padding de 16–18 px e intervalos de 16 px. Compactar sem espremer rótulos, contadores, navegação ou alvos de interação.
- Ações principais ficam visíveis; ações secundárias usam menus ou modais. Formulários, tabelas, etapas, estados vazios/erro e portais recebem o mesmo acabamento, incluindo tema escuro, teclado, responsividade e movimento reduzido.
- Preservar campos, validações, salvar/publicar, upload e processamento, seleção de biblioteca, importação/exportação, métricas reais, mapas, realtime, configuração de agentes/webhooks, gestão de atendentes e segurança da conta.
- A direção v2 é administrativa: não sobrescrever a aparência pública dos webinars ou do player, nem as personalizações e o conteúdo das prévias configuradas no editor. Login/2FA mantém o fluxo de autenticação e recuperação existente.

Esta revisão visual permanece em avaliação pelo JP. Deploy em produção exige solicitação específica.

### Tempo real: mapa no topo e pins individuais — 09/11/2026

JP pediu a composição `[métricas | mapa]`, com o mapa alinhado ao início dos contadores no desktop. Contadores, audiência, contagem regressiva e funil ficam à esquerda; dispositivos e rankings vêm abaixo. No mobile, exibir contadores e mapa antes dos detalhes, sem rolagem horizontal. O painel deve conter apenas o mapa e seus controles, sem faixa de cabeçalho, título, contagem ou rodapé com descrição, botão de espectadores e texto de presença.

O card "Pessoas ao vivo" usa o mesmo fundo verde do faturamento do dashboard, mantendo escala compacta e contraste de textos e ícone.

O mapa de Tempo real mostra um pin para cada pessoa com localização disponível, identificado pelo nome no tooltip e no popup. Não agrupar por cidade nem por coordenadas. Pins coincidentes/próximos recebem deslocamento apenas na tela para permitir seleção individual; preservar as coordenadas originais, informar que a localização é aproximada e mostrar a conexão com a origem ao interagir com um pin deslocado. Manter atualização automática, zoom/posição durante refresh, centralização, seleção por teclado e contagem das pessoas sem localização. O scroll sobre o mapa deve aproximar e afastar o zoom. Rankings de cidades/países permanecem agregados; o mapa por UF do dashboard não muda.

### Navegação operacional alinhada à sidebar — 09/11/2026

JP rejeitou a faixa de abas larga e desalinhada com a sidebar. A navegação operacional do webinar passa a ser um painel flutuante compacto, limitado à largura do conteúdo, com superfície e seleção reutilizadas da sidebar. No desktop, o painel começa a 12 px do topo, alinhado à sidebar; links de 34 px, texto de 12 px e ícones de 15 px mantêm a escala compacta. Em telas estreitas, preservar rolagem horizontal interna e revelar a aba ativa ao navegar ou redimensionar. Manter nomes, destinos, teclado, tema escuro e movimento reduzido. O alinhamento se aplica somente às páginas iniciadas por essa navegação; não alterar o wizard do editor nem páginas sem abas operacionais.

### Funil do Tempo real: contagens no fluxo e exploração por etapa — 09/11/2026

JP aprovou o formato horizontal com cinco segmentos afunilados e pediu mais interação e menos ruído. A direção final mantém as contagens sempre visíveis em pílulas nas entradas/junções dos segmentos; não esconder os números apenas no hover nem recriar a grade de cinco indicadores acima. Rótulos curtos acompanham o fluxo, e um único detalhe abaixo apresenta o nome completo e o percentual da etapa explorada, sem repetir a contagem.

Hover antecipa a etapa; clique/toque mantém a seleção; teclado permite explorar e voltar à seleção. Manter os dados atualizados sem perder a etapa escolhida, reservar altura para o detalhe e preservar tema escuro, foco visível e movimento reduzido. A forma pode se alargar quando uma contagem posterior for maior; não alterar os dados para forçar queda contínua.

Os percentuais deste funil são razões em relação às visitas de hoje, no fuso do webinar. Compradores são contados separadamente das visitas, portanto etapas não comprovam passagem sequencial, perdas individuais ou abandono. Sem visitas, o percentual fica indisponível; percentuais acima de 100% não devem ser truncados. Esta direção é específica de `DashboardFunnel` no Tempo real e não substitui o funil em camadas do dashboard principal. Publicação exige solicitação específica.
