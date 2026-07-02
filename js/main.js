/* ============================================================
   main.js — "Inside the Developer's PC" · orbital choreography
   ------------------------------------------------------------
   PHASE → SCROLL-RANGE MAP (fractions of the 650vh track; tune here)

     PHASE 1  INTRO HOLD   0.00 – 0.08
              camera static behind the developer (orbit angle 0);
              intro text fades out over 0.02 – 0.08
     PHASE 2  ORBIT        0.08 – 0.22
             camera sweeps ORBIT_SWEEP (270° on all devices)
             around the developer at CONSTANT radius ORBIT_R;
              height rises ORBIT_H0 → ORBIT_H1 (~10%); no zoom;
              lookAt fixed on head/monitor midpoint (LOOK_ORBIT)
     PHASE 3  PAUSE+DIVE   0.22 – 0.32
              0.22–0.24 dead still (intentional beat);
              0.24–0.27 rise to over-shoulder point;
              0.27–0.32 plunge into the screen, lookAt lerps to
              SCREEN_C; FOV 75 → 90 across 0.24–0.32;
              0.30–0.32 crossfade 3D → HTML #os-desktop
     PHASE 4  ABOUT        0.32 – 0.44
              desktop scales 1→1.15 + about-me/ goes gold while the
              window fades in (photo staggers in ~0.15s before text);
              hold 0.36–0.42; zoom-out 0.42–0.444 (0.6× in-duration)
     PHASE 5  PROJECTS     0.44 – 0.84
              ONE ~/projects/ window holds all 3 projects;
              window zooms in 0.44–0.49, then the entries reveal
              one by one (0.46 / 0.55 / 0.64) as scroll continues;
              hold until 0.80; zoom-out 0.80–0.84 leads straight
              into contact
     PHASE 6  CONTACT      0.84 – 1.00
              terminal window in 0.84–0.88; scrubbed typewriter
              0.88–0.96 (reversing scroll untypes it); CTAs + footer
              0.96–0.985; end state persists to 1.0

   NAV JUMPS  About → 0.36 · Work → 0.46 · Contact/Start → 0.86
              (data-progress attributes in index.html)

   The rAF loop is independent of scroll: dust drift, dev breathing,
   hand sin-wave over the keyboard, code lines scrolling on the 3D
   screen texture, monitor light flicker (±5%), lamp glow breathing.

   prefers-reduced-motion → body.reduced-motion: no ScrollTriggers,
   no rAF; one static frame; sections stack as a normal document.
   ============================================================ */

import * as THREE from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import { DRACOLoader } from "three/addons/loaders/DRACOLoader.js";
import { gsap } from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { ScrollToPlugin } from "gsap/ScrollToPlugin";

gsap.registerPlugin(ScrollTrigger, ScrollToPlugin);

/* ================== Tunables ================== */

const isMobile = window.innerWidth < 768;
const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

// Single source of truth for nav jumps — scroll progress where each
// scene is FULLY open and readable. Tune here.
const SCENES = { top: 0, about: 0.38, work: 0.70, contact: 0.99 };

const ORBIT_R = 6.2;                       // constant orbit radius — never changes mid-orbit
const ORBIT_H0 = 3.0;                      // orbit height start
const ORBIT_H1 = 3.3;                      // orbit height end (~10% rise)
const ORBIT_SWEEP = 270 * (Math.PI / 180); // full 270° arc on all devices; only rendering cost (particles/shadows/pixelRatio) is reduced on mobile
const FOV_BASE = 75;
const FOV_DIVE = 90;

const DEV_PIVOT = { x: 0, z: 0.4 };        // orbit center (developer)
const LOOK_ORBIT = new THREE.Vector3(0, 2.72, -0.55); // head/monitor midpoint
const SCREEN_C = new THREE.Vector3(0, 2.85, -1.545);  // monitor screen center
const OVER_SHOULDER = { x: 0.7, y: 3.55, z: 2.5 };    // dive waypoint
const CAM_IN = { x: 0, y: 2.85, z: -0.72 };           // final in-screen position

const GOLD = 0xc9a961;
const DUST_COUNT = isMobile ? 10 : 25;
const SHADOWS = !isMobile;
const HAND_Y = 2.06;
const DRACO_PATH = "https://cdn.jsdelivr.net/npm/three@0.185.1/examples/jsm/libs/draco/gltf/";

function resolveAssetUrl(relativePath) {
  // Resolve from js/main.js so paths stay correct on GitHub Pages (Linux, case-sensitive).
  return new URL(relativePath, import.meta.url).href;
}

const AVATAR_URL = resolveAssetUrl("../assets/avatar.glb");
const TYPING_URL = resolveAssetUrl("../assets/Typing.glb");

/* ================== Renderer / scene / camera ================== */

const host = document.getElementById("webgl");

const renderer = new THREE.WebGLRenderer({ antialias: !isMobile });
renderer.setPixelRatio(isMobile ? 1 : Math.min(window.devicePixelRatio, 2));
renderer.setSize(window.innerWidth, window.innerHeight);
if (SHADOWS) {
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFShadowMap; // PCFSoft deprecated in r180+
}
host.appendChild(renderer.domElement);

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x0a0a0a);
scene.fog = new THREE.Fog(0x0a0a0a, 9, 22);

const camera = new THREE.PerspectiveCamera(
  FOV_BASE,
  window.innerWidth / window.innerHeight,
  0.05,
  60
);

/* ================== Lighting ================== */

scene.add(new THREE.AmbientLight(0xffffff, 0.15));

// Monitor glow — the main light source (cool white-cyan)
const MONITOR_BASE = 30;
const monitorLight = new THREE.PointLight(0xbfe8ff, MONITOR_BASE, 12, 2);
monitorLight.position.set(0, 2.7, -1.2);
if (SHADOWS) {
  monitorLight.castShadow = true;
  monitorLight.shadow.mapSize.set(2048, 2048);
  monitorLight.shadow.bias = -0.004;
}
scene.add(monitorLight);

// Warm gold desk-lamp accent — brand color
const lampLight = new THREE.PointLight(GOLD, 8, 7, 2);
lampLight.position.set(-2.1, 2.9, -1.1);
scene.add(lampLight);

// Faint cool fill so the room never reads pure black
const fill = new THREE.DirectionalLight(0x8899aa, 0.12);
fill.position.set(2, 6, 8);
scene.add(fill);

/* ================== Helpers ================== */

const shadowed = (m) => { m.castShadow = SHADOWS; m.receiveShadow = SHADOWS; return m; };
const darkMat = (color, rough = 0.6, metal = 0.2) =>
  new THREE.MeshStandardMaterial({ color, roughness: rough, metalness: metal });

/* ================== Room ================== */

const floor = new THREE.Mesh(
  new THREE.PlaneGeometry(40, 40),
  new THREE.MeshStandardMaterial({ color: 0x101014, roughness: 0.85, metalness: 0.3 })
);
floor.rotation.x = -Math.PI / 2;
floor.receiveShadow = SHADOWS;
scene.add(floor);

const grid = new THREE.GridHelper(40, 40, 0x22222a, 0x17171d);
grid.position.y = 0.002;
scene.add(grid);

const wallMat = new THREE.MeshStandardMaterial({ color: 0x0e0e12, roughness: 0.95 });
const backWall = new THREE.Mesh(new THREE.PlaneGeometry(40, 14), wallMat);
backWall.position.set(0, 7, -6);
scene.add(backWall);

const sideWall = new THREE.Mesh(new THREE.PlaneGeometry(40, 14), wallMat);
sideWall.rotation.y = Math.PI / 2;
sideWall.position.set(-7, 7, 0);
scene.add(sideWall);

/* ================== Desk (wood, side panels, pad) ================== */

// Shared materials — reused across meshes to keep draw state light
const woodMat = new THREE.MeshStandardMaterial({ color: 0x2c2018, roughness: 0.7, metalness: 0.08 });
const bezelMat = darkMat(0x0c0c10, 0.35, 0.6);
const plasticMat = darkMat(0x111118, 0.5, 0.35);
const padMat = darkMat(0x14141a, 0.9, 0.0);
const charcoal = new THREE.MeshStandardMaterial({ color: 0x1c1c1e, roughness: 0.85, metalness: 0.05 });
const chairMat = darkMat(0x101014, 0.7, 0.1);

// Top slab + inset lower slab = thickness bevel
const deskTop = shadowed(new THREE.Mesh(new THREE.BoxGeometry(4.6, 0.1, 2.1), woodMat));
deskTop.position.set(0, 1.92, -1.1);
scene.add(deskTop);

const deskBevel = shadowed(new THREE.Mesh(new THREE.BoxGeometry(4.44, 0.07, 1.96), woodMat));
deskBevel.position.set(0, 1.835, -1.1);
scene.add(deskBevel);

// Two side panels instead of legs
[-2.2, 2.2].forEach((x) => {
  const panel = shadowed(new THREE.Mesh(new THREE.BoxGeometry(0.08, 1.8, 1.9), woodMat));
  panel.position.set(x, 0.9, -1.1);
  scene.add(panel);
});

// Desk mat under keyboard + mouse
const deskPad = shadowed(new THREE.Mesh(new THREE.BoxGeometry(2.1, 0.015, 0.95), padMat));
deskPad.position.set(0.2, 1.978, -0.55);
scene.add(deskPad);

/* ================== Monitors ================== */

// Code texture shared by both screens.
// FIX 1: screens use MeshBasicMaterial — immune to scene lights, so no
// specular hot spot can ever wash them out. The room glow comes from
// monitorLight (at the screen, facing outward), not from the material.
const { texture: codeTexture, draw: drawCode, setMonitorCode } = makeCodeTexture();

const monitorGroup = new THREE.Group();
monitorGroup.position.set(0, 1.97, -1.6);
scene.add(monitorGroup);

const standBase = shadowed(new THREE.Mesh(new THREE.CylinderGeometry(0.34, 0.38, 0.05, 24), bezelMat));
standBase.scale.x = 1.45; // ellipse base
standBase.position.y = 0.025;
monitorGroup.add(standBase);

const neck = shadowed(new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.5, 0.08), bezelMat));
neck.position.y = 0.28;
monitorGroup.add(neck);

// Slim bezel
const frame = shadowed(new THREE.Mesh(new THREE.BoxGeometry(2.24, 1.34, 0.05), bezelMat));
frame.position.y = 0.88;
monitorGroup.add(frame);

// Subtle logo dot on the bottom bezel
const logoDot = new THREE.Mesh(
  new THREE.CircleGeometry(0.016, 12),
  new THREE.MeshStandardMaterial({ color: GOLD, emissive: GOLD, emissiveIntensity: 0.5 })
);
logoDot.position.set(0, -0.635, 0.03);
frame.add(logoDot);

const screen = new THREE.Mesh(
  new THREE.PlaneGeometry(2.14, 1.24),
  new THREE.MeshBasicMaterial({ map: codeTexture, toneMapped: false })
);
screen.position.set(0, 0.88, 0.03);
monitorGroup.add(screen);

// Second smaller monitor, angled ~20° toward the developer
const mon2 = new THREE.Group();
mon2.position.set(1.62, 1.97, -1.35);
mon2.rotation.y = -0.35;
scene.add(mon2);

const mon2Base = shadowed(new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.24, 0.04, 20), bezelMat));
mon2Base.scale.x = 1.4;
mon2Base.position.y = 0.02;
mon2.add(mon2Base);

const mon2Neck = shadowed(new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.34, 0.07), bezelMat));
mon2Neck.position.y = 0.19;
mon2.add(mon2Neck);

const mon2Frame = shadowed(new THREE.Mesh(new THREE.BoxGeometry(1.42, 0.9, 0.05), bezelMat));
mon2Frame.position.y = 0.76;
mon2.add(mon2Frame);

const mon2Screen = new THREE.Mesh(
  new THREE.PlaneGeometry(1.34, 0.82),
  new THREE.MeshBasicMaterial({ map: codeTexture, color: 0x777777, toneMapped: false })
);
mon2Screen.position.set(0, 0.76, 0.03);
mon2.add(mon2Screen);

/* ================== Keyboard + mouse ================== */

// Low-profile board with hinted key rows (4 thin strips, no per-key geo)
const keyboard = shadowed(new THREE.Mesh(new THREE.BoxGeometry(1.5, 0.05, 0.5), plasticMat));
keyboard.position.set(0, 2.01, -0.55);
scene.add(keyboard);

const keyRowMat = darkMat(0x1a1a22, 0.6, 0.2);
for (let r = 0; r < 4; r++) {
  const row = shadowed(new THREE.Mesh(new THREE.BoxGeometry(1.38, 0.018, 0.075), keyRowMat));
  row.position.set(0, 2.045, -0.71 + r * 0.11);
  scene.add(row);
}

// Mouse: low rounded capsule (not a sphere), right of the keyboard
const mouse = shadowed(new THREE.Mesh(new THREE.CapsuleGeometry(0.05, 0.09, 4, 12), plasticMat));
mouse.scale.set(1.1, 1, 0.5);      // local z → world height after rotation
mouse.rotation.x = Math.PI / 2;    // lie along z
mouse.position.set(0.95, 2.02, -0.5);
scene.add(mouse);

/* ================== Accessories: lamp, mug, books ================== */

const lampBase = shadowed(new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.2, 0.05, 16), bezelMat));
lampBase.position.set(-2.0, 2.0, -1.1);
scene.add(lampBase);

const lampArm = shadowed(new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 0.85, 8), bezelMat));
lampArm.position.set(-2.05, 2.4, -1.1);
lampArm.rotation.z = 0.25;
scene.add(lampArm);

const lampShade = new THREE.Mesh(
  new THREE.ConeGeometry(0.16, 0.22, 16, 1, true),
  new THREE.MeshStandardMaterial({
    color: 0x181818, roughness: 0.4, metalness: 0.6,
    emissive: GOLD, emissiveIntensity: 0.9, side: THREE.DoubleSide,
  })
);
lampShade.position.set(-2.16, 2.84, -1.1);
lampShade.rotation.z = 0.5;
scene.add(lampShade);

// Mug: cylinder + torus handle
const mugMat = darkMat(0x2a2118, 0.6, 0.1);
const mug = shadowed(new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.08, 0.18, 16), mugMat));
mug.position.set(1.32, 2.06, -0.62);
scene.add(mug);

const mugHandle = shadowed(new THREE.Mesh(new THREE.TorusGeometry(0.055, 0.014, 8, 16), mugMat));
mugHandle.position.set(1.41, 2.06, -0.62);
mugHandle.rotation.y = Math.PI / 2;
scene.add(mugHandle);

// Small stack of 2 books beside the lamp
const book1 = shadowed(new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.055, 0.36), darkMat(0x233028, 0.85, 0)));
book1.position.set(-1.35, 2.0, -1.4);
book1.rotation.y = 0.12;
scene.add(book1);

const book2 = shadowed(new THREE.Mesh(new THREE.BoxGeometry(0.44, 0.05, 0.32), darkMat(0x39262a, 0.85, 0)));
book2.position.set(-1.37, 2.052, -1.39);
book2.rotation.y = -0.1;
scene.add(book2);

/* ================== "NajDev <>" green LED sign above the desk ================== */

const signTexture = makeSignTexture("NajDev");
const sign = new THREE.Mesh(
  new THREE.PlaneGeometry(3.3, 0.93),
  new THREE.MeshBasicMaterial({
    map: signTexture,
    transparent: true,
    toneMapped: false,
    depthWrite: false,
    side: THREE.DoubleSide, // stays visible while the camera orbits
  })
);
sign.position.set(0, 5.55, -2.85);
scene.add(sign);

// Soft green wash so the LED reads as a real light source above the desk
const signLight = new THREE.PointLight(0x39ff6a, 5, 7, 2);
signLight.position.set(0, 5.4, -2.5);
scene.add(signLight);

/* ================== Avatar helpers ================== */

function findBone(skeleton, names) {
  const list = Array.isArray(names) ? names : [names];
  for (const name of list) {
    for (const key of [name, `mixamorig:${name}`, `mixamorig${name}`]) {
      const bone = skeleton.getBoneByName(key);
      if (bone) return bone;
    }
  }
  return null;
}

/* Mixamo animation → RPM avatar: strip the "mixamorig_" prefix, keep
   rotation tracks, and rescale the Hips position track (Mixamo rigs are
   in centimeters, the avatar is in meters). */
function wantsTypingPositionTrack(boneName) {
  if (boneName === "Hips") return true;
  // Finger + forearm translation drives visible keypress motion.
  return /ForeArm|Hand/.test(boneName);
}

function retargetMixamoClip(clip, sourceScene, skeleton) {
  const targetHips = findBone(skeleton, "Hips");
  const sourceHips = sourceScene.getObjectByName("mixamorig_Hips");
  const hipsRatio =
    targetHips && sourceHips ? targetHips.position.y / sourceHips.position.y : 0.01;

  const tracks = [];
  for (const track of clip.tracks) {
    const dot = track.name.lastIndexOf(".");
    const rawName = track.name.slice(0, dot);
    const prop = track.name.slice(dot + 1);
    const boneName = rawName.replace(/^mixamorig[_:]?/, "");
    if (!findBone(skeleton, boneName)) continue;

    if (prop === "quaternion") {
      const clone = track.clone();
      clone.name = `${boneName}.quaternion`;
      tracks.push(clone);
    } else if (prop === "position" && wantsTypingPositionTrack(boneName)) {
      const clone = track.clone();
      clone.name = `${boneName}.position`;
      clone.values = clone.values.map((v) => v * hipsRatio);
      tracks.push(clone);
    }
  }
  return new THREE.AnimationClip("typing", clip.duration, tracks);
}

/* Bone-anchored fit: bounding boxes ignore skeleton pose, so we scale
   and place the avatar by its hips/head bones instead. Seat top ~1.34,
   primitive head was at ~2.58. */
function fitAvatarToSeat(root, skeleton) {
  const hips = findBone(skeleton, "Hips");
  const headBone = findBone(skeleton, "Head");
  if (!hips || !headBone) return false;

  // Face the monitor (-Z), back toward the default orbit camera
  root.rotation.y = Math.PI;
  root.scale.setScalar(1);
  root.position.set(0, 0, 0);
  root.updateMatrixWorld(true);

  const hipsPos = new THREE.Vector3();
  const headPos = new THREE.Vector3();
  hips.getWorldPosition(hipsPos);
  headBone.getWorldPosition(headPos);

  const HIPS_TARGET = { x: 0, y: 1.47, z: -0.18 }; // seated, hands over the keyboard
  const HEAD_TARGET_Y = 2.9;                       // slightly above primitive head

  const scale = (HEAD_TARGET_Y - HIPS_TARGET.y) / Math.max(headPos.y - hipsPos.y, 0.01);
  root.scale.setScalar(scale);
  root.position.set(
    HIPS_TARGET.x - hipsPos.x * scale,
    HIPS_TARGET.y - hipsPos.y * scale,
    HIPS_TARGET.z - hipsPos.z * scale
  );
  root.updateMatrixWorld(true);
  return true;
}

function buildPrimitiveSilhouette(charcoal) {
  const group = new THREE.Group();

  const torso = shadowed(new THREE.Mesh(new THREE.CapsuleGeometry(0.24, 0.62, 6, 14), charcoal));
  torso.scale.set(1.25, 1, 0.7);
  torso.position.set(0, 1.86, -0.02);
  torso.rotation.x = -0.14;
  group.add(torso);

  const shoulders = shadowed(new THREE.Mesh(new THREE.CapsuleGeometry(0.09, 0.42, 4, 10), charcoal));
  shoulders.rotation.z = Math.PI / 2;
  shoulders.position.set(0, 2.26, -0.08);
  group.add(shoulders);

  const neckJoint = shadowed(new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.08, 0.14, 10), charcoal));
  neckJoint.position.set(0, 2.4, -0.1);
  group.add(neckJoint);

  const head = shadowed(new THREE.Mesh(new THREE.SphereGeometry(0.17, 20, 16), charcoal));
  head.scale.set(0.95, 1.1, 1.0);
  head.position.set(0, 2.58, -0.12);
  head.rotation.x = -0.18;
  group.add(head);

  const upperArmGeo = new THREE.CapsuleGeometry(0.07, 0.32, 4, 10);
  const forearmGeo = new THREE.CapsuleGeometry(0.06, 0.48, 4, 10);
  [-1, 1].forEach((side) => {
    const upper = shadowed(new THREE.Mesh(upperArmGeo, charcoal));
    upper.position.set(side * 0.31, 2.05, -0.19);
    upper.rotation.x = 0.51;
    upper.rotation.z = side * -0.08;
    group.add(upper);

    const forearm = shadowed(new THREE.Mesh(forearmGeo, charcoal));
    forearm.position.set(side * 0.28, 1.95, -0.59);
    forearm.rotation.x = -1.24;
    group.add(forearm);
  });

  const handGeo = new THREE.BoxGeometry(0.1, 0.05, 0.14);
  const handL = shadowed(new THREE.Mesh(handGeo, charcoal));
  handL.position.set(-0.25, HAND_Y, -0.9);
  group.add(handL);
  const handR = shadowed(new THREE.Mesh(handGeo, charcoal));
  handR.position.set(0.25, HAND_Y, -0.9);
  group.add(handR);

  const hips = shadowed(new THREE.Mesh(new THREE.CapsuleGeometry(0.11, 0.28, 4, 10), charcoal));
  hips.rotation.z = Math.PI / 2;
  hips.position.set(0, 1.38, 0.05);
  group.add(hips);

  const thighGeo = new THREE.CapsuleGeometry(0.1, 0.4, 4, 10);
  const calfGeo = new THREE.CapsuleGeometry(0.075, 1.0, 4, 10);
  const footGeo = new THREE.BoxGeometry(0.15, 0.09, 0.32);
  [-1, 1].forEach((side) => {
    const thigh = shadowed(new THREE.Mesh(thighGeo, charcoal));
    thigh.rotation.x = Math.PI / 2;
    thigh.position.set(side * 0.145, 1.38, -0.25);
    group.add(thigh);

    const calf = shadowed(new THREE.Mesh(calfGeo, charcoal));
    calf.rotation.x = 0.064;
    calf.position.set(side * 0.15, 0.74, -0.56);
    group.add(calf);

    const foot = shadowed(new THREE.Mesh(footGeo, charcoal));
    foot.position.set(side * 0.15, 0.05, -0.72);
    group.add(foot);
  });

  return { group, handL, handR, head };
}

function buildChair(parent) {
  const chair = new THREE.Group();
  parent.add(chair);

  const seat = shadowed(new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.12, 0.85), chairMat));
  seat.position.set(0, 1.28, 0.2);
  chair.add(seat);

  const backrest = shadowed(new THREE.Mesh(new THREE.BoxGeometry(0.85, 1.05, 0.1), chairMat));
  backrest.position.set(0, 1.95, 0.68);
  backrest.rotation.x = 0.12;
  chair.add(backrest);

  const chairPost = shadowed(new THREE.Mesh(new THREE.CylinderGeometry(0.055, 0.055, 1.1, 12), chairMat));
  chairPost.position.set(0, 0.68, 0.2);
  chair.add(chairPost);

  const chairFoot = shadowed(new THREE.Mesh(new THREE.CylinderGeometry(0.42, 0.46, 0.05, 20), chairMat));
  chairFoot.position.set(0, 0.05, 0.2);
  chair.add(chairFoot);

  return chair;
}

function loadGltfAsset(loader, url) {
  return new Promise((resolve, reject) => {
    loader.load(
      url,
      (gltf) => resolve(gltf),
      undefined,
      (error) => {
        console.error("Avatar failed to load:", error.message);
        reject(error);
      }
    );
  });
}

async function loadAvatarFigure(parent, silhouetteGroup) {
  const dracoLoader = new DRACOLoader();
  dracoLoader.setDecoderPath(DRACO_PATH);
  const gltfLoader = new GLTFLoader();
  gltfLoader.setDRACOLoader(dracoLoader);

  try {
    const [avatarGltf, typingGltf] = await Promise.all([
      loadGltfAsset(gltfLoader, AVATAR_URL),
      loadGltfAsset(gltfLoader, TYPING_URL),
    ]);
    const root = avatarGltf.scene;
    let skeleton = null;

    root.traverse((obj) => {
      if (obj.isSkinnedMesh && obj.skeleton && !skeleton) skeleton = obj.skeleton;
      if (!obj.isMesh) return;
      obj.castShadow = SHADOWS;
      obj.receiveShadow = SHADOWS;
      const mats = Array.isArray(obj.material) ? obj.material : [obj.material];
      mats.forEach((mat) => {
        if (mat?.isMeshStandardMaterial) mat.envMapIntensity = 0.35;
      });
    });

    if (!skeleton) {
      console.warn("Avatar GLB has no skeleton — using silhouette fallback");
      return null;
    }

    const sourceClip = typingGltf.animations?.[0];
    if (!sourceClip) {
      console.warn("Typing.glb has no animation — using silhouette fallback");
      return null;
    }

    const clip = retargetMixamoClip(sourceClip, typingGltf.scene, skeleton);
    if (!clip.tracks.length) {
      console.warn("Typing clip retarget produced no tracks — using silhouette fallback");
      return null;
    }

    const mixer = new THREE.AnimationMixer(root);
    const action = mixer.clipAction(clip);
    action.setLoop(THREE.LoopRepeat, Infinity);
    action.timeScale = 1.15;
    action.play();
    mixer.update(0); // apply the seated typing pose before measuring

    if (!fitAvatarToSeat(root, skeleton)) {
      console.warn("Avatar missing Hips/Head bones — using silhouette fallback");
      return null;
    }

    parent.add(root);
    silhouetteGroup.visible = false;

    return { mixer };
  } catch (err) {
    console.error("Avatar failed to load:", err.message);
    return null;
  } finally {
    dracoLoader.dispose();
  }
}

/* ================== Developer — avatar GLB with primitive fallback ================== */

const devGroup = new THREE.Group();
devGroup.position.set(DEV_PIVOT.x, 0, DEV_PIVOT.z);
scene.add(devGroup);

const chairGroup = buildChair(devGroup);

const figureRoot = new THREE.Group();
devGroup.add(figureRoot);

const silhouette = buildPrimitiveSilhouette(charcoal);
figureRoot.add(silhouette.group);

let handL = silhouette.handL;
let handR = silhouette.handR;
let head = silhouette.head;
let avatarRig = null;

// Temporarily load avatar on mobile too (was: desktop-only via !isMobile)
loadAvatarFigure(figureRoot, silhouette.group).then((rig) => {
  if (rig) {
    avatarRig = rig;
    // Tuck the chair forward under the avatar (silhouette uses the default spot)
    chairGroup.position.z = -0.3;
  }
});

/* ================== Dust in the light beam ================== */

const dust = [];
const dustGeo = new THREE.SphereGeometry(0.012, 6, 6);
const DB = { x: 2.4, yMin: 1.6, yMax: 3.6, zMin: -1.5, zMax: 2.2 };
for (let i = 0; i < DUST_COUNT; i++) {
  const p = new THREE.Mesh(
    dustGeo,
    new THREE.MeshBasicMaterial({ color: 0xcfe8f5, transparent: true, opacity: 0.25 + Math.random() * 0.4 })
  );
  p.position.set(
    (Math.random() * 2 - 1) * DB.x,
    DB.yMin + Math.random() * (DB.yMax - DB.yMin),
    DB.zMin + Math.random() * (DB.zMax - DB.zMin)
  );
  p.userData.vel = new THREE.Vector3(
    (Math.random() - 0.5) * 0.05,
    (Math.random() - 0.5) * 0.035,
    (Math.random() - 0.5) * 0.05
  );
  scene.add(p);
  dust.push(p);
}

/* ================== Camera state ================== */

// Everything scrubbed writes into `cam`; applyCamera() pushes to the camera.
const cam = {
  px: 0, py: ORBIT_H0, pz: 0,
  lx: LOOK_ORBIT.x, ly: LOOK_ORBIT.y, lz: LOOK_ORBIT.z,
  fov: FOV_BASE,
};

const orbitPos = (angle, h) => ({
  x: DEV_PIVOT.x + Math.sin(angle) * ORBIT_R,
  y: h,
  z: DEV_PIVOT.z + Math.cos(angle) * ORBIT_R,
});

function applyCamera() {
  camera.position.set(cam.px, cam.py, cam.pz);
  camera.fov = cam.fov;
  camera.updateProjectionMatrix();
  camera.lookAt(cam.lx, cam.ly, cam.lz);
}

// Start: behind the developer (orbit angle 0)
{
  const p0 = orbitPos(0, ORBIT_H0);
  cam.px = p0.x; cam.py = p0.y; cam.pz = p0.z;
  applyCamera();
}

/* ================== DOM refs ================== */

const loader = document.getElementById("loader");
const nav = document.getElementById("site-nav");
const osDesktop = document.getElementById("os-desktop");
const folderGrid = osDesktop.querySelector(".folder-grid");
const layerIntro = document.getElementById("layer-intro");
const layerAbout = document.getElementById("about");
const layerProjects = document.getElementById("work");
let projectItems = [];
const layerContact = document.getElementById("contact");
const photoWrap = layerAbout.querySelector(".photo-wrap");
const aboutText = layerAbout.querySelector(".about-text");
const mePhoto = document.getElementById("me-photo");
const terminalEl = document.getElementById("terminal-output");
const projectsBody = document.getElementById("projects-body");
const wallpaperTrack = document.querySelector(".os-wallpaper-track");
const contactCtas = document.getElementById("contact-ctas");
const contactFooter = document.getElementById("contact-footer");

/* ================== Photo preload (Phase 3 start) ================== */

let photoLoaded = false;
function loadPhoto() {
  if (photoLoaded) return;
  photoLoaded = true;
  mePhoto.src = mePhoto.dataset.src;
}

/* ================== Terminal (scroll-scrubbed typewriter) ================== */

let termLine1 = "";
let termLine2 = "";
let termTotal = 0;
const termState = { chars: 0 };

function renderTerminal() {
  const n = Math.floor(termState.chars);
  const l1 = termLine1.slice(0, Math.min(n, termLine1.length));
  const l2 = n > termLine1.length ? termLine2.slice(0, n - termLine1.length) : "";
  terminalEl.innerHTML =
    `<span class="prompt">${escHtml(l1)}</span>` +
    (l2 ? `\n${escHtml(l2)}` : "") +
    (n < termTotal ? `<span class="caret"></span>` : "");
}

function escHtml(str) {
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function phoneToWhatsApp(phone) {
  const digits = String(phone || "").replace(/\D/g, "");
  return digits ? `https://wa.me/${digits}` : "#";
}

function setupProjectsMobileScroll() {
  if (!isMobile || !projectsBody) return;

  const el = projectsBody;
  let touchY = 0;

  el.addEventListener(
    "touchstart",
    (e) => {
      touchY = e.touches[0].clientY;
    },
    { passive: true }
  );

  el.addEventListener(
    "touchmove",
    (e) => {
      if (el.scrollHeight <= el.clientHeight + 1) return;

      const y = e.touches[0].clientY;
      const goingDown = y < touchY;
      const goingUp = y > touchY;
      touchY = y;

      const atTop = el.scrollTop <= 0;
      const atBottom =
        el.scrollTop + el.clientHeight >= el.scrollHeight - 1;

      if ((goingUp && atTop) || (goingDown && atBottom)) return;

      e.stopPropagation();
    },
    { passive: true }
  );

  el.addEventListener(
    "wheel",
    (e) => {
      if (el.scrollHeight <= el.clientHeight + 1) return;

      const atTop = el.scrollTop <= 0;
      const atBottom =
        el.scrollTop + el.clientHeight >= el.scrollHeight - 1;

      if ((e.deltaY < 0 && atTop) || (e.deltaY > 0 && atBottom)) return;

      e.stopPropagation();
    },
    { passive: true }
  );
}

function slugFromTitle(title) {
  const base = String(title)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 28);
  return `${base || "project"}.sys`;
}

function renderProjectCard(project) {
  const slug = project.slug || slugFromTitle(project.title);
  const primaryHref = project.url || project.github || "";
  const titleHtml = primaryHref
    ? `<h3><a href="${escHtml(primaryHref)}" target="_blank" rel="noopener">${escHtml(project.title)} ↗</a></h3>`
    : `<h3>${escHtml(project.title)}</h3>`;
  const links = [];
  if (project.github) {
    links.push(
      `<a class="project-link" href="${escHtml(project.github)}" target="_blank" rel="noopener">GitHub</a>`
    );
  }
  if (project.url) {
    links.push(
      `<a class="project-link" href="${escHtml(project.url)}" target="_blank" rel="noopener">Live site</a>`
    );
  }
  const linksHtml = links.length
    ? `<div class="project-links">${links.join("")}</div>`
    : "";

  return `
    <article class="project">
      <p class="project-file">${escHtml(slug)}</p>
      ${titleHtml}
      <p>${escHtml(project.description)}</p>
      <div class="chips">${project.stack.map((s) => `<span>${escHtml(s)}</span>`).join("")}</div>
      ${linksHtml}
    </article>`;
}

function formatWallpaper(text) {
  if (!text) return "";
  return escHtml(text)
    .replace(
      /\b(public class|public string|public string\[\]|public|private readonly|const|async|await)\b/g,
      '<span class="g">$1</span>'
    )
    .replace(
      /(Build succeeded\.[^<\n]*|Migrating:[^<\n]*|→ deployed)/g,
      '<span class="g">$1</span>'
    );
}

function setupWallpaper(text) {
  if (!wallpaperTrack) return;
  const html = formatWallpaper(text);
  wallpaperTrack.innerHTML = `<pre class="os-wallpaper-code">${html}</pre>`;
  const first = wallpaperTrack.querySelector(".os-wallpaper-code");
  if (first) wallpaperTrack.appendChild(first.cloneNode(true));
}

function dismissLoader() {
  loader?.classList.add("done");
}

function applyContent(data) {
  const site = data?.site || {};
  const profile = data?.profile || {};
  const about = data?.about || {};
  const contact = data?.contact || {};
  const desktop = data?.desktop || {};

  document.title = profile.name
    ? `${profile.name} — ${profile.title}`
    : "Portfolio";
  document.getElementById("meta-description").content =
    profile.intro || profile.tagline || "";

  const monogram = document.getElementById("nav-monogram");
  if (site.monogram?.includes("·")) {
    const [a, b] = site.monogram.split("·");
    monogram.innerHTML = `${escHtml(a)}<span>·</span>${escHtml(b || "")}`;
  } else {
    monogram.textContent = site.monogram || "H·N";
  }
  document.getElementById("nav-cta").textContent = site.navCta || "Start a project";

  document.getElementById("intro-location").textContent = profile.location;
  document.getElementById("intro-name").textContent = profile.name;
  document.getElementById("intro-title").textContent = profile.title;
  document.getElementById("intro-hint").textContent = site.introHint || "";

  document.getElementById("os-brand").textContent = desktop.brand || "";
  document.getElementById("os-path").textContent = desktop.path || "";
  document.getElementById("os-location").textContent = desktop.location || "";
  setupWallpaper(desktop.wallpaper || "");

  document.getElementById("about-path").textContent = desktop.aboutPath || "~/about-me/";
  document.getElementById("about-heading").textContent = about.heading;
  document.getElementById("about-bio").textContent = about.bio;
  document.getElementById("about-badges").innerHTML = about.badges
    .map((badge) => `<li>${escHtml(badge)}</li>`)
    .join("");
  mePhoto.dataset.src = profile.photo || "assets/me.jpg";
  mePhoto.alt = profile.name
    ? `${profile.name}, ${profile.title}`
    : "Profile photo";

  document.getElementById("projects-path").textContent =
    desktop.projectsPath || "~/projects/";
  const projects = data.projects || [];
  projectsBody.innerHTML = projects.length
    ? projects.map(renderProjectCard).join("")
    : `<p class="project-empty">No projects yet.</p>`;
  projectItems = [...projectsBody.querySelectorAll(".project")];

  document.getElementById("contact-path").textContent =
    desktop.contactTitle || "";
  termLine1 = contact.terminalLine1 || "";
  termLine2 = contact.terminalLine2 || "";
  termTotal = termLine1.length + termLine2.length;

  const emailBtn = document.getElementById("contact-email");
  const phoneBtn = document.getElementById("contact-phone");
  emailBtn.href = profile.email ? `mailto:${profile.email}` : "#";
  emailBtn.textContent = site.emailButton || "Email me";
  phoneBtn.href = profile.phone ? phoneToWhatsApp(profile.phone) : "#";
  phoneBtn.target = "_blank";
  phoneBtn.rel = "noopener noreferrer";
  phoneBtn.textContent = site.phoneButton || "Call / WhatsApp";
  document.getElementById("contact-footer").textContent = contact.footer || "";

  if (desktop.monitorCode?.length) setMonitorCode(desktop.monitorCode);
  renderTerminal();
}

async function bootstrap() {
  try {
    let data;
    try {
      data = await Store.load();
    } catch (e) {
      console.error("Portfolio data failed to load", e);
      data = Store.empty();
    }
    applyContent(data);
    setupProjectsMobileScroll();

    if (reducedMotion) {
      document.body.classList.add("reduced-motion");
      nav.classList.add("scrolled");
      loadPhoto();
      termState.chars = termTotal;
      renderTerminal();
      cam.px = OVER_SHOULDER.x; cam.py = OVER_SHOULDER.y; cam.pz = OVER_SHOULDER.z;
      cam.lx = SCREEN_C.x; cam.ly = SCREEN_C.y; cam.lz = SCREEN_C.z;
      cam.fov = FOV_BASE;
      applyCamera();
      drawCode(0);
      renderer.render(scene, camera);
      const targets = { top: "body", about: "#about", work: "#work", contact: "#contact" };
      document.querySelectorAll("[data-scene]").forEach((link) => {
        link.addEventListener("click", (e) => {
          e.preventDefault();
          document.querySelector(targets[link.dataset.scene] || "body")
            ?.scrollIntoView({ behavior: "smooth" });
        });
      });
      window.addEventListener("resize", () => {
        camera.aspect = window.innerWidth / window.innerHeight;
        camera.updateProjectionMatrix();
        renderer.setSize(window.innerWidth, window.innerHeight);
        renderer.render(scene, camera);
      });
    } else {
      buildTimeline();
      wireNav();
      startLoop();
      window.addEventListener("resize", () => {
        camera.aspect = window.innerWidth / window.innerHeight;
        camera.updateProjectionMatrix();
        renderer.setSize(window.innerWidth, window.innerHeight);
      });
    }
  } catch (err) {
    console.error("Site bootstrap failed:", err);
    try {
      renderer.render(scene, camera);
    } catch (_) { /* WebGL unavailable */ }
  } finally {
    dismissLoader();
  }
}

bootstrap();

window.addEventListener("pagehide", () => renderer.dispose());

/* ================== Master scrubbed timeline ================== */

function buildTimeline() {
  if (isMobile) ScrollTrigger.normalizeScroll(true);

  const orbitEnd = orbitPos(-ORBIT_SWEEP, ORBIT_H1);

  // Initial layer states (GSAP owns autoAlpha from here on)
  gsap.set(layerIntro, { autoAlpha: 1 });
  gsap.set([photoWrap, aboutText], { autoAlpha: 0 });
  gsap.set(projectItems, { autoAlpha: 0 });
  gsap.set([contactCtas, contactFooter], { autoAlpha: 0 });

  const tl = gsap.timeline({
    defaults: { ease: "none" },
    scrollTrigger: {
      trigger: "#scroll-track",
      start: "top top",
      end: "bottom bottom",
      scrub: 1,
      invalidateOnRefresh: true,
      onUpdate: (self) => { if (self.progress > 0.2) loadPhoto(); },
    },
  });

  /* --- PHASE 1: intro text out (0.02–0.08) --- */
  tl.to(layerIntro, { autoAlpha: 0, y: -60, duration: 0.06 }, 0.02);

  /* --- PHASE 2: orbit (0.08–0.22) — constant radius, no zoom --- */
  const orbit = { a: 0, h: ORBIT_H0 };
  tl.to(orbit, {
    a: -ORBIT_SWEEP,
    h: ORBIT_H1,
    duration: 0.14,
    onUpdate: () => {
      const p = orbitPos(orbit.a, orbit.h);
      cam.px = p.x; cam.py = p.y; cam.pz = p.z;
      applyCamera();
    },
  }, 0.08);

  /* --- PHASE 3: pause 0.22–0.24 (no tweens), then dive --- */
  // Rise to the over-shoulder waypoint (explicit from = orbit end,
  // so reversibility and mid-jump initialization are exact)
  tl.fromTo(cam,
    { px: orbitEnd.x, py: orbitEnd.y, pz: orbitEnd.z },
    { px: OVER_SHOULDER.x, py: OVER_SHOULDER.y, pz: OVER_SHOULDER.z,
      duration: 0.03, onUpdate: applyCamera, immediateRender: false },
    0.24);

  // Plunge into the screen; lookAt lerps head-midpoint → screen center
  tl.fromTo(cam,
    { px: OVER_SHOULDER.x, py: OVER_SHOULDER.y, pz: OVER_SHOULDER.z,
      lx: LOOK_ORBIT.x, ly: LOOK_ORBIT.y, lz: LOOK_ORBIT.z },
    { px: CAM_IN.x, py: CAM_IN.y, pz: CAM_IN.z,
      lx: SCREEN_C.x, ly: SCREEN_C.y, lz: SCREEN_C.z,
      duration: 0.05, onUpdate: applyCamera, immediateRender: false },
    0.27);

  // FOV 75 → 90 across the whole dive
  tl.fromTo(cam, { fov: FOV_BASE },
    { fov: FOV_DIVE, duration: 0.08, onUpdate: applyCamera, immediateRender: false },
    0.24);

  /* --- Crossfade 3D screen → HTML OS desktop (0.30–0.32) --- */
  tl.to(osDesktop, { autoAlpha: 1, duration: 0.02 }, 0.30);

  /* --- Folder helpers --- */
  const gold = (id) => `#${id} .folder-gold`;
  const openFolder = (id, at) => {
    tl.to(gold(id), { opacity: 1, duration: 0.02 }, at);
    tl.to(`#${id}`, { scale: 1.28, duration: 0.025 }, at);
  };
  const closeFolder = (id, at) => {
    tl.to(gold(id), { opacity: 0, duration: 0.015 }, at);
    tl.to(`#${id}`, { scale: 1, duration: 0.015 }, at);
  };

  /* --- PHASE 4: about (0.32–0.44) ---
     Zoom feel = scale on the whole desktop; only the folder grid dims
     (the full-bleed wallpaper stays, so the 3D never shows through). */
  openFolder("folder-about", 0.31);
  tl.to(osDesktop, { scale: 1.15, duration: 0.04 }, 0.32);
  tl.to(folderGrid, { opacity: 0.2, duration: 0.04 }, 0.32);
  tl.fromTo(layerAbout,
    { autoAlpha: 0, scale: 0.85, y: 40 },
    { autoAlpha: 1, scale: 1, y: 0, duration: 0.04, immediateRender: false },
    0.32);
  // Photo first, text ~0.15s later (stagger inside the window fade)
  tl.fromTo(photoWrap, { autoAlpha: 0, y: 14 },
    { autoAlpha: 1, y: 0, duration: 0.025, immediateRender: false }, 0.325);
  tl.fromTo(aboutText, { autoAlpha: 0, y: 18 },
    { autoAlpha: 1, y: 0, duration: 0.027, immediateRender: false }, 0.333);
  // Zoom-out — always faster than the zoom-in (0.6×)
  tl.to(layerAbout, { autoAlpha: 0, scale: 1.08, y: -30, duration: 0.024 }, 0.42);
  tl.to(osDesktop, { scale: 1, duration: 0.024 }, 0.42);
  tl.to(folderGrid, { opacity: 1, duration: 0.024 }, 0.42);
  closeFolder("folder-about", 0.42);

  /* --- PHASE 5: one ~/projects/ window, entries reveal one by one (0.44–0.84) --- */
  openFolder("folder-projects", 0.44);
  tl.to(osDesktop, { scale: 1.12, duration: 0.05 }, 0.44);
  tl.to(folderGrid, { opacity: 0.2, duration: 0.05 }, 0.44);
  tl.fromTo(layerProjects,
    { autoAlpha: 0, scale: 0.85, y: 40 },
    { autoAlpha: 1, scale: 1, y: 0, duration: 0.05, immediateRender: false },
    0.44);
  // Staggered reveal of projects inside the window
  const revealStart = 0.46;
  const revealEnd = Math.min(0.69, revealStart + Math.max(projectItems.length - 1, 0) * 0.09);
  projectItems.forEach((item, i) => {
    const at = projectItems.length <= 1
      ? revealStart
      : revealStart + (i / (projectItems.length - 1)) * (revealEnd - revealStart);
    tl.fromTo(item,
      { autoAlpha: 0, x: -26 },
      { autoAlpha: 1, x: 0, duration: 0.05, immediateRender: false },
      at);
  });
  // Hold fully readable 0.69–0.80, then fast zoom-out toward contact
  tl.to(layerProjects, { autoAlpha: 0, scale: 1.1, y: -30, duration: 0.04 }, 0.80);
  tl.to(osDesktop, { scale: 1.1, duration: 0.04 }, 0.80);
  tl.to(folderGrid, { opacity: 0.12, duration: 0.04 }, 0.80);
  closeFolder("folder-projects", 0.81);

  /* --- PHASE 6: contact terminal (0.84–1.0) --- */
  openFolder("folder-contact", 0.82);
  tl.fromTo(layerContact,
    { autoAlpha: 0, scale: 0.85, y: 40 },
    { autoAlpha: 1, scale: 1, y: 0, duration: 0.04, immediateRender: false },
    0.84);
  tl.to(termState, { chars: termTotal, duration: 0.08, onUpdate: renderTerminal }, 0.88);
  tl.fromTo([contactCtas, contactFooter], { autoAlpha: 0, y: 20 },
    { autoAlpha: 1, y: 0, duration: 0.025, immediateRender: false }, 0.96);
  // End state persists — nothing scheduled after 0.985

  /* --- Pointer events: a layer is clickable only while visible --- */
  [layerIntro, layerAbout, layerProjects, layerContact].forEach((layer) => {
    new MutationObserver(() => {
      layer.classList.toggle("interactive", gsap.getProperty(layer, "opacity") > 0.5);
    }).observe(layer, { attributes: true, attributeFilter: ["style"] });
  });
  layerIntro.classList.add("interactive");

  /* --- Nav background on scroll --- */
  ScrollTrigger.create({
    start: 1,
    end: "max",
    onUpdate: (self) => nav.classList.toggle("scrolled", self.scroll() > 40),
  });
}

/* ================== Nav scene jumps (SCENES = source of truth) ================== */

function wireNav() {
  const maxScroll = () =>
    document.documentElement.scrollHeight - window.innerHeight;
  document.querySelectorAll("[data-scene]").forEach((link) => {
    const go = (e) => {
      e.preventDefault();
      const p = SCENES[link.dataset.scene] ?? 0;
      gsap.to(window, { scrollTo: p * maxScroll(), duration: 1.2, ease: "power2.inOut" });
    };
    link.addEventListener("click", go);
    link.addEventListener("keydown", (e) => {
      if (e.key === "Enter" || e.key === " ") go(e);
    });
  });
}

/* ================== rAF loop — idle life, never scroll-bound ================== */

function startLoop() {
  const clock = new THREE.Clock();
  let firstFrame = true;
  let nextFlick = 0;
  let flickTarget = 0;

  function tick() {
    try {
      const t = clock.getElapsedTime();
      const dt = Math.min(clock.getDelta(), 0.05);

      for (const p of dust) {
        p.position.addScaledVector(p.userData.vel, dt);
        if (p.position.x > DB.x) p.position.x = -DB.x;
        else if (p.position.x < -DB.x) p.position.x = DB.x;
        if (p.position.y > DB.yMax) p.position.y = DB.yMin;
        else if (p.position.y < DB.yMin) p.position.y = DB.yMax;
        if (p.position.z > DB.zMax) p.position.z = DB.zMin;
        else if (p.position.z < DB.zMin) p.position.z = DB.zMax;
      }

      if (avatarRig) {
        avatarRig.mixer.update(dt);
      } else {
        handL.position.y = HAND_Y + Math.sin(t * 1.7) * 0.03;
        handR.position.y = HAND_Y + Math.sin(t * 1.7 + 1.4) * 0.03;
        head.rotation.y = Math.sin(t * 0.4) * 0.05;
      }

      if (t >= nextFlick) {
        flickTarget = (Math.random() - 0.5) * 0.1;
        nextFlick = t + 0.08 + Math.random() * 0.35;
      }
      monitorLight.intensity +=
        (MONITOR_BASE * (1 + flickTarget) - monitorLight.intensity) * Math.min(1, dt * 12);

      signLight.intensity = 5 + Math.sin(t * 2.3) * 0.7;
      lampLight.intensity = 8 + Math.sin(t * 1.1) * 0.9;
      devGroup.position.y = Math.sin(t * 0.9) * 0.012;

      drawCode(t);
      renderer.render(scene, camera);

      if (firstFrame) {
        firstFrame = false;
        dismissLoader();
      }
    } catch (err) {
      console.error("Render loop error:", err);
      dismissLoader();
    }
    requestAnimationFrame(tick);
  }
  requestAnimationFrame(tick);
}

/* ============================================================
   3D screen texture: dark editor with code lines that scroll
   upward over time (throttled to ~10 repaints/sec).
   ============================================================ */
function makeCodeTexture(initialLines = ["// loading portfolio…"]) {
  const W = 1024, H = 592;
  const canvas = document.createElement("canvas");
  canvas.width = W; canvas.height = H;
  const ctx = canvas.getContext("2d");

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = 4;

  let CODE = [...initialLines];
  const LINE_H = 34;
  const SPEED = 14;
  let lastFrame = -1;

  function setLines(lines) {
    CODE = lines?.length ? [...lines] : ["// no code"];
    lastFrame = -1;
    draw(0);
  }

  function draw(t) {
    if (!CODE.length) return;
    const frameN = Math.floor(t * 10);
    if (frameN === lastFrame) return;
    lastFrame = frameN;

    ctx.fillStyle = "#0d1117";
    ctx.fillRect(0, 0, W, H);

    ctx.fillStyle = "rgba(0,0,0,0.5)";
    ctx.fillRect(0, 0, W, 36);
    ctx.font = "18px 'JetBrains Mono', monospace";
    ctx.fillStyle = "#c9a961";
    ctx.textAlign = "left";
    ctx.fillText("~/workspace — hussein@beirut", 20, 25);

    const scroll = t * SPEED;
    const first = Math.floor(scroll / LINE_H);
    const off = scroll % LINE_H;
    ctx.font = "20px 'JetBrains Mono', monospace";
    for (let i = 0; i < 19; i++) {
      const line = CODE[(first + i) % CODE.length];
      const y = 66 + i * LINE_H - off;
      ctx.fillStyle = line.startsWith("$") ? "#8fdc9a" : "#9fd8e8";
      if (line.includes("//")) ctx.fillStyle = "#6a737d";
      ctx.fillText(line, 26, y);
    }

    if (Math.floor(t * 2) % 2 === 0) {
      ctx.fillStyle = "#9fd8e8";
      ctx.fillRect(26 + 340, 66 + 6 * LINE_H - off, 11, 22);
    }

    texture.needsUpdate = true;
  }

  draw(0);
  return { texture, draw, setMonitorCode: setLines };
}

/* ============================================================
   Green LED sign texture — glowing text on a transparent plane
   ============================================================ */
function makeSignTexture(brand) {
  const W = 1024, H = 288;
  const canvas = document.createElement("canvas");
  canvas.width = W; canvas.height = H;
  const ctx = canvas.getContext("2d");
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = 4;

  function drawGlowText(str, x, y, color, blur, size = 128) {
    ctx.font = `600 ${size}px 'JetBrains Mono', monospace`;
    ctx.textAlign = "left";
    ctx.textBaseline = "middle";
    ctx.shadowColor = "#39ff6a";
    ctx.shadowBlur = blur;
    ctx.fillStyle = color;
    ctx.fillText(str, x, y);
  }

  function drawCodeBracket(ch, x, y) {
    ctx.font = "700 148px 'JetBrains Mono', monospace";
    ctx.textAlign = "left";
    ctx.textBaseline = "middle";
    ctx.shadowColor = "#9fd8e8";
    ctx.shadowBlur = 8;
    ctx.fillStyle = "#e8ffff";
    ctx.fillText(ch, x, y);
    ctx.shadowBlur = 0;
    ctx.strokeStyle = "#39ff6a";
    ctx.lineWidth = 2.5;
    ctx.strokeText(ch, x, y);
    ctx.fillStyle = "#ffffff";
    ctx.fillText(ch, x, y);
    return ctx.measureText(ch).width;
  }

  function draw() {
    ctx.clearRect(0, 0, W, H);

    ctx.font = "600 128px 'JetBrains Mono', monospace";
    ctx.textBaseline = "middle";
    const brandW = ctx.measureText(`${brand} `).width;
    ctx.font = "700 148px 'JetBrains Mono', monospace";
    const ltW = ctx.measureText("<").width;
    const gtW = ctx.measureText(">").width;
    const bracketGap = 18;
    const totalW = brandW + ltW + bracketGap + gtW;
    const startX = (W - totalW) / 2;
    const y = H / 2;

    for (const blur of [64, 30]) drawGlowText(`${brand} `, startX, y, "#39ff6a", blur);
    drawGlowText(`${brand} `, startX, y, "#cfffdd", 12);

    let bx = startX + brandW;
    bx += drawCodeBracket("<", bx, y) + bracketGap;
    drawCodeBracket(">", bx, y);

    texture.needsUpdate = true;
  }

  draw();
  if (document.fonts?.ready) document.fonts.ready.then(draw);
  return texture;
}
