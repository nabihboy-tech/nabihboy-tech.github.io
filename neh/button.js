// Bouton rond de l'accueil : le disque NEH-1 en verre (même matière que le N), qui mène vers /moi/.
// Le site change de page sans rechargement (Swup) : on (ré)initialise tout bouton qui n'a pas encore son rendu.
import * as THREE from "/neh/vendor/three.module.min.js";
import { buildDisc, loadEnv } from "/neh/glass.js";

async function init(btn) {
  btn.dataset.ready = "1";
  const canvas = btn.querySelector("canvas");
  let renderer;
  try { renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true }); } catch { btn.classList.add("nogl"); return; }
  renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  await document.fonts?.load("900 100px Archivo").catch(() => {});
  loadEnv(renderer);
  const scene = new THREE.Scene();
  const cam = new THREE.PerspectiveCamera(28, 1, 0.1, 50); cam.position.set(0, 0, 5.2);
  const disc = await buildDisc({ layers: 1, radius: 1, height: 0.26 });
  const pivot = new THREE.Group(); pivot.add(disc.group); scene.add(pivot);
  const size = () => { const r = canvas.getBoundingClientRect(); renderer.setSize(r.width, r.height, false); };
  size(); new ResizeObserver(size).observe(canvas);
  let hover = 0, target = 0, visible = true, spin = 0, last = performance.now();
  // clic : un disque sombre s'ouvre depuis le bouton et recouvre l'écran, puis /moi/ s'ouvre sur le même disque
  const link = btn.closest("a") || btn;   // le disque peut être dans un lien (bloc About) ou être lui-même le lien
  link.addEventListener("click", e => {
    if (e.metaKey || e.ctrlKey || e.shiftKey || matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    e.preventDefault(); e.stopPropagation();   // le site (Swup) ne doit pas intercepter ce lien
    const go = () => location.assign(link.href);
    try {
      const r = btn.getBoundingClientRect(), cx = r.left + r.width / 2, cy = r.top + r.height / 2;
      const veil = document.createElement("div");
      veil.style.cssText = `position:fixed;inset:0;z-index:99999;background:#05060a;pointer-events:all;clip-path:circle(0px at ${cx}px ${cy}px);transition:clip-path .7s cubic-bezier(.7,0,.2,1)`;
      document.body.appendChild(veil);
      requestAnimationFrame(() => requestAnimationFrame(() => (veil.style.clipPath = `circle(${Math.hypot(innerWidth, innerHeight)}px at ${cx}px ${cy}px)`)));
      setTimeout(go, 720);
    } catch { go(); }   // si l'animation échoue, on navigue quand même
  });
  addEventListener("pageshow", ev => { if (ev.persisted) document.querySelectorAll("body > div[style*='clip-path']").forEach(v => v.remove()); });
  link.addEventListener("pointerenter", () => (target = 1));
  link.addEventListener("pointerleave", () => (target = 0));
  new IntersectionObserver(e => (visible = e[0].isIntersecting)).observe(btn);
  (function loop(now) {
    if (!btn.isConnected) { renderer.dispose(); return; }   // la page a changé : on libère le contexte WebGL
    requestAnimationFrame(loop);
    if (!visible) return;
    const dt = Math.min(0.05, (now - last) / 1000); last = now;
    hover += (target - hover) * 0.08;
    spin += dt * (0.5 + hover * 2.5);
    // de face (N lisible) qui oscille doucement ; au survol il se redresse et tourne plus vite
    pivot.rotation.set(Math.PI / 2 - 0.35 + hover * 0.35 + Math.sin(now / 1400) * 0.08, 0, Math.sin(now / 1900) * 0.06);
    disc.group.rotation.y = Math.sin(spin * 0.6) * 0.5 * (1 - hover) + hover * spin;
    disc.tick(now / 1000);
    renderer.render(scene, cam);
  })(last);
}

const scan = () => document.querySelectorAll(".nehBtn:not([data-ready])").forEach(init);
scan();
new MutationObserver(scan).observe(document.body, { childList: true, subtree: true });
