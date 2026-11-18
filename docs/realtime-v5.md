# Realtime v5 em paralelo

A v5 foi preparada em 18/11/2026 para avaliação em produção sem substituir o realtime existente.

## Rotas e isolamento

- Atual: `/dashboard/webinars/[id]/realtime` e `/api/webinars/[id]/realtime`. Página, API, componentes e cálculo preservados.
- V5: `/dashboard/webinars/[id]/v5` e `/api/webinars/[id]/realtime-v5`. O seletor do breadcrumb mantém essa rota ao trocar de webinar. O endereço anterior `/dashboard/webinars/[id]/realtime-v5` redireciona permanentemente para `/v5`, preservando os parâmetros.
- Produção usa Prisma e Redis da própria aplicação, com autorização por sessão e escopo do webinar.
- Demo existe somente em desenvolvimento/loopback com `?demo=1`; nunca substitui dados de produção.
- O adapter opcional de leitura remota só funciona em desenvolvimento/loopback. Suas credenciais não fazem parte do repositório.
- Não há migrations nem alterações de cadastro, ofertas, sessões ou mensagens.

## Contratos das métricas

| Bloco | Definição |
| --- | --- |
| Live | Pessoas identificadas com presença válida agora, deduplicadas entre abas. Minigráfico: amostras da última hora. Indicador vermelho animado antes do título quando há público. |
| Audience | Média das leituras simultâneas observadas hoje, no fuso do webinar. Peak mostra o pico de hoje e sua variação contra o pico real de ontem completo; ausência ou base zero não gera percentual. |
| Revenue | Bruto registrado hoje em BRL, por data de registro do pedido, somente Dominando Claude Code; gráfico diário do mês. Inclui adicionais incorporados ao pedido e não desconta reembolsos. Mostra também o bruto real de ontem completo e a variação de hoje parcial, no fuso do webinar. |
| Timeline | Ocorrência resolvida pelo servidor, sem cabeçalho ou box visual. Não inventa horário coletivo para JIT ou reprodução individual. |
| Accesses × time | Audiência simultânea observada ao longo da sessão; tempo decorrido desde o início, não duração individual assistida. |
| Funnel | Contagens independentes de pessoas com atividade hoje: visitantes, vídeo, pitch, clique e compra elegível. Compra exige identificação com atividade no mesmo webinar/dia. |
| Devices / Regions / Map | A mesma população online; localização desconhecida e exterior ficam explícitos. |
| Online attendants | Equipe com aba de Atendimento aberta e heartbeat válido, inclusive em segundo plano; conversas distintas respondidas hoje por autor, não resoluções nem atribuição atual. |

Zero real, ausência de amostras e falha de leitura têm estados diferentes. O polling acontece a cada 15 segundos enquanto a tela está visível. Falhas transitórias pausam os movimentos e identificam a última leitura; perda de autorização limpa os dados.

Pedidos e compradores não são a mesma métrica: `orders = uniquePeriodBuyers + repeatBuyerOrders + ordersWithoutPeriodAccess`. O snapshot retorna a reconciliação, sem forçar os totais a coincidirem. Aula de Configuração e produtos não elegíveis ficam excluídos da receita.

## Presença da equipe

O Inbox apenas renova um heartbeat autenticado em `/api/attendant/presence-v5`. A presença usa o namespace Redis `staff-v5`, separado dos espectadores, e expira após 90 segundos sem renovação (TTL de armazenamento de 180 segundos). Ocultar a aba não libera a presença; fechar/desmontar libera e voltar pelo BFCache restaura. Abas efetivamente suspensas ou desconectadas expiram. A API valida origem, sessão e papel; IDs de usuário e sessão são derivados no servidor. Sem coleta disponível, a tela informa ausência de coleta em vez de exibir zero confirmado. Nenhuma mensagem é enviada ou alterada por esse mecanismo.

## Gráficos

MUI X Charts Community nos KPIs e funil SVG próprio. Highcharts nos demais gráficos, com seu crédito visual desativado pela configuração oficial solicitada por JP; atribuições OpenStreetMap/Natural Earth preservadas no mapa. Esta publicação mantém a versão de avaliação separada para o teste solicitado; licenciamento comercial do Highcharts deve ser considerado antes de sua adoção definitiva.
