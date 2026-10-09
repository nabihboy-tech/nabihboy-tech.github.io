// Main de verre (section « Propulsé par l'IA ») : même famille de verre que le N, mais givrée et rosée
// pour se distinguer du disque. Six doigts (« on a dit high five, elle a entendu six »), pilotée par la souris,
// avec un halo arc-en-ciel derrière elle.
import * as THREE from "/neh/vendor/three.module.min.js";
import { makeGlass } from "/neh/glass.js";

export function buildHand() {
  const glass = makeGlass({ tint: 0xffb3e6, rough: 0.32, noiseScale: 14, brightness: 1.55, disp: 0.05 });
  // irisation plus forte sur les bords que le disque : la main « brille » arc-en-ciel au contour
  glass.fragmentShader = glass.fragmentShader.replace("col+=iri*fr*0.3;", "col+=iri*fr*0.55;");
  const root = new THREE.Group();          // poignet
  const mats = [glass];
  const seg = (len, r) => { const g = new THREE.CapsuleGeometry(r, len, 6, 16); g.translate(0, len / 2 + r * 0.6, 0); return new THREE.Mesh(g, glass); };

  // paume : capsule aplatie
  const palm = new THREE.Mesh(new THREE.CapsuleGeometry(0.5, 0.42, 8, 24), glass);
  palm.scale.set(1.28, 1, 0.42); palm.position.y = 0.6; root.add(palm);
  const wrist = new THREE.Mesh(new THREE.CapsuleGeometry(0.34, 0.6, 6, 18), glass);
  wrist.scale.set(1, 1, 0.55); wrist.position.y = -0.15; root.add(wrist);

  // doigts : 5 longs + le pouce = 6 (exprès)
  const fingers = [];
  const spec = [  // x à la base, longueur des 3 phalanges, rayon, écart angulaire
    { x: -0.5, l: [0.34, 0.24, 0.2], r: 0.085, spread: 0.2 },
    { x: -0.3, l: [0.4, 0.28, 0.22], r: 0.09, spread: 0.1 },
    { x: -0.1, l: [0.44, 0.3, 0.23], r: 0.092, spread: 0.03 },
    { x: 0.1, l: [0.42, 0.29, 0.22], r: 0.09, spread: -0.04 },
    { x: 0.3, l: [0.38, 0.26, 0.21], r: 0.085, spread: -0.12 },
    { x: 0.48, l: [0.3, 0.22, 0.18], r: 0.078, spread: -0.24 },
  ];
  for (const f of spec) {
    const base = new THREE.Group(); base.position.set(f.x * 0.9, 1.02 - Math.abs(f.x) * 0.22, 0); base.rotation.z = f.spread; root.add(base);
    let parent = base; const joints = [];
    for (let i = 0; i < 3; i++) {
      const j = new THREE.Group(); if (i > 0) j.position.y = f.l[i - 1] + f.r * 0.9; parent.add(j);
      j.add(seg(f.l[i], f.r * (1 - i * 0.08))); joints.push(j); parent = j;
    }
    fingers.push({ joints, spread: f.spread });
  }
  // pouce, sur le côté, en avant de la paume (il tient le disque par-devant)
  const thumbBase = new THREE.Group(); thumbBase.position.set(-0.62, 0.35, 0.12); thumbBase.rotation.set(0.5, 0, 0.95); root.add(thumbBase);
  const thumb = []; let tp = thumbBase;
  for (let i = 0; i < 2; i++) { const j = new THREE.Group(); if (i) j.position.y = 0.34; tp.add(j); j.add(seg(0.3, 0.1)); thumb.push(j); tp = j; }

  // halo arc-en-ciel derrière la main (additif, flou, couleurs qui tournent)
  const halo = new THREE.Mesh(new THREE.PlaneGeometry(3.4, 4.2), new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
    uniforms: { uTime: { value: 0 }, uAmt: { value: 0 } },
    vertexShader: "varying vec2 vUv;void main(){vUv=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0);}",
    fragmentShader: `varying vec2 vUv;uniform float uTime;uniform float uAmt;
      void main(){vec2 p=(vUv-vec2(0.5,0.42))*vec2(1.0,0.8);float d=length(p);
        float ring=smoothstep(0.5,0.18,d)*smoothstep(0.02,0.2,d);
        float a=atan(p.y,p.x);vec3 c=0.55+0.45*cos(6.2831*(vec3(0.0,0.33,0.67)+a/6.2831+uTime*0.12));
        gl_FragColor=vec4(c*ring*uAmt*0.5,1.0);}`,
  }));
  halo.position.set(0, 0.9, -0.6); root.add(halo);

  // pose : curl 0 (main ouverte) → 1 (fermée) ; wave anime les doigts un par un
  function pose({ curl = 0.25, wave = 0, t = 0, mx = 0, my = 0 }) {
    fingers.forEach((f, i) => {
      const k = curl + Math.sin(t * 2.2 + i * 0.8) * 0.12 * wave + (my + 0.5) * 0.25;
      f.joints[0].rotation.x = -k * 0.9; f.joints[1].rotation.x = -k * 1.1; f.joints[2].rotation.x = -k * 0.8;
      f.joints[0].rotation.z = mx * 0.25 * (i - 2.5) * 0.15;
    });
    thumb[0].rotation.x = -0.3 - curl * 0.4; thumb[1].rotation.x = -0.4 - curl * 0.5;
    root.rotation.z = -mx * 0.35; root.rotation.x = my * 0.25;
    halo.material.uniforms.uTime.value = t;
  }
  return { root, pose, halo, mats, setOpacity: o => { glass.uniforms.uOpacity.value = o; halo.material.uniforms.uAmt.value = o; } };
}
