// YACHT OPS - original browser FFA shooter. Sunset superyacht arena vs bots.
import * as THREE from 'three';

// ============ config ============
const CFG = {
  killTarget: 30,
  matchTime: 300,
  magSize: 30,
  reserve: 240,
  rpm: 720,
  dmg: 34,
  headMult: 1.6,
  reloadTime: 1.55,
  walk: 4.7, sprint: 7.4, crouchSpd: 2.5,
  jumpV: 5.0, grav: 14.5,
  eye: 1.62, eyeCrouch: 1.02,
  fov: 75, fovAds: 52,
  botHp: 100, playerHp: 100,
  botNames: ['VIPER','ROGUE','CORSAIR','MARINER','DEADEYE','ADMIRAL'],
};
const IS_TOUCH = ('ontouchstart' in window) || navigator.maxTouchPoints > 0 || location.hash.includes('touch');

// ============ renderer / scene ============
const canvas = document.getElementById('game');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
renderer.setPixelRatio(Math.min(devicePixelRatio, IS_TOUCH ? 1.8 : 2));
renderer.setSize(innerWidth, innerHeight);
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.05;

const scene = new THREE.Scene();
scene.fog = new THREE.FogExp2(0x8f5a6e, 0.0045);
const camera = new THREE.PerspectiveCamera(CFG.fov, innerWidth / innerHeight, 0.05, 900);
camera.rotation.order = 'YXZ';

const hemi = new THREE.HemisphereLight(0xffc9b0, 0x504550, 0.95);
scene.add(new THREE.AmbientLight(0x6a5560, 0.55));
scene.add(hemi);
const sun = new THREE.DirectionalLight(0xffb37a, 1.9);
sun.position.set(-60, 26, 18);
scene.add(sun);
const fill = new THREE.DirectionalLight(0x7a8fd0, 0.35);
fill.position.set(40, 30, -30);
scene.add(fill);

// ============ sky ============
{
  const skyGeo = new THREE.SphereGeometry(760, 32, 20);
  const skyMat = new THREE.ShaderMaterial({
    side: THREE.BackSide, depthWrite: false, fog: false,
    uniforms: { t: { value: 0 } },
    vertexShader: `varying vec3 vP; void main(){ vP=position; gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0); }`,
    fragmentShader: `
      varying vec3 vP; uniform float t;
      float hash(vec2 p){ return fract(sin(dot(p, vec2(127.1,311.7)))*43758.5453); }
      float noise(vec2 p){ vec2 i=floor(p),f=fract(p); f=f*f*(3.-2.*f);
        return mix(mix(hash(i),hash(i+vec2(1,0)),f.x),mix(hash(i+vec2(0,1)),hash(i+vec2(1,1)),f.x),f.y); }
      void main(){
        vec3 d = normalize(vP);
        float h = clamp(d.y, -0.08, 1.0);
        vec3 horizon = vec3(1.00, 0.62, 0.45);
        vec3 mid     = vec3(0.83, 0.45, 0.55);
        vec3 zenith  = vec3(0.21, 0.27, 0.48);
        vec3 col = mix(horizon, mid, smoothstep(0.0, 0.22, h));
        col = mix(col, zenith, smoothstep(0.18, 0.62, h));
        vec3 sunDir = normalize(vec3(-0.92, 0.16, 0.28));
        float s = max(dot(d, sunDir), 0.0);
        col += vec3(1.0, 0.72, 0.42) * pow(s, 220.0) * 2.4;
        col += vec3(1.0, 0.60, 0.38) * pow(s, 9.0) * 0.42;
        float cl = noise(d.xz / max(d.y + 0.24, 0.05) * 1.4 + vec2(t*0.004, 0.0));
        cl = smoothstep(0.55, 0.9, cl) * smoothstep(0.5, 0.12, h) * step(0.015, h);
        col = mix(col, vec3(1.0, 0.78, 0.68), cl * 0.5);
        gl_FragColor = vec4(col, 1.0);
      }`,
  });
  scene.add(new THREE.Mesh(skyGeo, skyMat));
}

// ============ ocean ============
let oceanMat;
{
  const geo = new THREE.PlaneGeometry(1400, 1400, 90, 90);
  geo.rotateX(-Math.PI / 2);
  oceanMat = new THREE.ShaderMaterial({
    fog: false,
    uniforms: { t: { value: 0 }, sunDir: { value: new THREE.Vector3(-0.92, 0.16, 0.28).normalize() } },
    vertexShader: `
      uniform float t; varying vec3 vW; varying float vH;
      void main(){
        vec3 p = position;
        float w = sin(p.x*0.14 + t*1.1)*0.5 + sin(p.z*0.19 + t*0.9)*0.42 + sin((p.x+p.z)*0.06 + t*0.55)*0.8;
        p.y += w * 0.55;
        vH = w; vW = (modelMatrix * vec4(p,1.0)).xyz;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(p,1.0);
      }`,
    fragmentShader: `
      uniform float t; uniform vec3 sunDir; varying vec3 vW; varying float vH;
      void main(){
        vec3 V = normalize(cameraPosition - vW);
        vec3 deep = vec3(0.05, 0.10, 0.16);
        vec3 warm = vec3(0.85, 0.42, 0.38);
        float fres = pow(1.0 - max(V.y, 0.0), 2.2);
        vec3 col = mix(deep, warm, fres * 0.75);
        vec3 N = normalize(vec3(sin(vW.x*0.5+t)*0.08, 1.0, sin(vW.z*0.45+t*0.8)*0.08));
        vec3 R = reflect(-sunDir, N);
        col += vec3(1.0,0.7,0.45) * pow(max(dot(R, V),0.0), 60.0) * 1.4;
        col += vec3(0.9) * smoothstep(1.0, 1.35, vH) * 0.08;
        float dist = length(cameraPosition.xz - vW.xz);
        col = mix(col, vec3(0.56,0.35,0.43), smoothstep(120.0, 620.0, dist));
        gl_FragColor = vec4(col, 1.0);
      }`,
  });
  const ocean = new THREE.Mesh(geo, oceanMat);
  ocean.position.y = -4.2;
  scene.add(ocean);
}

// ============ procedural textures ============
function canvasTex(w, h, draw, repeat) {
  const c = document.createElement('canvas'); c.width = w; c.height = h;
  draw(c.getContext('2d'), w, h);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  if (repeat) { t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(repeat[0], repeat[1]); }
  t.anisotropy = 4;
  return t;
}
const deckTex = canvasTex(512, 512, (g, w, h) => {
  g.fillStyle = '#4a3a2c'; g.fillRect(0, 0, w, h);
  const rows = 8;
  for (let r = 0; r < rows; r++) {
    for (let x = 0; x < w; x += 128) {
      const off = (r % 2) * 64;
      const shade = 58 + Math.floor(Math.random() * 26);
      g.fillStyle = `rgb(${shade + 14},${shade - 4},${shade - 22})`;
      g.fillRect(x + off - 64, r * (h / rows) + 2, 124, h / rows - 4);
    }
  }
  g.strokeStyle = 'rgba(20,12,8,.8)'; g.lineWidth = 2;
  for (let r = 0; r <= rows; r++) { g.beginPath(); g.moveTo(0, r * h / rows); g.lineTo(w, r * h / rows); g.stroke(); }
}, [10, 4]);

const camoTex = canvasTex(512, 512, (g, w, h) => {
  g.fillStyle = '#dcdad5'; g.fillRect(0, 0, w, h);
  g.strokeStyle = 'rgba(60,60,66,.75)'; g.fillStyle = 'rgba(70,70,78,.7)';
  for (let i = 0; i < 260; i++) {
    const x = Math.random() * w, y = Math.random() * h, s = 3 + Math.random() * 7;
    g.save(); g.translate(x, y); g.rotate(Math.random() * Math.PI);
    if (i % 3 === 0) { g.beginPath(); g.arc(0, 0, s * 0.5, 0, Math.PI * 2); g.stroke(); }
    else if (i % 3 === 1) { g.strokeRect(-s / 2, -s / 4, s, s / 2); }
    else { g.font = `${s}px Arial`; g.fillText('YO', -s / 2, s / 3); }
    g.restore();
  }
  g.fillStyle = 'rgba(120,118,112,.25)';
  for (let i = 0; i < 40; i++) { g.beginPath(); g.arc(Math.random() * w, Math.random() * h, 2 + Math.random() * 8, 0, 7); g.fill(); }
}, [1, 1]);

const hullTex = canvasTex(512, 256, (g, w, h) => {
  g.fillStyle = '#f2f0ec'; g.fillRect(0, 0, w, h);
  g.fillStyle = '#22262e'; g.fillRect(0, h * 0.42, w, h * 0.16);
  g.fillStyle = 'rgba(0,0,0,.06)'; g.fillRect(0, 0, w, 8);
}, [3, 1]);

// ============ materials ============
const M = {
  hull: new THREE.MeshLambertMaterial({ color: 0xf4f2ee }),
  hullStripe: new THREE.MeshLambertMaterial({ map: hullTex }),
  deck: new THREE.MeshLambertMaterial({ map: deckTex }),
  dark: new THREE.MeshLambertMaterial({ color: 0x23262c }),
  glass: new THREE.MeshLambertMaterial({ color: 0x10151d }),
  trim: new THREE.MeshLambertMaterial({ color: 0x9aa2ac }),
  rail: new THREE.MeshLambertMaterial({ color: 0xd9dde2 }),
  accent: new THREE.MeshLambertMaterial({ color: 0x35e0b8, emissive: 0x0f6a52 }),
  wood2: new THREE.MeshLambertMaterial({ color: 0x6b5138 }),
  white: new THREE.MeshLambertMaterial({ color: 0xf7f5f1 }),
  cushion: new THREE.MeshLambertMaterial({ color: 0xd8d3c8 }),
  yellow: new THREE.MeshLambertMaterial({ color: 0xe8c93a }),
  plant: new THREE.MeshLambertMaterial({ color: 0x2f6b3a }),
  pot: new THREE.MeshLambertMaterial({ color: 0x30343a }),
  invisible: new THREE.MeshBasicMaterial({ visible: false }),
};

// ============ collision registry ============
const colliderMeshes = [];   // meshes shots + movement raycast against
const wallAABBs = [];        // {x0,x1,z0,z1,y0,y1} movement blockers
function addColliderMesh(mesh) { colliderMeshes.push(mesh); scene.add(mesh); return mesh; }
function box(w, h, d, mat, x, y, z, opts = {}) {
  const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
  m.position.set(x, y + h / 2, z);
  if (opts.ry) m.rotation.y = opts.ry;
  (opts.parent || scene).add(m);
  if (opts.solid !== false) {
    colliderMeshes.push(m);
    wallAABBs.push({ x0: x - w / 2, x1: x + w / 2, z0: z - d / 2, z1: z + d / 2, y0: y, y1: y + h });
  }
  return m;
}
function wall(x0, x1, z0, z1, y0, y1) { // invisible movement+shot blocker
  wallAABBs.push({ x0, x1, z0, z1, y0, y1 });
  const m = new THREE.Mesh(new THREE.BoxGeometry(x1 - x0, y1 - y0, z1 - z0), M.invisible);
  m.position.set((x0 + x1) / 2, (y0 + y1) / 2, (z0 + z1) / 2);
  colliderMeshes.push(m); scene.add(m);
  return m;
}

// ============ yacht geometry ============
const animated = []; // objects with .tick(t,dt)
function floorBox(w, h, d, mat, x, yTop, z, parent) {
  const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
  m.position.set(x, yTop - h / 2, z);
  (parent || scene).add(m); colliderMeshes.push(m);
  return m;
}

// hull + decks
floorBox(70, 4.2, 24, M.hull, 0, 0, 0);                    // main hull body
floorBox(68, 0.18, 22, M.deck, 0, 0.02, 0);                // wood deck surface
{ // bow wedge
  const bow = new THREE.Mesh(new THREE.CylinderGeometry(12, 12, 4.2, 3, 1), M.hull);
  bow.rotation.y = Math.PI; bow.rotation.x = 0; bow.scale.set(1.4, 1, 1);
  bow.position.set(-44.5, -2.1, 0); bow.rotation.z = 0; bow.rotation.y = Math.PI / 2;
  scene.add(bow); colliderMeshes.push(bow);
  const bowDeck = new THREE.Mesh(new THREE.CylinderGeometry(11, 11, 0.18, 3, 1), M.deck);
  bowDeck.scale.set(1.4, 1, 1); bowDeck.rotation.y = Math.PI / 2;
  bowDeck.position.set(-44.5, -0.08, 0); scene.add(bowDeck); colliderMeshes.push(bowDeck);
}
// bow walkable extension walls handled by perimeter walls below
wall(-35.2, -34.2, -11.4, 11.4, 0, 5); // fore limit (before bow point)
wall(34.2, 35.2, -11.4, 11.4, 0, 5);   // aft limit
wall(-35, 35, 10.9, 11.5, 0, 5);       // port rail line
wall(-35, 35, -11.5, -10.9, 0, 5);     // starboard rail line

// railings (visual)
function railing(x0, z0, x1, z1, y) {
  const dx = x1 - x0, dz = z1 - z0, len = Math.hypot(dx, dz);
  const rail = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.035, len, 6), M.rail);
  rail.position.set((x0 + x1) / 2, y + 1.05, (z0 + z1) / 2);
  rail.rotation.z = Math.PI / 2; rail.rotation.y = Math.atan2(dz, dx) * -1;
  rail.rotation.order = 'YXZ'; scene.add(rail);
  const n = Math.max(2, Math.round(len / 2.4));
  for (let i = 0; i <= n; i++) {
    const p = new THREE.Mesh(new THREE.CylinderGeometry(0.028, 0.028, 1.05, 5), M.rail);
    p.position.set(x0 + dx * i / n, y + 0.52, z0 + dz * i / n);
    scene.add(p);
  }
}
railing(-34, 11, 34, 11, 0); railing(-34, -11, 34, -11, 0);
railing(-34, -11, -34, 11, 0); railing(34, -11, 34, 11, 0);

// ---- cabin (ground floor interior D) ----
const CAB = { x0: -6, x1: 10, z0: -5.5, z1: 5.5, h: 3.2 };
// fore wall (x = -6) with door z[-1.5,1.5]
box(0.3, 3.2, 4, M.hull, CAB.x0, 0, -3.5); box(0.3, 3.2, 4, M.hull, CAB.x0, 0, 3.5);
box(0.3, 1.0, 3.0, M.hull, CAB.x0, 2.2, 0); // lintel
// aft wall (x = 10) same
box(0.3, 3.2, 4, M.hull, CAB.x1, 0, -3.5); box(0.3, 3.2, 4, M.hull, CAB.x1, 0, 3.5);
box(0.3, 1.0, 3.0, M.hull, CAB.x1, 2.2, 0);
// side walls with window bands
box(16, 3.2, 0.3, M.hullStripe, 2, 0, CAB.z1);
box(16, 3.2, 0.3, M.hullStripe, 2, 0, CAB.z0);
// interior furniture
box(3.4, 0.75, 1.2, M.cushion, -2, 0, -4.3);            // sofa
box(1.6, 0.95, 1.0, M.wood2, 2.5, 0, 0);                // table
box(3.0, 1.1, 0.9, M.wood2, 6.5, 0, -4.4);              // counter
box(1.2, 2.0, 1.2, M.dark, 8.5, 0, 4.2);                // cabinet
box(0.9, 0.5, 2.6, M.cushion, 0, 0, 4.5);               // bench
// interior rug (visual)
floorBox(6, 0.03, 4, new THREE.MeshLambertMaterial({ color: 0x7a2e35 }), 2, 0.05, 0);

// ---- upper deck (F) floor slab = cabin roof, walkable top y=3.5 ----
floorBox(16.9, 0.35, 16, M.hull, 2, 3.5, 0);              // x[-6.45,10.45] z[-8,8]
floorBox(15.5, 0.06, 14.6, M.deck, 2, 3.56, 0);           // upper deck wood
// upper deck clutter
box(2.0, 1.0, 1.2, M.dark, -4.5, 3.56, 0);                // helm console
box(0.85, 0.85, 0.85, M.wood2, 5.5, 3.56, 5);             // crate
box(0.85, 0.85, 0.85, M.wood2, 6.4, 3.56, 5.6);
box(0.85, 0.85, 0.85, M.wood2, 5.9, 4.41, 5.3);
box(1.1, 0.6, 2.4, M.cushion, -2, 3.56, -6);              // lounger
// mast with rotating radar
{
  const mast = new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.2, 5.2, 8), M.trim);
  mast.position.set(2, 3.5 + 2.6, 0); scene.add(mast); colliderMeshes.push(mast);
  wallAABBs.push({ x0: 1.7, x1: 2.3, z0: -0.3, z1: 0.3, y0: 3.5, y1: 8.7 });
  const bar = new THREE.Mesh(new THREE.BoxGeometry(2.6, 0.12, 0.3), M.rail);
  bar.position.set(2, 8.3, 0); scene.add(bar);
  const dome = new THREE.Mesh(new THREE.SphereGeometry(0.45, 12, 8), M.white);
  dome.position.set(2, 7.2, 0); scene.add(dome);
  animated.push({ tick(t) { bar.rotation.y = t * 1.4; } });
  const nav1 = new THREE.Mesh(new THREE.SphereGeometry(0.07, 6, 6), new THREE.MeshBasicMaterial({ color: 0xff4040 }));
  nav1.position.set(2, 8.9, 0); scene.add(nav1);
}

// ---- stairs (E deck -> upper deck), region x[10,20] z[-1.5,1.5] ----
for (let k = 0; k < 10; k++) {
  floorBox(1.02, 0.35 * (k + 1), 3.0, M.hull, 19.5 - k, 0.35 * (k + 1), 0);
}
wall(14.8, 17.8, -1.5, 1.5, 0, 0.75); // under-stair low blocker (side approach)
// stair stringers
box(10.4, 0.18, 0.12, M.trim, 15, 1.9, -1.56, { solid: false, ry: 0 });
box(10.4, 0.18, 0.12, M.trim, 15, 1.9, 1.56, { solid: false });

// ---- aft lounge (covered seating on E) ----
floorBox(13, 0.25, 15, M.hull, 19.5, 3.7, 0);             // lounge roof y3.7
for (const [px, pz] of [[13.6, -6.6], [13.6, 6.6], [25.4, -6.6], [25.4, 6.6]]) {
  box(0.28, 3.7, 0.28, M.trim, px, 0, pz);                // pillars
}
box(4.2, 0.78, 1.3, M.cushion, 16.5, 0, -5.2);            // sofas
box(4.2, 0.78, 1.3, M.cushion, 16.5, 0, 5.2);
box(1.3, 0.78, 3.6, M.cushion, 22.5, 0, -5.0);
box(1.5, 0.55, 1.5, M.wood2, 16.5, 0, 0, { solid: true });// coffee table -> moved aside:
box(2.6, 1.1, 1.2, M.wood2, 24.5, 0, 5.2);                // bar counter
box(0.9, 0.9, 0.9, M.yellow, 24.2, 0, -5.0);              // storage box
// aft open deck props
box(1.2, 1.3, 1.2, M.dark, 30, 0, -7.5);
box(1.6, 0.9, 0.8, M.trim, 28.5, 0, 7.8);

// ---- foredeck props ----
{ // jacuzzi
  const tub = new THREE.Mesh(new THREE.CylinderGeometry(2.4, 2.5, 0.95, 20), M.white);
  tub.position.set(-26, 0.475, 0); scene.add(tub); colliderMeshes.push(tub);
  wallAABBs.push({ x0: -28.4, x1: -23.6, z0: -2.4, z1: 2.4, y0: 0, y1: 0.95 });
  const water = new THREE.Mesh(new THREE.CircleGeometry(2.15, 20),
    new THREE.MeshLambertMaterial({ color: 0x3ec8d8, emissive: 0x0a3a44 }));
  water.rotation.x = -Math.PI / 2; water.position.set(-26, 0.82, 0); scene.add(water);
  animated.push({ tick(t) { water.position.y = 0.82 + Math.sin(t * 2.2) * 0.015; } });
}
for (const [px, pz] of [[-16, 8], [-16, -8], [12.6, 8.6], [12.6, -8.6]]) { // planters
  box(1.3, 1.05, 1.3, M.pot, px, 0, pz);
  const pl = new THREE.Mesh(new THREE.ConeGeometry(0.9, 2.0, 7), M.plant);
  pl.position.set(px, 1.9, pz); scene.add(pl);
  const pl2 = new THREE.Mesh(new THREE.ConeGeometry(0.6, 1.4, 7), M.plant);
  pl2.position.set(px, 2.6, pz); scene.add(pl2);
}
for (const [px, pz] of [[-20, 4.5], [-20, -4.5]]) { // sunpads (walk-over)
  floorBox(2.0, 0.32, 4.2, M.cushion, px, 0.32, pz);
}
// walkway vents / cover
box(1.4, 1.25, 1.0, M.trim, -10, 0, 8.4);
box(1.4, 1.25, 1.0, M.trim, 4, 0, -8.4);
box(1.0, 1.0, 1.0, M.wood2, -2, 0, -8.6);
// life rings on cabin walls
for (const zz of [5.72, -5.72]) {
  const ring = new THREE.Mesh(new THREE.TorusGeometry(0.4, 0.1, 8, 18), new THREE.MeshLambertMaterial({ color: 0xe86a3a }));
  ring.position.set(2, 1.8, zz); scene.add(ring);
}
// hull stripe accents + name board
floorBox(30, 0.5, 0.06, M.dark, 0, 2.6, 11.02);
floorBox(30, 0.5, 0.06, M.dark, 0, 2.6, -11.02);
{ // glowing name board aft
  const board = new THREE.Mesh(new THREE.BoxGeometry(6, 0.9, 0.12),
    new THREE.MeshLambertMaterial({ color: 0x0c2a24, emissive: 0x0f8a6a }));
  board.position.set(0, 2.6, -11.1); scene.add(board);
  const tex = canvasTex(512, 80, (g, w, h) => {
    g.fillStyle = '#08110e'; g.fillRect(0, 0, w, h);
    g.font = 'bold 52px Arial'; g.textAlign = 'center'; g.fillStyle = '#5ff2c8';
    g.fillText('YACHT OPS', w / 2, 58);
  });
  const sign = new THREE.Mesh(new THREE.PlaneGeometry(5.6, 0.8),
    new THREE.MeshBasicMaterial({ map: tex, transparent: true }));
  sign.position.set(0, 2.6, -11.18); sign.rotation.y = Math.PI; scene.add(sign);
}

// ============ walkable zones + nav ============
const ZONES = {
  A: { x0: -33, x1: -14, z0: -10, z1: 10, y: 0 },
  G: { x0: -14, x1: -6.4, z0: -5, z1: 5, y: 0 },
  B: { x0: -14, x1: 12, z0: 6, z1: 10, y: 0 },
  C: { x0: -14, x1: 12, z0: -10, z1: -6, y: 0 },
  D: { x0: -5.6, x1: 9.6, z0: -5, z1: 5, y: 0 },
  E: { x0: 12, x1: 33, z0: -10, z1: 10, y: 0 },
  F: { x0: -5.5, x1: 9.5, z0: -7.5, z1: 7.5, y: 3.5 },
};
const ADJ = { A: ['G', 'B', 'C'], G: ['A', 'B', 'C', 'D'], B: ['A', 'G', 'E'], C: ['A', 'G', 'E'], D: ['G', 'E'], E: ['B', 'C', 'D', 'F'], F: ['E'] };
const PORTALS = {
  'A-G': [-14, 0, 0], 'A-B': [-14, 0, 8], 'A-C': [-14, 0, -8],
  'G-B': [-10, 0, 5.5], 'G-C': [-10, 0, -5.5], 'G-D': [-6, 0, 0],
  'B-E': [12, 0, 8], 'C-E': [12, 0, -8], 'D-E': [11, 0, 0],
};
function portalPoints(from, to) {
  if ((from === 'E' && to === 'F') || (from === 'F' && to === 'E')) {
    return from === 'E' ? [[19.5, 0, 0], [11, 3.5, 0]] : [[11, 3.5, 0], [19.5, 0, 0]];
  }
  const k1 = `${from}-${to}`, k2 = `${to}-${from}`;
  const p = PORTALS[k1] || PORTALS[k2];
  return p ? [p] : [];
}
function zoneAt(x, z, y) {
  for (const [id, zr] of Object.entries(ZONES)) {
    if (x >= zr.x0 && x <= zr.x1 && z >= zr.z0 && z <= zr.z1 && Math.abs(y - zr.y) < 1.6) return id;
  }
  return null;
}
function groundAt(x, z, y) {
  let best = -Infinity;
  const consider = (h) => { if (h <= y + 0.55 && h > best) best = h; };
  if (x >= -34 && x <= 34 && z >= -11 && z <= 11) consider(0);
  if (x >= -6.45 && x <= 10.45 && z >= -8 && z <= 8) consider(3.56);
  if (x >= 10 && x <= 20 && z >= -1.5 && z <= 1.5) consider(((20 - x) / 10) * 3.56);
  return best === -Infinity ? y : best;
}
const SPAWNS = [
  [-30, 0, 6], [-30, 0, -6], [-24, 0, 7], [-18, 0, -7], [-10, 0, 8], [-10, 0, -8],
  [2, 0, 8], [4, 0, -8], [2, 0, 2], [16, 0, 7], [16, 0, -7], [28, 0, 5], [30, 0, -6],
  [-3, 3.56, 5], [7, 3.56, -5], [7, 3.56, 6],
];

// ============ audio (procedural WebAudio) ============
const AU = { ctx: null, master: null };
function audioInit() {
  if (AU.ctx) return;
  AU.ctx = new (window.AudioContext || window.webkitAudioContext)();
  AU.master = AU.ctx.createGain(); AU.master.gain.value = 0.55;
  AU.master.connect(AU.ctx.destination);
  // ocean ambience: filtered noise, slow swell
  const len = 4 * AU.ctx.sampleRate;
  const buf = AU.ctx.createBuffer(1, len, AU.ctx.sampleRate);
  const d = buf.getChannelData(0);
  let last = 0;
  for (let i = 0; i < len; i++) { const w = Math.random() * 2 - 1; last = (last + 0.02 * w) / 1.02; d[i] = last * 3.2; }
  const src = AU.ctx.createBufferSource(); src.buffer = buf; src.loop = true;
  const lp = AU.ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 420;
  const g = AU.ctx.createGain(); g.gain.value = 0.12;
  const lfo = AU.ctx.createOscillator(); lfo.frequency.value = 0.14;
  const lfoG = AU.ctx.createGain(); lfoG.gain.value = 0.05;
  lfo.connect(lfoG); lfoG.connect(g.gain);
  src.connect(lp); lp.connect(g); g.connect(AU.master);
  src.start(); lfo.start();
}
function noiseBurst(dur, vol, freq, type = 'lowpass') {
  if (!AU.ctx) return;
  const n = Math.floor(dur * AU.ctx.sampleRate);
  const buf = AU.ctx.createBuffer(1, n, AU.ctx.sampleRate);
  const d = buf.getChannelData(0);
  for (let i = 0; i < n; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / n, 2.2);
  const s = AU.ctx.createBufferSource(); s.buffer = buf;
  const f = AU.ctx.createBiquadFilter(); f.type = type; f.frequency.value = freq;
  const g = AU.ctx.createGain(); g.gain.value = vol;
  s.connect(f); f.connect(g); g.connect(AU.master); s.start();
}
function blip(freq, dur, vol, type = 'square') {
  if (!AU.ctx) return;
  const o = AU.ctx.createOscillator(); o.type = type; o.frequency.value = freq;
  const g = AU.ctx.createGain();
  g.gain.setValueAtTime(vol, AU.ctx.currentTime);
  g.gain.exponentialRampToValueAtTime(0.001, AU.ctx.currentTime + dur);
  o.connect(g); g.connect(AU.master); o.start(); o.stop(AU.ctx.currentTime + dur);
}
const sfx = {
  shot: () => { noiseBurst(0.14, 0.5, 2600); noiseBurst(0.3, 0.25, 300); },
  botShot: (dist) => { const v = Math.max(0.04, 0.3 - dist * 0.006); noiseBurst(0.12, v, 900); },
  hit: () => blip(1900, 0.05, 0.2),
  kill: () => { blip(1300, 0.07, 0.25); setTimeout(() => blip(1950, 0.09, 0.25), 70); },
  hurt: () => noiseBurst(0.18, 0.3, 500),
  reload: () => { blip(700, 0.05, 0.18); setTimeout(() => blip(500, 0.05, 0.18), 350); setTimeout(() => blip(900, 0.06, 0.2), 1100); },
  empty: () => blip(1100, 0.04, 0.12),
  respawn: () => blip(880, 0.15, 0.2, 'sine'),
  step: () => noiseBurst(0.05, 0.05, 900),
};

// ============ input ============
const input = {
  fwd: 0, strafe: 0, sprint: false, jump: false, crouch: false,
  fire: false, ads: false, reload: false, lookDX: 0, lookDY: 0,
};
const keys = {};
addEventListener('keydown', (e) => {
  keys[e.code] = true;
  if (e.code === 'KeyR') input.reload = true;
  if (e.code === 'Space') { input.jump = true; e.preventDefault(); }
});
addEventListener('keyup', (e) => { keys[e.code] = false; });
addEventListener('mousemove', (e) => {
  if (document.pointerLockElement === canvas) {
    const s = input.ads ? 0.0011 : 0.0021;
    input.lookDX += e.movementX * s; input.lookDY += e.movementY * s;
  }
});
addEventListener('mousedown', (e) => {
  if (document.pointerLockElement === canvas) {
    if (e.button === 0) input.fire = true;
    if (e.button === 2) input.ads = true;
  }
});
addEventListener('mouseup', (e) => {
  if (e.button === 0) input.fire = false;
  if (e.button === 2) input.ads = false;
});
addEventListener('contextmenu', (e) => e.preventDefault());

// ---- touch controls ----
const touch = { joyId: null, joyOX: 0, joyOY: 0, lookId: null, lookLX: 0, lookLY: 0, fireId: null, fireLX: 0, fireLY: 0 };
if (IS_TOUCH) document.body.classList.add('touchmode');
const $ = (id) => document.getElementById(id);
function bindHold(id, on, off) {
  const el = $(id);
  el.addEventListener('touchstart', (e) => { e.preventDefault(); e.stopPropagation(); el.classList.add('held'); on(e.changedTouches[0]); }, { passive: false });
  const end = (e) => { e.preventDefault(); el.classList.remove('held'); off && off(); };
  el.addEventListener('touchend', end, { passive: false });
  el.addEventListener('touchcancel', end, { passive: false });
}
if (IS_TOUCH) {
  const jz = $('joy-zone'), jb = $('joy-base'), js = $('joy-stick'), jl = $('joy-label');
  jz.addEventListener('touchstart', (e) => {
    e.preventDefault();
    const t = e.changedTouches[0];
    if (touch.joyId !== null) return;
    touch.joyId = t.identifier; touch.joyOX = t.clientX; touch.joyOY = t.clientY;
    jb.style.display = 'block'; jb.style.left = t.clientX + 'px'; jb.style.top = t.clientY + 'px';
    js.style.left = '50%'; js.style.top = '50%';
  }, { passive: false });
  jz.addEventListener('touchmove', (e) => {
    e.preventDefault();
    for (const t of e.changedTouches) {
      if (t.identifier !== touch.joyId) continue;
      let dx = t.clientX - touch.joyOX, dy = t.clientY - touch.joyOY;
      const len = Math.hypot(dx, dy), max = 65;
      if (len > max) { dx *= max / len; dy *= max / len; }
      js.style.left = `calc(50% + ${dx}px)`; js.style.top = `calc(50% + ${dy}px)`;
      input.fwd = -dy / max; input.strafe = dx / max;
      const mag = Math.hypot(input.fwd, input.strafe);
      input.sprint = mag > 0.92;
      jl.textContent = input.sprint ? 'SPRINT' : 'MOVE';
    }
  }, { passive: false });
  const joyEnd = (e) => {
    for (const t of e.changedTouches) {
      if (t.identifier !== touch.joyId) continue;
      touch.joyId = null; input.fwd = 0; input.strafe = 0; input.sprint = false;
      jb.style.display = 'none'; jl.textContent = 'MOVE';
    }
  };
  jz.addEventListener('touchend', joyEnd); jz.addEventListener('touchcancel', joyEnd);

  bindHold('btn-fire', (t) => { input.fire = true; touch.fireId = t.identifier; touch.fireLX = t.clientX; touch.fireLY = t.clientY; },
    () => { input.fire = false; touch.fireId = null; });
  $('btn-fire').addEventListener('touchmove', (e) => { // drag fire to aim
    e.preventDefault();
    for (const t of e.changedTouches) {
      if (t.identifier !== touch.fireId) continue;
      input.lookDX += (t.clientX - touch.fireLX) * 0.004;
      input.lookDY += (t.clientY - touch.fireLY) * 0.004;
      touch.fireLX = t.clientX; touch.fireLY = t.clientY;
    }
  }, { passive: false });
  bindHold('btn-aim', () => { input.ads = !input.ads; });
  bindHold('btn-jump', () => { input.jump = true; });
  bindHold('btn-crouch', () => { input.crouch = !input.crouch; });
  bindHold('btn-reload', () => { input.reload = true; });
  // look = drag on empty right half
  canvas.addEventListener('touchstart', (e) => {
    for (const t of e.changedTouches) {
      if (t.clientX > innerWidth * 0.4 && touch.lookId === null) {
        touch.lookId = t.identifier; touch.lookLX = t.clientX; touch.lookLY = t.clientY;
      }
    }
  }, { passive: true });
  canvas.addEventListener('touchmove', (e) => {
    for (const t of e.changedTouches) {
      if (t.identifier !== touch.lookId) continue;
      const s = input.ads ? 0.0024 : 0.0046;
      input.lookDX += (t.clientX - touch.lookLX) * s;
      input.lookDY += (t.clientY - touch.lookLY) * s;
      touch.lookLX = t.clientX; touch.lookLY = t.clientY;
    }
  }, { passive: true });
  const lookEnd = (e) => { for (const t of e.changedTouches) if (t.identifier === touch.lookId) touch.lookId = null; };
  canvas.addEventListener('touchend', lookEnd); canvas.addEventListener('touchcancel', lookEnd);
}

// ============ player ============
const player = {
  pos: new THREE.Vector3(16, 0, 7),
  vel: new THREE.Vector3(),
  yaw: Math.PI * 0.5, pitch: 0,
  hp: CFG.playerHp, alive: true,
  mag: CFG.magSize, reserve: CFG.reserve,
  reloading: 0, lastDmg: -9, fireCd: 0, adsT: 0, crouchT: 0,
  kills: 0, deaths: 0, grounded: true, stepT: 0,
};
function collideXZ(pos, r) {
  for (const w of wallAABBs) {
    if (pos.y + 1.6 < w.y0 || pos.y + 0.25 > w.y1) continue;
    const cx = Math.max(w.x0, Math.min(pos.x, w.x1));
    const cz = Math.max(w.z0, Math.min(pos.z, w.z1));
    const dx = pos.x - cx, dz = pos.z - cz;
    const d2 = dx * dx + dz * dz;
    if (d2 < r * r) {
      if (d2 < 1e-8) { pos.x += r; continue; }
      const d = Math.sqrt(d2), push = (r - d) / d;
      pos.x += dx * push; pos.z += dz * push;
    }
  }
}
function updatePlayer(dt) {
  if (!player.alive) return;
  // look
  player.yaw -= input.lookDX; player.pitch -= input.lookDY;
  player.pitch = Math.max(-1.45, Math.min(1.45, player.pitch));
  input.lookDX = 0; input.lookDY = 0;
  // keyboard move
  if (!IS_TOUCH) {
    input.fwd = (keys.KeyW ? 1 : 0) - (keys.KeyS ? 1 : 0);
    input.strafe = (keys.KeyD ? 1 : 0) - (keys.KeyA ? 1 : 0);
    input.sprint = !!keys.ShiftLeft || !!keys.ShiftRight;
    input.crouch = !!keys.KeyC || !!keys.ControlLeft;
  }
  // ads / crouch smoothing
  player.adsT += ((input.ads && !player.reloading ? 1 : 0) - player.adsT) * Math.min(1, dt * 10);
  player.crouchT += ((input.crouch ? 1 : 0) - player.crouchT) * Math.min(1, dt * 8);
  // move
  const speed = player.crouchT > 0.5 ? CFG.crouchSpd : (input.sprint && input.fwd > 0.3 ? CFG.sprint : CFG.walk);
  const sin = Math.sin(player.yaw), cos = Math.cos(player.yaw);
  let mx = (-sin * input.fwd + cos * input.strafe);
  let mz = (-cos * input.fwd - sin * input.strafe);
  const ml = Math.hypot(mx, mz);
  if (ml > 1) { mx /= ml; mz /= ml; }
  const accel = player.grounded ? 22 : 6;
  player.vel.x += (mx * speed - player.vel.x) * Math.min(1, accel * dt);
  player.vel.z += (mz * speed - player.vel.z) * Math.min(1, accel * dt);
  // jump / gravity
  if (input.jump && player.grounded) { player.vel.y = CFG.jumpV; player.grounded = false; sfx.step(); }
  input.jump = false;
  player.vel.y -= CFG.grav * dt;
  player.pos.x += player.vel.x * dt;
  player.pos.z += player.vel.z * dt;
  collideXZ(player.pos, 0.42);
  player.pos.y += player.vel.y * dt;
  const g = groundAt(player.pos.x, player.pos.z, player.pos.y);
  if (player.pos.y <= g + 0.001 && player.vel.y <= 0) {
    player.pos.y = g; player.vel.y = 0; player.grounded = true;
  } else player.grounded = false;
  // footsteps
  if (player.grounded && ml > 0.2) {
    player.stepT -= dt * (input.sprint ? 1.6 : 1);
    if (player.stepT <= 0) { player.stepT = 0.38; sfx.step(); }
  }
  // camera
  const eyeH = CFG.eye + (CFG.eyeCrouch - CFG.eye) * player.crouchT;
  camera.position.set(player.pos.x, player.pos.y + eyeH, player.pos.z);
  camera.rotation.set(player.pitch, player.yaw, 0);
  const targetFov = CFG.fov + (CFG.fovAds - CFG.fov) * player.adsT;
  if (Math.abs(camera.fov - targetFov) > 0.1) { camera.fov = targetFov; camera.updateProjectionMatrix(); }
  // health regen
  if (timeNow - player.lastDmg > 4.5 && player.hp < CFG.playerHp) {
    player.hp = Math.min(CFG.playerHp, player.hp + 26 * dt);
  }
  // reload
  if (input.reload && player.mag < CFG.magSize && player.reserve > 0 && !player.reloading) {
    player.reloading = CFG.reloadTime; sfx.reload();
  }
  input.reload = false;
  if (player.reloading > 0) {
    player.reloading -= dt;
    if (player.reloading <= 0) {
      const need = CFG.magSize - player.mag, take = Math.min(need, player.reserve);
      player.mag += take; player.reserve -= take; player.reloading = 0;
    }
  }
  updateVignette(dt);
}

// ============ particles / tracers ============
const particles = [];
const partGeo = new THREE.BoxGeometry(0.045, 0.045, 0.045);
function spawnParticles(pos, color, n, spread, up) {
  for (let i = 0; i < n; i++) {
    let p = particles.find((q) => !q.alive);
    if (!p) {
      if (particles.length > 90) return;
      p = { mesh: new THREE.Mesh(partGeo, new THREE.MeshBasicMaterial({ color: 0xffffff })), vel: new THREE.Vector3(), life: 0, alive: false };
      scene.add(p.mesh); particles.push(p);
    }
    p.alive = true; p.life = 0.5 + Math.random() * 0.25;
    p.mesh.visible = true;
    p.mesh.material.color.setHex(color);
    p.mesh.position.copy(pos);
    p.vel.set((Math.random() - 0.5) * spread, Math.random() * up, (Math.random() - 0.5) * spread);
  }
}
function updateParticles(dt) {
  for (const p of particles) {
    if (!p.alive) continue;
    p.life -= dt;
    if (p.life <= 0) { p.alive = false; p.mesh.visible = false; continue; }
    p.vel.y -= 9 * dt;
    p.mesh.position.addScaledVector(p.vel, dt);
    p.mesh.scale.setScalar(Math.max(0.1, p.life * 1.6));
  }
}
const tracers = [];
function spawnTracer(from, to, color = 0xffd9a0) {
  let t = tracers.find((q) => !q.alive);
  if (!t) {
    if (tracers.length > 24) return;
    const g = new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(), new THREE.Vector3()]);
    t = { line: new THREE.Line(g, new THREE.LineBasicMaterial({ color, transparent: true, opacity: 0.9, blending: THREE.AdditiveBlending, depthWrite: false })), life: 0, alive: false };
    scene.add(t.line); tracers.push(t);
  }
  t.alive = true; t.life = 0.07; t.line.visible = true; t.line.material.opacity = 0.9;
  const a = t.line.geometry.attributes.position.array;
  a[0] = from.x; a[1] = from.y; a[2] = from.z; a[3] = to.x; a[4] = to.y; a[5] = to.z;
  t.line.geometry.attributes.position.needsUpdate = true;
}
function updateTracers(dt) {
  for (const t of tracers) {
    if (!t.alive) continue;
    t.life -= dt;
    if (t.life <= 0) { t.alive = false; t.line.visible = false; }
    else t.line.material.opacity = t.life / 0.07 * 0.9;
  }
}

// ============ weapon viewmodel ============
const camoMat = new THREE.MeshLambertMaterial({ map: camoTex });
const gunDark = new THREE.MeshLambertMaterial({ color: 0x2a2d33 });
const gun = new THREE.Group();
{
  const add = (w, h, d, mat, x, y, z) => {
    const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
    m.position.set(x, y, z); gun.add(m); return m;
  };
  add(0.09, 0.11, 0.52, camoMat, 0, 0, -0.05);            // receiver
  add(0.075, 0.075, 0.3, camoMat, 0, 0.01, -0.44);        // handguard
  add(0.035, 0.035, 0.22, gunDark, 0, 0.02, -0.68);       // barrel
  add(0.07, 0.1, 0.22, camoMat, 0, -0.01, 0.3);           // stock
  add(0.06, 0.16, 0.09, camoMat, 0, -0.12, -0.02);        // mag
  add(0.05, 0.1, 0.07, gunDark, 0, -0.1, 0.12);           // grip
  add(0.02, 0.045, 0.06, gunDark, 0, 0.085, -0.1);        // rear sight
  add(0.02, 0.05, 0.03, gunDark, 0, 0.08, -0.55);         // front sight
  add(0.09, 0.02, 0.3, gunDark, 0, 0.065, -0.44);         // top rail
}
const gunTip = new THREE.Object3D(); gunTip.position.set(0, 0.02, -0.8); gun.add(gunTip);
camera.add(gun); scene.add(camera); gun.scale.setScalar(0.62);
const GUN_HIP = new THREE.Vector3(0.23, -0.26, -0.44);
const GUN_ADS = new THREE.Vector3(0, -0.152, -0.34);
const flash = new THREE.Mesh(new THREE.PlaneGeometry(0.3, 0.3),
  new THREE.MeshBasicMaterial({ color: 0xffd9a0, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false }));
flash.position.set(0, 0.02, -0.85); gun.add(flash);
const flashLight = new THREE.PointLight(0xffc080, 0, 6);
scene.add(flashLight);
let gunKick = 0, swayX = 0, swayY = 0, bobT = 0;
function updateGun(dt) {
  const moving = Math.hypot(player.vel.x, player.vel.z);
  bobT += dt * (3 + moving * 1.1);
  gunKick = Math.max(0, gunKick - dt * 6);
  swayX += ((-input._lastLookDX || 0) * 0 - swayX) * dt * 6; // decay
  const bobX = Math.sin(bobT) * 0.008 * (moving > 0.5 ? 1 : 0.2);
  const bobY = Math.abs(Math.cos(bobT)) * 0.01 * (moving > 0.5 ? 1 : 0.15);
  gun.position.lerpVectors(GUN_HIP, GUN_ADS, player.adsT);
  gun.position.x += bobX; gun.position.y += bobY - gunKick * 0.02; gun.position.z += gunKick * 0.06;
  gun.rotation.set(gunKick * 0.16 + 0.03, -0.19, 0.06);
  if (player.reloading > 0) {
    const p = 1 - player.reloading / CFG.reloadTime;
    gun.rotation.x += Math.sin(p * Math.PI) * -0.7;
    gun.position.y -= Math.sin(p * Math.PI) * 0.12;
  }
  flash.material.opacity = Math.max(0, flash.material.opacity - dt * 14);
  flash.rotation.z = Math.random() * Math.PI;
  flashLight.intensity = Math.max(0, flashLight.intensity - dt * 60);
}
function muzzleWorld(out) { return gunTip.getWorldPosition(out); }

// ============ shooting ============
const raycaster = new THREE.Raycaster();
const _v1 = new THREE.Vector3(), _v2 = new THREE.Vector3(), _v3 = new THREE.Vector3();
let dmgFlash = 0;
function fireWeapon() {
  if (player.fireCd > 0 || player.reloading > 0 || !player.alive) return;
  if (player.mag <= 0) { sfx.empty(); input.reload = true; player.fireCd = 0.25; return; }
  player.fireCd = 60 / CFG.rpm;
  player.mag--;
  gunKick = 1; flash.material.opacity = 0.95;
  muzzleWorld(_v1); flashLight.position.copy(_v1); flashLight.intensity = 3.2;
  sfx.shot();
  // spread
  const spread = (input.ads ? 0.0035 : 0.017) + Math.hypot(player.vel.x, player.vel.z) * 0.0012;
  _v2.set((Math.random() - 0.5) * spread * 2, (Math.random() - 0.5) * spread * 2, -1).normalize();
  _v2.applyQuaternion(camera.quaternion);
  raycaster.set(camera.position, _v2);
  raycaster.far = 120;
  const targets = colliderMeshes.concat(bots.filter((b) => b.alive).map((b) => b.hitMesh));
  const hits = raycaster.intersectObjects(targets, false);
  let end = _v3.copy(camera.position).addScaledVector(_v2, 120).clone();
  if (hits.length) {
    const h = hits[0];
    end = h.point.clone();
    const bot = h.object.userData.bot;
    if (bot && bot.alive) {
      const head = h.point.y > bot.pos.y + 1.42;
      damageBot(bot, CFG.dmg * (head ? CFG.headMult : 1), 'YOU');
      spawnParticles(h.point, 0xc03028, 7, 2.4, 2.4);
      hitmark(bot.hp <= 0);
      sfx.hit();
    } else {
      spawnParticles(h.point, 0xffc060, 5, 3.2, 3.0);
      spawnParticles(h.point, 0x888888, 3, 1.4, 1.2);
    }
  }
  spawnTracer(_v1, end);
  player.pitch += 0.011 + Math.random() * 0.004;
  player.yaw += (Math.random() - 0.5) * 0.005;
}
function hitmark(kill) {
  const el = $('hitmarker');
  el.classList.remove('pop', 'kill'); void el.offsetWidth;
  if (kill) el.classList.add('kill');
  el.classList.add('pop');
}
function updateVignette(dt) {
  dmgFlash = Math.max(0, dmgFlash - dt * 1.4);
  const low = 1 - player.hp / CFG.playerHp;
  $('vignette').style.opacity = Math.min(1, low * 0.75 + dmgFlash * 0.6);
}

// ============ bots ============
const bots = [];
const BOT_COLORS = { body: 0x2b3038, vest: 0x1b1e24, head: 0x3a3f47, gun: 0x14161a };
function nametagSprite(name) {
  const c = document.createElement('canvas'); c.width = 256; c.height = 56;
  const g = c.getContext('2d');
  g.font = 'bold 34px Arial'; g.textAlign = 'center';
  g.shadowColor = 'rgba(0,0,0,.9)'; g.shadowBlur = 6;
  g.fillStyle = '#ff5b4d'; g.fillText(name, 128, 40);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace;
  const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: t, transparent: true, depthWrite: false }));
  s.scale.set(1.7, 0.37, 1);
  return s;
}
function buildBotMesh() {
  const g = new THREE.Group();
  const body = new THREE.MeshLambertMaterial({ color: BOT_COLORS.body });
  const vest = new THREE.MeshLambertMaterial({ color: BOT_COLORS.vest });
  const headM = new THREE.MeshLambertMaterial({ color: BOT_COLORS.head });
  const legL = new THREE.Mesh(new THREE.BoxGeometry(0.17, 0.8, 0.17), body); legL.position.set(-0.12, 0.4, 0);
  const legR = legL.clone(); legR.position.x = 0.12;
  const torso = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.62, 0.28), body); torso.position.y = 1.1;
  const vestM = new THREE.Mesh(new THREE.BoxGeometry(0.54, 0.42, 0.34), vest); vestM.position.y = 1.12;
  const head = new THREE.Mesh(new THREE.BoxGeometry(0.26, 0.28, 0.26), headM); head.position.y = 1.58;
  const visor = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.08, 0.02), new THREE.MeshBasicMaterial({ color: 0x57f2c8 }));
  visor.position.set(0, 1.6, -0.14);
  const armL = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.12, 0.5), body); armL.position.set(-0.2, 1.22, -0.3);
  const armR = armL.clone(); armR.position.set(0.18, 1.18, -0.24);
  const rifle = new THREE.Mesh(new THREE.BoxGeometry(0.07, 0.14, 0.85), new THREE.MeshLambertMaterial({ color: BOT_COLORS.gun }));
  rifle.position.set(0.02, 1.24, -0.5);
  g.add(legL, legR, torso, vestM, head, visor, armL, armR, rifle);
  g.userData.legs = [legL, legR];
  return g;
}
class Bot {
  constructor(name) {
    this.name = name;
    this.group = buildBotMesh();
    this.tag = nametagSprite(name); this.tag.position.y = 2.05; this.group.add(this.tag);
    this.hitMesh = new THREE.Mesh(new THREE.BoxGeometry(0.85, 1.8, 0.85), M.invisible);
    this.hitMesh.userData.bot = this;
    scene.add(this.group); scene.add(this.hitMesh);
    this.pos = new THREE.Vector3(); this.vel = new THREE.Vector3();
    this.yaw = 0; this.hp = CFG.botHp; this.alive = false;
    this.kills = 0; this.deaths = 0;
    this.wps = []; this.enemy = null; this.thinkT = Math.random();
    this.fireT = 0; this.burstLeft = 0; this.burstCd = 0;
    this.speed = 3.1 + Math.random() * 1.1;
    this.acc = 0.32 + Math.random() * 0.2;
    this.walkPhase = 0; this.respawnT = 0; this.lastShot = -9;
    this.strafeDir = 1; this.strafeT = 0; this.deadT = 0;
  }
  spawn(at) {
    this.pos.set(at[0], at[1], at[2]);
    this.hp = CFG.botHp; this.alive = true; this.wps = [];
    this.group.visible = true; this.hitMesh.visible = true;
    this.group.rotation.set(0, this.yaw, 0);
  }
  die(killer) {
    this.alive = false; this.deaths++; this.deadT = 0;
    this.hitMesh.visible = false;
    this.group.rotation.z = Math.PI / 2 * (Math.random() > 0.5 ? 1 : -1);
    spawnParticles(this.pos.clone().add(new THREE.Vector3(0, 1, 0)), 0xc03028, 12, 3, 3);
    this.respawnT = 3;
    if (killer === 'YOU') { player.kills++; sfx.kill(); }
    else { const k = bots.find((b) => b.name === killer); if (k) k.kills++; }
    addFeed(killer, this.name, killer === 'YOU' || false);
  }
  pickPath() {
    const cz = zoneAt(this.pos.x, this.pos.z, this.pos.y) || 'E';
    const keys = Object.keys(ZONES).filter((k) => k !== cz);
    const tz = keys[(Math.random() * keys.length) | 0];
    // BFS
    const prev = { [cz]: null }; const q = [cz];
    while (q.length) {
      const c = q.shift();
      if (c === tz) break;
      for (const n of ADJ[c]) if (!(n in prev)) { prev[n] = c; q.push(n); }
    }
    const path = []; let c = tz;
    while (c) { path.unshift(c); c = prev[c]; }
    const wps = [];
    for (let i = 0; i < path.length - 1; i++) wps.push(...portalPoints(path[i], path[i + 1]));
    const zr = ZONES[tz];
    wps.push([zr.x0 + 1 + Math.random() * (zr.x1 - zr.x0 - 2), zr.y, zr.z0 + 1 + Math.random() * (zr.z1 - zr.z0 - 2)]);
    this.wps = wps;
  }
  visibleEnemy() {
    const cands = [];
    if (player.alive) cands.push({ p: player.pos, kind: 'player', d: this.pos.distanceTo(player.pos) });
    for (const b of bots) {
      if (b === this || !b.alive) continue;
      cands.push({ p: b.pos, kind: 'bot', bot: b, d: this.pos.distanceTo(b.pos) });
    }
    cands.sort((a, b) => a.d - b.d);
    for (const c of cands) {
      if (c.d > 46) continue;
      _v1.set(this.pos.x, this.pos.y + 1.5, this.pos.z);
      _v2.set(c.p.x, c.p.y + 1.3, c.p.z).sub(_v1);
      const dist = _v2.length(); _v2.normalize();
      raycaster.set(_v1, _v2); raycaster.far = dist - 0.4;
      if (raycaster.intersectObjects(colliderMeshes, false).length === 0) return c;
    }
    return null;
  }
  update(dt) {
    if (!this.alive) {
      this.deadT += dt;
      if (this.deadT > 1.2) this.group.position.y = this.pos.y - (this.deadT - 1.2) * 0.8;
      this.respawnT -= dt;
      if (this.respawnT <= 0) { this.group.position.y = 0; this.spawn(pickSpawn(this)); }
      return;
    }
    this.thinkT -= dt;
    if (this.thinkT <= 0) { this.thinkT = 0.22 + Math.random() * 0.15; this.enemy = this.visibleEnemy(); }
    let mvx = 0, mvz = 0, moving = false;
    if (this.enemy) {
      const ep = this.enemy.p;
      const dx = ep.x - this.pos.x, dz = ep.z - this.pos.z;
      const wantYaw = Math.atan2(-dx, -dz);
      let dy = wantYaw - this.yaw;
      while (dy > Math.PI) dy -= Math.PI * 2; while (dy < -Math.PI) dy += Math.PI * 2;
      this.yaw += dy * Math.min(1, dt * 7);
      // strafe + range keeping
      this.strafeT -= dt;
      if (this.strafeT <= 0) { this.strafeT = 0.8 + Math.random() * 1.4; this.strafeDir = Math.random() > 0.5 ? 1 : -1; }
      const d = Math.hypot(dx, dz);
      const toward = d > 16 ? 1 : (d < 7 ? -1 : 0);
      const sin = Math.sin(this.yaw), cos = Math.cos(this.yaw);
      mvx = -sin * toward + cos * this.strafeDir * 0.8;
      mvz = -cos * toward - sin * this.strafeDir * 0.8;
      moving = true;
      // fire
      this.fireT -= dt; this.burstCd -= dt;
      if (this.burstLeft > 0 && this.fireT <= 0) {
        this.fireT = 60 / 480; this.burstLeft--;
        this.shootAt(this.enemy);
      } else if (this.burstLeft <= 0 && this.burstCd <= 0 && Math.abs(dy) < 0.3) {
        this.burstLeft = 2 + (Math.random() * 4 | 0);
        this.burstCd = 0.7 + Math.random() * 1.1;
      }
    } else {
      if (!this.wps.length) this.pickPath();
      const wp = this.wps[0];
      if (wp) {
        const dx = wp[0] - this.pos.x, dz = wp[2] - this.pos.z;
        const d = Math.hypot(dx, dz);
        if (d < 0.7) this.wps.shift();
        else {
          const wantYaw = Math.atan2(-dx, -dz);
          let dy = wantYaw - this.yaw;
          while (dy > Math.PI) dy -= Math.PI * 2; while (dy < -Math.PI) dy += Math.PI * 2;
          this.yaw += dy * Math.min(1, dt * 5);
          mvx = dx / d; mvz = dz / d; moving = true;
        }
      }
    }
    // move + collide
    this.vel.x += (mvx * this.speed - this.vel.x) * Math.min(1, 10 * dt);
    this.vel.z += (mvz * this.speed - this.vel.z) * Math.min(1, 10 * dt);
    this.pos.x += this.vel.x * dt; this.pos.z += this.vel.z * dt;
    collideXZ(this.pos, 0.42);
    this.pos.y = groundAt(this.pos.x, this.pos.z, this.pos.y);
    // visuals
    this.group.position.copy(this.pos);
    this.group.rotation.y = this.yaw;
    if (moving) this.walkPhase += dt * 9;
    const sw = Math.sin(this.walkPhase) * (moving ? 0.5 : 0);
    this.group.userData.legs[0].rotation.x = sw;
    this.group.userData.legs[1].rotation.x = -sw;
    this.hitMesh.position.set(this.pos.x, this.pos.y + 0.9, this.pos.z);
  }
  shootAt(enemy) {
    const from = new THREE.Vector3(this.pos.x, this.pos.y + 1.25, this.pos.z);
    const to = new THREE.Vector3(enemy.p.x, enemy.p.y + 1.2, enemy.p.z);
    const d = from.distanceTo(to);
    this.lastShot = timeNow;
    sfx.botShot(d);
    spawnParticles(from.clone().add(new THREE.Vector3(0, 0.05, 0)), 0xffd9a0, 2, 1, 0.6);
    const hit = Math.random() < this.acc * (enemy.kind === 'player' && player.crouchT > 0.5 ? 0.7 : 1);
    if (!hit) {
      to.x += (Math.random() - 0.5) * 2.2; to.y += (Math.random() - 0.5) * 1.4; to.z += (Math.random() - 0.5) * 2.2;
      spawnTracer(from, to, 0xffb070);
      return;
    }
    spawnTracer(from, to, 0xffb070);
    if (enemy.kind === 'player') damagePlayer(8 + Math.random() * 7, this.name);
    else {
      spawnParticles(to, 0xc03028, 4, 2, 2);
      damageBot(enemy.bot, 24 + Math.random() * 14, this.name);
    }
  }
}
function damageBot(bot, dmg, killer) {
  if (!bot.alive) return;
  bot.hp -= dmg;
  if (bot.hp <= 0) bot.die(killer);
  else if (killer === 'YOU') bot.enemy = { p: player.pos, kind: 'player', d: 0 };
}
function damagePlayer(dmg, fromName) {
  if (!player.alive) return;
  player.hp -= dmg; player.lastDmg = timeNow; dmgFlash = 1;
  sfx.hurt();
  if (player.hp <= 0) playerDie(fromName);
}
function pickSpawn(avoid) {
  let best = null, bestScore = -1;
  for (const s of SPAWNS) {
    let minD = 999;
    if (player.alive) minD = Math.min(minD, Math.hypot(player.pos.x - s[0], player.pos.z - s[2]));
    for (const b of bots) if (b.alive && b !== avoid) minD = Math.min(minD, Math.hypot(b.pos.x - s[0], b.pos.z - s[2]));
    const score = minD + Math.random() * 8;
    if (score > bestScore) { bestScore = score; best = s; }
  }
  return best;
}

// ============ HUD ============
let timeNow = 0;
let state = 'title';
let timeLeft = CFG.matchTime;
function addFeed(killer, victim) {
  const feed = $('killfeed');
  const div = document.createElement('div');
  div.className = 'kf' + (killer === 'YOU' ? ' me' : '') + (victim === 'YOU' ? ' dead me' : '');
  const k = document.createElement('span'); k.className = 'k'; k.textContent = killer;
  const a = document.createElement('span'); a.className = 'arr'; a.textContent = '›';
  const v = document.createElement('span'); v.className = 'v'; v.textContent = victim;
  div.append(k, a, v); feed.prepend(div);
  while (feed.children.length > 5) feed.lastChild.remove();
  setTimeout(() => { div.style.opacity = '0'; div.style.transition = 'opacity .4s'; setTimeout(() => div.remove(), 400); }, 4200);
}
function playerDie(fromName) {
  player.alive = false; player.deaths++;
  $('death-by').textContent = 'KILLED BY ' + fromName;
  $('screen-death').classList.add('on');
  setTimeout(() => {
    if (state !== 'playing') return;
    const s = pickSpawn(null);
    player.pos.set(s[0], s[1], s[2]);
    player.vel.set(0, 0, 0);
    player.hp = CFG.playerHp; player.alive = true;
    player.mag = CFG.magSize;
    player.yaw = Math.atan2(-(-s[0]), -(-s[2])); // face midship
    $('screen-death').classList.remove('on');
    sfx.respawn();
  }, 2400);
}
function standings() {
  const rows = [{ name: 'YOU', kills: player.kills, deaths: player.deaths, me: true }];
  for (const b of bots) rows.push({ name: b.name, kills: b.kills, deaths: b.deaths });
  rows.sort((a, b) => b.kills - a.kills);
  return rows;
}
function playerRank() {
  let r = 1;
  for (const b of bots) if (b.kills > player.kills) r++;
  return r;
}
function updateHUD() {
  $('ammo-line').innerHTML = `<span class="mag">${player.mag}</span><span class="sep">|</span><span class="res">${player.reserve}</span>`;
  $('ammo-line').classList.toggle('low', player.mag <= 6);
  $('sb-kills').textContent = `${player.kills} / ${CFG.killTarget}`;
  const t = Math.max(0, Math.ceil(timeLeft));
  $('sb-time').textContent = `${(t / 60) | 0}:${String(t % 60).padStart(2, '0')}`;
  $('sb-rank').textContent = '#' + playerRank();
  const lead = Math.max(player.kills, ...bots.map((b) => b.kills));
  $('score-fill').style.width = (lead / CFG.killTarget * 100) + '%';
}
// minimap
const mm = $('minimap').getContext('2d');
const MMS = 264 / 76; // world -38..38 -> px
function mx(x) { return (x + 38) * MMS; }
function mz(z) { return (z + 14) * MMS; }
function drawMinimap() {
  const g = mm;
  g.clearRect(0, 0, 264, 264);
  g.fillStyle = 'rgba(8,12,14,.78)'; g.fillRect(0, 0, 264, 264);
  g.strokeStyle = 'rgba(190,225,215,.55)'; g.lineWidth = 2;
  g.strokeRect(mx(-34), mz(-11), 68 * MMS, 22 * MMS);
  g.beginPath(); // bow wedge hint
  g.moveTo(mx(-34), mz(-11)); g.lineTo(mx(-40), mz(0)); g.lineTo(mx(-34), mz(11));
  g.stroke();
  g.strokeStyle = 'rgba(190,225,215,.35)';
  g.strokeRect(mx(-6), mz(-5.5), 16 * MMS, 11 * MMS);      // cabin
  g.strokeRect(mx(-6), mz(-8), 16.9 * MMS, 16 * MMS);      // upper deck footprint
  g.strokeRect(mx(13), mz(-7), 13 * MMS, 14 * MMS);        // lounge roof
  g.beginPath(); g.arc(mx(-26), mz(0), 2.4 * MMS, 0, 7); g.stroke(); // jacuzzi
  // enemies who fired recently
  for (const b of bots) {
    if (!b.alive || timeNow - b.lastShot > 2.5) continue;
    g.fillStyle = '#ff5b4d';
    g.beginPath(); g.arc(mx(b.pos.x), mz(b.pos.z), 4.5, 0, 7); g.fill();
  }
  // player arrow
  g.save();
  g.translate(mx(player.pos.x), mz(player.pos.z));
  g.rotate(-player.yaw);
  g.fillStyle = '#ffd94a';
  g.beginPath(); g.moveTo(0, -8); g.lineTo(5.5, 6); g.lineTo(0, 3); g.lineTo(-5.5, 6); g.closePath(); g.fill();
  g.restore();
}

// ============ match flow ============
const pauseBoard = document.createElement('div');
pauseBoard.id = 'pause-board';
$('screen-pause').insertBefore(pauseBoard, $('btn-resume'));
function renderBoard(el) {
  el.innerHTML = '';
  standings().forEach((r, i) => {
    const d = document.createElement('div');
    d.className = 'brow' + (r.me ? ' me' : '');
    d.innerHTML = `<span class="place">#${i + 1}</span><span class="nm">${r.name}</span><span>${r.kills} / ${r.deaths}</span>`;
    el.appendChild(d);
  });
}
function startMatch() {
  audioInit();
  if (AU.ctx && AU.ctx.state === 'suspended') AU.ctx.resume();
  state = 'playing';
  player.kills = 0; player.deaths = 0;
  player.hp = CFG.playerHp; player.alive = true;
  player.mag = CFG.magSize; player.reserve = CFG.reserve;
  const s = SPAWNS[11]; player.pos.set(s[0], s[1], s[2]); player.yaw = Math.PI / 2; player.pitch = 0;
  timeLeft = CFG.matchTime;
  $('killfeed').innerHTML = '';
  for (const b of bots) { b.kills = 0; b.deaths = 0; b.spawn(pickSpawn(b)); }
  $('screen-title').classList.remove('on');
  $('screen-end').classList.remove('on');
  $('hud').classList.add('on');
  if (IS_TOUCH) { $('touch').classList.add('on'); $('hint').textContent = 'SWIPE TO LOOK · DRAG FIRE TO AIM'; }
  else { $('hint').textContent = 'WASD MOVE · SHIFT SPRINT · RIGHT-CLICK AIM · R RELOAD'; canvas.requestPointerLock(); }
  $('hint').style.opacity = '0.55';
  setTimeout(() => { $('hint').style.transition = 'opacity 1.2s'; $('hint').style.opacity = '0'; }, 7000);
}
function endMatch(reason) {
  state = 'end';
  $('screen-death').classList.remove('on');
  const rank = playerRank();
  const win = rank === 1;
  $('end-title').textContent = win ? 'VICTORY' : 'DEFEAT';
  $('end-title').className = win ? 'win' : 'lose';
  renderBoard($('board'));
  $('screen-end').classList.add('on');
  $('touch').classList.remove('on');
  if (document.pointerLockElement) document.exitPointerLock();
  if (win) sfx.kill(); else sfx.hurt();
}
function pauseMatch() {
  if (state !== 'playing') return;
  state = 'paused';
  renderBoard(pauseBoard);
  $('screen-pause').classList.add('on');
  if (document.pointerLockElement) document.exitPointerLock();
}
function resumeMatch() {
  if (state !== 'paused') return;
  state = 'playing';
  $('screen-pause').classList.remove('on');
  if (!IS_TOUCH) canvas.requestPointerLock();
}
$('btn-play').addEventListener('click', startMatch);
$('btn-again').addEventListener('click', startMatch);
$('btn-resume').addEventListener('click', resumeMatch);
$('btn-pause').addEventListener('click', () => { state === 'paused' ? resumeMatch() : pauseMatch(); });
$('btn-score').addEventListener('click', pauseMatch);
document.addEventListener('pointerlockchange', () => {
  if (!IS_TOUCH && state === 'playing' && !document.pointerLockElement) pauseMatch();
});
$('controls-copy').innerHTML = IS_TOUCH
  ? 'LEFT THUMB — MOVE / PUSH FAR TO SPRINT<br>RIGHT SIDE — SWIPE TO LOOK<br>FIRE · AIM · JUMP · CROUCH · RELOAD ON SCREEN<br><br>ADD TO HOME SCREEN FOR FULLSCREEN APP MODE'
  : 'WASD — MOVE · MOUSE — LOOK · SHIFT — SPRINT<br>LEFT CLICK — FIRE · RIGHT CLICK — AIM · R — RELOAD<br>SPACE — JUMP · C — CROUCH · ESC — PAUSE';
// cosmetic ping
setInterval(() => { $('pingnum').textContent = (14 + (Math.random() * 14 | 0)) + ' ms'; }, 2000);

// ============ main loop ============
const clock = new THREE.Clock();
let frame = 0;
function loop() {
  requestAnimationFrame(loop);
  const dt = Math.min(clock.getDelta(), 0.05);
  timeNow += dt;
  const t = timeNow;
  // environment always animates
  oceanMat.uniforms.t.value = t;
  for (const a of animated) a.tick(t, dt);
  if (state === 'title' || state === 'end') {
    const ang = t * 0.08;
    camera.position.set(Math.cos(ang) * 46, 13 + Math.sin(t * 0.3) * 2, Math.sin(ang) * 46);
    camera.lookAt(0, 3, 0);
    for (const b of bots) b.update(dt);
  } else if (state === 'playing') {
    timeLeft -= dt;
    player.fireCd -= dt;
    if (input.fire) fireWeapon();
    updatePlayer(dt);
    for (const b of bots) b.update(dt);
    updateGun(dt);
    if (timeLeft <= 0) endMatch('time');
    else if (player.kills >= CFG.killTarget || bots.some((b) => b.kills >= CFG.killTarget)) endMatch('kills');
  } else if (state === 'paused') {
    // frozen world
  }
  updateParticles(dt);
  updateTracers(dt);
  if (state === 'playing' || state === 'paused') {
    if ((frame++ & 1) === 0) { updateHUD(); drawMinimap(); }
  }
  renderer.render(scene, camera);
}
addEventListener('resize', () => {
  camera.aspect = innerWidth / innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(innerWidth, innerHeight);
});
// boot
for (const n of CFG.botNames) bots.push(new Bot(n));
for (const b of bots) b.spawn(pickSpawn(b));
loop();
if ('serviceWorker' in navigator) navigator.serviceWorker.register('sw.js').catch(() => {});
// debug hooks (used for automated smoke tests)
window.__yacht = { player, bots, startMatch, camera };
if (location.hash.includes('auto')) setTimeout(() => {
  startMatch();
  const g = (k) => { const m = location.hash.match(new RegExp(k + '=(-?[\\d.]+)')); return m ? +m[1] : null; };
  const px = g('px'), pz = g('pz'), py = g('pyaw'), pp = g('ppitch');
  if (px !== null) player.pos.x = px;
  if (pz !== null) player.pos.z = pz;
  if (py !== null) player.yaw = py;
  if (pp !== null) player.pitch = pp;
  const w = g('warp');
  if (w) {
    for (let i = 0; i < w * 60 && state === 'playing'; i++) {
      timeLeft -= 1 / 60;
      for (const b of bots) b.update(1 / 60);
      if (timeLeft <= 0) { endMatch('time'); break; }
      if (bots.some((b) => b.kills >= CFG.killTarget)) { endMatch('kills'); break; }
    }
    updateHUD(); drawMinimap();
  }
}, 600);
