# Tremor Raw — componentes oficiais

`AreaChart` e `DonutChart` foram copiados do código oficial **Tremor Raw v1.0.0**,
commit `ca4d588f47820ff3d514d37fa4ee08a4222dec11`, sob licença MIT (preservada em `LICENSE`).

- [Repositório e código original](https://github.com/tremorlabs/tremor/tree/ca4d588f47820ff3d514d37fa4ee08a4222dec11)
- [Documentação AreaChart](https://www.tremor.so/docs/visualizations/area-chart)
- [Documentação DonutChart](https://www.tremor.so/docs/visualizations/donut-chart)

Adaptações locais:

- Imports locais e `cn` existente; ícones exclusivamente do catálogo do projeto.
- Classes `outline-hidden` (Tailwind 4) convertidas para `outline-none` (Tailwind 3.4).
- Paleta `forest` / `chartLime` adicionada ao utilitário oficial de cores.
- Label do tooltip normalizado para string, conforme tipos do Recharts 3.
- Proteção para série vazia com `startEndOnly`.
- Animação do tooltip respeita `prefers-reduced-motion` via Framer Motion.
- `accessibilityLayer` pode ser desativada em minigráficos decorativos dentro de
  links com descrição textual, evitando um foco de teclado extra dentro do link.
- `tooltipPosition` e `tooltipAllowEscapeViewBox` permitem posicionar detalhes
  abaixo de minigráficos interativos; tooltips mantêm prioridade visual sobre cards.
- Keys distintas para gradientes, áreas e linhas de interação; dimensões iniciais
  positivas antes da primeira medição do `ResizeObserver`.
- `activeIndex` removido no Recharts 3 substituído por renderização `shape` no donut;
  `activeCategory` permite controlar o destaque por uma legenda acessível por teclado.
  O clique no centro também limpa seleções controladas pela legenda.

Os componentes mantêm a API de dados, formatação, seleção e tooltip do Tremor.
Não foi instalado `@tremor/react` legado, que tem peer React 18 e inclui Recharts 2;
esta integração usa o React/Next, Recharts 3 e Tailwind 3.4 já presentes no projeto.
