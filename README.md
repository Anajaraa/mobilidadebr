# Acessível SP

Site estático (HTML + CSS + JavaScript puro) para **pessoas com deficiência usarem diretamente** — ache lugares acessíveis em São Paulo, saiba o que esperar antes de viajar, e veja a situação de acessibilidade de qualquer um dos 5.570 municípios do Brasil.

Projeto irmão do [Mapa da Equidade](https://github.com/Anajaraa/mapa-da-equidade), que é a ferramenta de advocacy (voltada a governo/empresas) com o pipeline de dados completo. Este repositório só consome os dados já processados lá — não recalcula nada.

## O que tem

- **Início** — o que o site oferece
- **Lugares Acessíveis** — 690 locais de São Paulo (turismo, hotéis, shopping, restaurantes) cruzados com 165 banheiros públicos, com fotos reais via Wikipedia quando existem
- **Antes de Viajar** — direitos no aeroporto (Resolução ANAC 280/2013), acessibilidade real do Metrô/CPTM de SP
- **Minha Cidade** — índice de déficit de acessibilidade de qualquer município do Brasil, com ficha pra baixar
- **Panorama no Brasil** — mapa coroplético por estado + gráfico por região

PT-BR / English, tema claro/escuro conforme preferência do sistema (com alternância manual).

## Stack

HTML/CSS/JS puro, sem build step. Bibliotecas via CDN: [Leaflet](https://leafletjs.com/) (mapas), [Leaflet.heat](https://github.com/Leaflet/Leaflet.heat) (mapa de densidade), [Chart.js](https://www.chartjs.org/) (gráfico), [Lucide](https://lucide.dev/) (ícones).

## Rodando localmente

Precisa de um servidor local porque o `fetch()` dos arquivos `data/*.json` não funciona em `file://` direto:

```
python -m http.server 8000
```

Depois abra `http://localhost:8000`.

## Atualizando os dados

Os arquivos em `data/` são gerados pelo projeto [Mapa da Equidade](https://github.com/Anajaraa/mapa-da-equidade) (`src/exportar_dados_js.py`). Para atualizar: rode o script lá, e copie o conteúdo de `data/site_export/` para a pasta `data/` deste repositório.
