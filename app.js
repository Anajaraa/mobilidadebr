// mobilidadeBR — lógica principal. Usa i18n.js (dicionário) e busca os
// dados já exportados em data/*.json pelo pipeline Python do projeto.

const CORES = { vermelho: "#C1272D", violeta: "#6C5296", verde: "#2E6F4E", ambar: "#B5790A", cinza: "#8A8F8C" };

let LANG = localStorage.getItem("lang") || "pt";
let DADOS = {};

const CIDADES_EXEMPLO = ["Pacujá - CE", "São Paulo - SP", "Macaúbas - BA", "Pilar de Goiás - GO"];

const CATEGORIA_ICONE = {
  museum: "landmark", attraction: "sparkles", viewpoint: "mountain", gallery: "image",
  historic: "landmark", hotel: "bed", mall: "shopping-bag",
  restaurant: "utensils", fast_food: "utensils", cafe: "coffee", artwork: "palette",
};

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
function locale() { return LANG === "en" ? "en-US" : "pt-BR"; }
function num(v, casas = 1) { return Number(v).toLocaleString(locale(), { maximumFractionDigits: casas }); }

function aplicarTraducoes() {
  document.querySelectorAll("[data-i18n]").forEach(el => { el.textContent = t(el.dataset.i18n); });
  document.querySelectorAll("[data-i18n-html]").forEach(el => { el.innerHTML = t(el.dataset.i18nHtml); });
  document.querySelectorAll("[data-i18n-placeholder]").forEach(el => { el.placeholder = t(el.dataset.i18nPlaceholder); });
  document.title = t("titulo");
  if (!DADOS.lugares) return;
  renderizarLugares();
  renderizarLegenda();
  renderizarRuasTexto();
  renderizarCidadeAtual();
  renderizarPanoramaBrasil();
  if (window.lucide) lucide.createIcons();
}

// ---------------------------------------------------------------- NAV / SCROLL-SPY
function configurarNav() {
  const links = [...document.querySelectorAll(".chip-link")];
  const secoes = links.map(l => document.getElementById(l.dataset.section)).filter(Boolean);
  const observer = new IntersectionObserver(entradas => {
    entradas.forEach(entrada => {
      const link = links.find(l => l.dataset.section === entrada.target.id);
      if (!link) return;
      if (entrada.isIntersecting) {
        links.forEach(l => l.classList.remove("ativo"));
        link.classList.add("ativo");
      }
    });
  }, { rootMargin: "-40% 0px -55% 0px" });
  secoes.forEach(s => observer.observe(s));
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
let marcadoresLugares = [];

function categoriaTexto(c) {
  return LANG === "en" ? c.categoria_en : c.categoria_pt;
}

function construirChipsCategoria() {
  const caixa = document.getElementById("chips-categoria");
  const vistos = new Map();
  DADOS.lugares.forEach(p => { if (!vistos.has(p.categoria)) vistos.set(p.categoria, categoriaTexto(p)); });
  const categorias = [...vistos.entries()].sort((a, b) => a[1].localeCompare(b[1]));

  const chipTodos = `<button class="chip ${filtroCategoria.length === 0 ? "ativo" : ""}" data-cat="">${t("lugares_chip_todas")}</button>`;
  const chips = categorias.map(([raw, label]) => `<button class="chip ${filtroCategoria.includes(raw) ? "ativo" : ""}" data-cat="${raw}">${label}</button>`);
  caixa.innerHTML = [chipTodos, ...chips].join("");

  caixa.querySelectorAll(".chip").forEach(botao => {
    botao.addEventListener("click", () => {
      const cat = botao.dataset.cat;
      if (cat === "") { filtroCategoria = []; }
      else if (filtroCategoria.includes(cat)) { filtroCategoria = filtroCategoria.filter(c => c !== cat); }
      else { filtroCategoria = [...filtroCategoria, cat]; }
      construirChipsCategoria();
      renderizarGridLugares();
      renderizarMapaLugares();
    });
  });
}

function aplicarFiltrosLugares() {
  return DADOS.lugares.filter(p => {
    if (filtroCategoria.length && !filtroCategoria.includes(p.categoria)) return false;
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
  construirChipsCategoria();
  renderizarGridLugares();
  renderizarMapaLugares();
}

function renderizarGridLugares() {
  const wtxt = WHEELCHAIR_TXT[LANG];
  const lugares = aplicarFiltrosLugares().slice().sort((a, b) => {
    const aInfo = a.wheelchair === "nao_informado" ? 1 : 0;
    const bInfo = b.wheelchair === "nao_informado" ? 1 : 0;
    if (aInfo !== bInfo) return aInfo - bInfo;
    return a.nome.localeCompare(b.nome);
  });
  const grid = document.getElementById("grid-lugares");

  if (!lugares.length) {
    grid.innerHTML = `<p class="secao-caption">${t("lugares_vazio")}</p>`;
    return;
  }

  grid.innerHTML = lugares.map((p, i) => {
    const temInfo = p.wheelchair !== "nao_informado";
    const imagem = p.imagem
      ? `<img src="${p.imagem}" loading="lazy" alt="">`
      : `<i data-lucide="${CATEGORIA_ICONE[p.categoria] || "map-pin"}"></i>`;
    const distancia = p.banheiro_acessivel_m != null
      ? `${t("lugares_banheiro_perto")}: ${Math.round(p.banheiro_acessivel_m)} m`
      : t("lugares_banheiro_sem");
    return `
      <article class="lugar-card" data-idx="${i}" tabindex="0">
        <div class="lugar-img ${p.imagem ? "" : "lugar-img-placeholder"}">${imagem}</div>
        <div class="lugar-corpo">
          <div class="lugar-topo">
            <span class="lugar-categoria">${categoriaTexto(p)}</span>
            <span class="badge badge-${p.wheelchair}">${wtxt[p.wheelchair] || wtxt.nao_informado}</span>
          </div>
          <h4>${p.nome}</h4>
          <div class="lugar-banheiro"><i data-lucide="droplet"></i> ${distancia}</div>
        </div>
      </article>`;
  }).join("");

  grid.querySelectorAll(".lugar-card").forEach(card => {
    const ir = () => focarMarcador(Number(card.dataset.idx));
    card.addEventListener("click", ir);
    card.addEventListener("keydown", e => { if (e.key === "Enter") ir(); });
  });

  if (window.lucide) lucide.createIcons();
}

function focarMarcador(idx) {
  const marcador = marcadoresLugares[idx];
  if (!marcador || !mapaLugares) return;
  document.getElementById("mapa-lugares").scrollIntoView({ behavior: "smooth", block: "center" });
  mapaLugares.flyTo(marcador.getLatLng(), 16, { duration: 0.6 });
  setTimeout(() => marcador.openPopup(), 650);
}

function renderizarMapaLugares() {
  if (!mapaLugares) {
    mapaLugares = L.map("mapa-lugares").setView([-23.55, -46.63], 12);
    L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
      attribution: "&copy; OpenStreetMap contributors",
    }).addTo(mapaLugares);
    mapaLugares._camadaPontos = L.layerGroup().addTo(mapaLugares);
  }
  mapaLugares._camadaPontos.clearLayers();
  marcadoresLugares = [];
  const wtxt = WHEELCHAIR_TXT[LANG];

  aplicarFiltrosLugares().slice().sort((a, b) => {
    const aInfo = a.wheelchair === "nao_informado" ? 1 : 0;
    const bInfo = b.wheelchair === "nao_informado" ? 1 : 0;
    if (aInfo !== bInfo) return aInfo - bInfo;
    return a.nome.localeCompare(b.nome);
  }).forEach(p => {
    const temInfo = p.wheelchair !== "nao_informado";
    const marcador = L.circleMarker([p.lat, p.lon], {
      radius: temInfo ? 8 : 4, color: corAcessibilidade(p.wheelchair), weight: temInfo ? 2 : 1,
      fillOpacity: temInfo ? 0.9 : 0.4, fillColor: corAcessibilidade(p.wheelchair),
    });
    const img = p.imagem ? `<img src="${p.imagem}" style="width:160px;border-radius:8px;display:block;margin-bottom:6px;">` : "";
    marcador.bindPopup(`${img}<b>${p.nome}</b><br>${wtxt[p.wheelchair] || wtxt.nao_informado}`);
    marcador.addTo(mapaLugares._camadaPontos);
    marcadoresLugares.push(marcador);
  });

  DADOS.banheiros.forEach(b => {
    L.circleMarker([b.lat, b.lon], {
      radius: 3, color: b.wheelchair === "yes" ? CORES.verde : "#AEB4B0", fillOpacity: 0.5,
    }).bindTooltip("WC").addTo(mapaLugares._camadaPontos);
  });
}

function renderizarLegenda() {
  const wtxt = WHEELCHAIR_TXT[LANG];
  document.getElementById("legenda-lugares").innerHTML = `
    <span class="dot" style="background:${CORES.verde}"></span>${wtxt.yes}
    <span class="dot" style="background:${CORES.ambar}"></span>${wtxt.limited}
    <span class="dot" style="background:${CORES.cinza}"></span>${wtxt.nao_informado}
    <span class="dot" style="background:#AEB4B0"></span>${t("legenda_banheiro")}`;
}

function renderizarRuasTexto() {
  const el = document.getElementById("ruas-stat-texto");
  if (el && DADOS.ruasCalor) el.textContent = `${num(DADOS.ruasCalor.length, 0)} ${t("ruas_stat")}`;
}

function renderizarMapaRuas() {
  if (mapaRuas) return;
  mapaRuas = L.map("mapa-ruas").setView([-23.55, -46.63], 11);
  L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
    attribution: "&copy; OpenStreetMap contributors",
  }).addTo(mapaRuas);
  L.heatLayer(DADOS.ruasCalor, { radius: 9, blur: 12, maxZoom: 13 }).addTo(mapaRuas);
}

// ---------------------------------------------------------------- MINHA CIDADE
let cidadeSelecionada = null;

function configurarBuscaCidade() {
  const datalist = document.getElementById("lista-cidades");
  datalist.innerHTML = DADOS.municipios.map(m => `<option value="${m.municipio}">`).join("");

  document.getElementById("form-busca-cidade").addEventListener("submit", e => {
    e.preventDefault();
    selecionarCidadePorNome(document.getElementById("busca-cidade").value);
  });
}

function selecionarCidadePorNome(nome) {
  const encontrado = DADOS.municipios.find(m => m.municipio === nome);
  const aviso = document.getElementById("busca-cidade-erro");
  if (!encontrado) {
    if (aviso) aviso.textContent = t("cidade_nao_encontrado");
    return;
  }
  if (aviso) aviso.textContent = "";
  cidadeSelecionada = encontrado;
  renderizarCidadeAtual();
  document.getElementById("cidade").scrollIntoView({ behavior: "smooth" });
}

function renderizarCidadeAtual() {
  const div = document.getElementById("resultado-cidade");
  if (!div || !DADOS.municipios) return;

  if (!cidadeSelecionada) {
    div.innerHTML = `
      <div class="cidade-vazio">
        <p>${t("cidade_vazio_titulo")}</p>
        <p class="secao-caption">${t("cidade_vazio_texto")}</p>
        <div class="chips-categoria" id="chips-exemplo"></div>
      </div>`;
    const caixa = document.getElementById("chips-exemplo");
    caixa.innerHTML = CIDADES_EXEMPLO.map(nome => `<button class="chip" data-nome="${nome}">${nome}</button>`).join("");
    caixa.querySelectorAll(".chip").forEach(b => b.addEventListener("click", () => selecionarCidadePorNome(b.dataset.nome)));
    return;
  }

  const m = cidadeSelecionada;
  const total = DADOS.municipios.length;
  const rotulo = LANG === "en" ? m.rotulo_en : m.rotulo_pt;
  const corPerfil = m.cluster === 1 ? CORES.ambar : (m.cluster === 2 ? CORES.verde : CORES.violeta);
  const mediaRegiao = DADOS.resumo.por_regiao[m.regiao];
  const regiaoLabel = LANG === "en" ? (REGIAO_PT_EN[m.regiao] || m.regiao) : m.regiao;

  div.innerHTML = `
    <div class="ficha-cidade">
      <div class="ficha-topo">
        <div>
          <div class="ficha-municipio">${m.municipio}</div>
          <span class="pill" style="background:${corPerfil}1a;color:${corPerfil};border:1px solid ${corPerfil}55;">${rotulo}</span>
        </div>
        <button class="link-trocar" id="btn-trocar-cidade">${t("cidade_vazio_titulo")}</button>
      </div>

      <div class="ficha-numeros">
        <div class="numero-grande"><span class="num">#${m.posicao}</span><span class="label">${t("cidade_posicao")}<br>${t("cidade_de")}</span></div>
        <div class="numero-grande"><span class="num">${num(m.indice)}</span><span class="label">${t("cidade_indice")}<br>${t("cidade_em100")}</span></div>
      </div>

      <div class="comparacao">
        <div class="comparacao-label">${t("cidade_comparacao").replace("{regiao}", regiaoLabel)}</div>
        <div class="barra-comparacao">
          <div class="barra-linha"><span>${m.municipio.split(" - ")[0]}</span><div class="barra"><div class="barra-fill" style="width:${m.indice}%;background:${corPerfil}"></div></div><b>${num(m.indice)}</b></div>
          <div class="barra-linha"><span>${regiaoLabel}</span><div class="barra"><div class="barra-fill" style="width:${mediaRegiao}%;background:${CORES.cinza}"></div></div><b>${num(mediaRegiao)}</b></div>
        </div>
      </div>

      <div class="ficha-stats">
        <div><span class="num-media">${num(m.pop_dificuldade, 0)}</span><span class="label">${t("cidade_dificuldade")}<br>${t("cidade_pessoas")}</span></div>
        <div><span class="num-media">${num(m.pct_vinculos_pcd)}%</span><span class="label">${t("cidade_vinculos")}<br>${t("cidade_vinculos_nota")}</span></div>
        <div><span class="num-media">${m.status_transporte.replace(/_/g, " ")}</span><span class="label">${t("cidade_transporte")}</span></div>
      </div>

      <p class="ficha-contexto"><b>${t("cidade_contexto_titulo")}:</b> ${t("cidade_contexto_texto")}</p>
      <button id="btn-baixar-cidade"><i data-lucide="download"></i> ${t("cidade_download")}</button>
    </div>`;

  document.getElementById("btn-baixar-cidade").addEventListener("click", () => baixarResumoCidade(m));
  document.getElementById("btn-trocar-cidade").addEventListener("click", () => {
    cidadeSelecionada = null;
    renderizarCidadeAtual();
    document.getElementById("topo").scrollIntoView({ behavior: "smooth" });
    document.getElementById("busca-cidade").focus();
  });
  if (window.lucide) lucide.createIcons();
}

function baixarResumoCidade(m) {
  const total = DADOS.municipios.length;
  const rotulo = LANG === "en" ? m.rotulo_en : m.rotulo_pt;
  const texto = `ACESSIBILIDADE EM ${m.municipio}
Fonte: site mobilidadeBR / projeto Mapa da Equidade

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
  if (!DADOS.resumo) return;
  const porRegiao = DADOS.resumo.por_regiao;
  const regioesOrdenadas = Object.keys(porRegiao).sort((a, b) => porRegiao[b] - porRegiao[a]);
  const maiorRegiao = regioesOrdenadas[0];
  const menorRegiao = regioesOrdenadas[regioesOrdenadas.length - 1];
  document.getElementById("destaque-brasil").innerHTML = t("brasil_destaque")
    .replace("{regiao}", LANG === "en" ? (REGIAO_PT_EN[maiorRegiao] || maiorRegiao) : maiorRegiao)
    .replace("{indice}", num(porRegiao[maiorRegiao]))
    .replace("{menorIndice}", num(porRegiao[menorRegiao]))
    .replace("{menorRegiao}", LANG === "en" ? (REGIAO_PT_EN[menorRegiao] || menorRegiao) : menorRegiao);

  if (!mapaBrasil) {
    mapaBrasil = L.map("mapa-brasil").setView([-14.2, -51.9], 3.6);
    L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
      attribution: "&copy; OpenStreetMap contributors",
    }).addTo(mapaBrasil);

    const porUf = DADOS.resumo.por_uf;
    const max = Math.max(...Object.values(porUf).map(v => v.indice));
    const corPorIndice = v => {
      const frac = v / max;
      const r = Math.round(240 - frac * 47);
      const g = Math.round(222 - frac * 182);
      const b = Math.round(205 - frac * 160);
      return `rgb(${r}, ${g}, ${b})`;
    };
    L.geoJSON(DADOS.malha, {
      style: feat => {
        const sigla = CODIGO_PARA_SIGLA[feat.properties.codigo_uf];
        const dado = porUf[sigla];
        return { fillColor: dado ? corPorIndice(dado.indice) : "#ccc", fillOpacity: 0.9, color: "var(--surface)", weight: 1 };
      },
      onEachFeature: (feat, layer) => {
        const sigla = CODIGO_PARA_SIGLA[feat.properties.codigo_uf];
        const dado = porUf[sigla];
        if (dado) layer.bindTooltip(`${sigla}: ${num(dado.indice)} (${dado.n} municípios)`);
      },
    }).addTo(mapaBrasil);
  }

  const labels = regioesOrdenadas.map(r => LANG === "en" ? (REGIAO_PT_EN[r] || r) : r);
  const valores = regioesOrdenadas.map(r => porRegiao[r]);

  if (graficoRegiao) graficoRegiao.destroy();
  graficoRegiao = new Chart(document.getElementById("grafico-regiao"), {
    type: "bar",
    data: { labels, datasets: [{ label: t("cidade_indice"), data: valores, backgroundColor: CORES.violeta, borderRadius: 6 }] },
    options: {
      indexAxis: "y",
      plugins: { legend: { display: false } },
      scales: { x: { beginAtZero: true, max: 100 } },
    },
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

  configurarNav();
  await carregarDados();
  aplicarTraducoes();
  configurarBuscaCidade();
  renderizarMapaRuas();
  renderizarPanoramaBrasil();

  document.getElementById("filtro-nome").addEventListener("input", e => {
    filtroNome = e.target.value;
    renderizarGridLugares();
    renderizarMapaLugares();
  });
  document.getElementById("filtro-so-info").addEventListener("change", e => {
    filtroSoInfo = e.target.checked;
    renderizarGridLugares();
    renderizarMapaLugares();
  });
}

document.addEventListener("DOMContentLoaded", iniciar);
