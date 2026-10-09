// /moi/ — NEH-1. Le disque de verre (même matière que le N) traverse les 12 sections au scroll.
// Principe : chaque section a une progression 0→1 ; l'état du disque est défini par des images clés
// (section, progression) et interpolé ; les éléments [data-step="section:a-b"] apparaissent dans leur plage.
import * as THREE from "/neh/vendor/three.module.min.js";
import { buildDisc, loadEnv } from "/neh/glass.js";
import { buildHand } from "/neh/hand.js";

const $ = s => document.querySelector(s), $$ = s => [...document.querySelectorAll(s)];
const clamp = (v, a = 0, b = 1) => Math.min(b, Math.max(a, v));
const smooth = t => t * t * (3 - 2 * t);
const TAU = Math.PI * 2;
const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;
gsap.registerPlugin(ScrollTrigger);

// ---------------- scroll doux ----------------
let lenis = null;
if (!reduce && window.Lenis) {
  lenis = new Lenis({ lerp: 0.1 }); window.__lenis = lenis;
  lenis.on("scroll", ScrollTrigger.update);
  gsap.ticker.add(t => lenis.raf(t * 1000)); gsap.ticker.lagSmoothing(0);
  $$('a[href^="#"]').forEach(a => a.addEventListener("click", e => { const t = $(a.getAttribute("href")); if (t) { e.preventDefault(); lenis.scrollTo(t); } }));
}

// ---------------- sections : position et progression ----------------
const secs = $$(".sec").map(el => ({ id: el.dataset.sec, el, top: 0, h: 0, pin: el.classList.contains("pin") }));
const S = Object.fromEntries(secs.map(s => [s.id, s]));
function measure() { for (const s of secs) { s.top = s.el.getBoundingClientRect().top + scrollY; s.h = s.el.offsetHeight; } }
const span = s => Math.max(1, s.pin ? s.h - innerHeight : s.h);
const progress = (id, y = scrollY) => { const s = S[id]; return clamp((y - s.top) / span(s)); };
const yAt = (id, p) => S[id].top + p * span(S[id]);

// éléments à plage d'apparition
const steps = $$("[data-step]").map(el => { const [sec, r] = el.dataset.step.split(":"); const [a, b] = r.split("-").map(Number); return { el, sec, a, b }; });
function applySteps() {
  for (const st of steps) {
    const s = S[st.sec], p = progress(st.sec), f = 0.035;
    const inside = scrollY >= s.top - 2 && scrollY <= s.top + span(s) + 2;
    let o = inside ? Math.min(st.a <= 0.001 ? 1 : clamp((p - st.a) / f), clamp((st.b - p) / f)) : 0;
    st.el.style.opacity = o.toFixed(3);
    st.el.style.visibility = o > 0.001 ? "visible" : "hidden";
    st.el.style.filter = o < 0.999 ? `blur(${((1 - o) * 8).toFixed(1)}px)` : "none";
  }
}

// ---------------- WebGL ----------------
const renderer = new THREE.WebGLRenderer({ canvas: $("#gl"), antialias: true, alpha: true, powerPreference: "high-performance" });
renderer.setPixelRatio(Math.min(devicePixelRatio, 1.75));
renderer.setClearColor(0x000000, 0);
renderer.outputColorSpace = THREE.SRGBColorSpace;
const scene = new THREE.Scene();
const cam = new THREE.PerspectiveCamera(30, 1, 0.05, 100);
await document.fonts?.load("900 100px Archivo").catch(() => {});
loadEnv(renderer);

// tapis de découpe (intro)
function matTexture() {
  const W = 2048, H = 1365, c = document.createElement("canvas"); c.width = W; c.height = H; const g = c.getContext("2d");
  const bg = g.createRadialGradient(W / 2, H / 2, 100, W / 2, H / 2, W * 0.7); bg.addColorStop(0, "#151a3d"); bg.addColorStop(1, "#070812");
  g.fillStyle = bg; g.fillRect(0, 0, W, H);
  for (const [axis, len] of [["x", W], ["y", H]]) for (let v = 0, i = 0; v <= len; v += 40, i++) {
    g.strokeStyle = i % 5 ? "rgba(197,208,255,.10)" : "rgba(197,208,255,.25)"; g.lineWidth = i % 5 ? 1 : 1.6; g.beginPath();
    if (axis === "x") { g.moveTo(v, 0); g.lineTo(v, H); } else { g.moveTo(0, v); g.lineTo(W, v); } g.stroke();
  }
  g.fillStyle = "rgba(197,208,255,.55)"; g.font = "500 18px JetBrains Mono, monospace";
  for (let x = 200, n = 5; x < W; x += 200, n += 5) { g.fillText(n, x + 6, 28); g.fillText(n, x + 6, H - 14); }
  for (let y = 200, n = 5; y < H; y += 200, n += 5) g.fillText(n, 10, y - 6);
  g.font = "700 22px JetBrains Mono, monospace"; g.fillStyle = "rgba(197,208,255,.45)"; g.fillText("NEH-1 · ÉCHELLE 1:1 · CLUSES (74)", 60, H - 60);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8; return t;
}
const mat = new THREE.Mesh(new THREE.PlaneGeometry(10, 6.66), new THREE.MeshBasicMaterial({ map: matTexture(), transparent: true }));
mat.rotation.x = -Math.PI / 2; mat.position.y = -0.14; scene.add(mat);
const radialTex = (a0, a1) => { const c = document.createElement("canvas"); c.width = c.height = 256; const g = c.getContext("2d");
  const r = g.createRadialGradient(128, 128, 0, 128, 128, 128); r.addColorStop(0, a0); r.addColorStop(1, a1); g.fillStyle = r; g.fillRect(0, 0, 256, 256); return new THREE.CanvasTexture(c); };
const shadow = new THREE.Mesh(new THREE.PlaneGeometry(3.2, 3.2), new THREE.MeshBasicMaterial({ map: radialTex("rgba(0,0,0,.8)", "rgba(0,0,0,0)"), transparent: true, depthWrite: false }));
shadow.rotation.x = -Math.PI / 2; shadow.position.y = -0.135; scene.add(shadow);
const glow = new THREE.Mesh(new THREE.PlaneGeometry(10, 10), new THREE.MeshBasicMaterial({ map: radialTex("rgba(255,255,255,1)", "rgba(255,255,255,0)"), color: 0x3a3cff, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false }));
glow.position.z = -3; scene.add(glow);

// disque principal + "tableau de bord" posé dessus (section fonctions)
const disc = await buildDisc({ layers: 4, radius: 1, height: 0.24 });
const pivot = new THREE.Group(); pivot.add(disc.group); scene.add(pivot);
const plainMats = [];
disc.group.traverse(o => { if (o.material && !o.material.uniforms) { o.material.transparent = true; o.material.userData.base = o.material.opacity; plainMats.push(o.material); } });
const cardTex = new THREE.TextureLoader().load("/neh/shots/glpi/1-synthese.webp"); cardTex.colorSpace = THREE.SRGBColorSpace;
const edgeMat = new THREE.MeshBasicMaterial({ color: 0x1a1d2e, transparent: true }), faceMat = new THREE.MeshBasicMaterial({ map: cardTex, transparent: true });
const card = new THREE.Mesh(new THREE.BoxGeometry(1.5, 0.02, 0.94), [edgeMat, edgeMat, faceMat, edgeMat, edgeMat, edgeMat]);
card.position.y = 0.14; disc.group.add(card);

// la main de verre (section IA) : tient le disque, suit la souris
const hand = buildHand(); hand.root.scale.setScalar(0.95); hand.root.visible = false; scene.add(hand.root);
const follow = new THREE.Vector2();

// trois disques pour "Choisissez votre NEH-1" (1, 2 et 3 couches)
const stacks = [];
for (let n = 1; n <= 3; n++) {
  const d = await buildDisc({ layers: n, radius: 1, height: 0.1 * n, knurl: n === 1 });
  const g = new THREE.Group(); g.add(d.group); g.visible = false; scene.add(g); stacks.push({ g, d });
}

// ---------------- images clés du disque ----------------
// cam : 1 vue de dessus, 0 vue de côté · close : macro sur la tranche · alpha : visibilité · lift : hauteur au-dessus du tapis
const BASE = { cam: 1, mat: 1, px: 0, py: 0, scale: 1, tilt: 0, spin: 0, flip: 0, alpha: 1, thermal: 0, gray: 0, close: 0, glow: 0, card: 0, stacks: 0, lift: 0, hand: 0 };
const KEYS = [
  ["hero", 0, {}],
  ["hero", 0.45, { mat: 0.35, lift: 0.45, cam: 0.55, glow: 0.3 }],            // il décolle AVANT de basculer : il ne traverse plus le tapis
  ["ai", 0, { cam: 0, mat: 0, lift: 0, tilt: 1.25, spin: 0.6, glow: 0.5 }],
  ["ai", 0.38, { tilt: 0.95, spin: TAU }],
  ["ai", 0.46, { hand: 0 }],
  ["ai", 0.56, { tilt: 1.42, py: 0.22, scale: 0.6, glow: 1, hand: 1 }],
  ["ai", 0.98, {}],
  ["wearable", 0.04, { alpha: 0, scale: 0.6, glow: 0.4, hand: 0 }],
  ["wearable", 0.98, {}],
  ["features", 0, { alpha: 1, tilt: 0.42, spin: 2 * TAU, px: 0.85, py: -0.1, scale: 1, glow: 0.6 }],
  ["features", 0.08, { card: 0 }],
  ["features", 0.2, { card: 1 }],
  ["features", 0.25, { card: 0, thermal: 0 }],
  ["features", 0.3, { thermal: 1, spin: 2 * TAU }],
  ["features", 0.48, { thermal: 1, spin: 3 * TAU }],
  ["features", 0.53, { thermal: 0, alpha: 0 }],
  ["features", 0.98, {}],
  ["encryption", 0, { alpha: 1, px: 0, py: -0.32, scale: 0.6, tilt: 1.15, spin: 3 * TAU, glow: 0.7 }],
  ["encryption", 0.5, { flip: 1 }],
  ["encryption", 0.96, {}],
  ["grip", 0.0, { close: 1, gray: 1, tilt: 0.12, scale: 1, py: 0, glow: 0 }],
  ["grip", 0.95, { spin: 3.3 * TAU }],
  ["sustain", 0.02, { alpha: 0, close: 0, gray: 0 }],
  ["sustain", 0.98, {}],
  ["reviews", 0, { alpha: 1, flip: 2, px: 0.15, py: 0.55, tilt: 0.5, scale: 0.5, spin: 3.5 * TAU, glow: 0.5 }],
  ["reviews", 0.35, { spin: 4 * TAU, py: 2.4 }],
  ["social", 0.03, { alpha: 0 }],
  ["social", 0.97, {}],
  ["product", 0.0, { stacks: 1 }],
  ["product", 0.85, {}],
  ["paper", 0.1, { stacks: 0 }],
  ["paper", 0.6, {}],
  ["contact", 0.3, { alpha: 1, px: 0, py: 0.95, scale: 0.5, tilt: 0.4, spin: 5 * TAU, glow: 0.8 }],
];
let keys = [];
function buildKeys() {
  let cur = { ...BASE };
  keys = KEYS.map(([sec, p, s]) => { cur = { ...cur, ...s }; return { y: yAt(sec, p), s: cur }; }).sort((a, b) => a.y - b.y);
}
const st = { ...BASE };
function sample(y) {
  if (y <= keys[0].y) return Object.assign(st, keys[0].s);
  for (let i = 0; i < keys.length - 1; i++) {
    const a = keys[i], b = keys[i + 1];
    if (y <= b.y) { const t = smooth(clamp((y - a.y) / Math.max(1, b.y - a.y))); for (const k in BASE) st[k] = a.s[k] + (b.s[k] - a.s[k]) * t; return st; }
  }
  return Object.assign(st, keys[keys.length - 1].s);
}

// ---------------- interactions ----------------
let mx = 0, my = 0;
const aiframe = $("#aiframe");
addEventListener("pointermove", e => {
  mx = e.clientX / innerWidth - 0.5; my = e.clientY / innerHeight - 0.5;
  aiframe.style.setProperty("--mx", e.clientX + "px"); aiframe.style.setProperty("--my", e.clientY + "px");
});
let temp = 0.5; $("#temp")?.addEventListener("input", e => (temp = +e.target.value));
$("#chatSend")?.addEventListener("click", () => $("#chatReply").classList.add("on"));
// chiffrement : on retourne le disque et le texte (caractères à l'envers)
const FLIPMAP = Object.fromEntries([..."abcdefghijklmnopqrstuvwxyz"].map((c, i) => [c, [..."ɐqɔpǝɟƃɥᴉɾʞlɯuodbɹsʇnʌʍxʎz"][i]]));
const upside = s => [...s.toLowerCase()].reverse().map(c => FLIPMAP[c] || c).join("");
let flipUser = 0, encrypted = false;
$("#encForm")?.addEventListener("submit", e => {
  e.preventDefault(); encrypted = !encrypted;
  const o = { v: flipUser };
  gsap.to(o, { v: Math.round(flipUser) + 1, duration: 0.9, ease: "power3.inOut", onUpdate: () => (flipUser = o.v) });
  const msg = $("#encInput").value.trim() || "…";
  $("#encOut").textContent = encrypted ? upside(msg) : msg;
  $("#encBtn").textContent = encrypted ? "DÉCHIFFRER LE MESSAGE" : "CHIFFRER LE MESSAGE";
});
$("#copyUrl")?.addEventListener("click", e => { navigator.clipboard?.writeText(location.href); e.target.textContent = "URL COPIÉE"; });
// texture "macro" de la carte d'adhérence
{ const c = $("#gripTex"), g = c?.getContext("2d"); if (g) { const im = g.createImageData(c.width, c.height);
  for (let i = 0; i < im.data.length; i += 4) { const v = 40 + Math.random() * 140 * (Math.random() < 0.6 ? 1 : 0.3); im.data[i] = im.data[i + 1] = im.data[i + 2] = v; im.data[i + 3] = 255; } g.putImageData(im, 0, 0); } }
// points du cercle de construction
{ const g = $(".f-circle .dots"); if (g) for (let i = 0; i < 24; i++) { const a = i / 24 * TAU; const c = document.createElementNS("http://www.w3.org/2000/svg", "circle");
  c.setAttribute("cx", (Math.cos(a) * 210).toFixed(1)); c.setAttribute("cy", (Math.sin(a) * 210).toFixed(1)); c.setAttribute("r", i % 6 ? 3 : 5); g.appendChild(c); } }
// lettres qui roulent au survol (comme les liens d'oryzo)
function rollify(el) {
  const txt = el.textContent; if (!txt.trim() || el.querySelector(".roll")) return;
  el.textContent = ""; const w = document.createElement("span"); w.className = "roll"; w.setAttribute("aria-label", txt);
  [...txt].forEach((ch, i) => { const c = document.createElement("span"), v = ch === " " ? " " : ch;
    c.textContent = v; c.dataset.c = v; c.style.setProperty("--i", i); c.setAttribute("aria-hidden", "true"); w.appendChild(c); });
  el.appendChild(w);
}
$$(".top nav a, .back, .pp-btns a, .ft-row a, .ft-row button, .p-btn, .w-prompt button").forEach(rollify);
// lecteur "PLAY" : bande-annonce = diaporama de mes vraies captures
const REEL = [["/neh/shots/glpi/1-synthese.webp", "GLPI BI · SYNTHÈSE DU MOIS"], ["/neh/shots/glpi/6-ajout-visuel.webp", "GLPI BI · ÉDITEUR FAÇON POWER BI"],
  ["/neh/shots/synchro/2-planning.webp", "SYNCHRO CEGID · PLANNING"], ["/neh/shots/synchro/4-decisions.webp", "SYNCHRO CEGID · CE QUI BLOQUE"],
  ["/neh/shots/scaime/2-avion.webp", "SITE SCAIME · PLAN-SÉQUENCE"], ["/neh/shots/scaime/5-eclate.webp", "SITE SCAIME · VUE ÉCLATÉE 3D"],
  ["/neh/visuals/star.png", "ENTREPÔT EN ÉTOILE · −70 %"]];
let reelT = null;
function openPlayer() {
  const stg = $("#plStage");
  stg.replaceChildren(...REEL.map(([src]) => { const i = new Image(); i.src = src; i.alt = ""; return i; }));
  $("#player").hidden = false; lenis?.stop(); let k = 0;
  const show = () => {
    [...stg.children].forEach((im, j) => im.classList.toggle("on", j === k)); $("#plCap").textContent = REEL[k][1];
    gsap.fromTo("#plProg", { width: (k / REEL.length * 100) + "%" }, { width: ((k + 1) / REEL.length * 100) + "%", duration: 3.6, ease: "none" });
    k = (k + 1) % REEL.length;
  };
  show(); reelT = setInterval(show, 3600);
}
function closePlayer() { clearInterval(reelT); $("#player").hidden = true; lenis?.start(); }
$("#playCard").addEventListener("click", e => { e.preventDefault(); openPlayer(); });
$("#plClose").addEventListener("click", closePlayer);
addEventListener("keydown", e => { if (e.key === "Escape" && !$("#player").hidden) closePlayer(); });
// matière sombre qui se fend (durabilité) : relief granuleux de verre fumé, liseré lavande sur la cassure
$$(".s-half").forEach((c, idx) => {
  c.width = 1600; c.height = 600; const g = c.getContext("2d"), im = g.createImageData(c.width, c.height);
  for (let y = 0; y < c.height; y++) for (let x = 0; x < c.width; x++) {
    const n = Math.sin(x * 0.013 + Math.sin(y * 0.021) * 3) * 0.5 + Math.sin(y * 0.03 + x * 0.004) * 0.3 + Math.random() * 0.35;
    const v = 18 + n * 26, o = (y * c.width + x) * 4; im.data[o] = v * 0.8; im.data[o + 1] = v * 0.85; im.data[o + 2] = v * 1.4 + 12; im.data[o + 3] = 255;
  }
  g.putImageData(im, 0, 0);
  g.strokeStyle = "rgba(197,208,255,.55)"; g.lineWidth = 2; g.beginPath(); const y0 = idx ? 2 : c.height - 2;
  for (let x = 0; x <= c.width; x += 40) g.lineTo(x, y0 + (Math.random() - 0.5) * 10);
  g.stroke();
});
// graduations de l'horloge (carte 6 h)
{ const g = $(".clock .ticks"); if (g) for (let i = 0; i < 12; i++) {
  const a = i / 12 * TAU, l = document.createElementNS("http://www.w3.org/2000/svg", "line"), r2 = i % 3 ? 37 : 40;
  l.setAttribute("x1", 50 + Math.cos(a) * 34); l.setAttribute("y1", 50 + Math.sin(a) * 34); l.setAttribute("x2", 50 + Math.cos(a) * r2); l.setAttribute("y2", 50 + Math.sin(a) * r2); g.appendChild(l); } }
// avis : apparition au défilement
$$(".reveal-y").forEach(el => ScrollTrigger.create({ trigger: el, start: "top 88%", once: true, onEnter: () => gsap.to(el, { opacity: 1, y: 0, duration: 0.9, ease: "power3.out" }) }));

// ---------------- animations DOM liées aux sections ----------------
const NAVGROUP = { hero: "hero", ai: "hero", wearable: "hero", features: "features", encryption: "features", grip: "features", sustain: "features", reviews: "product", social: "product", product: "product", paper: "product", contact: "contact" };
const inSus = () => scrollY >= S.sustain.top - 2 && scrollY <= S.sustain.top + span(S.sustain);
function domFrame() {
  // portable : le grand texte traverse le cadre, puis la bande d'images défile
  const pw = progress("wearable"), inW = scrollY >= S.wearable.top - innerHeight;
  const big = $("#wBig"); if (big) { const k = smooth(clamp(pw / 0.32)); big.style.transform = `translate(${(1 - k) * innerWidth - k * big.offsetWidth * 1.05}px,-50%)`; big.style.visibility = inW ? "visible" : "hidden"; }
  const strip = $("#wStrip"), frame = $("#wFrame");
  if (strip && frame) { const max = strip.scrollWidth - frame.clientWidth; strip.style.transform = `translateX(${-clamp((pw - 0.3) / 0.62) * max}px)`;
    frame.style.opacity = 1 - clamp((pw - 0.74) / 0.04); }
  if (pw > 0.62) $("#chatReply")?.classList.add("on");
  // fonctions : dessin du cercle et du mot NABIH
  const pf = progress("features");
  $$(".f-circle .draw > *").forEach((n, i) => { n.style.strokeDasharray = "1600"; n.style.strokeDashoffset = (1600 * (1 - clamp((pf - 0.53 - i * 0.012) / 0.12))).toFixed(0); });
  const word = $(".f-word text"); if (word) { word.style.strokeDasharray = "5200"; word.style.strokeDashoffset = (5200 * (1 - clamp((pf - 0.78) / 0.14))).toFixed(0); }
  // durabilité : le papier clair monte depuis le bas, la page passe en clair
  const ps = progress("sustain");
  $("#sPaper").style.clipPath = `inset(${(100 * (1 - smooth(clamp((ps - 0.42) / 0.18)))).toFixed(2)}% 0 0 0)`;
  document.body.classList.toggle("paper", ps > 0.55 && scrollY < S.sustain.top + span(S.sustain) + innerHeight * 0.4);
  // durabilité : la matière se fend en deux et s'écarte
  const sp = smooth(clamp((ps - 0.02) / 0.14));
  $$(".s-half").forEach((h, i) => (h.style.transform = `translateY(${(i ? 1 : -1) * sp * 52}vh)`));
  $("#sSplit").style.visibility = inSus() && sp < 0.999 ? "visible" : "hidden";
  // cartes : défilement horizontal
  const track = $("#cTrack"); if (track) track.style.transform = `translate(${-clamp(progress("social") * 1.05) * Math.max(0, track.scrollWidth - innerWidth)}px,-50%)`;
  $$(".c-card").forEach(c => {   // le titre glisse et grossit en passant au centre
    const r = c.getBoundingClientRect(), d = (r.left + r.width / 2 - innerWidth / 2) / innerWidth, h = c.querySelector("h3");
    h.style.transformOrigin = "left bottom";
    h.style.transform = `translateX(${(-d * 120).toFixed(1)}px) scale(${(1 + Math.max(0, 0.18 - Math.abs(d) * 0.3)).toFixed(3)})`; });
  // cadre irisé "IA"
  const pa = progress("ai"), inAi = scrollY >= S.ai.top && scrollY <= S.ai.top + span(S.ai);
  aiframe.style.opacity = inAi ? Math.min(clamp((pa - 0.46) / 0.05), clamp((0.98 - pa) / 0.04)).toFixed(3) : 0;
  // navigation active + indicateur de scroll
  const cur = secs.filter(s => scrollY + innerHeight * 0.5 >= s.top).pop()?.id || "hero";
  $$("[data-nav]").forEach(a => a.classList.toggle("on", a.dataset.nav === NAVGROUP[cur]));
  $("#scrollhint").classList.toggle("off", scrollY > S.contact.top - innerHeight * 0.6);
}

// ---------------- guides de construction autour du disque (intro), façon logiciel de dessin ----------------
const hud = $("#hud"), NS = "http://www.w3.org/2000/svg";
const mk = (tag, at) => { const e = document.createElementNS(NS, tag); for (const k in at) e.setAttribute(k, at[k]); return e; };
const v3 = new THREE.Vector3();
const toScreen = (x, y, z, obj) => { v3.set(x, y, z); if (obj) v3.applyMatrix4(obj.matrixWorld); v3.project(cam); return [(v3.x + 1) / 2 * innerWidth, (1 - v3.y) / 2 * innerHeight]; };
function drawHud() {
  hud.replaceChildren();
  const o = clamp(1 - st.lift * 3) * st.alpha * st.mat; if (o < 0.01) return;
  const g = mk("g", { opacity: o.toFixed(3) }); hud.appendChild(g);
  const c = toScreen(0, 0.12, 0, disc.group), r = toScreen(1, 0.12, 0, disc.group)[0] - c[0], R = r + 18, k = 0.5523 * R;
  const P = [[c[0], c[1] - R], [c[0] + R, c[1]], [c[0], c[1] + R], [c[0] - R, c[1]]];
  const Hd = [[[c[0] - k, c[1] - R], [c[0] + k, c[1] - R]], [[c[0] + R, c[1] - k], [c[0] + R, c[1] + k]], [[c[0] + k, c[1] + R], [c[0] - k, c[1] + R]], [[c[0] - R, c[1] + k], [c[0] - R, c[1] - k]]];
  g.appendChild(mk("circle", { cx: c[0], cy: c[1], r: R, "stroke-dasharray": "2 5" }));
  P.forEach((p, i) => { const [h1, h2] = Hd[i]; g.appendChild(mk("line", { x1: h1[0], y1: h1[1], x2: h2[0], y2: h2[1] }));
    for (const h of [h1, h2]) g.appendChild(mk("circle", { cx: h[0], cy: h[1], r: 3.5, class: "dot" }));
    g.appendChild(mk("rect", { x: p[0] - 4, y: p[1] - 4, width: 8, height: 8, fill: "#05060a", stroke: "#c5d0ff" })); });
  const t1 = mk("text", { x: c[0], y: c[1] - R - 26, "text-anchor": "middle" }); t1.textContent = "Ø 9 PROJETS"; g.appendChild(t1);
  const t2 = mk("text", { x: c[0] + R + 30, y: c[1] + 4 }); t2.textContent = "2 ALTERNANCES"; g.appendChild(t2);
}

// ---------------- boucle ----------------
const camTop = new THREE.Vector3(0, 7.4, 0.0001), camSide = new THREE.Vector3(0, 1.25, 6.4), camMacro = new THREE.Vector3(0, 0.32, 2.35);
const camPos = new THREE.Vector3(), look = new THREE.Vector3(), lookMacro = new THREE.Vector3(0, 0, 1.0);
const ray = new THREE.Raycaster(), plane = new THREE.Plane(new THREE.Vector3(0, 0, 1), 0), hit = new THREE.Vector3(), ndc = new THREE.Vector2();
function slotWorld(slot) {  // centre d'un emplacement HTML -> point 3D sur le plan z = 0
  const r = slot.getBoundingClientRect();
  ndc.set((r.left + r.width / 2) / innerWidth * 2 - 1, -((r.top + r.height / 2) / innerHeight * 2 - 1));
  ray.setFromCamera(ndc, cam);
  return ray.ray.intersectPlane(plane, hit) ? hit : null;
}
function resize() { renderer.setSize(innerWidth, innerHeight, false); cam.aspect = innerWidth / innerHeight; cam.updateProjectionMatrix(); hud.setAttribute("viewBox", `0 0 ${innerWidth} ${innerHeight}`); measure(); buildKeys(); }
addEventListener("resize", resize); resize();
setTimeout(resize, 800); document.fonts?.ready.then(resize);
const clock = new THREE.Clock();
function frame() {
  const t = clock.getElapsedTime();
  sample(scrollY);
  // caméra : dessus → côté → macro
  camPos.lerpVectors(camSide, camTop, smooth(clamp(st.cam)));
  camPos.lerp(camMacro, smooth(clamp(st.close)));
  look.set(0, 0, 0).lerp(lookMacro, smooth(clamp(st.close)));
  cam.position.copy(camPos); cam.lookAt(look);
  mat.material.opacity = st.mat; mat.visible = st.mat > 0.01;
  shadow.material.opacity = st.mat * 0.9; shadow.visible = st.mat > 0.01;
  glow.material.opacity = st.glow * 0.45 * (1 - st.gray); glow.lookAt(cam.position);
  const free = 1 - st.mat;   // flottement et suivi de la souris seulement une fois le disque décollé
  // section IA : la main et le disque suivent le curseur (on « bouge la main »)
  follow.x += ((mx * 2.2) * st.hand - follow.x) * 0.06; follow.y += ((-my * 1.3) * st.hand - follow.y) * 0.06;
  pivot.position.set(st.px + follow.x, st.py + st.lift + follow.y + Math.sin(t * 1.2) * 0.03 * free, 0);
  pivot.scale.setScalar(st.scale);
  pivot.rotation.set(st.tilt + (st.flip + flipUser) * Math.PI + my * 0.14 * free, 0, mx * 0.12 * free);
  disc.group.rotation.y = st.spin + Math.sin(t * 0.5) * 0.1 * free;
  const thermal = st.thermal * (0.3 + temp * 0.7);
  for (const m of disc.mats) { m.uniforms.uOpacity.value = st.alpha; m.uniforms.uThermal.value = thermal; m.uniforms.uGray.value = st.gray; }
  for (const m of plainMats) m.opacity = m.userData.base * st.alpha;
  pivot.visible = st.alpha > 0.01;
  hand.root.visible = st.hand > 0.01;
  if (hand.root.visible) {
    // main venue d'en bas, derrière le disque : le disque repose sur le bout des doigts (comme chez oryzo)
    hand.root.scale.setScalar(0.8);
    hand.root.position.set(pivot.position.x - 0.04, pivot.position.y - 0.6 * st.scale / 0.6 - 1.42 - (1 - smooth(st.hand)) * 2.6, -0.3);
    hand.pose({ curl: 0.12 + Math.abs(mx) * 0.45, wave: 0.8, t, mx, my }); hand.setOpacity(smooth(st.hand));
    hand.mats.forEach(m => (m.uniforms.uTime.value = t));
  }
  // caméra thermique : le fond entier passe en fausses couleurs, centré sur le disque
  const th = $("#thermal"); th.style.opacity = (st.thermal * (0.55 + temp * 0.45)).toFixed(3);
  if (st.thermal > 0.01) { const c = toScreen(0, 0, 0, pivot); th.style.setProperty("--tx", c[0] + "px"); th.style.setProperty("--ty", c[1] + "px"); }
  card.visible = st.card > 0.01; card.position.y = 0.14 + st.card * 0.32; edgeMat.opacity = faceMat.opacity = st.card * st.alpha;
  disc.tick(t);
  // trois disques du comparatif, posés sur leurs emplacements HTML
  const slots = $$(".p-slot");
  stacks.forEach((s, i) => {
    s.g.visible = st.stacks > 0.01 && !!slots[i]; if (!s.g.visible) return;
    const w = slotWorld(slots[i]); if (w) s.g.position.copy(w);
    const k = smooth(clamp((progress("product") - 0.02 - i * 0.06) / 0.12)) * st.stacks;   // chaque pile tombe à son tour
    s.g.position.y += (1 - k) * 1.6; s.g.scale.setScalar(0.42 * Math.max(0.001, k)); s.g.rotation.set(0.5, 0, 0); s.d.group.rotation.y = t * 0.4 + i; s.d.tick(t);
    s.d.mats.forEach(m => (m.uniforms.uOpacity.value = k));
    s.d.parts.forEach((p, j) => (p.position.y = p.userData.baseY + (1 - smooth(clamp(k * 1.4 - j * 0.15))) * 0.6 * j));   // les couches se posent une à une
  });
  scene.updateMatrixWorld();
  renderer.render(scene, cam);
  drawHud(); applySteps(); domFrame();
  requestAnimationFrame(frame);
}
frame();

// accès de débogage (captures automatiques)
window.__neh = { hand, pivot, st, disc };
