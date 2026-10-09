// Verre du "N" (même rendu que l'objet 3D du portfolio) : réfraction avec dispersion, surface givrée
// par un bruit, veines, scintillements et irisation en bordure. Partagé par le bouton de l'accueil et la page /moi/.
import * as THREE from "/neh/vendor/three.module.min.js";

// Reflet : la même "salle" que derrière le N du portfolio (dalles lumineuses sombres, NABIH en filigrane,
// halo bleu), rendue une fois dans une cubemap. Elle n'est jamais affichée, seulement vue à travers le verre.
let envCache = null;
export function loadEnv(renderer) {
  if (envCache) return envCache.texture;
  const rt = new THREE.WebGLCubeRenderTarget(256, { generateMipmaps: true, minFilter: THREE.LinearMipmapLinearFilter });
  envCache = { rt, texture: rt.texture, rendered: false };
  if (renderer) renderRoom(renderer);
  return rt.texture;
}
export function renderRoom(renderer) {
  if (!envCache || envCache.rendered) return;
  const room = new THREE.Scene();
  const cv = document.createElement("canvas"); cv.width = 2048; cv.height = 1024; const c = cv.getContext("2d");
  c.fillStyle = "#020203"; c.fillRect(0, 0, 2048, 1024);
  const s = 64;
  for (let y = 0; y < 1024; y += s) for (let x = 0; x < 2048; x += s) {
    const r = Math.random(); const v = r < 0.03 ? 120 + Math.random() * 80 : r < 0.2 ? 30 + Math.random() * 26 : 6 + Math.random() * 12;
    c.fillStyle = `rgb(${v * 0.75},${v * 0.8},${v + 12})`; c.fillRect(x + 2, y + 2, s - 4, s - 4);
  }
  c.globalCompositeOperation = "lighter"; c.fillStyle = "rgba(197,208,255,.10)"; c.font = "900 230px Archivo, Arial Black, sans-serif";
  for (let y = 260; y < 1024; y += 320) for (let x = -200 + (y / 320 % 2) * 400; x < 2048; x += 1150) c.fillText("NABIH", x, y);
  const tex = new THREE.CanvasTexture(cv); tex.colorSpace = THREE.SRGBColorSpace; tex.wrapS = tex.wrapT = THREE.RepeatWrapping; tex.repeat.set(3, 2);
  room.add(new THREE.Mesh(new THREE.CylinderGeometry(22, 22, 70, 72, 1, true), new THREE.MeshBasicMaterial({ map: tex, side: THREE.BackSide, color: 0x9aa0ff })));
  const gc = document.createElement("canvas"); gc.width = gc.height = 512; const g = gc.getContext("2d");
  const rg = g.createRadialGradient(256, 256, 0, 256, 256, 256); rg.addColorStop(0, "#fff"); rg.addColorStop(.35, "rgba(255,255,255,.35)"); rg.addColorStop(1, "rgba(255,255,255,0)");
  g.fillStyle = rg; g.fillRect(0, 0, 512, 512);
  for (const [z, col] of [[-10, 0x3a3cff], [10, 0x6a3cff]]) {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(26, 26), new THREE.MeshBasicMaterial({ map: new THREE.CanvasTexture(gc), color: col, transparent: true, opacity: 0.5, blending: THREE.AdditiveBlending, depthWrite: false }));
    m.position.z = z; m.lookAt(0, 0, 0); room.add(m);
  }
  // sol et plafond dallés + halo dessous : vu de dessus, le verre a aussi quelque chose à réfracter
  for (const [y, rx] of [[-30, -Math.PI / 2], [30, Math.PI / 2]]) {
    const t2 = tex.clone(); t2.needsUpdate = true; t2.repeat.set(2, 2);
    const cap = new THREE.Mesh(new THREE.CircleGeometry(22, 72), new THREE.MeshBasicMaterial({ map: t2, color: 0x7a80d0, side: THREE.DoubleSide }));
    cap.position.y = y; cap.rotation.x = rx; room.add(cap);
  }
  const under = new THREE.Mesh(new THREE.PlaneGeometry(30, 30), new THREE.MeshBasicMaterial({ map: new THREE.CanvasTexture(gc), color: 0x3a3cff, transparent: true, opacity: 0.22, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide }));
  under.position.y = -12; under.rotation.x = -Math.PI / 2; room.add(under);
  const cubeCam = new THREE.CubeCamera(0.1, 100, envCache.rt);
  cubeCam.update(renderer, room);
  envCache.rendered = true;
}

export function makeGlass({ tint = 0x8f95ff, rough = 0.1, noiseScale = 9, disp = 0.035, ior = 1.45, brightness = 1 } = {}) {
  return new THREE.ShaderMaterial({
    uniforms: {
      uEnv: { value: loadEnv() }, uIor: { value: ior }, uDisp: { value: disp }, uTime: { value: 0 },
      uTint: { value: new THREE.Color(tint) }, uRough: { value: rough }, uNScale: { value: noiseScale },
      uBright: { value: brightness }, uOpacity: { value: 1 }, uThermal: { value: 0 }, uGray: { value: 0 },
    },
    transparent: true,
    vertexShader: `varying vec3 vW;varying vec3 vN;varying vec3 vO;
      void main(){vO=position;vec4 w=modelMatrix*vec4(position,1.0);vW=w.xyz;vN=normalize(mat3(modelMatrix)*normal);gl_Position=projectionMatrix*viewMatrix*w;}`,
    fragmentShader: `uniform samplerCube uEnv;uniform float uIor;uniform float uDisp;uniform float uTime;uniform vec3 uTint;
      uniform float uRough;uniform float uNScale;uniform float uBright;uniform float uOpacity;uniform float uThermal;uniform float uGray;varying vec3 vW;
      vec3 thermal(float t){t=clamp(t,0.0,1.0);return clamp(vec3(1.6*t-0.1,1.8*t*t-0.35,0.9*sin(3.1416*t*1.4)+(t>0.85?(t-0.85)*6.0:0.0)),0.0,1.0);}varying vec3 vN;varying vec3 vO;
      float h3(vec3 p){return fract(sin(dot(p,vec3(127.1,311.7,74.7)))*43758.5453);}
      float n3(vec3 p){vec3 i=floor(p),f=fract(p);f=f*f*(3.0-2.0*f);
        return mix(mix(mix(h3(i),h3(i+vec3(1,0,0)),f.x),mix(h3(i+vec3(0,1,0)),h3(i+vec3(1,1,0)),f.x),f.y),
                   mix(mix(h3(i+vec3(0,0,1)),h3(i+vec3(1,0,1)),f.x),mix(h3(i+vec3(0,1,1)),h3(i+vec3(1,1,1)),f.x),f.y),f.z);}
      float fb(vec3 p){return n3(p)*0.6+n3(p*2.1+3.7)*0.28+n3(p*4.3+9.1)*0.12;}
      void main(){
        vec3 I=normalize(vW-cameraPosition);vec3 N=normalize(vN);if(!gl_FrontFacing)N=-N;
        vec3 q=vO*uNScale*0.18;float n0=fb(q);
        vec3 g=vec3(fb(q+vec3(0.04,0,0))-n0,fb(q+vec3(0,0.04,0))-n0,fb(q+vec3(0,0,0.04))-n0)/0.04;
        N=normalize(N+g*uRough*0.35);
        float vein=abs(fract(n0*3.0)-0.5);float rnd=h3(vec3(gl_FragCoord.xy,uTime));
        float e=1.0/uIor;vec3 rf=vec3(0.0);
        for(int i=0;i<4;i++){float k=float(i)/3.0-0.5;
          vec3 jit=(vec3(h3(vW*91.0+float(i)),h3(vW*57.0-float(i)),h3(vW*33.0+float(i)*2.0))-0.5)*uRough*0.5;
          rf.r+=textureCube(uEnv,refract(I,N,e-uDisp*(1.0+k))+jit).r;
          rf.g+=textureCube(uEnv,refract(I,N,e+k*uDisp*.3)+jit).g;
          rf.b+=textureCube(uEnv,refract(I,N,e+uDisp*(1.0+k))+jit).b;}
        rf/=4.0;
        vec3 rl=textureCube(uEnv,reflect(I,N)).rgb;float fr=0.05+0.95*pow(1.0-max(dot(-I,N),0.0),2.4);
        vec3 frost=vec3(dot(rf,vec3(0.333)))*1.35+0.3;rf=mix(rf,frost,uRough*0.7);
        vec3 col=mix(rf*mix(vec3(1.0),uTint,0.2)*1.3,rl*1.4,fr);
        col*=mix(1.0,0.2+0.8*smoothstep(0.0,0.06,vein),uRough*0.9);
        col+=step(0.985,rnd)*uRough*0.6;
        vec3 iri=0.5+0.5*cos(6.2831*(vec3(0.0,0.33,0.67)+dot(N,vec3(0.3,0.8,0.5))*1.6+uTime*0.05));col+=iri*fr*0.3;
        col*=uBright;
        float lum=dot(col,vec3(0.299,0.587,0.114));
        col=mix(col,thermal(lum*1.5+fr*0.6+0.12*sin(vO.x*6.0+uTime)),uThermal);   // mode thermique
        col=mix(col,vec3(lum)*vec3(1.02,1.0,0.98),uGray);                     // macro noir et blanc
        gl_FragColor=vec4(col,uOpacity);}`,
  });
}

// Disque NEH : galette de verre, bord moleté, N en relief sur le dessus (et en creux dessous).
// layers > 1 : le disque est fait de couches empilées que l'on peut écarter (vue éclatée).
export async function buildDisc({ layers = 1, radius = 1, height = 0.22, knurl = true } = {}) {
  const NPTS = await (await fetch("/neh/n_shape.json")).json();
  const group = new THREE.Group();
  const parts = [];
  const lh = height / layers;
  const tints = [0x8f95ff, 0xa9b4ff, 0x9aa3ff, 0xc5d0ff];
  for (let i = 0; i < layers; i++) {
    const layer = new THREE.Group();
    const geo = new THREE.CylinderGeometry(radius, radius, lh * 0.96, 128, 1);
    const mat = makeGlass({ tint: tints[i % tints.length], rough: 0.1 + i * 0.02, brightness: 1.5 });
    layer.add(new THREE.Mesh(geo, mat));
    // fin liseré lumineux en haut de chaque couche, pour lire la tranche
    const ring = new THREE.Mesh(new THREE.TorusGeometry(radius * 0.999, 0.0035, 6, 160),
      new THREE.MeshBasicMaterial({ color: 0xdfe4ff, transparent: true, opacity: 0.55 }));
    ring.rotation.x = Math.PI / 2; ring.position.y = lh * 0.48; layer.add(ring);
    layer.userData.baseY = -height / 2 + lh * (i + 0.5);
    layer.position.y = layer.userData.baseY;
    group.add(layer); parts.push(layer);
  }
  if (knurl) {  // bord moleté : petites perles de verre en haut et en bas
    const n = 180, bead = new THREE.SphereGeometry(0.016, 8, 6);
    const mat = makeGlass({ tint: 0xc5d0ff, rough: 0.05 });
    for (const [layer, y] of [[parts[parts.length - 1], lh * 0.45], [parts[0], -lh * 0.45]]) {
      const inst = new THREE.InstancedMesh(bead, mat, n); const m = new THREE.Matrix4();
      for (let k = 0; k < n; k++) { const a = k / n * Math.PI * 2; m.makeTranslation(Math.cos(a) * radius, y, Math.sin(a) * radius); inst.setMatrixAt(k, m); }
      layer.add(inst);
    }
  }
  // N en relief, dans le même verre (un peu plus clair) : dessus, et retourné dessous pour la face arrière
  const shape = new THREE.Shape(NPTS.map(([x, y]) => new THREE.Vector2(x * radius * 0.78, y * radius * 0.78)));
  const nGeo = new THREE.ExtrudeGeometry(shape, { depth: 0.045, bevelEnabled: true, bevelThickness: 0.012, bevelSize: 0.01, bevelSegments: 2 });
  const nMat = makeGlass({ tint: 0xdfe4ff, rough: 0.08, brightness: 1.9 });
  const top = new THREE.Mesh(nGeo, nMat); top.rotation.x = -Math.PI / 2; top.position.y = lh * 0.48;
  parts[parts.length - 1].add(top);
  const bottom = new THREE.Mesh(nGeo, nMat); bottom.rotation.x = Math.PI / 2; bottom.rotation.z = Math.PI; bottom.position.y = -lh * 0.48;
  parts[0].add(bottom);
  const groove = new THREE.Mesh(new THREE.TorusGeometry(radius * 0.9, 0.006, 6, 160),
    new THREE.MeshBasicMaterial({ color: 0xc5d0ff, transparent: true, opacity: 0.35 }));
  groove.rotation.x = Math.PI / 2; groove.position.y = lh * 0.49; parts[parts.length - 1].add(groove);
  const mats = [];
  group.traverse(o => { if (o.material?.uniforms?.uTime) mats.push(o.material); });
  return { group, parts, mats, tick: t => mats.forEach(m => (m.uniforms.uTime.value = t)) };
}
