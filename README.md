# mobilidadeBR

Site estático (HTML + CSS + JavaScript puro) para **pessoas com deficiência usarem diretamente** — ache lugares acessíveis em 40 cidades brasileiras (capitais + praias e destinos turísticos famosos), saiba o que esperar antes de viajar, e veja a situação de acessibilidade de qualquer um dos 5.570 municípios do Brasil.

Projeto irmão do [Mapa da Equidade](https://github.com/Anajaraa/mapa-da-equidade), que é a ferramenta de advocacy (voltada a governo/empresas) com o pipeline de dados completo. Este repositório só consome os dados já processados lá — não recalcula nada.

## O que tem

- **Lugares Acessíveis** — mais de 5.300 locais (turismo, hotéis, shopping, restaurantes, estádios, casas de shows/eventos) em 26 capitais + 14 destinos turísticos, cruzados com mais de 1.000 banheiros públicos, com fotos reais via Wikipedia quando existem
- **Antes de Viajar** — direitos no aeroporto (Resolução ANAC 280/2013), e um exemplo verificado de acessibilidade de transporte público (Metrô/CPTM de São Paulo)
- **Minha Cidade** — índice de déficit de acessibilidade de qualquer um dos 5.570 municípios do Brasil, com ficha pra baixar

PT-BR / English, tema claro/escuro conforme preferência do sistema (com alternância manual).

## Stack

HTML/CSS/JS puro, sem build step. Bibliotecas via CDN: [Leaflet](https://leafletjs.com/) (mapas), [Lucide](https://lucide.dev/) (ícones). Tiles de mapa do OpenStreetMap (sem necessidade de chave de API).

## Rodando localmente

Precisa de um servidor local porque o `fetch()` dos arquivos `data/*.json` não funciona em `file://` direto:

```
python -m http.server 8000
```

Depois abra `http://localhost:8000`.

## Atualizando os dados

Os arquivos em `data/` são gerados pelo projeto [Mapa da Equidade](https://github.com/Anajaraa/mapa-da-equidade) (`src/exportar_dados_js.py`, que lê o que foi coletado por `src/collect_turismo_cidades.py`, `src/collect_eventos_cidades.py` e `src/collect_imagens_turismo.py`). Para atualizar: rode os scripts lá, e copie o conteúdo de `data/site_export/` para a pasta `data/` deste repositório.
