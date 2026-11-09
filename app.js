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
  stadium: "flag", nightclub: "music", events_venue: "party-popper",
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
  renderizarSeletorCidade();
  renderizarLugares();
  renderizarLegenda();
  renderizarViagemCidade();
  renderizarCidadeAtual();
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
  const [municipios, cidades, lugares, banheiros, viagem] = await Promise.all([
    fetch("data/municipios.json").then(r => r.json()),
    fetch("data/cidades.json").then(r => r.json()),
    fetch("data/lugares.json").then(r => r.json()),
    fetch("data/banheiros.json").then(r => r.json()),
    fetch("data/viagem.json").then(r => r.json()),
  ]);
  DADOS = { municipios, cidades, lugares, banheiros, viagem };
}

function renderizarEstatisticasHero() {
  document.getElementById("stat-lugares").textContent = num(DADOS.lugares.length, 0);
  document.getElementById("stat-cidades").textContent = num(DADOS.cidades.length, 0);
  document.getElementById("stat-banheiros").textContent = num(DADOS.banheiros.filter(b => b.wheelchair === "yes").length, 0);
  document.getElementById("stat-municipios").textContent = num(DADOS.municipios.length, 0);
}

// ---------------------------------------------------------------- LUGARES ACESSÍVEIS
let mapaLugares;
let cidadeAtual = "sp";
let filtroCategoria = [], filtroNome = "", filtroSoInfo = false;
let marcadoresLugares = [];

function categoriaTexto(c) {
  return LANG === "en" ? c.categoria_en : c.categoria_pt;
}

function cidadeInfo(slug) {
  return DADOS.cidades.find(c => c.slug === slug);
}

function nomeCidadeExibicao(slug) {
  const c = cidadeInfo(slug);
  if (!c) return slug;
  return c.apelido || c.cidade.split(" - ")[0];
}

function renderizarSeletorCidade() {
  const capitais = DADOS.cidades.filter(c => c.capital).sort((a, b) => a.cidade.localeCompare(b.cidade));
  const destinos = DADOS.cidades.filter(c => !c.capital).sort((a, b) => (a.apelido || a.cidade).localeCompare(b.apelido || b.cidade));
  const opcao = c => `<option value="${c.slug}">${c.apelido ? `${c.apelido} (${c.cidade})` : c.cidade}</option>`;
  const html = `
    <optgroup label="${t("lugares_grupo_capitais")}">${capitais.map(opcao).join("")}</optgroup>
    <optgroup label="${t("lugares_grupo_destinos")}">${destinos.map(opcao).join("")}</optgroup>
  `;

  ["seletor-cidade", "seletor-cidade-viagem"].forEach(id => {
    const select = document.getElementById(id);
    if (select.dataset.montado !== "1") {
      select.innerHTML = html;
      select.value = cidadeAtual;
      select.dataset.montado = "1";
      select.addEventListener("change", () => mudarCidade(select.value));
    }
  });
}

function mudarCidade(novoSlug) {
  cidadeAtual = novoSlug;
  document.getElementById("seletor-cidade").value = novoSlug;
  document.getElementById("seletor-cidade-viagem").value = novoSlug;
  filtroCategoria = []; filtroNome = ""; filtroSoInfo = false;
  document.getElementById("filtro-nome").value = "";
  document.getElementById("filtro-so-info").checked = false;
  renderizarLugares();
  renderizarViagemCidade();
}

function lugaresDaCidade() {
  return DADOS.lugares.filter(p => p.cidade_slug === cidadeAtual);
}

function construirChipsCategoria() {
  const caixa = document.getElementById("chips-categoria");
  const vistos = new Map();
  lugaresDaCidade().forEach(p => { if (!vistos.has(p.categoria)) vistos.set(p.categoria, categoriaTexto(p)); });
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
  return lugaresDaCidade().filter(p => {
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
  document.getElementById("lugares-titulo").textContent = t("lugares_titulo").replace("{cidade}", nomeCidadeExibicao(cidadeAtual));
  construirChipsCategoria();
  renderizarGridLugares();
  renderizarMapaLugares();
}

function ordenarPorInfo(lista) {
  return lista.slice().sort((a, b) => {
    const aInfo = a.wheelchair === "nao_informado" ? 1 : 0;
    const bInfo = b.wheelchair === "nao_informado" ? 1 : 0;
    if (aInfo !== bInfo) return aInfo - bInfo;
    return a.nome.localeCompare(b.nome);
  });
}

function renderizarGridLugares() {
  const wtxt = WHEELCHAIR_TXT[LANG];
  const lugares = ordenarPorInfo(aplicarFiltrosLugares());
  const grid = document.getElementById("grid-lugares");

  if (!lugares.length) {
    grid.innerHTML = `<p class="secao-caption">${t("lugares_vazio")}</p>`;
    return;
  }

  grid.innerHTML = lugares.map((p, i) => {
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
  const c = cidadeInfo(cidadeAtual);
  if (!mapaLugares) {
    mapaLugares = L.map("mapa-lugares").setView([c.lat, c.lon], 13);
    L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
      attribution: "&copy; OpenStreetMap contributors",
    }).addTo(mapaLugares);
    mapaLugares._camadaPontos = L.layerGroup().addTo(mapaLugares);
  } else {
    mapaLugares.setView([c.lat, c.lon], 13);
  }
  mapaLugares._camadaPontos.clearLayers();
  marcadoresLugares = [];
  const wtxt = WHEELCHAIR_TXT[LANG];

  ordenarPorInfo(aplicarFiltrosLugares()).forEach(p => {
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

  DADOS.banheiros.filter(b => b.cidade_slug === cidadeAtual).forEach(b => {
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

// ---------------------------------------------------------------- ANTES DE VIAJAR (por cidade)
function badgeConfianca(nivel) {
  const chave = { alta: "viagem_confianca_alta", moderada: "viagem_confianca_moderada", baixa: "viagem_confianca_moderada", nao_encontrado: "viagem_confianca_nao_encontrado" }[nivel] || "viagem_confianca_moderada";
  const classe = { alta: "badge-yes", moderada: "badge-limited", baixa: "badge-limited", nao_encontrado: "badge-nao_informado" }[nivel] || "badge-limited";
  return `<span class="badge ${classe}">${t(chave)}</span>`;
}

function cartaoInfoViagem(icone, titulo, bloco, mensagemVazia) {
  const corpo = bloco
    ? `${badgeConfianca(bloco.confianca)}<p>${bloco[LANG] || bloco.pt}</p>`
    : `${badgeConfianca("nao_encontrado")}<p>${mensagemVazia}</p>`;
  return `
    <article class="cartao-editorial cartao-violeta">
      <i data-lucide="${icone}" class="cartao-icone"></i>
      <h3>${titulo}</h3>
      ${corpo}
    </article>`;
}

function renderizarViagemCidade() {
  if (!DADOS.viagem) return;
  const nome = nomeCidadeExibicao(cidadeAtual);
  document.getElementById("viagem-cidade-titulo").textContent = t("viagem_cidade_titulo").replace("{cidade}", nome);

  const d = DADOS.viagem[cidadeAtual] || {};
  document.getElementById("viagem-cidade-cards").innerHTML =
    cartaoInfoViagem("plane", t("viagem_aeroporto_cidade_titulo"), d.aeroporto, t("viagem_sem_aeroporto")) +
    cartaoInfoViagem("bus", t("viagem_transporte_cidade_titulo"), d.transporte, t("viagem_sem_transporte"));

  if (window.lucide) lucide.createIcons();
}

// ---------------------------------------------------------------- MINHA CIDADE (índice nacional)
let cidadeSelecionada = null;

function configurarBuscaMunicipio() {
  const datalist = document.getElementById("lista-municipios");
  datalist.innerHTML = DADOS.municipios.map(m => `<option value="${m.municipio}">`).join("");

  document.getElementById("form-busca-municipio").addEventListener("submit", e => {
    e.preventDefault();
    selecionarCidadePorNome(document.getElementById("busca-municipio").value);
  });
}

function selecionarCidadePorNome(nome) {
  const encontrado = DADOS.municipios.find(m => m.municipio === nome);
  const aviso = document.getElementById("busca-municipio-erro");
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

      <div class="ficha-stats">
        <div><span class="num-media">${num(m.pop_dificuldade, 0)}</span><span class="label">${t("cidade_dificuldade")}<br>${t("cidade_pessoas")}</span></div>
        <div><span class="num-media">${num(m.pct_vinculos_pcd)}%</span><span class="label">${t("cidade_vinculos")}<br>${t("cidade_vinculos_nota")}</span></div>
        <div><span class="num-media">${m.status_transporte.replace(/_/g, " ")}</span><span class="label">${t("cidade_transporte")}</span></div>
        <div><span class="num-media">${regiaoLabel} (${m.uf})</span><span class="label">${t("cidade_regiao")}</span></div>
      </div>

      <p class="ficha-contexto"><b>${t("cidade_contexto_titulo")}:</b> ${t("cidade_contexto_texto")}</p>
      <button id="btn-baixar-cidade"><i data-lucide="download"></i> ${t("cidade_download")}</button>
    </div>`;

  document.getElementById("btn-baixar-cidade").addEventListener("click", () => baixarResumoCidade(m));
  document.getElementById("btn-trocar-cidade").addEventListener("click", () => {
    cidadeSelecionada = null;
    renderizarCidadeAtual();
    document.getElementById("busca-municipio").focus();
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
  renderizarEstatisticasHero();
  renderizarSeletorCidade();
  aplicarTraducoes();
  configurarBuscaMunicipio();

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
