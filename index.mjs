import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { DRACOLoader } from 'three/addons/loaders/DRACOLoader.js';
import { KTX2Loader } from 'three/addons/loaders/KTX2Loader.js';
import { MeshoptDecoder } from 'three/addons/libs/meshopt_decoder.module.js';
import { OBJLoader } from 'three/addons/loaders/OBJLoader.js';
import { STLLoader } from 'three/addons/loaders/STLLoader.js';
import { FBXLoader } from 'three/addons/loaders/FBXLoader.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';

const qs = s => document.querySelector(s);
const qsa = s => [...document.querySelectorAll(s)];
const state = {
  models: [],
  nextId: 1,
  selectedId: null,
  projection: 'perspective',
  dragMode: 'off',
  dragging: false,
  dragMoved: false,
  pinchScaling: false,
  pinchDistance: 0,
  rotateStart: { x: 0, y: 0 },
  theme: 'light',
  showGrid: false,
  floorMode: 'white',
  floorPlaced: false,
  handleDragging: false,
  activeHandleAxis: '',
  handleStartX: 0,
  handleStartY: 0,
  handleStartRotationY: 0,
  handleStartRotationX: 0,
  handleStartRotationZ: 0,
  activeMoveAxis: '',
  handleStartPosition: { x:0, y:0, z:0 },
  boxOnly: false,
  pointLightOn: false,
  rimLightOn: true,
  pointLightIntensity: 2.4,
  rimLightIntensity: 0.82,
  metalReflectivity: 1.15,
  glassTransmission: 0.9,
  glassOpacity: 0.42,
  reflectionTick: 0
};
const DEFAULT_LIGHT = { angle:135, height:14, radius:12, intensity:3 };

const canvasWrap = qs('#canvasWrap');
const scene = new THREE.Scene();
const renderer = new THREE.WebGLRenderer({ antialias:true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio,2));
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 0.88;
const maxTextureAnisotropy = Math.min(8, renderer.capabilities.getMaxAnisotropy?.() || 1);
canvasWrap.appendChild(renderer.domElement);

const pmremGenerator = new THREE.PMREMGenerator(renderer);
const envRenderTarget = pmremGenerator.fromScene(new RoomEnvironment(renderer), 0.04);
scene.environment = null;
pmremGenerator.dispose();

const dracoLoader = new DRACOLoader();
dracoLoader.setDecoderPath('https://www.gstatic.com/draco/versioned/decoders/1.5.7/');
const ktx2Loader = new KTX2Loader();
ktx2Loader.setTranscoderPath('https://unpkg.com/three@0.160.0/examples/jsm/libs/basis/');
ktx2Loader.detectSupport(renderer);
const gltfLoader = new GLTFLoader();
gltfLoader.setDRACOLoader(dracoLoader);
gltfLoader.setKTX2Loader(ktx2Loader);
gltfLoader.setMeshoptDecoder(MeshoptDecoder);

const perspectiveCam = new THREE.PerspectiveCamera(50, 1, 0.1, 1000);
perspectiveCam.position.set(4,3,5);
const orthoCam = new THREE.OrthographicCamera(-5,5,5,-5,0.1,1000);
orthoCam.position.copy(perspectiveCam.position);
let camera = perspectiveCam;

let controls = new OrbitControls(camera, renderer.domElement);
function applyControls(){
  controls.enableDamping = true;
  controls.dampingFactor = 0.08;
  controls.screenSpacePanning = true;
  controls.minDistance = 0.5;
  controls.maxDistance = 150;
  controls.touches = { ONE: THREE.TOUCH.ROTATE, TWO: THREE.TOUCH.DOLLY_PAN };
}
applyControls();
controls.target.set(0,1,0);

const ambient = new THREE.AmbientLight(0xffffff, 0.0); scene.add(ambient);
const hemi = new THREE.HemisphereLight(0xffffff, 0x223344, 0.0); scene.add(hemi);
const dirLight = new THREE.DirectionalLight(0xffffff, DEFAULT_LIGHT.intensity);
dirLight.castShadow = true;
dirLight.shadow.mapSize.set(4096,4096);
dirLight.shadow.radius = 1.2;
dirLight.shadow.bias = -0.00004;
dirLight.shadow.normalBias = 0.0012;
dirLight.shadow.camera.near = 0.5;
dirLight.shadow.camera.far = 80;
dirLight.shadow.camera.left = -20;
dirLight.shadow.camera.right = 20;
dirLight.shadow.camera.top = 20;
dirLight.shadow.camera.bottom = -20;
scene.add(dirLight);
const rimLight = new THREE.DirectionalLight(0xe7f0ff, 0.82);
rimLight.castShadow = false;
scene.add(rimLight);
const pointLights = Array.from({ length: 9 }, () => {
  const light = new THREE.PointLight(0xffffff, 0, 7.2, 2.15);
  light.castShadow = false;
  light.visible = false;
  scene.add(light);
  return light;
});
const reflectionRenderTarget = new THREE.WebGLCubeRenderTarget(256, {
  type: THREE.HalfFloatType,
  generateMipmaps: true,
  minFilter: THREE.LinearMipmapLinearFilter
});
const reflectionCubeCamera = new THREE.CubeCamera(0.1, 120, reflectionRenderTarget);
scene.add(reflectionCubeCamera);

const whiteFloorMaterial = new THREE.MeshStandardMaterial({ color:0xffffff, roughness:0.94, metalness:0.02 });
const shadowFloorMaterial = new THREE.ShadowMaterial({ opacity:.3 });
const ground = new THREE.Mesh(new THREE.PlaneGeometry(200,200), whiteFloorMaterial);
ground.rotation.x = -Math.PI/2; ground.receiveShadow = false; ground.position.y = -0.002; scene.add(ground);
const shadowCatcher = new THREE.Mesh(new THREE.PlaneGeometry(200,200), shadowFloorMaterial);
shadowCatcher.rotation.x = -Math.PI/2; shadowCatcher.receiveShadow = true; shadowCatcher.position.y = 0.002; scene.add(shadowCatcher);
let grid = new THREE.GridHelper(80, 80, 0x788393, 0x909baa); grid.material.transparent = true; grid.material.opacity = .7; scene.add(grid);
const selectionColor = 0x46d7ff;
const handleColor = 0xff00ff;
const selectionBox = new THREE.BoxHelper(undefined, selectionColor); selectionBox.visible = false; scene.add(selectionBox);
const guideMaterial = new THREE.LineBasicMaterial({ color:selectionColor, transparent:true, opacity:.86, depthTest:true, depthWrite:false });
const guideGeometry = new THREE.BufferGeometry();
const selectionGuides = new THREE.LineSegments(guideGeometry, guideMaterial);
selectionGuides.visible = false;
selectionGuides.renderOrder = 11;
scene.add(selectionGuides);

function createRingHandle(axis){
  const pts = [];
  const segments = 96;
  for (let i = 0; i < segments; i++) {
    const a = (i / segments) * Math.PI * 2;
    pts.push(new THREE.Vector3(Math.cos(a), Math.sin(a), 0));
  }
  const geo = new THREE.BufferGeometry().setFromPoints(pts);
  const mat = new THREE.LineBasicMaterial({ color:getAxisColor(axis), transparent:true, opacity:.98, depthTest:false });
  const line = new THREE.LineLoop(geo, mat);
  line.userData.handleAxis = axis;
  line.renderOrder = 12;
  if (axis === 'y') line.rotation.x = Math.PI / 2;
  if (axis === 'x') line.rotation.y = Math.PI / 2;
  line.visible = false;
  scene.add(line);
  return line;
}

const rotateHandleY = createRingHandle('y');
const rotateHandleX = createRingHandle('x');
const rotateHandleZ = createRingHandle('z');

function createMoveGuide(axis){
  const pts = [new THREE.Vector3(0,0,0), new THREE.Vector3(1,0,0)];
  const geo = new THREE.BufferGeometry().setFromPoints(pts);
  const color = getAxisColor(axis);
  const mat = new THREE.LineBasicMaterial({ color, transparent:true, opacity:0.95, depthTest:false });
  const line = new THREE.Line(geo, mat);
  if (axis === 'y') line.rotation.z = Math.PI / 2;
  if (axis === 'z') line.rotation.y = -Math.PI / 2;
  line.userData.moveAxis = axis;
  line.renderOrder = 12;
  line.visible = false;
  scene.add(line);
  return line;
}

const moveGuideX = createMoveGuide('x');
const moveGuideY = createMoveGuide('y');
const moveGuideZ = createMoveGuide('z');

function updateSelectionGuides(box){
  const size = new THREE.Vector3(
    box.max.x - box.min.x,
    box.max.y - box.min.y,
    box.max.z - box.min.z
  );
  const inset = Math.max(Math.max(size.x, size.y, size.z) * 0.002, 0.0005);
  const minX = box.min.x + inset, maxX = box.max.x - inset;
  const minY = box.min.y + inset, maxY = box.max.y - inset;
  const minZ = box.min.z + inset, maxZ = box.max.z - inset;
  const cx = (minX + maxX) / 2;
  const cy = (minY + maxY) / 2;
  const cz = (minZ + maxZ) / 2;
  const pts = [];
  const pushLine = (ax, ay, az, bx, by, bz) => {
    pts.push(ax, ay, az, bx, by, bz);
  };

  pushLine(minX, minY, minZ, maxX, minY, minZ);
  pushLine(maxX, minY, minZ, maxX, minY, maxZ);
  pushLine(maxX, minY, maxZ, minX, minY, maxZ);
  pushLine(minX, minY, maxZ, minX, minY, minZ);

  pushLine(minX, maxY, minZ, maxX, maxY, minZ);
  pushLine(maxX, maxY, minZ, maxX, maxY, maxZ);
  pushLine(maxX, maxY, maxZ, minX, maxY, maxZ);
  pushLine(minX, maxY, maxZ, minX, maxY, minZ);

  pushLine(minX, minY, minZ, minX, maxY, minZ);
  pushLine(maxX, minY, minZ, maxX, maxY, minZ);
  pushLine(maxX, minY, maxZ, maxX, maxY, maxZ);
  pushLine(minX, minY, maxZ, minX, maxY, maxZ);

  pushLine(minX, cy, maxZ, maxX, cy, maxZ);
  pushLine(cx, minY, maxZ, cx, maxY, maxZ);
  pushLine(minX, cy, minZ, maxX, cy, minZ);
  pushLine(cx, minY, minZ, cx, maxY, minZ);

  pushLine(minX, cy, minZ, minX, cy, maxZ);
  pushLine(minX, minY, cz, minX, maxY, cz);
  pushLine(maxX, cy, minZ, maxX, cy, maxZ);
  pushLine(maxX, minY, cz, maxX, maxY, cz);

  pushLine(minX, maxY, cz, maxX, maxY, cz);
  pushLine(cx, maxY, minZ, cx, maxY, maxZ);
  pushLine(minX, minY, cz, maxX, minY, cz);
  pushLine(cx, minY, minZ, cx, minY, maxZ);

  selectionGuides.geometry.dispose();
  selectionGuides.geometry = new THREE.BufferGeometry();
  selectionGuides.geometry.setAttribute('position', new THREE.BufferAttribute(new Float32Array(pts), 3));
}

function updateSelectionVisuals(){
  const m = getModel();
  const showBox = !!(m && m.visible && state.boxOnly);
  const showHandles = !!(m && m.visible && state.dragMode !== 'off' && !state.boxOnly);
  selectionBox.visible = false;
  selectionGuides.visible = showBox;
  rotateHandleY.visible = showHandles;
  rotateHandleX.visible = showHandles;
  rotateHandleZ.visible = showHandles;
  moveGuideX.visible = showHandles;
  moveGuideY.visible = showHandles;
  moveGuideZ.visible = showHandles;
  if (!showBox && !showHandles) return;
  const box = new THREE.Box3().setFromObject(m.object);
  if (box.isEmpty()) {
    selectionBox.visible = false;
    selectionGuides.visible = false;
    rotateHandleY.visible = false;
    rotateHandleX.visible = false;
    rotateHandleZ.visible = false;
    moveGuideX.visible = false;
    moveGuideY.visible = false;
    moveGuideZ.visible = false;
    return;
  }
  const size = new THREE.Vector3();
  const center = new THREE.Vector3();
  box.getSize(size);
  box.getCenter(center);
  const radius = Math.max(size.x, size.y, size.z, 0.9) * 0.62;
  if (showBox) updateSelectionGuides(box);
  rotateHandleY.scale.setScalar(radius);
  rotateHandleX.scale.setScalar(radius);
  rotateHandleZ.scale.setScalar(radius);
  rotateHandleY.position.copy(center);
  rotateHandleX.position.copy(center);
  rotateHandleZ.position.copy(center);
  const guideLen = Math.max(size.x, size.y, size.z, 1) * 0.72;
  moveGuideX.scale.setScalar(guideLen);
  moveGuideY.scale.setScalar(guideLen);
  moveGuideZ.scale.setScalar(guideLen);
  moveGuideX.position.copy(center);
  moveGuideY.position.copy(center);
  moveGuideZ.position.copy(center);
}

function updateRotateHandle(){
  updateSelectionVisuals();
}

function updateLightFromOrbit(angleDeg = DEFAULT_LIGHT.angle, height = DEFAULT_LIGHT.height, radius = DEFAULT_LIGHT.radius){
  const rad = THREE.MathUtils.degToRad(angleDeg);
  dirLight.position.set(Math.cos(rad) * radius, height, Math.sin(rad) * radius);
  const rimRadius = radius * 0.9;
  rimLight.position.set(-Math.cos(rad) * rimRadius, Math.max(height * 0.42, 0.8), -Math.sin(rad) * rimRadius);
}

updateLightFromOrbit(DEFAULT_LIGHT.angle, DEFAULT_LIGHT.height, DEFAULT_LIGHT.radius);

const raycaster = new THREE.Raycaster();
raycaster.params.Line.threshold = 0.18;
const pointer = new THREE.Vector2();
const dragPlane = new THREE.Plane();
const hitPoint = new THREE.Vector3();
const dragOffset = new THREE.Vector3();
const activePointers = new Set();
const pointerPositions = new Map();
let pointerDownInfo = { x:0, y:0, t:0 };

function resize(){
  const w = canvasWrap.clientWidth, h = canvasWrap.clientHeight;
  renderer.setSize(w,h,false);
  perspectiveCam.aspect = w / h;
  perspectiveCam.updateProjectionMatrix();
  const s = 5, a = w/h;
  orthoCam.left = -s*a; orthoCam.right = s*a; orthoCam.top = s; orthoCam.bottom = -s;
  orthoCam.updateProjectionMatrix();
}
window.addEventListener('resize', resize); window.addEventListener('orientationchange', ()=>setTimeout(resize,80)); resize();

function toast(msg){
  const el = document.createElement('div'); el.className = 'toast'; el.textContent = msg; qs('#toasts').appendChild(el);
  setTimeout(()=>{ el.style.opacity = '0'; el.style.transform = 'translateY(-8px)'; el.style.transition = '.2s'; setTimeout(()=>el.remove(),220); }, 1800);
}
function showLoading(v){ qs('#loading').classList.toggle('show', v); }
function getExt(name){ const m = name.toLowerCase().match(/\.([^.]+)$/); return m ? m[1] : ''; }
function fmt(n){ return String(Math.round(n*100)/100); }
function setEmpty(){ qs('#empty').classList.toggle('hidden', state.models.length > 0); qs('#modelCount').textContent = state.models.length; }

function normalizeRawObject(raw){
  const box = new THREE.Box3().setFromObject(raw);
  if (box.isEmpty()) return;
  const size = new THREE.Vector3(); box.getSize(size);
  const maxDim = Math.max(size.x,size.y,size.z) || 1;
  const scale = 2 / maxDim;
  raw.scale.multiplyScalar(scale);
  const box2 = new THREE.Box3().setFromObject(raw);
  const center = new THREE.Vector3(); box2.getCenter(center);
  raw.position.x -= center.x;
  raw.position.z -= center.z;
  raw.position.y -= box2.min.y;
}
function tuneTexture(tex, isColor = false){
  if (!tex) return tex;
  tex.anisotropy = maxTextureAnisotropy;
  if (isColor && 'colorSpace' in tex) tex.colorSpace = THREE.SRGBColorSpace;
  tex.needsUpdate = true;
  return tex;
}
function ensurePhysicalMaterialDefaults(m){
  if (!m) return m;
  if (!m.normalScale) m.normalScale = new THREE.Vector2(1, 1);
  if (m.clearcoatNormalMap && !m.clearcoatNormalScale) m.clearcoatNormalScale = new THREE.Vector2(1, 1);
  if (m.iridescenceThicknessRange == null) m.iridescenceThicknessRange = [100, 400];
  if (m.specularColor == null) m.specularColor = new THREE.Color(0xffffff);
  if (m.attenuationColor == null) m.attenuationColor = new THREE.Color(0xffffff);
  return m;
}
function detectMaterialKind(source, meshName=''){
  const forced = source?.userData?.forcedSurfaceKind;
  if (forced === 'glass' || forced === 'metal' || forced === 'default') return forced;
  const tag = `${source?.name || ''} ${meshName || ''}`.toLowerCase();
  const transparent = !!source?.transparent || (source?.opacity ?? 1) < 0.985 || (source?.transmission ?? 0) > 0.05;
  const metallic = (source?.metalness ?? 0) > 0.42;
  if (/glass|window|crystal|lens|bottle|cup|acrylic|clear|유리/.test(tag) || transparent) return 'glass';
  if (/metal|steel|chrome|iron|silver|gold|alum|aluminum|brass|copper|metallic|stainless|금속/.test(tag) || metallic) return 'metal';
  return 'default';
}

function sanitizeMaterialMode(mode){
  return ['default','metal','glass'].includes(mode) ? mode : 'default';
}

function getMaterialUiLabel(mode){
  return mode === 'metal' ? '금속' : mode === 'glass' ? '유리' : '일반';
}

function getModelDefaultMaterialMode(model){
  return sanitizeMaterialMode(model?.defaultMaterialMode || model?.materialMode || 'default');
}

function inferInitialMaterialMode(source, meshName=''){
  const kind = detectMaterialKind(source, meshName);
  return kind === 'glass' ? 'glass' : kind === 'metal' ? 'metal' : 'default';
}

function getKindsSummaryFromOriginalMaterials(materials){
  const arr = Array.isArray(materials) ? materials : [materials];
  const kinds = [];
  arr.forEach(mat => {
    const kind = detectMaterialKind(mat, '');
    if (!kinds.includes(kind)) kinds.push(kind);
  });
  return kinds;
}

function summarizeOriginalKindsOnModel(model){
  const summary = [];
  if (!model?.object) return summary;
  model.object.traverse(obj => {
    if (!obj.isMesh) return;
    const originals = obj.userData.originalMaterials || obj.material;
    getKindsSummaryFromOriginalMaterials(originals).forEach(kind => {
      if (!summary.includes(kind)) summary.push(kind);
    });
  });
  return summary;
}

function inferModelModeFromOriginalKinds(kinds){
  const uniq = [...new Set(kinds.filter(Boolean))];
  if (uniq.length === 1) return uniq[0];
  return 'default';
}

function getKindsSummaryLabel(kinds){
  const labels = kinds.map(kind => getMaterialUiLabel(kind));
  return labels.length ? labels.join(' + ') : '일반';
}

function defaultMaterialSettings(){
  return {
    metalReflectivity: 1.15,
    glassTransmission: 0.9,
    glassOpacity: 0.42
  };
}

function normalizeMaterialSettings(settings){
  return {
    metalReflectivity: THREE.MathUtils.clamp(Number(settings?.metalReflectivity) || 1.15, 0, 2),
    glassTransmission: THREE.MathUtils.clamp(Number(settings?.glassTransmission) || 0.9, 0, 1),
    glassOpacity: THREE.MathUtils.clamp(Number(settings?.glassOpacity) || 0.42, 0.15, 1)
  };
}

function getMaterialSettingsFromTarget(target){
  return normalizeMaterialSettings(target?.userData?.materialSettings || target?.materialSettings || target || defaultMaterialSettings());
}

function applyMaterialSettingsToModel(model){
  if (!model?.object) return;
  model.materialSettings = normalizeMaterialSettings(model.materialSettings || defaultMaterialSettings());
  model.object.traverse(obj => {
    if (!obj.isMesh || !obj.material) return;
    const mats = Array.isArray(obj.material) ? obj.material : [obj.material];
    mats.forEach(mat => { if (mat) mat.userData.materialSettings = model.materialSettings; });
  });
}

function refreshSelectedMaterialSliders(){ return; }

function applyGlassRenderPriority(mat, mesh){
  if (!mat || !mesh) return;
  mat.transparent = true;
  mat.depthWrite = false;
  mesh.renderOrder = 20;
  if (mat.side == null) mat.side = THREE.DoubleSide;
}

function clearPlasterMaps(mat){
  if (!mat) return;
  ['map','metalnessMap','roughnessMap','normalMap','aoMap','alphaMap','emissiveMap','displacementMap','bumpMap','lightMap'].forEach(k => {
    if (k in mat) mat[k] = null;
  });
}

function getAxisColor(axis){
  return axis === 'x' ? 0xff5a7a : axis === 'y' ? 0x55d66b : 0x4aa8ff;
}

function createPlasterGridTexture(){
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 512;
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = '#f4f4f2';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.strokeStyle = 'rgba(145,145,145,0.55)';
  ctx.lineWidth = 2;
  const step = 64;
  for (let x = 0; x <= canvas.width; x += step) {
    ctx.beginPath();
    ctx.moveTo(x + 0.5, 0);
    ctx.lineTo(x + 0.5, canvas.height);
    ctx.stroke();
  }
  for (let y = 0; y <= canvas.height; y += step) {
    ctx.beginPath();
    ctx.moveTo(0, y + 0.5);
    ctx.lineTo(canvas.width, y + 0.5);
    ctx.stroke();
  }
  const tex = new THREE.CanvasTexture(canvas);
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(1.2, 1.2);
  tex.anisotropy = maxTextureAnisotropy;
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.needsUpdate = true;
  return tex;
}
const plasterGridTexture = createPlasterGridTexture();
function applyReflectiveMaterialProfile(mat){
  const kind = mat?.userData?.surfaceKind || 'default';
  if (!mat || !mat.isMeshPhysicalMaterial) return mat;
  if (!mat.userData.__baseSurface) {
    mat.userData.__baseSurface = {
      roughness: mat.roughness,
      metalness: mat.metalness,
      clearcoat: mat.clearcoat,
      clearcoatRoughness: mat.clearcoatRoughness,
      transmission: mat.transmission,
      thickness: mat.thickness,
      ior: mat.ior,
      envMapIntensity: mat.envMapIntensity,
      opacity: mat.opacity,
      transparent: mat.transparent,
      side: mat.side,
      depthWrite: mat.depthWrite,
      color: mat.color?.clone?.() || new THREE.Color(0xffffff),
      map: mat.map || null,
      normalMap: mat.normalMap || null,
      roughnessMap: mat.roughnessMap || null,
      metalnessMap: mat.metalnessMap || null
    };
  }
  const base = mat.userData.__baseSurface;
  if (kind === 'metal') {
    mat.color.copy(base.color || new THREE.Color(0xb8bcc7));
    mat.map = base.map || null;
    mat.normalMap = base.normalMap || null;
    mat.roughnessMap = base.roughnessMap || null;
    mat.metalnessMap = base.metalnessMap || null;
    mat.metalness = Math.min(Math.max(base.metalness ?? 0.55, 0.96), 1.0);
    mat.roughness = Math.min(base.roughness ?? 0.22, 0.12);
    mat.clearcoat = Math.max(base.clearcoat ?? 0.08, 0.28);
    mat.clearcoatRoughness = Math.min(base.clearcoatRoughness ?? 0.14, 0.08);
    mat.envMapIntensity = Math.max(base.envMapIntensity ?? 1.0, 2.35);
    mat.envMap = reflectionRenderTarget.texture;
    mat.reflectivity = 1.0;
    mat.transparent = false
;
    mat.opacity = 1;
    mat.depthWrite = true;
    if ('specularIntensity' in mat) mat.specularIntensity = Math.max(mat.specularIntensity ?? 0.65, 1.0);
  } else if (kind === 'glass') {
    mat.color.copy(base.color || new THREE.Color(0xf2f7ff));
    mat.map = base.map || null;
    mat.normalMap = base.normalMap || null;
    mat.roughnessMap = base.roughnessMap || null;
    mat.metalnessMap = base.metalnessMap || null;
    mat.transparent = true;
    mat.opacity = 0.42;
    mat.transmission = Math.max(base.transmission ?? 0.2, 0.9);
    mat.thickness = Math.max(base.thickness ?? 0.08, 0.34);
    mat.ior = Math.max(base.ior ?? 1.1, 1.45);
    mat.roughness = Math.min(base.roughness ?? 0.1, 0.08);
    mat.clearcoat = Math.max(base.clearcoat ?? 0.04, 0.18);
    mat.clearcoatRoughness = Math.min(base.clearcoatRoughness ?? 0.14, 0.08);
    mat.envMapIntensity = Math.max(base.envMapIntensity ?? 1.0, 1.6);
    mat.attenuationDistance = 6.5;
    mat.attenuationColor = new THREE.Color(0xffffff);
    mat.side = THREE.DoubleSide;
    mat.envMap = reflectionRenderTarget.texture;
    mat.depthWrite = false;
    if ('specularIntensity' in mat) mat.specularIntensity = Math.max(mat.specularIntensity ?? 0.7, 1.0);
  } else if (kind === 'plaster') {
    clearPlasterMaps(mat);
    mat.map = plasterGridTexture;
    mat.color = new THREE.Color(0xffffff);
    mat.transparent = false;
    mat.opacity = 1;
    mat.transmission = 0;
    mat.metalness = 0.0;
    mat.roughness = 0.98;
    mat.clearcoat = 0.0;
    mat.clearcoatRoughness = 0.3;
    mat.envMapIntensity = 0.02;
    mat.side = THREE.FrontSide;
    mat.envMap = null;
    mat.depthWrite = true;
  } else {
    mat.color.copy(base.color || new THREE.Color(0xb8bcc7));
    mat.map = base.map || null;
    mat.normalMap = base.normalMap || null;
    mat.roughnessMap = base.roughnessMap || null;
    mat.metalnessMap = base.metalnessMap || null;
    mat.envMap = null;
    mat.transparent = !!base.transparent;
    mat.opacity = base.opacity ?? 1;
    mat.transmission = base.transmission ?? 0;
    mat.metalness = base.metalness ?? mat.metalness;
    mat.roughness = base.roughness ?? mat.roughness;
    mat.clearcoat = base.clearcoat ?? mat.clearcoat;
    mat.clearcoatRoughness = base.clearcoatRoughness ?? mat.clearcoatRoughness;
    mat.thickness = base.thickness ?? mat.thickness;
    mat.ior = base.ior ?? mat.ior;
    mat.depthWrite = base.depthWrite ?? true;
    mat.side = base.side ?? mat.side;
  }
  mat.needsUpdate = true;
  return mat;
}
function buildPhysicalMaterialFrom(source){
  const material = new THREE.MeshPhysicalMaterial({
    name: source.name || '',
    color: source.color?.clone?.() || new THREE.Color(0xb8bcc7),
    map: tuneTexture(source.map || null, true),
    normalMap: tuneTexture(source.normalMap || null),
    roughnessMap: tuneTexture(source.roughnessMap || null),
    metalnessMap: tuneTexture(source.metalnessMap || null),
    aoMap: tuneTexture(source.aoMap || null),
    alphaMap: tuneTexture(source.alphaMap || null),
    emissive: source.emissive?.clone?.() || new THREE.Color(0x000000),
    emissiveMap: tuneTexture(source.emissiveMap || null, true),
    emissiveIntensity: source.emissiveIntensity ?? 1,
    transparent: !!source.transparent,
    opacity: source.opacity ?? 1,
    side: source.side ?? THREE.FrontSide,
    roughness: source.roughness ?? 0.55,
    metalness: source.metalness ?? 0.08,
    flatShading: !!source.flatShading,
    wireframe: !!source.wireframe,
    envMapIntensity: source.envMapIntensity ?? 1.0,
    normalScale: source.normalScale?.clone?.() || new THREE.Vector2(1, 1),
    aoMapIntensity: source.aoMapIntensity ?? 1,
    displacementMap: tuneTexture(source.displacementMap || null),
    displacementScale: source.displacementScale ?? 1,
    displacementBias: source.displacementBias ?? 0,
    bumpMap: tuneTexture(source.bumpMap || null),
    bumpScale: source.bumpScale ?? 1,
    lightMap: tuneTexture(source.lightMap || null),
    lightMapIntensity: source.lightMapIntensity ?? 1
  });
  if (source.alphaTest != null) material.alphaTest = source.alphaTest;
  if (source.depthWrite != null) material.depthWrite = source.depthWrite;
  if (source.depthTest != null) material.depthTest = source.depthTest;
  if (source.vertexColors) material.vertexColors = source.vertexColors;
  if (source.transparent && source.opacity === 1) material.opacity = 0.999;
  return material;
}
function cloneSourceMaterial(mat){
  if (!mat) return createFallbackMaterial(null, '');
  try {
    return mat.clone ? mat.clone() : buildPhysicalMaterialFrom(mat);
  } catch (e) {
    return buildPhysicalMaterialFrom(mat);
  }
}

function prepareNativeMaterial(mat, meshName=''){
  if (!mat) return createFallbackMaterial(null, meshName);
  if ('map' in mat) mat.map = tuneTexture(mat.map || null, true);
  if ('emissiveMap' in mat) mat.emissiveMap = tuneTexture(mat.emissiveMap || null, true);
  if ('normalMap' in mat) mat.normalMap = tuneTexture(mat.normalMap || null);
  if ('roughnessMap' in mat) mat.roughnessMap = tuneTexture(mat.roughnessMap || null);
  if ('metalnessMap' in mat) mat.metalnessMap = tuneTexture(mat.metalnessMap || null);
  if ('aoMap' in mat) mat.aoMap = tuneTexture(mat.aoMap || null);
  if ('alphaMap' in mat) mat.alphaMap = tuneTexture(mat.alphaMap || null);
  if ('displacementMap' in mat) mat.displacementMap = tuneTexture(mat.displacementMap || null);
  if ('bumpMap' in mat) mat.bumpMap = tuneTexture(mat.bumpMap || null);
  if ('lightMap' in mat) mat.lightMap = tuneTexture(mat.lightMap || null);
  if (mat.isMeshPhysicalMaterial) ensurePhysicalMaterialDefaults(mat);
  delete mat.userData?.forcedSurfaceKind;
  mat.userData = mat.userData || {};
  mat.userData.surfaceKind = detectMaterialKind(mat, meshName);
  return mat;
}

function createFallbackMaterial(source, meshName=''){
  const inferred = inferInitialMaterialMode(source, meshName);
  const transparent = inferred === 'glass' || !!source?.transparent;
  const fallback = new THREE.MeshPhysicalMaterial({
    name: source?.name || '',
    color: source?.color?.clone?.() || new THREE.Color(inferred === 'glass' ? 0xf2f7ff : inferred === 'plaster' ? 0xf4f4f2 : 0xb8bcc7),
    map: tuneTexture(source?.map || null, true),
    normalMap: tuneTexture(source?.normalMap || null),
    transparent,
    opacity: inferred === 'glass' ? 0.42 : 1,
    transmission: inferred === 'glass' ? 0.9 : 0,
    ior: inferred === 'glass' ? 1.45 : 1.45,
    thickness: inferred === 'glass' ? 0.35 : 0,
    roughness: inferred === 'metal' ? 0.12 : inferred === 'glass' ? 0.06 : 0.62,
    metalness: inferred === 'metal' ? 0.94 : 0.06,
    clearcoat: inferred === 'metal' ? 0.28 : inferred === 'glass' ? 0.18 : 0.04,
    clearcoatRoughness: inferred === 'metal' ? 0.1 : inferred === 'glass' ? 0.08 : 0.24,
    envMapIntensity: inferred === 'metal' ? 2.35 : inferred === 'glass' ? 1.6 : 0.95,
    side: inferred === 'glass' ? THREE.DoubleSide : (source?.side ?? THREE.FrontSide)
  });
  fallback.userData.surfaceKind = inferred;
  fallback.shadowSide = THREE.FrontSide;
  return applyReflectiveMaterialProfile(ensurePhysicalMaterialDefaults(fallback));
}
function safeEnhanceMaterial(material, meshName=''){
  try {
    return enhanceMaterial(material, meshName);
  } catch (error) {
    console.warn('Material fallback applied:', meshName, error);
    return createFallbackMaterial(material, meshName);
  }
}
function refreshModelMaterialMode(model){
  if (!model?.object) return;
  model.materialMode = sanitizeMaterialMode(model.materialMode || model.defaultMaterialMode || 'default');
  model.defaultMaterialMode = sanitizeMaterialMode(model.defaultMaterialMode || 'default');
  model.object.traverse(obj => {
    if (!obj.isMesh) return;
    if (!obj.userData.originalMaterials) {
      const current = obj.material;
      obj.userData.originalMaterials = Array.isArray(current) ? current.map(cloneSourceMaterial) : cloneSourceMaterial(current);
    }
    const originals = obj.userData.originalMaterials;
    const buildForMode = (sourceMat) => {
      const baseMat = cloneSourceMaterial(sourceMat);
      if (model.materialMode === 'default') {
        const nativeMat = prepareNativeMaterial(baseMat, obj.name);
        nativeMat.shadowSide = THREE.FrontSide;
        nativeMat.needsUpdate = true;
        return nativeMat;
      }
      const physical = baseMat.isMeshPhysicalMaterial ? baseMat : buildPhysicalMaterialFrom(baseMat);
      physical.userData = physical.userData || {};
      physical.userData.forcedSurfaceKind = model.materialMode;
      delete physical.userData.__baseSurface;
      delete physical.userData.__basePointLight;
      const next = safeEnhanceMaterial(physical, obj.name);
      next.shadowSide = THREE.FrontSide;
      next.needsUpdate = true;
      return next;
    };
    obj.material = Array.isArray(originals) ? originals.map(buildForMode) : buildForMode(originals);
    const mats = Array.isArray(obj.material) ? obj.material : [obj.material];
    const hasGlass = mats.some(mat => mat?.transparent || (mat?.userData?.surfaceKind === 'glass') || ((mat?.transmission ?? 0) > 0.05));
    if (hasGlass) applyGlassRenderPriority(mats[0], obj);
    else obj.renderOrder = 1;
  });
  applyPointLightMaterialBoost(state.pointLightOn);
}
function dominantModelMaterialMode(model){
  if (!model?.object) return 'auto';
  const counts = { default:0, metal:0, glass:0 };
  model.object.traverse(obj => {
    if (!obj.isMesh || !obj.material) return;
    const mats = Array.isArray(obj.material) ? obj.material : [obj.material];
    mats.forEach(mat => {
      const kind = mat?.userData?.forcedSurfaceKind || mat?.userData?.surfaceKind || 'default';
      if (counts[kind] != null) counts[kind] += 1;
    });
  });
  const ranked = Object.entries(counts).sort((a,b)=>b[1]-a[1]);
  return ranked[0]?.[1] ? ranked[0][0] : 'default';
}
function updateTextureUI(){
  const wrap = qs('#textureWrap'), dis = qs('#textureDisabledMsg'), m = getModel();
  if (!m){
    wrap.style.display = 'none';
    dis.style.display = '';
    ['materialGeneral','materialMetal','materialGlass','materialReset'].forEach(id => qs('#'+id).classList.remove('active'));
    qs('#materialModeHint').textContent = '현재: 선택 없음';
    return;
  }
  wrap.style.display = '';
  dis.style.display = 'none';
  const mode = sanitizeMaterialMode(m.materialMode || m.defaultMaterialMode || 'default');
  const originalKinds = summarizeOriginalKindsOnModel(m);
  qs('#materialGeneral').classList.toggle('active', mode === 'default');
  qs('#materialMetal').classList.toggle('active', mode === 'metal');
  qs('#materialGlass').classList.toggle('active', mode === 'glass');
  qs('#materialReset').classList.remove('active');
  qs('#materialModeHint').textContent = `현재: ${getMaterialUiLabel(mode)} · 원본: ${getKindsSummaryLabel(originalKinds)}`;
}

function setSelectedMaterialMode(mode){
  const m = getModel();
  if (!m) return;
  const next = sanitizeMaterialMode(mode);
  m.materialMode = next;
  refreshModelMaterialMode(m);
  updateTextureUI();
  toast(`질감 타입: ${getMaterialUiLabel(next)}`);
}
function resetSelectedMaterialMode(){
  const m = getModel();
  if (!m) return;
  m.materialMode = getModelDefaultMaterialMode(m);
  refreshModelMaterialMode(m);
  updateTextureUI();
  toast(`질감 초기화: ${getMaterialUiLabel(m.materialMode)}`);
}
qs('#materialGeneral').onclick = () => setSelectedMaterialMode('default');
qs('#materialMetal').onclick = () => setSelectedMaterialMode('metal');
qs('#materialGlass').onclick = () => setSelectedMaterialMode('glass');
qs('#materialReset').onclick = () => resetSelectedMaterialMode();

function updateSelectedMaterialSetting(){ return; }

function enhanceMaterial(material, meshName=''){
  let m = material;
  if (!m) return createFallbackMaterial(null, meshName);
  if (!m.isMeshPhysicalMaterial) {
    m = buildPhysicalMaterialFrom(m);
  }
  ensurePhysicalMaterialDefaults(m);

  m.map = tuneTexture(m.map, true);
  m.emissiveMap = tuneTexture(m.emissiveMap, true);
  m.normalMap = tuneTexture(m.normalMap);
  m.roughnessMap = tuneTexture(m.roughnessMap);
  m.metalnessMap = tuneTexture(m.metalnessMap);
  m.aoMap = tuneTexture(m.aoMap);
  m.alphaMap = tuneTexture(m.alphaMap);
  m.displacementMap = tuneTexture(m.displacementMap);
  m.bumpMap = tuneTexture(m.bumpMap);
  m.lightMap = tuneTexture(m.lightMap);

  const kind = sanitizeMaterialMode(detectMaterialKind(m, meshName));
  m.userData.surfaceKind = kind;
  const transparent = kind === 'glass' || !!m.transparent || (m.opacity ?? 1) < 1;
  m.transparent = transparent;
  if (transparent && (m.opacity ?? 1) >= 1) m.opacity = 0.999;

  if (kind === 'glass') {
    const settings = getMaterialSettingsFromTarget(m);
    m.transmission = Math.max(m.transmission ?? 0.2, settings.glassTransmission);
    m.ior = Math.max(m.ior ?? 1.12, 1.45);
    m.thickness = Math.max(m.thickness ?? 0.04, 0.35);
    m.roughness = Math.min(m.roughness ?? 0.18, 0.08);
    m.clearcoat = Math.max(m.clearcoat ?? 0.04, 0.18);
    m.clearcoatRoughness = Math.min(m.clearcoatRoughness ?? 0.18, 0.08);
    m.envMapIntensity = Math.max(m.envMapIntensity ?? 1.0, 1.4);
    m.attenuationDistance = 6.5;
    m.attenuationColor = new THREE.Color(0xffffff);
    m.side = THREE.DoubleSide;
    m.depthWrite = false;
    m.opacity = getMaterialSettingsFromTarget(m).glassOpacity;
  } else if (kind === 'metal') {
    m.metalness = Math.max(m.metalness ?? 0.3, 0.9);
    m.roughness = Math.min(m.roughness ?? 0.24, 0.16);
    m.clearcoat = Math.max(m.clearcoat ?? 0.04, 0.18);
    m.clearcoatRoughness = Math.min(m.clearcoatRoughness ?? 0.18, 0.1);
    m.envMapIntensity = Math.max(m.envMapIntensity ?? 1.0, 1.5);
    m.depthWrite = true;
    m.opacity = 1;
  } else if (kind === 'plaster') {
    clearPlasterMaps(m);
    m.color = new THREE.Color(0xf4f4f2);
    m.transmission = 0;
    m.metalness = 0.02;
    m.roughness = 0.94;
    m.clearcoat = 0;
    m.clearcoatRoughness = 0.22;
    m.envMapIntensity = 0.08;
    m.transparent = false;
    m.opacity = 1;
    m.side = THREE.FrontSide;
    m.depthWrite = true;
  } else {
    m.transmission = 0;
    m.metalness = THREE.MathUtils.clamp(m.metalness ?? 0.08, 0, 0.55);
    m.roughness = THREE.MathUtils.clamp(m.roughness ?? 0.62, 0.22, 0.96);
    m.clearcoat = Math.min(m.clearcoat ?? 0.04, 0.08);
    m.clearcoatRoughness = THREE.MathUtils.clamp(m.clearcoatRoughness ?? 0.24, 0.16, 0.36);
    m.envMapIntensity = THREE.MathUtils.clamp(m.envMapIntensity ?? 0.75, 0.45, 1.02);
    m.depthWrite = true;
  }
  m.toneMapped = true;
  m.shadowSide = THREE.FrontSide;
  ensurePhysicalMaterialDefaults(m);
  return applyReflectiveMaterialProfile(m);
}


async function loadModelAsset({ name, url, sourceType='file', sourceUrl='', revoke=false, transform=null, visible=true, selectOnLoad=true, fitOnLoad=true, toastOnLoad=true, materialMode='default', materialSettings=null, defaultMaterialMode=null, defaultMaterialSettings=null }){
  const ext = getExt(name);
  try {
    showLoading(true);
    let raw;
    if (ext === 'glb' || ext === 'gltf') raw = (await gltfLoader.loadAsync(url)).scene;
    else if (ext === 'obj') raw = await new OBJLoader().loadAsync(url);
    else if (ext === 'stl') {
      const geo = await new STLLoader().loadAsync(url); geo.computeVertexNormals();
      raw = new THREE.Mesh(geo, new THREE.MeshPhysicalMaterial({ color:0x9aa5ff, roughness:.36, metalness:.18, clearcoat:.18, envMapIntensity:1.2 }));
    } else if (ext === 'fbx') raw = await new FBXLoader().loadAsync(url);
    else throw new Error('지원하지 않는 형식');

    let inferredKinds = [];
    raw.traverse(c => {
      if (c.isMesh){
        if (!c.material) c.material = createFallbackMaterial(null, c.name);
        c.userData.originalMaterials = Array.isArray(c.material) ? c.material.map(cloneSourceMaterial) : cloneSourceMaterial(c.material);
        if (Array.isArray(c.material)) c.material = c.material.map(mat => {
          const inferred = inferInitialMaterialMode(mat, c.name);
          inferredKinds.push(inferred);
          const next = safeEnhanceMaterial(mat, c.name);
          next.shadowSide = THREE.FrontSide;
          next.needsUpdate = true;
          if (next.userData.surfaceKind === 'glass') applyGlassRenderPriority(next, c);
          return next;
        });
        else {
          const inferred = inferInitialMaterialMode(c.material, c.name);
          inferredKinds.push(inferred);
          c.material = safeEnhanceMaterial(c.material, c.name);
          c.material.shadowSide = THREE.FrontSide;
          c.material.needsUpdate = true;
          if (c.material.userData.surfaceKind === 'glass') applyGlassRenderPriority(c.material, c);
        }
        c.castShadow = true;
        c.receiveShadow = true;
        if (!c.renderOrder) c.renderOrder = 1;
        if (c.geometry && !c.geometry.attributes.normal) c.geometry.computeVertexNormals();
      }
    });
    normalizeRawObject(raw);

    const pivot = new THREE.Group();
    const id = state.nextId++;
    pivot.userData.modelId = id;
    pivot.add(raw);
    scene.add(pivot);

    const normalized = normalizeTransform(transform);
    const inferredDefault = sanitizeMaterialMode(defaultMaterialMode || inferModelModeFromOriginalKinds(inferredKinds) || materialMode || 'default');
    const normalizedMaterialSettings = normalizeMaterialSettings(materialSettings || defaultMaterialSettings || { metalReflectivity:1.15, glassTransmission:0.9, glassOpacity:0.42 });
    const model = {
      id,
      name,
      ext:ext.toUpperCase(),
      object:pivot,
      visible:visible !== false,
      source:{ type:sourceType, url:sourceUrl || (sourceType === 'url' ? url : '') },
      transform: normalized,
      materialMode: inferredDefault,
      defaultMaterialMode: inferredDefault,
      materialSettings: normalizedMaterialSettings,
      defaultMaterialSettings: { ...normalizedMaterialSettings }
    };
    state.models.push(model);
    applyMaterialSettingsToModel(model);
    applyTransform(model);
    model.object.visible = model.visible;
    if (state.floorPlaced) {
      model.floorRestoreY = model.transform.position.y;
      const box = new THREE.Box3().setFromObject(model.object);
      if (!box.isEmpty()) {
        model.transform.position.y += -box.min.y;
        applyTransform(model);
      }
    }
    refreshModelMaterialMode(model);
    renderList();
    if (selectOnLoad) selectModel(id, false);
    if (fitOnLoad) fitScene();
    if (toastOnLoad) toast(`${name} 로드 완료`);
    return model;
  } catch(e){
    console.error(e);
    const message = String(e?.message || e || '알 수 없는 오류');
    const low = message.toLowerCase();
    let friendly = message;
    if (ext === 'glb' || ext === 'gltf') {
      if (low.includes('draco')) friendly = 'DRACO 압축 GLB를 읽는 중 오류가 발생했습니다.';
      else if (low.includes('meshopt')) friendly = 'Meshopt 압축 GLB를 읽는 중 오류가 발생했습니다.';
      else if (low.includes('ktx2') || low.includes('basis')) friendly = '압축 텍스처(KTX2/Basis) GLB를 읽는 중 오류가 발생했습니다.';
      else if (low.includes("reading 'x'") || low.includes('reading \"x\"')) friendly = '재질 보강 처리 중 일부 GLB 머티리얼 속성이 비어 있어 로드에 실패했습니다.';
      else if (low.includes('json') || low.includes('unexpected')) friendly = 'GLB/GLTF 파일 구조를 읽는 중 오류가 발생했습니다.';
    }
    toast(`로드 실패: ${friendly}`);
    throw e;
  } finally {
    if (revoke) URL.revokeObjectURL(url);
    showLoading(false);
  }
}

async function loadFile(file){
  const url = URL.createObjectURL(file);
  const hasModels = state.models.length > 0;
  return loadModelAsset({ name:file.name, url, sourceType:'file', revoke:true, fitOnLoad: !hasModels });
}

function modelNameFromUrl(input){
  try {
    const u = new URL(input, location.href);
    return decodeURIComponent((u.pathname.split('/').pop() || 'remote-model').trim()) || 'remote-model';
  } catch {
    const clean = String(input).split('?')[0].split('#')[0];
    return decodeURIComponent((clean.split('/').pop() || 'remote-model').trim()) || 'remote-model';
  }
}

async function loadRemoteModel(inputUrl, options = {}){
  const resolved = new URL(String(inputUrl).trim(), location.href).href;
  const name = options.name || modelNameFromUrl(resolved);
  const hasModels = state.models.length > 0;
  return loadModelAsset({ name, url:resolved, sourceType:'url', sourceUrl:resolved, fitOnLoad: options.fitOnLoad ?? !hasModels, ...options });
}

function renderList(){
  const list = qs('#modelList');
  if (!state.models.length){ list.innerHTML = '<div class="emptyList">업로드된 소재가 없습니다</div>'; setEmpty(); return; }
  setEmpty();
  list.innerHTML = '';
  for (const m of state.models){
    const item = document.createElement('div');
    item.className = 'modelItem' + (m.id === state.selectedId ? ' selected' : '');
    item.innerHTML = `<div class="name"><span class="ext">${m.ext}</span>${escapeHtml(m.name.replace(/\.[^.]+$/, ''))}</div>
      <button class="miBtn ${m.visible ? '' : 'off'}" data-act="vis"><svg viewBox="0 0 24 24">${m.visible ? '<path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8S1 12 1 12Z"/><circle cx="12" cy="12" r="3"/>' : '<path d="M17.94 17.94A10.94 10.94 0 0 1 12 20C5 20 1 12 1 12a21.8 21.8 0 0 1 5.06-5.94"/><path d="M9.9 4.24A10.94 10.94 0 0 1 12 4c7 0 11 8 11 8a21.77 21.77 0 0 1-2.16 3.19"/><path d="M14.12 14.12A3 3 0 1 1 9.88 9.88"/><path d="M1 1l22 22"/>'}</svg></button>
      <button class="miBtn danger" data-act="del"><svg viewBox="0 0 24 24"><path d="M3 6h18"/><path d="M8 6V4h8v2"/><path d="m19 6-1 14H6L5 6"/><path d="M10 11v6M14 11v6"/></svg></button>`;
    item.querySelector('.name').onclick = () => selectModel(m.id, true);
    item.querySelector('[data-act="vis"]').onclick = (e) => { e.stopPropagation(); m.visible = !m.visible; m.object.visible = m.visible; if (!m.visible && state.selectedId === m.id) state.boxOnly = false; updateSelectionVisuals(); syncPerspectiveBoxButton(); renderList(); };
    item.querySelector('[data-act="del"]').onclick = (e) => { e.stopPropagation(); deleteModel(m.id); };
    list.appendChild(item);
  }
}

function escapeHtml(s){ return String(s).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c])); }
function getModel(id=state.selectedId){ return state.models.find(m => m.id === id); }

function selectModel(id, autoMove=false){
  state.selectedId = id;
  const m = getModel();
  renderList(); updateTransformUI(); updateTextureUI();
  if (m && m.visible){
    if (state.boxOnly) updateSelectionVisuals();
    else if (autoMove) setDragMode('screen');
    else updateSelectionVisuals();
  } else {
    state.boxOnly = false;
    updateSelectionVisuals();
    setDragMode('off');
    syncPerspectiveBoxButton();
  }
}

function clearSelection(){ state.selectedId = null; state.boxOnly = false; updateSelectionVisuals(); updateTransformUI(); updateTextureUI(); refreshSelectedMaterialSliders(); renderList(); setDragMode('off'); syncPerspectiveBoxButton(); }

function clearAllModels(){
  for (const m of [...state.models]){
    scene.remove(m.object);
    disposeObject(m.object);
  }
  state.models = [];
  state.floorPlaced = false;
  clearSelection();
  renderList();
  setEmpty();
}

function deleteModel(id){
  const i = state.models.findIndex(m => m.id === id); if (i < 0) return;
  const m = state.models[i]; scene.remove(m.object); disposeObject(m.object); state.models.splice(i,1);
  if (state.selectedId === id) clearSelection();
  renderList(); setEmpty(); toast(`${m.name} 삭제됨`);
}

function disposeObject(obj){ obj.traverse(c => { if (c.geometry) c.geometry.dispose(); if (c.material){ const arr = Array.isArray(c.material) ? c.material : [c.material]; for (const mat of arr){ for (const k in mat){ if (mat[k] && mat[k].isTexture) mat[k].dispose(); } mat.dispose?.(); } } }); }

function normalizeTransform(transform){
  const next = {
    position:{ x:0, y:0, z:0 },
    rotation:{ x:0, y:0, z:0 },
    scale:{ x:1, y:1, z:1, uniform:1 }
  };
  if (!transform) return next;
  ['x','y','z'].forEach(axis => {
    if (Number.isFinite(transform?.position?.[axis])) next.position[axis] = transform.position[axis];
    if (Number.isFinite(transform?.rotation?.[axis])) next.rotation[axis] = transform.rotation[axis];
    if (Number.isFinite(transform?.scale?.[axis])) next.scale[axis] = transform.scale[axis];
  });
  const uniform = Number.isFinite(transform?.scale?.uniform) ? transform.scale.uniform : (next.scale.x + next.scale.y + next.scale.z) / 3;
  next.scale.uniform = uniform;
  return next;
}

function applyTransform(m){
  if (!m) return;
  m.object.position.set(m.transform.position.x, m.transform.position.y, m.transform.position.z);
  m.object.rotation.set(THREE.MathUtils.degToRad(m.transform.rotation.x), THREE.MathUtils.degToRad(m.transform.rotation.y), THREE.MathUtils.degToRad(m.transform.rotation.z));
  m.object.scale.set(m.transform.scale.x, m.transform.scale.y, m.transform.scale.z);
  if (state.selectedId === m.id) updateRotateHandle();
}

function syncFloorPlacementButton(){
  qs('#toggleFloorPlacement').textContent = state.floorPlaced ? '공간에 배치' : '바닥에 배치';
}

function applyAllModelsToFloor(enable){
  if (enable) {
    for (const m of state.models){
      if (typeof m.floorRestoreY !== 'number') m.floorRestoreY = m.transform.position.y;
      const box = new THREE.Box3().setFromObject(m.object);
      if (box.isEmpty()) continue;
      const delta = -box.min.y;
      m.transform.position.y += delta;
      applyTransform(m);
    }
    state.floorPlaced = true;
    toast('모든 소재를 바닥에 배치했습니다');
  } else {
    for (const m of state.models){
      if (typeof m.floorRestoreY === 'number') {
        m.transform.position.y = m.floorRestoreY;
        applyTransform(m);
      }
    }
    state.floorPlaced = false;
    toast('소재를 원래 높이로 복원했습니다');
  }
  syncFloorPlacementButton();
  updateTransformUI();
  updateTextureUI();
  if (getModel()) updateSelectionVisuals();
  updateRotateHandle();
}

function syncPair(kind, axis, value){ qsa(`[data-kind="${kind}"][data-axis="${axis}"]`).forEach(el => el.value = fmt(value)); }
function updateTransformUI(){
  const wrap = qs('#transformWrap'), dis = qs('#disabledMsg'), m = getModel();
  if (!m){ wrap.style.display = 'none'; dis.style.display = ''; return; }
  wrap.style.display = ''; dis.style.display = 'none';
  const t = m.transform;
  qs('#suRange').value = qs('#suNum').value = fmt(t.scale.uniform);
  ['x','y','z'].forEach(a => {
    syncPair('scale', a, t.scale[a]);
    syncPair('rotation', a, t.rotation[a]);
    syncPair('position', a, t.position[a]);
  });
}

qsa('input[data-kind]').forEach(el => {
  el.addEventListener('input', () => {
    const m = getModel(); if (!m) return;
    const kind = el.dataset.kind, axis = el.dataset.axis, val = parseFloat(el.value); if (isNaN(val)) return;
    m.transform[kind][axis] = val;
    qsa(`[data-kind="${kind}"][data-axis="${axis}"]`).forEach(other => { if (other !== el) other.value = fmt(val); });
    if (kind === 'scale') m.transform.scale.uniform = (m.transform.scale.x + m.transform.scale.y + m.transform.scale.z) / 3;
    applyTransform(m); updateSelectionVisuals();
  });
});

function setUniform(v){ const m = getModel(); if (!m || isNaN(v)) return; m.transform.scale.uniform = v; m.transform.scale.x = v; m.transform.scale.y = v; m.transform.scale.z = v; ['x','y','z'].forEach(a => syncPair('scale',a,v)); qs('#suRange').value = qs('#suNum').value = fmt(v); applyTransform(m); updateSelectionVisuals(); }
qs('#suRange').addEventListener('input', e => setUniform(parseFloat(e.target.value)));
qs('#suNum').addEventListener('input', e => setUniform(parseFloat(e.target.value)));
qs('#uniformScale').addEventListener('change', e => { qs('#uniformRow').style.display = e.target.checked ? '' : 'grid'; qs('#scaleXYZ').style.display = e.target.checked ? 'none' : 'block'; });
qs('#toggleFloorPlacement').onclick = () => applyAllModelsToFloor(!state.floorPlaced);
qs('#resetTransform').onclick = () => { const m = getModel(); if (!m) return; m.transform = { position:{x:0,y:0,z:0}, rotation:{x:0,y:0,z:0}, scale:{x:1,y:1,z:1,uniform:1} }; delete m.floorRestoreY; applyTransform(m); updateTransformUI(); updateSelectionVisuals(); toast('변환 초기화'); };

function syncControlMode(){
  const on = state.dragMode !== 'off' && !!getModel();
  controls.enabled = true;
  controls.enableRotate = !on;
  controls.enableZoom = !on;
  controls.enablePan = !on;
}

function setFloorMode(mode, showToast = true){
  const next = ['white','grid','none'].includes(mode) ? mode : 'white';
  state.floorMode = next;
  state.showGrid = next === 'grid';
  if (next === 'white') {
    ground.visible = true;
    ground.material = whiteFloorMaterial;
    shadowCatcher.visible = true;
    shadowCatcher.receiveShadow = true;
  } else if (next === 'grid') {
    ground.visible = false;
    shadowCatcher.visible = false;
    shadowCatcher.receiveShadow = false;
  } else {
    ground.visible = false;
    shadowCatcher.visible = false;
    shadowCatcher.receiveShadow = false;
  }
  grid.visible = next === 'grid';
  const label = next === 'white' ? '흰 바닥' : next === 'grid' ? '그리드' : '바닥 없음';
  qs('#floorLabel').textContent = label;
  qs('#floorBtn').classList.toggle('active', next !== 'none');
  if (showToast) toast(`바닥 모드: ${label}`);
}

function cycleFloorMode(){
  const next = state.floorMode === 'white' ? 'grid' : state.floorMode === 'grid' ? 'none' : 'white';
  setFloorMode(next, true);
}

function setDragMode(mode){
  state.dragMode = mode;
  qs('#dragScreen').classList.toggle('active', mode === 'screen');
  qs('#dragGround').classList.toggle('active', mode === 'ground');
  qs('#dragRotate').classList.toggle('active', mode === 'rotate');
  qs('#dragOff').classList.toggle('active', mode === 'off');
  if (mode !== 'off' && state.boxOnly) state.boxOnly = false;
  const on = mode !== 'off' && !!getModel();
  qs('#dragBadge').style.display = on ? 'inline-flex' : 'none';
  qs('#dragBadge').querySelector('span').textContent = mode === 'screen' ? '이동 모드 ON' : mode === 'ground' ? '바닥 이동 ON' : mode === 'rotate' ? '회전 모드 ON' : '이동 모드 OFF';
  updateSelectionVisuals();
  syncPerspectiveBoxButton();
  syncControlMode();
}
qs('#dragScreen').onclick = () => getModel() && setDragMode('screen');
qs('#dragGround').onclick = () => getModel() && setDragMode('ground');
qs('#dragRotate').onclick = () => getModel() && setDragMode('rotate');
qs('#dragOff').onclick = () => setDragMode('off');
qs('#dragBadge').onclick = () => setDragMode('off');
qs('#floorBtn').onclick = cycleFloorMode;
function syncPerspectiveBoxButton(){
  const m = getModel();
  qs('#boxBtn').classList.toggle('active', !!(state.boxOnly && m && m.visible));
}
function togglePerspectiveBox(){
  const m = getModel();
  if (!m || !m.visible) {
    state.boxOnly = false;
    syncPerspectiveBoxButton();
    toast('먼저 소재를 선택하세요');
    return;
  }
  if (state.boxOnly) {
    state.boxOnly = false;
    updateSelectionVisuals();
    syncPerspectiveBoxButton();
    toast('투시박스 끔');
    return;
  }
  setDragMode('off');
  state.boxOnly = true;
  updateSelectionVisuals();
  syncPerspectiveBoxButton();
  toast('투시박스 켬');
}
qs('#boxBtn').onclick = togglePerspectiveBox;

function updatePointer(event){ const r = renderer.domElement.getBoundingClientRect(); pointer.x = ((event.clientX - r.left) / r.width) * 2 - 1; pointer.y = -((event.clientY - r.top) / r.height) * 2 + 1; }
function topModelFromIntersection(obj){ let cur = obj; while (cur && cur !== scene){ if (cur.userData.modelId) return getModel(cur.userData.modelId); cur = cur.parent; } return null; }
function selectableRoots(){ return state.models.filter(m => m.visible).map(m => m.object); }
function scaleSelectedByFactor(factor){
  const m = getModel();
  if (!m) return;
  const next = THREE.MathUtils.clamp(m.transform.scale.uniform * factor, 0.1, 5);
  m.transform.scale.uniform = next;
  m.transform.scale.x = next;
  m.transform.scale.y = next;
  m.transform.scale.z = next;
  qs('#suRange').value = qs('#suNum').value = fmt(next);
  ['x','y','z'].forEach(a => syncPair('scale', a, next));
  applyTransform(m);
  selectionBox.setFromObject(m.object);
}
function getPinchDistance(){
  const pts = [...pointerPositions.values()];
  if (pts.length < 2) return 0;
  return Math.hypot(pts[0].x - pts[1].x, pts[0].y - pts[1].y);
}

renderer.domElement.addEventListener('pointerdown', (e) => {
  activePointers.add(e.pointerId);
  pointerPositions.set(e.pointerId, { x: e.clientX, y: e.clientY });
  pointerDownInfo = { x:e.clientX, y:e.clientY, t:Date.now() };
  state.dragMoved = false;
  if (activePointers.size >= 2) {
    state.dragging = false;
    state.handleDragging = false;
    if (state.dragMode !== 'off' && getModel()) {
      state.pinchScaling = true;
      state.pinchDistance = getPinchDistance();
    }
    syncControlMode();
    return;
  }
  updatePointer(e); raycaster.setFromCamera(pointer, camera);
  const selected = getModel();
  const handleHits = [
    ...(rotateHandleY.visible ? raycaster.intersectObject(rotateHandleY, false) : []),
    ...(rotateHandleX.visible ? raycaster.intersectObject(rotateHandleX, false) : []),
    ...(rotateHandleZ.visible ? raycaster.intersectObject(rotateHandleZ, false) : []),
    ...(moveGuideX.visible ? raycaster.intersectObject(moveGuideX, false) : []),
    ...(moveGuideY.visible ? raycaster.intersectObject(moveGuideY, false) : []),
    ...(moveGuideZ.visible ? raycaster.intersectObject(moveGuideZ, false) : [])
  ].sort((a,b)=>a.distance-b.distance);
  if (selected && handleHits.length) {
    state.handleDragging = true;
    state.activeHandleAxis = handleHits[0].object.userData.handleAxis || '';
    state.activeMoveAxis = handleHits[0].object.userData.moveAxis || '';
    state.handleStartX = e.clientX;
    state.handleStartY = e.clientY;
    state.handleStartRotationY = selected.transform.rotation.y;
    state.handleStartRotationX = selected.transform.rotation.x;
    state.handleStartRotationZ = selected.transform.rotation.z;
    state.handleStartPosition = { ...selected.transform.position };
    controls.enabled = false;
    e.preventDefault();
    return;
  }
  const hits = raycaster.intersectObjects(selectableRoots(), true);
  if (state.dragMode !== 'off' && selected){
    const hitSelected = hits.find(h => topModelFromIntersection(h.object)?.id === selected.id);
    if (hitSelected){
      state.dragging = true;
      if (state.dragMode === 'rotate') {
        state.rotateStart = { x: e.clientX, y: e.clientY };
      } else if (state.dragMode === 'ground') {
        dragPlane.setFromNormalAndCoplanarPoint(new THREE.Vector3(0,1,0), selected.object.position.clone());
        raycaster.ray.intersectPlane(dragPlane, hitPoint);
        dragOffset.copy(selected.object.position).sub(hitPoint);
      } else {
        const normal = new THREE.Vector3(); camera.getWorldDirection(normal).negate();
        dragPlane.setFromNormalAndCoplanarPoint(normal, selected.object.position.clone());
        raycaster.ray.intersectPlane(dragPlane, hitPoint);
        dragOffset.copy(selected.object.position).sub(hitPoint);
      }
      controls.enabled = false;
      e.preventDefault();
    }
  }
}, { passive:false });

renderer.domElement.addEventListener('pointermove', (e) => {
  if (activePointers.has(e.pointerId)) pointerPositions.set(e.pointerId, { x: e.clientX, y: e.clientY });
  const m = getModel();
  if (state.pinchScaling && activePointers.size >= 2 && state.dragMode !== 'off' && m) {
    const dist = getPinchDistance();
    if (dist > 0 && state.pinchDistance > 0) {
      const factor = THREE.MathUtils.clamp(dist / state.pinchDistance, 0.92, 1.08);
      scaleSelectedByFactor(factor);
      state.pinchDistance = dist;
      updateTransformUI();
    }
    e.preventDefault();
    return;
  }
  if (state.handleDragging && m) {
    const dx = e.clientX - state.handleStartX;
    const dy = e.clientY - state.handleStartY;
    if (state.activeMoveAxis) {
      const delta = state.activeMoveAxis === 'y' ? -dy * 0.01 : -dx * 0.01;
      m.transform.position[state.activeMoveAxis] = state.handleStartPosition[state.activeMoveAxis] + delta;
    } else if (state.activeHandleAxis === 'x') m.transform.rotation.x = state.handleStartRotationX + dy * 0.6;
    else if (state.activeHandleAxis === 'z') m.transform.rotation.z = state.handleStartRotationZ + dx * 0.6;
    else m.transform.rotation.y = state.handleStartRotationY + dx * 0.6;
    applyTransform(m);
    updateTransformUI();
    updateSelectionVisuals();
    e.preventDefault();
    return;
  }
  if (!state.dragging || activePointers.size >= 2) return;
  state.dragMoved = true;
  if (!m) return;
  if (state.dragMode === 'rotate') {
    const dx = e.clientX - state.rotateStart.x;
    const dy = e.clientY - state.rotateStart.y;
    m.transform.rotation.y += dx * 0.4;
    m.transform.rotation.x += dy * 0.4;
    state.rotateStart = { x: e.clientX, y: e.clientY };
    applyTransform(m);
    updateTransformUI();
    selectionBox.setFromObject(m.object);
    updateRotateHandle();
    e.preventDefault();
    return;
  }
  updatePointer(e); raycaster.setFromCamera(pointer, camera);
  if (raycaster.ray.intersectPlane(dragPlane, hitPoint)){
    const p = hitPoint.clone().add(dragOffset);
    m.transform.position.x = p.x;
    m.transform.position.y = p.y;
    m.transform.position.z = p.z;
    applyTransform(m); updateTransformUI(); updateSelectionVisuals();
  }
  e.preventDefault();
}, { passive:false });

renderer.domElement.addEventListener('pointerup', (e) => {
  activePointers.delete(e.pointerId);
  pointerPositions.delete(e.pointerId);
  if (activePointers.size < 2) state.pinchScaling = false;
  const movedDist = Math.hypot(e.clientX - pointerDownInfo.x, e.clientY - pointerDownInfo.y);
  const isTap = movedDist < 8 && (Date.now() - pointerDownInfo.t) < 300;
  if (state.dragging){ state.dragging = false; syncControlMode(); }
  if (state.handleDragging){ state.handleDragging = false; state.activeHandleAxis = ''; state.activeMoveAxis = ''; syncControlMode(); return; }
  if (!isTap) return;
  updatePointer(e); raycaster.setFromCamera(pointer, camera);
  const hits = raycaster.intersectObjects(selectableRoots(), true);
  if (hits.length){ const m = topModelFromIntersection(hits[0].object); if (m) selectModel(m.id, true); }
  else {
    if (state.dragMode !== 'off') setDragMode('off');
    else clearSelection();
  }
}, { passive:false });

renderer.domElement.addEventListener('pointercancel', (e) => {
  activePointers.delete(e.pointerId);
  pointerPositions.delete(e.pointerId);
  state.pinchScaling = false;
  if (state.dragging) state.dragging = false;
  if (state.handleDragging) { state.handleDragging = false; state.activeHandleAxis = ''; state.activeMoveAxis = ''; }
  syncControlMode();
}, { passive:false });

renderer.domElement.addEventListener('wheel', (e) => {
  if (state.dragMode !== 'off' && getModel()) {
    e.preventDefault();
    const factor = e.deltaY < 0 ? 1.05 : 0.95;
    scaleSelectedByFactor(factor);
    updateTransformUI();
  }
}, { passive:false });

function fitScene(){
  const box = new THREE.Box3(); let has = false;
  for (const m of state.models){ if (!m.visible) continue; const b = new THREE.Box3().setFromObject(m.object); if (!b.isEmpty()){ box.union(b); has = true; } }
  if (!has) return;
  const size = new THREE.Vector3(), center = new THREE.Vector3(); box.getSize(size); box.getCenter(center);
  const maxDim = Math.max(size.x,size.y,size.z, 1); const dist = maxDim * 2.4;
  const dir = new THREE.Vector3(1,0.9,1.2).normalize();
  const pos = center.clone().add(dir.multiplyScalar(dist));
  perspectiveCam.position.copy(pos); orthoCam.position.copy(pos); controls.target.copy(center);
  const a = canvasWrap.clientWidth / canvasWrap.clientHeight; const s = maxDim * 1.4;
  orthoCam.left = -s * a; orthoCam.right = s * a; orthoCam.top = s; orthoCam.bottom = -s; orthoCam.updateProjectionMatrix();
  controls.update();
}

function applyTheme(){
  document.body.classList.toggle('light', state.theme === 'light');
  if (state.theme === 'light'){
    renderer.setClearColor(0xeef2f7, 1); ambient.intensity = 0.6; hemi.intensity = 0.34; if (grid.material.color) grid.material.color.setHex(0xdbe1ea); if (grid.material.opacity !== undefined) grid.material.opacity = .22;
  } else {
    renderer.setClearColor(0x000000, 0); ambient.intensity = 0.42; hemi.intensity = 0.24; if (grid.material.color) grid.material.color.setHex(0x8d96a6); if (grid.material.opacity !== undefined) grid.material.opacity = .18;
  }
}
qs('#themeBtn').onclick = () => { state.theme = state.theme === 'dark' ? 'light' : 'dark'; applyTheme(); toast(state.theme === 'light' ? '밝은 배경 모드' : '어두운 배경 모드'); qs('#themeBtn').classList.toggle('active', state.theme === 'light'); };

function currentLightAngle(){
  return ((THREE.MathUtils.radToDeg(Math.atan2(dirLight.position.z, dirLight.position.x)) % 360) + 360) % 360;
}
function applyPointLightMaterialBoost(enabled){
  for (const model of state.models) {
    model.object.traverse(obj => {
      if (!obj.isMesh || !obj.material) return;
      const mats = Array.isArray(obj.material) ? obj.material : [obj.material];
      mats.forEach(mat => {
        if (!mat || !mat.isMeshPhysicalMaterial) return;
        if (!mat.userData.__basePointLight) {
          mat.userData.__basePointLight = {
            roughness: mat.roughness,
            metalness: mat.metalness,
            clearcoat: mat.clearcoat,
            clearcoatRoughness: mat.clearcoatRoughness,
            transmission: mat.transmission,
            specularIntensity: mat.specularIntensity,
            envMapIntensity: mat.envMapIntensity
          };
        }
        const base = mat.userData.__basePointLight;
        const kind = mat.userData.surfaceKind || 'default';
        if (enabled && (kind === 'glass' || kind === 'metal')) {
          if (kind === 'glass') {
            mat.transmission = Math.max(base.transmission ?? 0.9, 0.94);
            mat.clearcoat = Math.max(base.clearcoat ?? 0.18, 0.24);
            mat.clearcoatRoughness = Math.min(base.clearcoatRoughness ?? 0.08, 0.05);
            mat.roughness = Math.max((base.roughness ?? 0.08) * 0.8, 0.04);
            mat.envMapIntensity = Math.max(base.envMapIntensity ?? 1.6, 1.95);
            if ('specularIntensity' in mat) mat.specularIntensity = Math.max(base.specularIntensity ?? 0.6, 1.0);
          }
          if (kind === 'metal') {
            mat.clearcoat = Math.max(base.clearcoat ?? 0.24, 0.32);
            mat.clearcoatRoughness = Math.min(base.clearcoatRoughness ?? 0.08, 0.05);
            mat.roughness = Math.max((base.roughness ?? 0.12) * 0.78, 0.06);
            mat.metalness = Math.min(Math.max(base.metalness ?? 0.96, 0.98), 1.0);
            mat.envMapIntensity = Math.max(base.envMapIntensity ?? 2.35, 2.75);
            if ('specularIntensity' in mat) mat.specularIntensity = Math.max(base.specularIntensity ?? 0.8, 1.05);
          }
        } else {
          mat.roughness = base.roughness;
          mat.metalness = base.metalness;
          mat.clearcoat = base.clearcoat;
          mat.clearcoatRoughness = base.clearcoatRoughness;
          mat.transmission = base.transmission;
          mat.envMapIntensity = base.envMapIntensity;
          if ('specularIntensity' in mat && base.specularIntensity != null) mat.specularIntensity = base.specularIntensity;
        }
        applyReflectiveMaterialProfile(mat);
        mat.needsUpdate = true;
      });
    });
  }
}
function updatePointLightPosition(){
  const dir = camera.getWorldDirection(new THREE.Vector3()).normalize();
  const up = camera.up.clone().normalize();
  const right = new THREE.Vector3().crossVectors(dir, up).normalize();
  const base = camera.position.clone().addScaledVector(dir, 0.92);
  const offsets = [
    { x: 0.00, y: 0.00, z: 0.00 },
    { x: 0.12, y: 0.06, z: 0.03 },
    { x: -0.12, y: 0.06, z: 0.03 },
    { x: 0.12, y: -0.06, z: 0.03 },
    { x: -0.12, y: -0.06, z: 0.03 },
    { x: 0.22, y: 0.00, z: 0.05 },
    { x: -0.22, y: 0.00, z: 0.05 },
    { x: 0.00, y: 0.14, z: 0.04 },
    { x: 0.00, y: -0.14, z: 0.04 }
  ];
  const weights = [0.18, 0.13, 0.13, 0.13, 0.13, 0.09, 0.09, 0.06, 0.06];
  pointLights.forEach((light, i) => {
    const off = offsets[i] || offsets[0];
    const weight = weights[i] || weights[0];
    light.position.copy(base)
      .addScaledVector(right, off.x)
      .addScaledVector(up, off.y)
      .addScaledVector(dir, off.z);
    light.distance = 7.2;
    light.intensity = state.pointLightOn ? state.pointLightIntensity * 9.5 * weight : 0;
    light.visible = state.pointLightOn;
  });
}
function syncPointLightIntensity(v){
  const next = THREE.MathUtils.clamp(Number(v) || 0, 0, 5);
  state.pointLightIntensity = next;
  qs('#pointLightIntensity').value = qs('#pointLightIntensityNum').value = fmt(next);
  if (state.pointLightOn) updatePointLightPosition();
}
function syncPointLightButton(){
  const btn = qs('#pointLightToggle');
  btn.classList.toggle('active', state.pointLightOn);
  btn.textContent = state.pointLightOn ? '포인트 끄기' : '포인트 켜기';
}
function setPointLightEnabled(on, showToast = true){
  state.pointLightOn = !!on;
  updatePointLightPosition();
  applyPointLightMaterialBoost(state.pointLightOn);
  syncPointLightButton();
  if (showToast) toast(state.pointLightOn ? '포인트 켬' : '포인트 끔');
}
qs('#pointLightToggle').onclick = () => setPointLightEnabled(!state.pointLightOn, true);
qs('#pointLightIntensity').addEventListener('input', e => syncPointLightIntensity(parseFloat(e.target.value)));
qs('#pointLightIntensityNum').addEventListener('input', e => syncPointLightIntensity(parseFloat(e.target.value)));
function syncRimLightIntensity(v){
  const next = THREE.MathUtils.clamp(Number(v) || 0, 0, 2);
  state.rimLightIntensity = next;
  rimLight.intensity = state.rimLightOn ? next : 0;
  qs('#rimLightIntensity').value = qs('#rimLightIntensityNum').value = fmt(next);
}
function syncRimLightButton(){
  const btn = qs('#rimLightToggle');
  btn.classList.toggle('active', state.rimLightOn);
  btn.textContent = state.rimLightOn ? '반사광 끄기' : '반사광 켜기';
}
function setRimLightEnabled(on, showToast = true){
  state.rimLightOn = !!on;
  rimLight.intensity = state.rimLightOn ? state.rimLightIntensity : 0;
  syncRimLightButton();
  if (showToast) toast(state.rimLightOn ? '반사광 켬' : '반사광 끔');
}
qs('#rimLightToggle').onclick = () => setRimLightEnabled(!state.rimLightOn, true);
qs('#rimLightIntensity').addEventListener('input', e => syncRimLightIntensity(parseFloat(e.target.value)));
qs('#rimLightIntensityNum').addEventListener('input', e => syncRimLightIntensity(parseFloat(e.target.value)));
function updateReflectionCapture(){
  const visibleModels = state.models.filter(m => m.visible);
  if (!visibleModels.length) return;
  const box = new THREE.Box3();
  visibleModels.forEach(m => box.expandByObject(m.object));
  if (box.isEmpty()) return;
  const center = new THREE.Vector3();
  box.getCenter(center);
  const prevGuides = selectionGuides.visible;
  const prevX = rotateHandleX.visible;
  const prevY = rotateHandleY.visible;
  const prevZ = rotateHandleZ.visible;
  const prevGX = moveGuideX.visible;
  const prevGY = moveGuideY.visible;
  const prevGZ = moveGuideZ.visible;
  selectionGuides.visible = false;
  rotateHandleX.visible = false;
  rotateHandleY.visible = false;
  rotateHandleZ.visible = false;
  moveGuideX.visible = false;
  moveGuideY.visible = false;
  moveGuideZ.visible = false;
  reflectionCubeCamera.position.copy(center);
  reflectionCubeCamera.update(renderer, scene);
  selectionGuides.visible = prevGuides;
  rotateHandleX.visible = prevX;
  rotateHandleY.visible = prevY;
  rotateHandleZ.visible = prevZ;
  moveGuideX.visible = prevGX;
  moveGuideY.visible = prevGY;
  moveGuideZ.visible = prevGZ;
}
function syncLightAngle(v){
  const angle = ((Number(v) % 360) + 360) % 360;
  updateLightFromOrbit(angle, dirLight.position.y, DEFAULT_LIGHT.radius);
  qs('#lightAngleRange').value = qs('#lightAngleNum').value = fmt(angle);
}
function syncLightHeight(v){
  updateLightFromOrbit(currentLightAngle(), Number(v), DEFAULT_LIGHT.radius);
  qs('#lightHeightRange').value = qs('#lightHeightNum').value = fmt(v);
}
function syncIntensity(v){ dirLight.intensity = Number(v); qs('#lightIntensity').value = qs('#lightIntensityNum').value = fmt(v); }
qs('#lightAngleRange').addEventListener('input', e => syncLightAngle(parseFloat(e.target.value)));
qs('#lightAngleNum').addEventListener('input', e => syncLightAngle(parseFloat(e.target.value)));
qs('#lightHeightRange').addEventListener('input', e => syncLightHeight(parseFloat(e.target.value)));
qs('#lightHeightNum').addEventListener('input', e => syncLightHeight(parseFloat(e.target.value)));
qs('#lightIntensity').addEventListener('input', e => syncIntensity(parseFloat(e.target.value)));
qs('#lightIntensityNum').addEventListener('input', e => syncIntensity(parseFloat(e.target.value)));
qs('#resetLight').onclick = () => { syncLightAngle(DEFAULT_LIGHT.angle); syncLightHeight(DEFAULT_LIGHT.height); syncIntensity(DEFAULT_LIGHT.intensity); toast('조명 초기화'); };

qs('#projBtn').onclick = () => {
  const target = controls.target.clone();
  const oldPos = camera.position.clone();
  controls.dispose();
  if (state.projection === 'perspective') { state.projection = 'orthographic'; camera = orthoCam; qs('#projLabel').textContent = '정투시'; qs('#projBtn').classList.add('active'); }
  else { state.projection = 'perspective'; camera = perspectiveCam; qs('#projLabel').textContent = '원근'; qs('#projBtn').classList.remove('active'); }
  camera.position.copy(oldPos);
  controls = new OrbitControls(camera, renderer.domElement); applyControls(); controls.target.copy(target); controls.update(); syncControlMode();
  toast(state.projection === 'perspective' ? '원근 모드' : '정투시 모드');
};

function isFullscreen(){
  return !!(document.fullscreenElement || document.webkitFullscreenElement);
}

async function toggleFullscreen(){
  try {
    if (!isFullscreen()) {
      const el = document.documentElement;
      if (el.requestFullscreen) await el.requestFullscreen();
      else if (el.webkitRequestFullscreen) el.webkitRequestFullscreen();
      else throw new Error('fullscreen-unsupported');
    } else {
      if (document.exitFullscreen) await document.exitFullscreen();
      else if (document.webkitExitFullscreen) document.webkitExitFullscreen();
      else throw new Error('fullscreen-unsupported');
    }
  } catch (err) {
    console.error(err);
    toast('전체화면을 지원하지 않는 브라우저입니다');
  }
}

function syncFullscreenButton(){
  qs('#fsBtn').classList.toggle('active', isFullscreen());
}

qs('#fsBtn').onclick = toggleFullscreen;
document.addEventListener('fullscreenchange', syncFullscreenButton);
document.addEventListener('webkitfullscreenchange', syncFullscreenButton);

async function captureScene(){
  const panel = qs('#panel');
  const topbar = qs('#topbar');
  const toasts = qs('#toasts');
  const loading = qs('#loading');
  const empty = qs('#empty');
  const prev = {
    panel: panel.style.display,
    topbar: topbar.style.display,
    toasts: toasts.style.display,
    loading: loading.style.display,
    empty: empty.style.display,
    badge: qs('#dragBadge').style.display
  };
  panel.style.display = 'none';
  topbar.style.display = 'none';
  toasts.style.display = 'none';
  loading.style.display = 'none';
  empty.style.display = 'none';
  await new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r)));
  try {
    const link = document.createElement('a');
    const stamp = new Date().toISOString().replace(/[:.]/g,'-');
    link.href = renderer.domElement.toDataURL('image/png');
    link.download = `btob-art-scene-${stamp}.png`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    toast('장면 캡처 완료');
  } catch (err) {
    console.error(err);
    toast('장면 캡처 실패');
  } finally {
    panel.style.display = prev.panel;
    topbar.style.display = prev.topbar;
    toasts.style.display = prev.toasts;
    loading.style.display = prev.loading;
    empty.style.display = prev.empty;
    qs('#dragBadge').style.display = prev.badge;
  }
}
qs('#captureBtn').onclick = captureScene;
qs('#panelBtn').onclick = () => qs('#panel').classList.toggle('collapsed');
qs('#handle').onclick = () => qs('#panel').classList.toggle('collapsed');
qsa('.tab').forEach(tab => tab.onclick = () => { qsa('.tab').forEach(t => t.classList.toggle('active', t === tab)); qsa('.pane').forEach(p => p.classList.toggle('active', p.id === 'pane-' + tab.dataset.tab)); });

qs('#addBtn').onclick = () => qs('#fileInput').click();
qs('#fileInput').addEventListener('change', async (e) => {
  const files = [...(e.target.files || [])];
  for (const f of files){ const ext = getExt(f.name); if (!['glb','gltf','obj','stl','fbx'].includes(ext)) { toast(`지원하지 않는 형식: .${ext}`); continue; } await loadFile(f); }
  e.target.value = '';
});
['dragenter','dragover','dragleave','drop'].forEach(type => window.addEventListener(type, e => { e.preventDefault(); e.stopPropagation(); }, false));
window.addEventListener('drop', async (e) => { const files = [...(e.dataTransfer?.files || [])]; for (const f of files){ const ext = getExt(f.name); if (!['glb','gltf','obj','stl','fbx'].includes(ext)) { toast(`지원하지 않는 형식: .${ext}`); continue; } await loadFile(f); } });


function getLightState(){
  return { angle: currentLightAngle(), height: dirLight.position.y, radius: DEFAULT_LIGHT.radius, x: dirLight.position.x, y: dirLight.position.y, z: dirLight.position.z, intensity: dirLight.intensity, pointLightOn: state.pointLightOn, rimLightOn: state.rimLightOn, pointLightIntensity: state.pointLightIntensity, rimLightIntensity: state.rimLightIntensity };
}

function sanitizePresetName(name){
  const base = String(name || 'scene-preset').trim().replace(/\s+/g,'-').replace(/[^\w\-가-힣]+/g,'-').replace(/-+/g,'-').replace(/^-|-$/g,'');
  return base || 'scene-preset';
}

function serializePreset({ shareableOnly=true } = {}){
  const skippedLocal = state.models.filter(m => m.source?.type !== 'url').length;
  const models = state.models
    .filter(m => !shareableOnly || m.source?.type === 'url')
    .map(m => ({
      name: m.name,
      ext: m.ext,
      url: m.source?.url || '',
      visible: m.visible,
      materialMode: m.materialMode || 'default',
      defaultMaterialMode: m.defaultMaterialMode || 'default',
      materialSettings: JSON.parse(JSON.stringify(normalizeMaterialSettings(m.materialSettings || defaultMaterialSettings()))),
      defaultMaterialSettings: JSON.parse(JSON.stringify(normalizeMaterialSettings(m.defaultMaterialSettings || defaultMaterialSettings()))),
      transform: JSON.parse(JSON.stringify(m.transform))
    }))
    .filter(m => !!m.url);
  return {
    version: 1,
    app: 'btob-art-viewer',
    savedAt: new Date().toISOString(),
    theme: state.theme,
    projection: state.projection,
    floorMode: state.floorMode,
    showGrid: state.showGrid,
    light: getLightState(),
    models,
    meta: { skippedLocalModels: skippedLocal }
  };
}

function encodePresetData(data){
  const json = JSON.stringify(data);
  const bytes = new TextEncoder().encode(json);
  let binary = '';
  bytes.forEach(b => binary += String.fromCharCode(b));
  return btoa(binary).replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/,'');
}

function decodePresetData(encoded){
  const base = String(encoded).replace(/-/g,'+').replace(/_/g,'/');
  const padded = base + '='.repeat((4 - base.length % 4) % 4);
  const binary = atob(padded);
  const bytes = Uint8Array.from(binary, ch => ch.charCodeAt(0));
  return JSON.parse(new TextDecoder().decode(bytes));
}

function downloadTextFile(filename, text, type='application/json;charset=utf-8'){
  const blob = new Blob([text], { type });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 500);
}

async function loadPresetFromUrl(url){
  const resolved = new URL(String(url).trim(), location.href).href;
  const res = await fetch(resolved, { cache:'no-store' });
  if (!res.ok) throw new Error(`프리셋을 불러오지 못했습니다 (${res.status})`);
  return await res.json();
}

async function applyPreset(preset, { clearExisting=true, toastMessage='프리셋 로드 완료' } = {}){
  if (!preset || !Array.isArray(preset.models)) throw new Error('올바른 프리셋 형식이 아닙니다');
  if (clearExisting) clearAllModels();
  state.theme = preset.theme === 'dark' ? 'dark' : 'light';
  applyTheme();
  qs('#themeBtn').classList.toggle('active', state.theme === 'light');
  const presetFloorMode = ['white','grid','none'].includes(preset.floorMode)
    ? preset.floorMode
    : (typeof preset.showGrid === 'boolean' ? (preset.showGrid ? 'grid' : 'none') : 'white');
  setFloorMode(presetFloorMode, false);
  const light = preset.light || {};
  const nextAngle = Number.isFinite(light.angle) ? light.angle : ((Number.isFinite(light.x) || Number.isFinite(light.z)) ? ((THREE.MathUtils.radToDeg(Math.atan2(light.z || 0, light.x || DEFAULT_LIGHT.radius)) % 360) + 360) % 360 : DEFAULT_LIGHT.angle);
  const nextHeight = Number.isFinite(light.height) ? light.height : (Number.isFinite(light.y) ? light.y : DEFAULT_LIGHT.height);
  syncLightAngle(nextAngle);
  syncLightHeight(nextHeight);
  syncIntensity(Number.isFinite(light.intensity) ? light.intensity : DEFAULT_LIGHT.intensity);
  syncPointLightIntensity(Number.isFinite(light.pointLightIntensity) ? light.pointLightIntensity : state.pointLightIntensity);
  syncRimLightIntensity(Number.isFinite(light.rimLightIntensity) ? light.rimLightIntensity : state.rimLightIntensity);
  setPointLightEnabled(!!light.pointLightOn, false);
  setRimLightEnabled(light.rimLightOn !== false, false);
  const desiredProjection = preset.projection === 'orthographic' ? 'orthographic' : 'perspective';
  if (desiredProjection !== state.projection) qs('#projBtn').click();
  for (const item of preset.models) {
    if (!item?.url) continue;
    await loadRemoteModel(item.url, {
      name: item.name || modelNameFromUrl(item.url),
      transform: normalizeTransform(item.transform),
      materialMode: item.materialMode || item.defaultMaterialMode || 'default',
      defaultMaterialMode: item.defaultMaterialMode || item.materialMode || 'default',
      materialSettings: item.materialSettings || null,
      defaultMaterialSettings: item.defaultMaterialSettings || item.materialSettings || null,
      visible: item.visible !== false,
      selectOnLoad: false,
      fitOnLoad: false,
      toastOnLoad: false
    });
  }
  if (state.models.length) {
    const first = state.models.find(m => m.visible) || state.models[0];
    if (first) selectModel(first.id, false);
    fitScene();
  } else {
    clearSelection();
  }
  setDragMode('off');
  if (toastMessage) toast(toastMessage);
}

async function bootScene(){
  const url = new URL(location.href);
  try {
    if (url.searchParams.get('presetData')) {
      const preset = decodePresetData(url.searchParams.get('presetData'));
      await applyPreset(preset, { toastMessage:'공유 장면 자동 로드 완료' });
      return;
    }
    const remotePreset = url.searchParams.get('preset') || url.searchParams.get('scene');
    if (remotePreset) {
      const preset = await loadPresetFromUrl(remotePreset);
      await applyPreset(preset, { toastMessage:'프리셋 자동 로드 완료' });
      return;
    }
    const saved = localStorage.getItem('btob-default-preset');
    if (saved) {
      await applyPreset(JSON.parse(saved), { toastMessage:'기기 시작 장면 로드 완료' });
    }
  } catch (err) {
    console.error(err);
    toast(err.message || '자동 프리셋 로드 실패');
  }
}

let brandTapCount = 0;
let brandTapTimer = null;
qs('#brandTap').addEventListener('click', () => {
  brandTapCount += 1;
  clearTimeout(brandTapTimer);
  brandTapTimer = setTimeout(() => { brandTapCount = 0; }, 1400);
  if (brandTapCount >= 6) {
    brandTapCount = 0;
    qs('#presetPanel').classList.toggle('show');
    toast(qs('#presetPanel').classList.contains('show') ? '프리셋 관리자 열림' : '프리셋 관리자 닫힘');
  }
});
qs('#presetCloseBtn').onclick = () => qs('#presetPanel').classList.remove('show');
qs('#clearRemoteFieldBtn').onclick = () => { qs('#remoteModelUrls').value = ''; };
qs('#loadRemoteBtn').onclick = async () => {
  const urls = qs('#remoteModelUrls').value.split(/\n+/).map(v => v.trim()).filter(Boolean);
  if (!urls.length) return toast('소재 URL을 입력하세요');
  for (const item of urls) {
    try { await loadRemoteModel(item); } catch (err) {}
  }
};
qs('#downloadPresetBtn').onclick = () => {
  const preset = serializePreset({ shareableOnly:true });
  if (!preset.models.length) return toast('공유 가능한 공개 URL 소재가 없습니다');
  if (preset.meta.skippedLocalModels) toast(`로컬 업로드 소재 ${preset.meta.skippedLocalModels}개는 공유 프리셋에서 제외되었습니다`);
  const filename = `${sanitizePresetName(qs('#presetName').value || 'scene-preset')}.json`;
  downloadTextFile(filename, JSON.stringify(preset, null, 2));
};
qs('#loadPresetFileBtn').onclick = () => qs('#presetFileInput').click();
qs('#presetFileInput').addEventListener('change', async (e) => {
  const file = e.target.files?.[0];
  if (!file) return;
  try {
    const preset = JSON.parse(await file.text());
    await applyPreset(preset);
  } catch (err) {
    console.error(err);
    toast('프리셋 파일을 읽지 못했습니다');
  }
  e.target.value = '';
});
qs('#copyPresetLinkBtn').onclick = async () => {
  const preset = serializePreset({ shareableOnly:true });
  if (!preset.models.length) return toast('공유 가능한 공개 URL 소재가 없습니다');
  if (preset.meta.skippedLocalModels) toast(`로컬 업로드 소재 ${preset.meta.skippedLocalModels}개는 링크에서 제외되었습니다`);
  const url = new URL(location.href);
  url.searchParams.delete('preset');
  url.searchParams.delete('scene');
  url.searchParams.set('presetData', encodePresetData(preset));
  try {
    await navigator.clipboard.writeText(url.toString());
    toast('공유 링크가 복사되었습니다');
  } catch {
    prompt('아래 링크를 복사하세요', url.toString());
  }
};
qs('#saveDefaultPresetBtn').onclick = () => {
  const preset = serializePreset({ shareableOnly:true });
  if (!preset.models.length) return toast('공개 URL 소재가 있어야 시작 장면으로 저장할 수 있습니다');
  localStorage.setItem('btob-default-preset', JSON.stringify(preset));
  toast('이 기기의 시작 장면으로 저장되었습니다');
};
qs('#clearDefaultPresetBtn').onclick = () => {
  localStorage.removeItem('btob-default-preset');
  toast('기기 시작 장면이 삭제되었습니다');
};
qs('#copyPresetPathBtn').onclick = async () => {
  const base = new URL(location.href);
  base.search = '';
  base.hash = '';
  const sample = `${base.origin}${base.pathname}?preset=/presets/class-a.json`;
  try {
    await navigator.clipboard.writeText(sample);
    toast('Netlify 프리셋 경로 예시가 복사되었습니다');
  } catch {
    prompt('아래 경로 예시를 복사하세요', sample);
  }
};
qs('#loadPresetUrlBtn').onclick = async () => {
  const value = qs('#presetUrlInput').value.trim();
  if (!value) return toast('프리셋 URL을 입력하세요');
  try {
    const preset = await loadPresetFromUrl(value);
    await applyPreset(preset);
  } catch (err) {
    console.error(err);
    toast(err.message || '프리셋 URL 로드 실패');
  }
};

renderer.domElement.addEventListener('touchmove', e => e.preventDefault(), { passive:false });
applyTheme(); qs('#themeBtn').classList.toggle('active', state.theme === 'light'); setFloorMode(state.floorMode, false); syncLightAngle(DEFAULT_LIGHT.angle); syncLightHeight(DEFAULT_LIGHT.height); syncIntensity(DEFAULT_LIGHT.intensity); syncPointLightIntensity(state.pointLightIntensity); syncRimLightIntensity(state.rimLightIntensity); setPointLightEnabled(state.pointLightOn, false); setRimLightEnabled(state.rimLightOn, false); syncFloorPlacementButton(); syncPerspectiveBoxButton(); syncFullscreenButton(); setEmpty(); renderList(); updateTextureUI(); refreshSelectedMaterialSliders(); bootScene();

(function loop(){ requestAnimationFrame(loop); controls.update(); if (state.pointLightOn) updatePointLightPosition(); if ((state.reflectionTick++ % 2) === 0) updateReflectionCapture(); renderer.render(scene, camera); })();
