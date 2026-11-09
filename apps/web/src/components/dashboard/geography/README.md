# Geografia do mapa de audiência

`brazil-states.ts` contém as 27 unidades da Federação do **IBGE**, com geometrias reais simplificadas. Nenhuma fronteira foi desenhada manualmente.

Fontes oficiais, consultadas em 04/11/2026:

- [Malha GeoJSON do Brasil subdividida em UFs, qualidade mínima](https://servicodados.ibge.gov.br/api/v3/malhas/paises/BR?formato=application/vnd.geo%2Bjson&qualidade=minima&intrarregiao=UF).
- [Nomes e siglas das UFs](https://servicodados.ibge.gov.br/api/v1/localidades/estados).
- [Documentação da API de malhas simplificadas](https://servicodados.ibge.gov.br/api/docs/malhas?versao=3).

Crédito: **IBGE — malhas geográficas simplificadas**. O IBGE disponibiliza a malha e os produtos dela derivados sob licença compatível com **Creative Commons Attribution 4.0 (CC BY 4.0)**, conforme [Informações Técnicas e Legais da Malha Municipal Digital, página 7](https://www.ibge.gov.br/biblioteca/visualizacao/livros/liv102152.pdf). [Texto da licença](https://creativecommons.org/licenses/by/4.0/).

Adaptação local: projeção Mercator esférica das coordenadas GeoJSON, ajuste uniforme para uma área SVG de 420 × 420, margem de 12px e arredondamento a duas casas. Polígonos e anéis são preservados. A versão simplificada do IBGE é apropriada à visualização estatística; não serve para demarcação territorial. O recorte e a simplificação decorrem da API oficial.

O navegador recebe apenas os caminhos SVG locais. Não há chamada ao IBGE em runtime, tiles externos, chaves ou coordenadas de espectadores neste asset.
