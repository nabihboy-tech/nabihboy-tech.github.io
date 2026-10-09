// Remplace le lecteur Vimeo d'oryzo par une balise <video> locale (showreel NEH-1), avec la même interface
// (play, pause, setVolume, getDuration, on("play"|"pause"|"ended"), …) pour que les animations d'origine restent intactes.
class NehPlayer {
  constructor(el, opts = {}) {
    if (typeof el === "string") el = document.getElementById(el);
    const v = document.createElement("video");
    v.playsInline = true; v.preload = "auto";
    v.setAttribute("playsinline", "");
    v.style.cssText = "width:100%;height:100%;display:block;object-fit:contain;background:#05060a";
    let src = opts.url;
    if (el.tagName === "IFRAME") {          // version mobile : l'iframe est remplacée par la vidéo, en lecture muette auto
      src = el.src; v.muted = true; v.autoplay = true; el.replaceWith(v);
    } else el.appendChild(v);
    this.element = v; this.v = v;
    if (src) v.src = src;
  }
  _ready() { return new Promise(r => (this.v.readyState >= 1 ? r() : this.v.addEventListener("loadedmetadata", () => r(), { once: true }))); }
  getVideoWidth() { return this._ready().then(() => this.v.videoWidth || 1280); }
  getVideoHeight() { return this._ready().then(() => this.v.videoHeight || 720); }
  getDuration() { return this._ready().then(() => this.v.duration || 0); }
  getCurrentTime() { return Promise.resolve(this.v.currentTime); }
  getPaused() { return Promise.resolve(this.v.paused); }
  on(ev, cb) { this.v.addEventListener(ev, () => cb({})); }
  off() {}
  ready() { return this._ready(); }
  play() { return this.v.play(); }
  pause() { this.v.pause(); return Promise.resolve(); }
  setVolume(x) { this.v.volume = x; this.v.muted = x === 0; return Promise.resolve(x); }
  setCurrentTime(t) { this.v.currentTime = t; return Promise.resolve(t); }
  loadVideo(url) {
    if (this.v.getAttribute("src") !== url) this.v.src = url;
    return this._ready();
  }
  destroy() { this.v.pause(); this.v.remove(); return Promise.resolve(); }
}
window.NehPlayer = NehPlayer;
