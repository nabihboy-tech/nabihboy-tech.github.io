// Papier cadeau de la vignette vidéo : au clic, il se déchire depuis le centre en lambeaux qui se replient vers
// l'extérieur, puis la vidéo s'ouvre. Le clic d'origine (videoOverlay.initAndPlayVideo) est retenu pendant l'animation.
(() => {
  const WRAP = "#hero-video-wrapper";
  const OPEN_AT = 620;     // ms : moment où la vidéo s'ouvre
  const RESTORE_AT = 1600; // ms : le cadeau se referme (caché derrière la vidéo)
  let busy = false, letThrough = false;

  const rand = (a, b) => a + Math.random() * (b - a);

  // Point où un rayon partant de (cx, cy) avec l'angle a sort du rectangle w × h.
  function edgePoint(cx, cy, a, w, h) {
    const dx = Math.cos(a), dy = Math.sin(a);
    const tx = dx > 0 ? (w - cx) / dx : dx < 0 ? -cx / dx : Infinity;
    const ty = dy > 0 ? (h - cy) / dy : dy < 0 ? -cy / dy : Infinity;
    const t = Math.min(tx, ty);
    return [cx + dx * t, cy + dy * t];
  }

  // Ligne de déchirure en zigzag du centre vers le bord (partagée par les deux lambeaux voisins).
  function tearLine(cx, cy, a, w, h) {
    const [ex, ey] = edgePoint(cx, cy, a, w, h);
    const len = Math.hypot(ex - cx, ey - cy), nx = -Math.sin(a), ny = Math.cos(a);
    const steps = Math.max(5, Math.round(len / 9)), pts = [[cx, cy]];
    for (let i = 1; i < steps; i++) {
      const t = i / steps, j = rand(-1, 1) * Math.min(7, 2 + t * 9);
      pts.push([cx + (ex - cx) * t + nx * j, cy + (ey - cy) * t + ny * j]);
    }
    pts.push([ex, ey]);
    return pts;
  }

  const norm = (a) => ((a % (2 * Math.PI)) + 2 * Math.PI) % (2 * Math.PI);

  function tear(wrapper, done) {
    const gift = wrapper.querySelector(".nehGift");
    if (!gift || matchMedia("(prefers-reduced-motion: reduce)").matches) { busy = false; return done(); }
    const w = gift.offsetWidth, h = gift.offsetHeight;
    const cx = w * rand(0.46, 0.54), cy = h * rand(0.44, 0.56);
    const host = gift.parentNode, tag = wrapper.querySelector("#hero-video-play");

    // Rayons de déchirure, répartis autour du centre avec un peu d'irrégularité.
    const n = 7, start = rand(0, Math.PI * 2);
    const angles = Array.from({ length: n }, (_, i) => norm(start + (i + rand(-0.28, 0.28)) * (2 * Math.PI / n)));
    const lines = angles.map((a) => tearLine(cx, cy, a, w, h));
    const corners = [[0, 0], [w, 0], [w, h], [0, h]].map(([x, y]) => ({ x, y, a: norm(Math.atan2(y - cy, x - cx)) }));

    gift.style.animation = "none";
    gift.style.transition = "none";
    gift.style.transform = "none";
    const flaps = [];
    for (let i = 0; i < n; i++) {
      const a0 = angles[i], a1 = angles[(i + 1) % n], span = norm(a1 - a0);
      const between = corners.filter((c) => norm(c.a - a0) < span).sort((p, q) => norm(p.a - a0) - norm(q.a - a0));
      const poly = [...lines[i], ...between.map((c) => [c.x, c.y]), ...lines[(i + 1) % n].slice().reverse()];

      const outer = document.createElement("div");
      outer.className = "nehGift__flap";
      const inner = gift.cloneNode(true);
      inner.removeAttribute("style");
      inner.querySelector(".nehGift__shine")?.remove();
      const clip = "clip-path:polygon(" + poly.map(([x, y]) => `${x.toFixed(1)}px ${y.toFixed(1)}px`).join(",") + ")";
      inner.style.cssText = "animation:none;transform:none;transition:none;" + clip;
      // Envers blanc du papier, qui apparaît à mesure que le lambeau se replie.
      const back = document.createElement("span");
      back.className = "nehGift__flapBack";
      back.style.cssText = clip;
      outer.append(inner, back);
      host.appendChild(outer);

      // Le lambeau part dans la direction de sa bissectrice et se replie autour de son bord extérieur.
      const mid = a0 + span / 2, dx = Math.cos(mid), dy = Math.sin(mid);
      const [ox, oy] = edgePoint(cx, cy, mid, w, h);
      outer.style.transformOrigin = `${ox}px ${oy}px`;
      const fold = rand(95, 125), spin = rand(-12, 12), push = rand(26, 46), delay = rand(0, 70);
      const tf = (t, deg, s) => `perspective(520px) translate(${dx * t}px,${dy * t}px) rotate3d(${-dy},${dx},0,${-deg}deg) rotate(${s}deg)`;
      flaps.push(outer.animate([
        { transform: tf(0, 0, 0), opacity: 1, easing: "cubic-bezier(.2,.7,.3,1)" },
        { transform: tf(4, 6, spin * 0.15), opacity: 1, offset: 0.22, easing: "cubic-bezier(.4,0,.7,.7)" },
        { transform: tf(push * 0.6, fold * 0.7, spin * 0.6), opacity: 1, offset: 0.7 },
        { transform: tf(push, fold, spin), opacity: 0 },
      ], { duration: 900, delay, fill: "forwards" }));
      back.animate([{ opacity: 0 }, { opacity: 0, offset: 0.3 }, { opacity: 0.92, offset: 0.62 }, { opacity: 0.92 }],
        { duration: 900, delay, fill: "forwards" });
    }
    gift.style.opacity = "0"; // les lambeaux reproduisent exactement le cadeau : le relais est invisible
    tag?.animate([{ opacity: 1, transform: "rotate(0) scale(1.08)" }, { opacity: 0, transform: "rotate(6deg) scale(.7)" }],
      { duration: 260, fill: "forwards", easing: "ease-in" });

    setTimeout(done, OPEN_AT);
    setTimeout(() => {
      flaps.forEach((f) => f.effect.target.remove());
      tag?.getAnimations().forEach((an) => an.cancel());
      gift.style.cssText = "opacity:0;animation:none";
      requestAnimationFrame(() => {
        gift.style.transition = "opacity .5s ease";
        gift.style.opacity = "1";
        setTimeout(() => { gift.removeAttribute("style"); busy = false; }, 550);
      });
    }, RESTORE_AT);
  }

  // Capture sur document : on passe avant l'écouteur de clic d'origine posé sur le wrapper.
  document.addEventListener("click", (e) => {
    const wrapper = e.target.closest?.(WRAP);
    if (!wrapper || letThrough) return;
    e.stopImmediatePropagation();
    e.preventDefault();
    if (busy) return;
    busy = true;
    tear(wrapper, () => {
      letThrough = true;
      wrapper.click();
      letThrough = false;
    });
  }, true);
})();
