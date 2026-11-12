# Teste A/B de webinars

## Uso

A área `/dashboard/ab-tests` organiza experimentos e comparações, acessível pelo item **Teste A/B** da sidebar. Em produção, os dados são reais e pertencem à conta autenticada. A implementação é uma extensão do aplicativo Next.js existente.

O seletor no topo reúne busca por teste, hipótese ou webinar, filtros de status/modalidade e paginação de seis resultados. O botão **Detalhes** abre hipótese, modalidade, data de criação e link de distribuição com cópia. Ações de coleta e filtros do relatório permanecem diretamente acessíveis, mantendo o dashboard comparativo em destaque.

## Prévia local

Em `NODE_ENV=development`, acessando por `localhost`, `127.0.0.1` ou `[::1]`, a tela abre preenchida com quatro cenários sintéticos: resultado concluído, teste em coleta, comparação histórica e horários 19h × 21h. A página continua exigindo autenticação administrativa. Filtros, gráfico, exportação e leitura estatística usam coortes determinísticas em memória e o mesmo cálculo do relatório real.

Criação, edição e mudanças de status nesta prévia também ficam apenas em memória e são descartadas ao recarregar. Não são criados experimentos, acessos, eventos ou vendas no banco; não há chamadas às APIs de testes nem links para webinars fictícios. A prévia não fornece link público para distribuição de tráfego.

Para operar sobre dados reais localmente, abra `/dashboard/ab-tests?demo=0`. Não há controles de demonstração na interface. Builds de produção e hosts fora do loopback nunca ativam os mocks, mesmo com `?demo=1`.

## Funcionalidades

- **Comparação histórica:** selecione dois webinars e um período de entrada. Compara acessos identificados, reprodução, pitch, cliques, compradores e receita registrada. Públicos diferentes não demonstram causalidade; esta modalidade nunca declara vencedor.
- **Variável testada:** declare se está comparando horário/programação, vídeo/abertura/conteúdo, pitch, oferta/preço/CTA, página/formulário, atendimento ou o webinar completo. Descreva as condições A e B. A configuração legível de cada variante é registrada no início; registros antigos sem snapshot são identificados como configuração atual.
- **Experimento randomizado:** escolha A (controle), B (variação), hipótese, métrica principal, conversão base, melhoria mínima relevante, duração e janela de conversão. Salve como rascunho, publique os dois webinars e inicie. Divulgue exclusivamente o link `/ab/:id` para o tráfego do experimento.
- O link sorteia 50/50 e conserva a versão por navegador. Acessos diretos aos links dos webinars não entram na base randomizada. Revisitas não são novas alocações; mudar de dispositivo ou apagar cookies pode criar outra unidade.
- A coleta de novos participantes para automaticamente no prazo planejado. Pausar e retomar preservam o prazo e os dados, mas uma interrupção antes do prazo mantém a conclusão exploratória mesmo depois de retomar. Isso impede que pausar ao observar uma diferença funcione como encerramento seletivo. Encerrar antes do prazo também mantém o resultado descritivo. Participantes anteriores podem retornar à versão original para completar sua janela.
- Filtros de período de entrada, origem, mídia, campanha, conteúdo e dispositivo aplicam a mesma seleção à base e aos resultados. Exportação CSV contém o relatório agregado do recorte, sem dados pessoais.

## Planejamento e diagnóstico completo

O planejamento informa tráfego diário necessário e primeira leitura final, considerando coleta e janela. A simulação opcional de entradas diárias evidencia amostras inviáveis no prazo; é uma estimativa local ao formulário, não uma promessa nem alteração automática de duração. MDE (efeito mínimo detectável) dimensiona a amostra e não equivale a uma meta comercial comprovada.

O comparativo mantém uma métrica principal para a inferência formal e mostra identificação, reprodução, chegada ao pitch, cliques, compradores, pedidos, receita, ticket e receita por entrada. A leitura comercial evidencia divergências entre eventos intermediários e compra/receita, sem fingir um teste estatístico de não inferioridade. Custos e estornos não estão disponíveis nesta coorte; não calcular lucro, CPA ou ROAS com dados inventados.

O diagnóstico reúne conversão diária, alcance no vídeo, jornada, audiência, segmentos e configuração A/B. Posição máxima registrada não é tempo assistido contínuo. Tempos até reprodução/pitch/clique/compra usam eventos elegíveis e apresentam sua quantidade de observações; ausência permanece desconhecida. Segmentos por origem, campanha, dispositivo e hora/dia de entrada são exploratórios, com denominadores explícitos e sem vencedores automáticos.

Audiência simultânea é contextual: leituras de `AudienceSample` do webinar inteiro, incluindo tráfego direto, nas janelas das entradas maduras. Não representa exclusivamente o grupo sorteado. Recortes de aquisição/dispositivo não podem decompor esses snapshots e mostram indisponibilidade. Audiência simultânea no pitch exige programação coletiva sincronizada e leitura próxima ao instante do pitch; JIT não tem um instante coletivo único. Isso é diferente de pessoas que chegaram ao pitch, contadas por entrada dentro da coorte.

Horários diferentes avaliam a estratégia de programação, incluindo espera. A janela continua começando na entrada do visitante, e deve comportar transmissão e oportunidade de compra. O modo histórico descreve públicos e períodos diferentes, sem demonstrar causalidade.

## Unidade e atribuição

No experimento, a unidade é um navegador alocado, inclusive quem não preencheu o formulário. Na comparação histórica, a unidade é um acesso identificado por webinar, com entrada no primeiro evento observado dentro do período escolhido. Não se trata de leads captados fora da plataforma.

UTMs e dispositivo da alocação são imutáveis. Para comparações históricas esses atributos vêm do cadastro atual do acesso, pois o sistema antigo não preservava snapshots de entrada. O relatório informa essa diferença.

Cada unidade tem uma janela fixa de 24, 72 ou 168 horas. Os resultados utilizam somente unidades cuja janela inteira já transcorreu. Entradas recentes aparecem como aguardando janela, sem serem classificadas prematuramente como não conversão. Todos os eventos e vendas precisam ser posteriores à entrada, do mesmo webinar/acesso e dentro da janela.

Eventos são agregados por unidade e tipo no banco, evitando carregar todos os heartbeats. Reprodução utiliza `VIDEO_TICK`; pitch utiliza `PITCH_REACHED` ou posição de vídeo que alcança o pitch; clique utiliza `OFFER_CLICK`. A configuração é verificada contra o fingerprint congelado ao iniciar. Editar o conteúdo da variante durante o teste invalida a conclusão quando a mudança é detectada.

Uma pessoa pode realizar vários pedidos, mas é um único comprador por unidade. A receita é a soma dos pedidos registrados em BRL, não receita líquida de estornos. A data da venda é a data de registro na integração. Vendas fora das janelas e outras moedas ficam fora da comparação. Nenhum relatório refaz atribuição por e-mail.

Quando um participante identificado do experimento abre uma oferta Kirvano, o checkout recebe o identificador do acesso em um sufixo de `utm_content` (`|hw_ab_lead=...`). O conteúdo original da campanha é mantido antes do sufixo. O webhook existente reconhece esse identificador antes da busca por e-mail/telefone. A inclusão depende de cookie assinado, vínculo com o acesso correto e janela válida; links de outros provedores e visitas comuns mantêm seu comportamento. A integração deve devolver esse parâmetro para a atribuição explícita funcionar.

E-mails reais encontrados nos dois braços e múltiplas alocações ligadas ao mesmo acesso são alertas de integridade. A base de navegadores é preservada; os resultados de um acesso repetido pertencem apenas à primeira alocação. Essas inconsistências bloqueiam a conclusão. Identidades desconhecidas e mudanças de aparelho não detectadas continuam sendo uma limitação.

## Decisão estatística

O plano usa teste bilateral de proporções, significância de 5%, poder de 80% e distribuição 50/50. A melhoria mínima é relativa: base de 5% e melhoria de 20% representam uma meta de 6%, diferença de 1 ponto percentual. Essa combinação exige aproximadamente 8.158 unidades por braço.

O prazo mínimo permitido é sete dias, sem implicar suficiência estatística. A decisão só é liberada após o período integral, maturação de todas as janelas, amostra planejada em ambos os braços e verificação de integridade. Não há extensão automática do prazo em busca de significância. Amostra insuficiente e ausência de diferença estatística não demonstram equivalência.

O relatório apresenta intervalos de Wilson de 95% para cada taxa. O teste bilateral e o intervalo da diferença usam aproximação normal somente com pelo menos dez conversores e dez não conversores em cada braço. O p-valor não é probabilidade de vitória. Receita é uma medida secundária descritiva e não recebe um teste binário de significância.

O diagnóstico de desequilíbrio de amostra (SRM) utiliza todas as alocações, antes de filtros e maturação, comparando com a divisão 50/50. Com amostra suficiente para a aproximação, `p < 0,0005` bloqueia a decisão. Recortes filtrados são exploratórios e não declaram um vencedor confirmatório.

Referências primárias utilizadas:

- [NIST — comparação de duas proporções](https://www.itl.nist.gov/div898/software/dataplot/refman2/auxillar/diffprci.htm).
- [statsmodels — planejamento de amostra para duas proporções](https://www.statsmodels.org/stable/generated/statsmodels.stats.proportion.samplesize_proportions_2indep_onetail.html).
- [Microsoft — diagnóstico de Sample Ratio Mismatch](https://www.microsoft.com/en-us/research/articles/diagnosing-sample-ratio-mismatch-in-a-b-testing/).
- [Microsoft — práticas durante um experimento, incluindo monitoramento repetido](https://www.microsoft.com/en-us/research/articles/patterns-of-trustworthy-experimentation-during-experiment-stage/).

## Operação técnica

- Persistência: `AbExperiment` e `AbAssignment`, migrations `20261111120000_ab_tests`, `20261111123000_ab_interruption` e `20261111220000_ab_test_design`.
- APIs administrativas: `/api/ab-tests`, `/api/ab-tests/:id`, `/api/ab-tests/:id/report`. Exigem autenticação, papel de administrador e isolamento por proprietário. Mutações também verificam origem.
- Plano somente editável em rascunho; exclusão somente de rascunhos sem participantes. Webinars referenciados não podem ser apagados enquanto preservam o histórico.
- Início exige variantes da mesma conta, publicadas, com hipótese e vídeo pronto. A métrica de pitch exige momento alcançável; clique exige oferta habilitada, link válido e período de exibição válido. Essas verificações de configuração não certificam a reprodução nem o callback da integração de compras. Programações diferentes são permitidas quando a variável declarada é horário/programação; nos demais casos, a programação deve ser compatível. Um webinar não participa simultaneamente de dois experimentos randomizados ativos/pausados.
- Alocação e transições usam transações e bloqueios para não admitir participantes depois de uma pausa concorrente. Cookies têm assinatura HMAC, HttpOnly e SameSite; respostas não são armazenadas em cache.
- A proteção contra previews/prefetch e robôs conhecidos reduz entradas artificiais; não equivale a uma identificação infalível de tráfego humano.
- Fingerprints verificam a configuração do webinar, mas não auditam substituição externa de mídia na mesma URL, todas as alterações em entidades relacionadas ou edições temporárias revertidas antes da leitura. Operação do teste pressupõe manter conteúdo, oferta e aquisição estáveis durante o horizonte planejado.
- A migration foi aplicada somente ao banco local de desenvolvimento. Publicação depende de solicitação explícita.

## Sessões públicas simultâneas

Cookies assinados por webinar e identificadores esperados em requests mantêm tracking, oferta, chat, presença e mídia associados à aba correta. O servidor verifica vínculo e assinatura; parâmetros enviados pelo cliente não autenticam uma identidade. O cookie global legado só é aceito quando pertence ao webinar solicitado. Abrir outro webinar não pode transferir eventos da primeira aba.
