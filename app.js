// Acessível SP — lógica principal. Usa i18n.js (dicionário) e busca os
// dados já exportados em data/*.json pelo pipeline Python do projeto.

const CORES = { azul: "#0B5FB0", ambar: "#8A5A00", verde: "#1F8A52", cinza: "#7A8898" };

let LANG = localStorage.getItem("lang") || "pt";
let DADOS = {};

// ---------------------------------------------------------------- TEMA
function aplicarTemaSalvo() {
  const salvo = localStorage.getItem("theme");
  if (salvo) document.documentElement.setAttribute("data-theme", salvo);
}
function alternarTema() {
  const atual = document.documentElement.getAttribute("data-theme") ||
    (window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light");
  const novo = atual === "dark" ? "light" : "dark";
  document.documentElement.setAttribute("data-theme", novo);
  localStorage.setItem("theme", novo);
}

// ---------------------------------------------------------------- I18N
function t(chave) {
  return (I18N[LANG] && I18N[LANG][chave]) || I18N.pt[chave] || chave;
}
function aplicarTraducoes() {
  document.querySelectorAll("[data-i18n]").forEach(el => { el.textContent = t(el.dataset.i18n); });
  document.querySelectorAll("[data-i18n-html]").forEach(el => { el.innerHTML = t(el.dataset.i18nHtml); });
  document.querySelectorAll("[data-i18n-placeholder]").forEach(el => { el.placeholder = t(el.dataset.i18nPlaceholder); });
  document.title = t("titulo").replace(/^\S+\s/, "");
  renderizarLugares();
  renderizarLegenda();
  renderizarCidadeAtual();
}

// ---------------------------------------------------------------- ABAS
function configurarAbas() {
  document.querySelectorAll(".tab").forEach(botao => {
    botao.addEventListener("click", () => {
      document.querySelectorAll(".tab").forEach(b => b.classList.remove("active"));
      document.querySelectorAll(".panel").forEach(p => p.classList.remove("active"));
      botao.classList.add("active");
      document.getElementById(`panel-${botao.dataset.tab}`).classList.add("active");
      // mapas Leaflet precisam de um invalidateSize ao aparecer num painel que estava oculto
      setTimeout(() => window.dispatchEvent(new Event("resize")), 50);
    });
  });
}

// ---------------------------------------------------------------- CARREGAMENTO DE DADOS
async function carregarDados() {
  const [municipios, resumo, malha, lugares, banheiros, ruasCalor] = await Promise.all([
    fetch("data/municipios.json").then(r => r.json()),
    fetch("data/resumo_regiao_uf.json").then(r => r.json()),
    fetch("data/malha_ufs.geojson").then(r => r.json()),
    fetch("data/lugares_sp.json").then(r => r.json()),
    fetch("data/banheiros_sp.json").then(r => r.json()),
    fetch("data/ruas_sp_calor.json").then(r => r.json()),
  ]);
  DADOS = { municipios, resumo, malha, lugares, banheiros, ruasCalor };
}

// ---------------------------------------------------------------- LUGARES ACESSÍVEIS
let mapaLugares, mapaRuas, mapaBrasil;
let filtroCategoria = [], filtroNome = "", filtroSoInfo = false;

function categoriaTexto(c) {
  return LANG === "en" ? c.categoria_en : c.categoria_pt;
}

function construirFiltroCategorias() {
  const select = document.getElementById("filtro-categoria");
  const categorias = [...new Set(DADOS.lugares.map(categoriaTexto))].sort();
  select.innerHTML = categorias.map(c => `<option value="${c}">${c}</option>`).join("");
}

function aplicarFiltrosLugares() {
  return DADOS.lugares.filter(p => {
    if (filtroCategoria.length && !filtroCategoria.includes(categoriaTexto(p))) return false;
    if (filtroNome && !p.nome.toLowerCase().includes(filtroNome.toLowerCase())) return false;
    if (filtroSoInfo && p.wheelchair === "nao_informado") return false;
    return true;
  });
}

function corAcessibilidade(w) {
  return { yes: CORES.verde, limited: CORES.ambar }[w] || CORES.cinza;
}

function renderizarLugares() {
  if (!DADOS.lugares) return;
  construirFiltroCategorias();

  const lugares = DADOS.lugares;
  const temInfo = p => p.wheelchair !== "nao_informado";
  const nHotel = lugares.filter(p => p.categoria === "hotel").length;
  const nHotelInfo = lugares.filter(p => p.categoria === "hotel" && temInfo(p)).length;
  const nMall = lugares.filter(p => p.categoria === "mall").length;
  const nMallInfo = lugares.filter(p => p.categoria === "mall" && temInfo(p)).length;
  const nRest = lugares.filter(p => ["restaurant", "fast_food", "cafe"].includes(p.categoria) && temInfo(p)).length;
  const nBanheirosAcess = DADOS.banheiros.filter(b => b.wheelchair === "yes").length;

  document.getElementById("lugares-stats").innerHTML = [
    statCard(t("lugares_locais"), lugares.length, t("lugares_locais_nota"), ""),
    statCard(t("lugares_hoteis"), `${nHotelInfo} / ${nHotel}`, `${Math.round(nHotelInfo / nHotel * 100)}% ${t("lugares_mapeados")}`, "ambar"),
    statCard(t("lugares_shopping"), `${nMallInfo} / ${nMall}`, `${Math.round(nMallInfo / nMall * 100)}% ${t("lugares_mapeados")}`, "ambar"),
    statCard(t("lugares_banheiros"), `${nBanheirosAcess} / ${DADOS.banheiros.length}`, t("lugares_mapeados_osm"), "verde"),
  ].join("");
  document.getElementById("lugares-rest-caption").textContent = t("lugares_rest_caption").replace("{n}", nRest);

  const ruas = DADOS.ruasCalor;
  const contarPorTag = () => 0; // calçadas/rampas/piso já não vêm separadas no JSON de calor; mostramos só o total
  document.getElementById("ruas-stats").innerHTML = [
    statCard(t("ruas_elementos"), ruas.length.toLocaleString("pt-BR"), "", ""),
  ].join("");

  renderizarTabelaLugares();
  renderizarMapaLugares();
}

function statCard(titulo, valor, nota, classe) {
  return `<div class="stat-card ${classe}"><div class="titulo">${titulo}</div><div class="valor">${valor}</div><div class="nota">${nota}</div></div>`;
}

function renderizarTabelaLugares() {
  const linhas = aplicarFiltrosLugares();
  const wtxt = WHEELCHAIR_TXT[LANG];
  linhas.sort((a, b) => {
    const aInfo = a.wheelchair === "nao_informado" ? 1 : 0;
    const bInfo = b.wheelchair === "nao_informado" ? 1 : 0;
    if (aInfo !== bInfo) return aInfo - bInfo;
    return a.nome.localeCompare(b.nome);
  });
  const corpo = document.querySelector("#tabela-lugares tbody");
  corpo.innerHTML = linhas.map(p => `
    <tr>
      <td>${p.imagem ? `<img src="${p.imagem}" loading="lazy" alt="">` : ""}</td>
      <td>${p.nome}</td>
      <td>${categoriaTexto(p)}</td>
      <td>${wtxt[p.wheelchair] || wtxt.nao_informado}</td>
      <td>${p.banheiro_acessivel_m != null ? p.banheiro_acessivel_m + " m" : "—"}</td>
    </tr>
  `).join("");
}

function renderizarMapaLugares() {
  if (!mapaLugares) {
    mapaLugares = L.map("mapa-lugares").setView([-23.55, -46.63], 12);
    L.tileLayer("https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png", {
      attribution: "&copy; CARTO &copy; OpenStreetMap contributors",
    }).addTo(mapaLugares);
    mapaLugares._camadaPontos = L.layerGroup().addTo(mapaLugares);
  }
  mapaLugares._camadaPontos.clearLayers();
  const wtxt = WHEELCHAIR_TXT[LANG];

  aplicarFiltrosLugares().forEach(p => {
    const temInfo = p.wheelchair !== "nao_informado";
    const marcador = L.circleMarker([p.lat, p.lon], {
      radius: temInfo ? 9 : 4, color: corAcessibilidade(p.wheelchair), weight: temInfo ? 2 : 1,
      fillOpacity: temInfo ? 0.9 : 0.45, fillColor: corAcessibilidade(p.wheelchair),
    });
    const img = p.imagem ? `<img src="${p.imagem}" style="width:160px;border-radius:6px;display:block;margin-bottom:4px;">` : "";
    marcador.bindPopup(`${img}<b>${p.nome}</b><br>${wtxt[p.wheelchair] || wtxt.nao_informado}`);
    marcador.addTo(mapaLugares._camadaPontos);
  });

  DADOS.banheiros.forEach(b => {
    L.circleMarker([b.lat, b.lon], {
      radius: 3, color: b.wheelchair === "yes" ? CORES.verde : "#AEB9C4", fillOpacity: 0.5,
    }).bindTooltip("WC").addTo(mapaLugares._camadaPontos);
  });
}

function renderizarLegenda() {
  const wtxt = WHEELCHAIR_TXT[LANG];
  document.getElementById("legenda-lugares").innerHTML = `
    <span class="dot" style="background:${CORES.verde}"></span>${wtxt.yes} &nbsp;
    <span class="dot" style="background:${CORES.ambar}"></span>${wtxt.limited} &nbsp;
    <span class="dot" style="background:${CORES.cinza}"></span>${wtxt.nao_informado} &nbsp;
    <span class="dot" style="background:#AEB9C4"></span>WC &nbsp;
    <i>${t("legenda_nota")}</i>`;
}

function renderizarMapaRuas() {
  if (mapaRuas) return;
  mapaRuas = L.map("mapa-ruas").setView([-23.55, -46.63], 11);
  L.tileLayer("https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png", {
    attribution: "&copy; CARTO &copy; OpenStreetMap contributors",
  }).addTo(mapaRuas);
  L.heatLayer(DADOS.ruasCalor, { radius: 9, blur: 12, maxZoom: 13 }).addTo(mapaRuas);
}

// ---------------------------------------------------------------- MINHA CIDADE
let cidadeSelecionada = null;

function configurarBuscaCidade() {
  const datalist = document.getElementById("lista-cidades");
  datalist.innerHTML = DADOS.municipios.map(m => `<option value="${m.municipio}">`).join("");

  const input = document.getElementById("busca-cidade");
  input.addEventListener("input", () => {
    const encontrado = DADOS.municipios.find(m => m.municipio === input.value);
    if (encontrado) {
      cidadeSelecionada = encontrado;
      renderizarCidadeAtual();
    }
  });
}

function renderizarCidadeAtual() {
  const div = document.getElementById("resultado-cidade");
  if (!div) return;
  if (!cidadeSelecionada) { div.innerHTML = ""; return; }
  const m = cidadeSelecionada;
  const total = DADOS.municipios.length;
  const rotulo = LANG === "en" ? m.rotulo_en : m.rotulo_pt;
  const corPerfil = m.cluster === 1 ? CORES.ambar : (m.cluster === 2 ? CORES.verde : CORES.cinza);

  div.innerHTML = `
    <div class="stat-row">
      ${statCard(t("cidade_posicao"), "#" + m.posicao, `${t("cidade_de")} ${total}`, "")}
      ${statCard(t("cidade_indice"), m.indice, t("cidade_em100"), "ambar")}
      ${statCard(t("cidade_dificuldade"), m.pop_dificuldade.toLocaleString("pt-BR"), t("cidade_pessoas"), "")}
      ${statCard(t("cidade_vinculos"), m.pct_vinculos_pcd + "%", "", "verde")}
    </div>
    <div class="ficha-card">
      <b>${t("cidade_perfil")}:</b> <span class="pill" style="background:${corPerfil}22;color:${corPerfil};border:1px solid ${corPerfil}55;">${rotulo}</span><br><br>
      <b>${t("cidade_regiao")}:</b> ${m.regiao} (${m.uf})<br>
      <b>${t("cidade_transporte")}:</b> ${m.status_transporte.replace(/_/g, " ")}
    </div>
    <h4>${t("cidade_contexto_titulo")}</h4>
    <p>${t("cidade_contexto_texto")}</p>
    <button id="btn-baixar-cidade"><i data-lucide="download"></i> ${t("cidade_download")}</button>
  `;
  document.getElementById("btn-baixar-cidade").addEventListener("click", () => baixarResumoCidade(m));
  if (window.lucide) lucide.createIcons();
}

function baixarResumoCidade(m) {
  const total = DADOS.municipios.length;
  const rotulo = LANG === "en" ? m.rotulo_en : m.rotulo_pt;
  const texto = `ACESSIBILIDADE EM ${m.municipio}
Fonte: site Acessível SP / projeto Mapa da Equidade

Posição no país: #${m.posicao} de ${total} municípios (índice de déficit: ${m.indice}/100 — quanto maior, pior)
Perfil: ${rotulo}
Pessoas com dificuldade de mobilidade: ${m.pop_dificuldade.toLocaleString("pt-BR")} (${m.pct_dificuldade}% da população)
Vínculos de trabalho formal ocupados por PCD: ${m.pct_vinculos_pcd}% (média nacional: 1.08%)
Transporte: ${m.status_transporte.replace(/_/g, " ")}

Fontes: IBGE (Censo 2022), RAIS 2024, OpenStreetMap.`;
  const blob = new Blob([texto], { type: "text/plain" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = `acessibilidade_${m.municipio.split(" - ")[0]}.txt`;
  a.click();
}

// ---------------------------------------------------------------- PANORAMA NO BRASIL
let graficoRegiao;

function renderizarPanoramaBrasil() {
  if (!mapaBrasil) {
    mapaBrasil = L.map("mapa-brasil").setView([-14.2, -51.9], 4);
    L.tileLayer("https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png", {
      attribution: "&copy; CARTO &copy; OpenStreetMap contributors",
    }).addTo(mapaBrasil);

    const porUf = DADOS.resumo.por_uf;
    const max = Math.max(...Object.values(porUf).map(v => v.indice));
    const corPorIndice = v => {
      const t = v / max;
      const g = Math.round(220 - t * 150);
      return `rgb(${Math.round(220 - t * 180)}, ${g}, ${Math.round(245 - t * 60)})`;
    };
    L.geoJSON(DADOS.malha, {
      style: feat => {
        const codigo = feat.properties.codigo_uf;
        const sigla = CODIGO_PARA_SIGLA[codigo];
        const dado = porUf[sigla];
        return { fillColor: dado ? corPorIndice(dado.indice) : "#ccc", fillOpacity: 0.85, color: "#fff", weight: 1 };
      },
      onEachFeature: (feat, layer) => {
        const codigo = feat.properties.codigo_uf;
        const sigla = CODIGO_PARA_SIGLA[codigo];
        const dado = porUf[sigla];
        if (dado) layer.bindTooltip(`${sigla}: ${dado.indice} (${dado.n} municípios)`);
      },
    }).addTo(mapaBrasil);
  }

  const porRegiao = DADOS.resumo.por_regiao;
  const labels = Object.keys(porRegiao).sort((a, b) => porRegiao[b] - porRegiao[a]);
  const valores = labels.map(r => porRegiao[r]);

  if (graficoRegiao) graficoRegiao.destroy();
  graficoRegiao = new Chart(document.getElementById("grafico-regiao"), {
    type: "bar",
    data: { labels, datasets: [{ label: t("cidade_indice"), data: valores, backgroundColor: CORES.azul }] },
    options: { indexAxis: "y", plugins: { legend: { display: false } }, scales: { x: { beginAtZero: true } } },
  });
}

const CODIGO_PARA_SIGLA = {
  11: "RO", 12: "AC", 13: "AM", 14: "RR", 15: "PA", 16: "AP", 17: "TO",
  21: "MA", 22: "PI", 23: "CE", 24: "RN", 25: "PB", 26: "PE", 27: "AL", 28: "SE", 29: "BA",
  31: "MG", 32: "ES", 33: "RJ", 35: "SP", 41: "PR", 42: "SC", 43: "RS", 50: "MS", 51: "MT", 52: "GO", 53: "DF",
};

// ---------------------------------------------------------------- INICIALIZAÇÃO
async function iniciar() {
  aplicarTemaSalvo();
  if (window.lucide) lucide.createIcons();
  document.getElementById("theme-toggle").addEventListener("click", alternarTema);

  document.getElementById("lang-toggle").value = LANG;
  document.getElementById("lang-toggle").addEventListener("change", e => {
    LANG = e.target.value;
    localStorage.setItem("lang", LANG);
    aplicarTraducoes();
  });

  configurarAbas();
  await carregarDados();
  aplicarTraducoes();
  configurarBuscaCidade();
  renderizarMapaRuas();
  renderizarPanoramaBrasil();

  document.getElementById("filtro-categoria").addEventListener("change", e => {
    filtroCategoria = [...e.target.selectedOptions].map(o => o.value);
    renderizarTabelaLugares();
    renderizarMapaLugares();
  });
  document.getElementById("filtro-nome").addEventListener("input", e => {
    filtroNome = e.target.value;
    renderizarTabelaLugares();
    renderizarMapaLugares();
  });
  document.getElementById("filtro-so-info").addEventListener("change", e => {
    filtroSoInfo = e.target.checked;
    renderizarTabelaLugares();
    renderizarMapaLugares();
  });
}

document.addEventListener("DOMContentLoaded", iniciar);
