import { useMemo, useRef } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import * as THREE from "three";
import { FarmerCharacter } from "./FarmerCharacter";
import {
  progressOf,
  walkPhaseOf,
  easeInOut,
  ramp,
  lerp,
  DURATION_S,
  HOLO_START,
  HOLO_FULL,
  WALK_END,
} from "./timeline";

/* ------------------------------------------------------------------ */
/* Terrain + furrowed crop field                                       */
/* ------------------------------------------------------------------ */

function Ground() {
  const mat = useRef<THREE.MeshStandardMaterial>(null);
  return (
    <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0, 0]} receiveShadow>
      <planeGeometry args={[420, 420]} />
      <meshStandardMaterial ref={mat} color="#6f5a3e" roughness={1} />
    </mesh>
  );
}

/**
 * The crop field: instanced maize-like clumps planted in furrows.
 * Wind is done in a small vertex shader (cheap, uniform across all instances).
 */
function CropField({ quality }: { quality: "low" | "high" }) {
  const rows = quality === "high" ? 26 : 14;
  const perRow = quality === "high" ? 34 : 20;
  const count = rows * perRow;

  const { mesh, uniforms } = useMemo(() => {
    const geo = new THREE.ConeGeometry(0.32, 1.5, 5, 1);
    geo.translate(0, 0.75, 0);
    const mat = new THREE.ShaderMaterial({
      uniforms: { uTime: { value: 0 }, uWind: { value: 0.5 } },
      vertexShader: /* glsl */ `
        uniform float uTime; uniform float uWind;
        varying float vY; varying vec3 vNormalW;
        void main(){
          vec3 p = position;
          vY = clamp(p.y / 1.5, 0.0, 1.0);
          // world position of the instance base for phase variation
          vec4 wp = instanceMatrix * vec4(0.0,0.0,0.0,1.0);
          float phase = wp.x * 0.35 + wp.z * 0.6;
          float sway = sin(uTime * 1.6 + phase) * 0.5 + sin(uTime * 3.1 + phase * 1.7) * 0.5;
          float bend = sway * 0.22 * uWind * vY * vY;
          p.x += bend; p.z += bend * 0.6;
          vNormalW = normalize(normalMatrix * normal);
          vec4 mv = modelViewMatrix * instanceMatrix * vec4(p,1.0);
          gl_Position = projectionMatrix * mv;
        }`,
      fragmentShader: /* glsl */ `
        varying float vY; varying vec3 vNormalW;
        void main(){
          vec3 deep = vec3(0.075, 0.235, 0.11);
          vec3 tip  = vec3(0.32, 0.55, 0.18);
          vec3 col = mix(deep, tip, vY);
          // fresnel-ish warm rim from the sunrise side
          vec3 sunDir = normalize(vec3(-0.55, 0.35, 0.75));
          float rim = pow(1.0 - abs(dot(normalize(vNormalW), sunDir)), 2.0);
          col += vec3(0.35, 0.22, 0.05) * rim * 0.35;
          gl_FragColor = vec4(col, 1.0);
        }`,
      side: THREE.DoubleSide,
    });

    // Keep the stage clear: walk corridor + camera view in front of the
    // farmer, the irrigation stream band, and the hut/well/haystack spots.
    const clearOfStage = (x: number, z: number) => {
      if (z > -14 && Math.abs(x) < 6) return true; // walk + view corridor
      if (Math.abs(x - 13) < 2.6) return true; // stream band
      if (Math.abs(x + 14) < 3.5 && Math.abs(z + 30) < 4.5) return true; // hut
      if (Math.abs(x - 7.5) < 2 && Math.abs(z + 22) < 2.5) return true; // well
      if (Math.abs(x + 9.5) < 2 && Math.abs(z + 26) < 2.5) return true; // haystack
      if (Math.abs(x - 16.5) < 2 && Math.abs(z + 34) < 2.5) return true; // haystack
      return false;
    };
    const positions: number[] = [];
    for (let r = 0; r < rows; r++) {
      const z = -20 + r * 1.55; // furrow spacing
      for (let i = 0; i < perRow; i++) {
        const x = -30 + (i / (perRow - 1)) * 60 + (Math.random() - 0.5) * 0.5;
        if (clearOfStage(x, z)) continue;
        positions.push(x, 0, z);
      }
    }
    const inst = new THREE.InstancedMesh(geo, mat, positions.length / 3);
    const m = new THREE.Matrix4();
    const q = new THREE.Quaternion();
    const s = new THREE.Vector3();
    for (let i = 0; i < positions.length; i += 3) {
      const sc = 0.75 + Math.random() * 0.55;
      s.set(sc, sc * (0.85 + Math.random() * 0.4), sc);
      q.setFromEuler(new THREE.Euler(0, Math.random() * Math.PI, 0));
      m.compose(new THREE.Vector3(positions[i]!, positions[i + 1]!, positions[i + 2]!), q, s);
      inst.setMatrixAt(i / 3, m);
    }
    inst.frustumCulled = false;
    return { mesh: inst, uniforms: mat.uniforms };
  }, [rows, perRow]);

  useFrame(({ clock }) => {
    uniforms.uTime.value = clock.elapsedTime;
    uniforms.uWind.value = 0.65 + Math.sin(clock.elapsedTime * 0.4) * 0.3;
  });

  return <primitive object={mesh} />;
}

/* ------------------------------------------------------------------ */
/* Nature: trees, hills, rocks                                         */
/* ------------------------------------------------------------------ */

function Tree({ position, scale = 1 }: { position: [number, number, number]; scale?: number }) {
  const canopy = useMemo(() => {
    const g = new THREE.Group();
    const trunk = new THREE.Mesh(
      new THREE.CylinderGeometry(0.16, 0.28, 1.7, 6),
      new THREE.MeshStandardMaterial({ color: "#5c4327", roughness: 0.95 }),
    );
    trunk.position.y = 0.85;
    g.add(trunk);
    const leafMat = new THREE.MeshStandardMaterial({ color: "#2c5c26", roughness: 0.9 });
    const blobs: [number, number, number, number][] = [
      [0, 2.1, 0, 0.95],
      [0.5, 1.8, 0.2, 0.7],
      [-0.45, 1.85, -0.15, 0.68],
      [0.1, 2.5, -0.1, 0.6],
    ];
    for (const [x, y, z, r] of blobs) {
      const b = new THREE.Mesh(new THREE.SphereGeometry(r, 10, 8), leafMat);
      b.position.set(x, y, z);
      g.add(b);
    }
    return g;
  }, []);

  return <primitive object={canopy} position={position} scale={scale} />;
}

function TreeLine() {
  const trees = useMemo(() => {
    const arr: { p: [number, number, number]; s: number }[] = [];
    for (let i = 0; i < 16; i++) {
      const x = -70 + i * 9.3 + (Math.random() - 0.5) * 4;
      arr.push({ p: [x, 0, -44 - Math.random() * 10], s: 0.85 + Math.random() * 0.8 });
    }
    return arr;
  }, []);
  return (
    <group>
      {trees.map((t, i) => (
        <Tree key={i} position={t.p} scale={t.s} />
      ))}
    </group>
  );
}

function Mountains() {
  const geo = useMemo(() => {
    // layered ridge silhouettes via lathe-like cones with noise
    const mk = (r: number, h: number, seg: number, col: string, z: number, y: number) => {
      const m = new THREE.Mesh(
        new THREE.ConeGeometry(r, h, seg, 1),
        new THREE.MeshBasicMaterial({ color: col }),
      );
      m.position.set((Math.random() - 0.5) * 40, y, z);
      return m;
    };
    const g = new THREE.Group();
    // far ridge — pale haze (fog-exempt: it IS the haze layer)
    for (let i = 0; i < 9; i++)
      g.add(mk(26 + Math.random() * 16, 26 + Math.random() * 18, 6, "#e8c393", -190 - Math.random() * 30, 4));
    // mid ridge
    for (let i = 0; i < 7; i++)
      g.add(mk(18 + Math.random() * 10, 16 + Math.random() * 12, 5, "#a8bc9b", -130 - Math.random() * 24, 2));
    return g;
  }, []);
  return <primitive object={geo} />;
}

/* ------------------------------------------------------------------ */
/* Sky: sun, god rays, clouds, birds                                   */
/* ------------------------------------------------------------------ */

function SunSky() {
  const glow = useRef<THREE.Mesh>(null);
  useFrame(({ clock }) => {
    if (glow.current) {
      const s = 1 + Math.sin(clock.elapsedTime * 0.7) * 0.03;
      glow.current.scale.setScalar(s);
    }
  });
  return (
    <group>
      {/* sky gradient dome (fog-exempt so it stays warm) */}
      <mesh>
        <sphereGeometry args={[300, 24, 16]} />
        <meshBasicMaterial color="#f7cf9a" side={THREE.BackSide} fog={false} />
      </mesh>
      {/* sunrise glow band (big billboard behind hills) */}
      <mesh position={[-40, 26, -250]}>
        <circleGeometry args={[70, 32]} />
        <meshBasicMaterial color="#ffd9a0" transparent opacity={0.75} fog={false} />
      </mesh>
      {/* sun disc + soft halo */}
      <mesh position={[-46, 30, -248]}>
        <circleGeometry args={[11, 32]} />
        <meshBasicMaterial color="#fff3d6" fog={false} />
      </mesh>
      <mesh ref={glow} position={[-46, 30, -247]}>
        <circleGeometry args={[19, 32]} />
        <meshBasicMaterial color="#ffdf9e" transparent opacity={0.45} fog={false} />
      </mesh>
    </group>
  );
}

function Clouds({ quality }: { quality: "low" | "high" }) {
  const group = useRef<THREE.Group>(null);
  const n = quality === "high" ? 7 : 4;
  const clouds = useMemo(
    () =>
      Array.from({ length: n }, (_, i) => ({
        x: -90 + i * 26 + Math.random() * 12,
        y: 34 + Math.random() * 14,
        z: -120 - Math.random() * 60,
        s: 7 + Math.random() * 8,
        v: 0.35 + Math.random() * 0.4,
      })),
    [n],
  );
  useFrame(({ clock }) => {
    if (!group.current) return;
    group.current.children.forEach((c, i) => {
      c.position.x += clouds[i]!.v * 0.016;
      if (c.position.x > 110) c.position.x = -110;
    });
  });
  return (
    <group ref={group}>
      {clouds.map((c, i) => (
        <group key={i} position={[c.x, c.y, c.z]} scale={c.s}>
          {[
            [0, 0, 0, 1],
            [0.9, -0.12, 0.2, 0.72],
            [-0.85, -0.1, -0.15, 0.66],
            [0.35, 0.32, -0.2, 0.6],
          ].map(([x, y, z, r], j) => (
            <mesh key={j} position={[x, y, z]}>
              <sphereGeometry args={[r, 9, 7]} />
              <meshBasicMaterial color="#fff4e2" transparent opacity={0.85} />
            </mesh>
          ))}
        </group>
      ))}
    </group>
  );
}

function Birds({ quality }: { quality: "low" | "high" }) {
  const n = quality === "high" ? 7 : 4;
  const birds = useRef<(THREE.Group | null)[]>([]);
  const data = useMemo(
    () =>
      Array.from({ length: n }, () => ({
        r: 40 + Math.random() * 60,
        h: 22 + Math.random() * 16,
        speed: 0.12 + Math.random() * 0.14,
        phase: Math.random() * Math.PI * 2,
      })),
    [n],
  );
  useFrame(({ clock }) => {
    const t = clock.elapsedTime;
    birds.current.forEach((b, i) => {
      if (!b) return;
      const d = data[i]!;
      const a = d.phase + t * d.speed;
      b.position.set(Math.cos(a) * d.r, d.h + Math.sin(t * 0.7 + i) * 1.5, Math.sin(a) * d.r - 30);
      b.rotation.y = -a + Math.PI / 2;
      // flap
      b.children.forEach((wing, wi) => {
        wing.rotation.z = (wi === 0 ? 1 : -1) * Math.sin(t * 9 + i * 2) * 0.55;
      });
    });
  });
  return (
    <group>
      {data.map((_, i) => (
        <group key={i} ref={(el) => { birds.current[i] = el; }}>
          <mesh rotation={[0, 0, Math.PI / 4]}>
            <boxGeometry args={[0.9, 0.04, 0.22]} />
            <meshBasicMaterial color="#3a3328" />
          </mesh>
          <mesh position={[0.4, 0, 0]} rotation={[0, 0, Math.PI / 4]}>
            <boxGeometry args={[0.7, 0.04, 0.2]} />
            <meshBasicMaterial color="#3a3328" />
          </mesh>
        </group>
      ))}
    </group>
  );
}

/* ------------------------------------------------------------------ */
/* Dust motes / light particles                                        */
/* ------------------------------------------------------------------ */

function Dust({ quality }: { quality: "low" | "high" }) {
  const count = quality === "high" ? 260 : 90;
  const ref = useRef<THREE.Points>(null);
  const geo = useMemo(() => {
    const pos = new Float32Array(count * 3);
    for (let i = 0; i < count; i++) {
      pos[i * 3] = (Math.random() - 0.5) * 60;
      pos[i * 3 + 1] = Math.random() * 8 + 0.4;
      pos[i * 3 + 2] = (Math.random() - 0.5) * 60 - 6;
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.BufferAttribute(pos, 3));
    return g;
  }, [count]);
  useFrame(({ clock }) => {
    if (!ref.current) return;
    const t = clock.elapsedTime;
    const arr = geo.attributes.position.array as Float32Array;
    // gentle rise + drift, wrapped in a box around the camera path
    for (let i = 0; i < count; i++) {
      arr[i * 3 + 1] += 0.004 + (i % 5) * 0.0008;
      arr[i * 3] += Math.sin(t * 0.5 + i) * 0.0012;
      if (arr[i * 3 + 1]! > 9) arr[i * 3 + 1] = 0.3;
    }
    geo.attributes.position.needsUpdate = true;
    ref.current.rotation.y = Math.sin(t * 0.05) * 0.04;
  });
  return (
    <points ref={ref} geometry={geo}>
      <pointsMaterial
        size={0.075}
        color="#ffe9b8"
        transparent
        opacity={0.55}
        sizeAttenuation
        depthWrite={false}
      />
    </points>
  );
}

/* ------------------------------------------------------------------ */
/* Farm props: irrigation stream, hut, well, haystack                  */
/* ------------------------------------------------------------------ */

function IrrigationStream() {
  const water = useRef<THREE.Mesh>(null);
  useFrame(({ clock }) => {
    if (water.current) {
      const m = water.current.material as THREE.MeshStandardMaterial;
      m.opacity = 0.72 + Math.sin(clock.elapsedTime * 1.8) * 0.06;
    }
  });
  return (
    <group position={[13, 0, -4]} rotation={[0, -0.22, 0]}>
      {/* banks */}
      <mesh position={[0, 0.015, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[3.6, 120]} />
        <meshStandardMaterial color="#8a7351" roughness={1} />
      </mesh>
      {/* water */}
      <mesh ref={water} position={[0, 0.03, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[2.1, 120]} />
        <meshStandardMaterial color="#4d9ec9" roughness={0.25} metalness={0.15} transparent opacity={0.8} />
      </mesh>
      {/* glints */}
      <mesh position={[0, 0.05, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[0.5, 110]} />
        <meshBasicMaterial color="#dff3ff" transparent opacity={0.28} />
      </mesh>
    </group>
  );
}

function Hut() {
  return (
    <group position={[-14, 0, -30]} rotation={[0, 0.5, 0]}>
      <mesh position={[0, 1.1, 0]} castShadow>
        <boxGeometry args={[4.2, 2.2, 3.2]} />
        <meshStandardMaterial color="#b98d5f" roughness={0.95} />
      </mesh>
      {/* thatched roof */}
      <mesh position={[0, 2.6, 0]} rotation={[0, Math.PI / 4, 0]} castShadow>
        <coneGeometry args={[3.6, 1.5, 4]} />
        <meshStandardMaterial color="#8a6d3b" roughness={1} />
      </mesh>
      <mesh position={[0, 1.0, 1.62]}>
        <boxGeometry args={[0.8, 1.4, 0.06]} />
        <meshStandardMaterial color="#4a331d" roughness={1} />
      </mesh>
      {/* small window */}
      <mesh position={[1.4, 1.4, 1.62]}>
        <boxGeometry args={[0.5, 0.5, 0.05]} />
        <meshStandardMaterial color="#2c1f12" roughness={1} />
      </mesh>
    </group>
  );
}

function Well() {
  return (
    <group position={[7.5, 0, -22]}>
      <mesh position={[0, 0.5, 0]} castShadow>
        <cylinderGeometry args={[1.1, 1.2, 1, 12]} />
        <meshStandardMaterial color="#8f8778" roughness={1} />
      </mesh>
      <mesh position={[0, 1.02, 0]}>
        <cylinderGeometry args={[0.9, 0.9, 0.06, 12]} />
        <meshStandardMaterial color="#3f6d8e" roughness={0.3} />
      </mesh>
      {/* wooden posts + crossbar */}
      <mesh position={[-0.9, 1.7, 0]}>
        <cylinderGeometry args={[0.07, 0.07, 1.6, 6]} />
        <meshStandardMaterial color="#5c4327" roughness={1} />
      </mesh>
      <mesh position={[0.9, 1.7, 0]}>
        <cylinderGeometry args={[0.07, 0.07, 1.6, 6]} />
        <meshStandardMaterial color="#5c4327" roughness={1} />
      </mesh>
      <mesh position={[0, 2.5, 0]} rotation={[0, 0, Math.PI / 2]}>
        <cylinderGeometry args={[0.06, 0.06, 2.1, 6]} />
        <meshStandardMaterial color="#5c4327" roughness={1} />
      </mesh>
    </group>
  );
}

function Haystack({ position }: { position: [number, number, number] }) {
  return (
    <group position={position}>
      <mesh position={[0, 1.1, 0]} castShadow>
        <coneGeometry args={[1.3, 2.3, 9]} />
        <meshStandardMaterial color="#c9a24b" roughness={1} />
      </mesh>
    </group>
  );
}

/* ------------------------------------------------------------------ */
/* AI hologram rings around the farmer                                 */
/* ------------------------------------------------------------------ */

function HoloRings({ progress }: { progress: React.RefObject<number> }) {
  const r1 = useRef<THREE.Mesh>(null);
  const r2 = useRef<THREE.Mesh>(null);
  const r3 = useRef<THREE.Mesh>(null);
  const ringMat = (op: number) =>
    new THREE.MeshBasicMaterial({
      color: "#8ef0b6",
      transparent: true,
      opacity: op,
      side: THREE.DoubleSide,
      depthWrite: false,
    });
  const mats = useMemo(() => [ringMat(0), ringMat(0), ringMat(0)], []);
  useFrame(({ clock }) => {
    const p = progress.current ?? 0;
    const a = ramp(p, HOLO_START, HOLO_FULL);
    const t = clock.elapsedTime;
    const set = [r1.current, r2.current, r3.current];
    set.forEach((r, i) => {
      if (!r) return;
      const m = mats[i]!;
      m.opacity = a * (i === 2 ? 0.16 : 0.3) * (0.85 + 0.15 * Math.sin(t * 2 + i));
      r.rotation.z = t * (0.25 + i * 0.12) * (i % 2 ? -1 : 1);
      r.scale.setScalar(1 + Math.sin(t * 1.2 + i) * 0.02);
      r.visible = a > 0.01;
    });
  });
  return (
    <group position={[0, 0.1, 0]}>
      <mesh ref={r1} rotation={[-Math.PI / 2, 0, 0]}>
        <ringGeometry args={[1.55, 1.66, 48]} />
        <primitive object={mats[0]!} attach="material" />
      </mesh>
      <mesh ref={r2} rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.02, 0]}>
        <ringGeometry args={[2.15, 2.22, 48]} />
        <primitive object={mats[1]!} attach="material" />
      </mesh>
      <mesh ref={r3} rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.04, 0]}>
        <ringGeometry args={[2.8, 2.85, 56]} />
        <primitive object={mats[2]!} attach="material" />
      </mesh>
    </group>
  );
}

/* ------------------------------------------------------------------ */
/* Camera director                                                     */
/* ------------------------------------------------------------------ */

const WIDE_POS: [number, number, number] = [4.5, 3.4, 16];
const WIDE_LOOK: [number, number, number] = [0, 1.2, -6];
const HERO_POS: [number, number, number] = [1.7, 1.55, 4.6];
const HERO_LOOK: [number, number, number] = [0, 1.15, 0];
const FINAL_POS: [number, number, number] = [1.35, 1.5, 3.9];
const FINAL_LOOK: [number, number, number] = [0, 1.2, 0];

function CameraDirector({ progress }: { progress: React.RefObject<number> }) {
  const { camera } = useThree();
  const look = useRef(new THREE.Vector3(...WIDE_LOOK));

  useFrame(({ clock }) => {
    const p = progress.current ?? 0;
    const t = clock.elapsedTime;
    const e = easeInOut(ramp(p, 0, 0.62));

    // wide → hero dolly
    const px = lerp(WIDE_POS[0], HERO_POS[0], e);
    const py = lerp(WIDE_POS[1], HERO_POS[1], e);
    const pz = lerp(WIDE_POS[2], HERO_POS[2], e);
    // final slow push after arrival
    const push = ramp(p, 0.62, 1);
    camera.position.set(
      lerp(px, FINAL_POS[0], push),
      lerp(py, FINAL_POS[1], push),
      lerp(pz, FINAL_POS[2], push),
    );

    const lx = lerp(WIDE_LOOK[0], HERO_LOOK[0], e);
    const ly = lerp(WIDE_LOOK[1], HERO_LOOK[1], e);
    const lz = lerp(WIDE_LOOK[2], HERO_LOOK[2], e);
    look.current.set(lerp(lx, FINAL_LOOK[0], push), lerp(ly, FINAL_LOOK[1], push), lerp(lz, FINAL_LOOK[2], push));

    // subtle handheld shake (bigger during the dolly, calmer at rest)
    const amp = 0.05 * (1 - push * 0.6);
    camera.position.x += Math.sin(t * 0.9) * amp * 0.25;
    camera.position.y += Math.sin(t * 1.3 + 1.7) * amp * 0.18;
    camera.lookAt(look.current);
  });
  return null;
}

/* ------------------------------------------------------------------ */
/* Root scene                                                          */
/* ------------------------------------------------------------------ */

export interface FarmSceneHandle {
  /** normalized timeline progress 0..1 */
  progress: React.RefObject<number>;
}

export function FarmScene({
  progressRef,
  quality,
  burst,
}: {
  progressRef: React.RefObject<number>;
  quality: "low" | "high";
  burst: React.RefObject<number>;
}) {
  const walkRef = useRef(0);
  const windRef = useRef(0.6);
  const { scene } = useThree();

  // soft sunrise fog
  useMemo(() => {
    scene.fog = new THREE.Fog("#f0cf9e", 55, 230);
    scene.background = new THREE.Color("#f2c98f");
  }, [scene]);

  useFrame((_, delta) => {
    const p = progressRef.current ?? 0;
    walkRef.current = walkPhaseOf(p);
    windRef.current = 0.55 + Math.sin(Date.now() * 0.0004) * 0.2;
    void delta;
  });

  return (
    <group>
      <SunSky />
      <Clouds quality={quality} />
      <Mountains />
      <TreeLine />
      <Ground />
      <IrrigationStream />
      <Hut />
      <Well />
      <Haystack position={[-9.5, 0, -26]} />
      <Haystack position={[16.5, 0, -34]} />
      <CropField quality={quality} />
      <Dust quality={quality} />
      <Birds quality={quality} />
      <HoloRings progress={progressRef} />

      {/* the farmer — walks from the mid-field toward his mark */}
      <FarmerRig progressRef={progressRef} walkRef={walkRef} windRef={windRef} burstRef={burst} />

      {/* lights */}
      <hemisphereLight args={["#ffe6c0", "#3f5c33", 0.85]} />
      <directionalLight
        position={[-30, 24, -18]}
        intensity={1.6}
        color="#ffd9a3"
        castShadow={quality === "high"}
        shadow-mapSize={[quality === "high" ? 1024 : 512, quality === "high" ? 1024 : 512]}
      />
      <directionalLight position={[14, 10, 18]} intensity={0.35} color="#bfe3ff" />
      <ambientLight intensity={0.25} />

      <CameraDirector progress={progressRef} />
    </group>
  );
}

/** Positions the farmer along his walk and plays the intro timeline. */
function FarmerRig({
  progressRef,
  walkRef,
  windRef,
  burstRef,
}: {
  progressRef: React.RefObject<number>;
  walkRef: React.RefObject<number>;
  windRef: React.RefObject<number>;
  burstRef: React.RefObject<number>;
}) {
  const g = useRef<THREE.Group>(null);
  useFrame(() => {
    if (!g.current) return;
    const p = progressRef.current ?? 0;
    const wp = walkPhaseOf(p);
    // farmer starts deep in the field and walks to his mark
    const startZ = -7.5;
    const endZ = 0;
    g.current.position.z = lerp(startZ, endZ, easeInOut(wp));
    // face the camera (walks toward +Z / camera side)
    g.current.rotation.y = 0;
    // burst: shrink/fly up during exit transition
    const b = burstRef.current ?? 0;
    if (b > 0) {
      g.current.position.y = b * 6;
      g.current.scale.setScalar(Math.max(0.001, 1 - b));
    }
  });
  return (
    <group ref={g}>
      <FarmerCharacter walk={walkRef} wind={windRef} />
    </group>
  );
}

export { WALK_END, HOLO_START, HOLO_FULL, DURATION_S, progressOf };
