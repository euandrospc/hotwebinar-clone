# Ícones da aplicação

Fonte: [jpasv/clickup-icons](https://github.com/jpasv/clickup-icons), commit
`ea7d14b464beadaddaf8e7e380711a1193f04907` (catálogo de 18/10/2026).

Importe os componentes de `@/components/icons`. Os nomes descrevem o uso na
aplicação; `manifest.json` associa cada export ao SVG original do catálogo.
A família `ui` é prioritária; `picker` complementa os símbolos ausentes.

Os SVGs utilizados estão versionados em `svg/`, sem alterações. Não é necessário
acessar GitHub ou servir a galeria durante build ou execução. O gerador verifica
os hashes e preserva paths, viewBox, preenchimentos e opacidades. A única
normalização é remover `style="color:inherit"`, redundante nos paths inline.

Após mudar o mapeamento ou adicionar um SVG com seu SHA-256, execute na raiz:

```sh
python3 apps/web/scripts/generate-icons.py
```

`generated.tsx` é gerado; não edite sua geometria manualmente. O gerador rejeita
estruturas ou referências externas que ainda não sabe converter.

Use `className` para tamanho e cor (`h-4 w-4 text-muted-foreground`). `size` define
as dimensões quando não há classes. Os ícones herdam a cor por `currentColor`.
Por padrão são decorativos. Para um ícone com significado próprio, forneça
`aria-label` ou `title`; botões que só contêm ícone precisam de nome acessível.

O logotipo, os desenhos de gráficos e o conteúdo dos usuários não fazem parte
da biblioteca de ícones. Consulte `THIRD_PARTY_NOTICES.md` para procedência.
