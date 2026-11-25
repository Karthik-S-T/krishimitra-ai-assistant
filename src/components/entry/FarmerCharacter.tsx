import { useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";

/**
 * KrishiMitra — procedural 3D farmer (stylized-realistic, friendly,
 * traditional clothes). Built entirely from primitives so it loads instantly
 * on rural / low-bandwidth connections — no GLB download.
 *
 * Rig (nested groups):
 *   farmer ─ body(bob/lean/breath) ─ head(look) ─ hat
 *            ├─ armL / armR (shoulder → forearm → hand)
 *            └─ legL / legR (hip → shin → foot)
 *
 * `walk` goes 0 → 1 over the timeline:
 *   0–0.82 walking (leg/arm swing, bob, lean, dhoti sway, tool swing)
 *   0.82–1  stopped (breathing, gentle look toward crops, tool rest swing)
 */
const DEG = Math.PI / 180;

interface FarmerProps {
  /** 0..1 progress through the entry timeline */
  walk: React.RefObject<number>;
  /** strength of wind on cloth (0..1) */
  wind: React.RefObject<number>;
}

interface Mats {
  skin: THREE.MeshStandardMaterial;
  shirt: THREE.MeshStandardMaterial;
  dhoti: THREE.MeshStandardMaterial;
  sash: THREE.MeshStandardMaterial;
  hat: THREE.MeshStandardMaterial;
  hair: THREE.MeshStandardMaterial;
  wood: THREE.MeshStandardMaterial;
  metal: THREE.MeshStandardMaterial;
}

function useMaterials(): Mats {
  return useMemo(() => {
    const mk = (color: string, roughness: number, metalness = 0) =>
      new THREE.MeshStandardMaterial({ color, roughness, metalness });
    return {
      skin: mk("#a9714b", 0.75),
      shirt: mk("#e8dcc3", 0.9),
      dhoti: mk("#c9b48f", 0.95),
      sash: mk("#c25b2e", 0.9),
      hat: mk("#d9b36c", 0.95),
      hair: mk("#26221d", 0.9),
      wood: mk("#7a5230", 0.85),
      metal: mk("#9aa0a6", 0.35, 0.7),
    };
  }, []);
}

/** Torso + head — breathing, subtle look-at-crops head motion. */
function UpperBody({ mats, walk, wind }: FarmerProps & { mats: Mats }) {
  const chest = useRef<THREE.Group>(null);
  const head = useRef<THREE.Group>(null);
  const dhoti = useRef<THREE.Group>(null);

  useFrame(({ clock }) => {
    const w = walk.current ?? 0;
    const t = clock.elapsedTime;
    if (chest.current) {
      // bob while walking; breathe when stopped
      chest.current.position.y =
        w < 0.82 ? Math.abs(Math.sin(w * 24)) * 0.045 : Math.sin(t * 1.4) * 0.012;
      chest.current.rotation.x =
        w < 0.82 ? 0.07 + Math.sin(w * 24) * 0.02 : Math.sin(t * 1.4) * 0.012; // slight lean + breath
    }
    if (head.current) {
      // when idle, turn head slightly toward the crops (his right)
      const look = THREE.MathUtils.smoothstep(w, 0.82, 1);
      head.current.rotation.y = THREE.MathUtils.lerp(
        Math.sin(w * 12) * 0.05,
        0.35 + Math.sin(t * 0.5) * 0.05,
        look,
      );
      head.current.rotation.z = THREE.MathUtils.lerp(
        Math.sin(w * 24) * 0.03,
        Math.sin(t * 1.4) * 0.008,
        look,
      );
    }
    if (dhoti.current) {
      // cloth react to wind + stride
      const stride = w < 0.82 ? Math.sin(w * 24) * 0.06 : 0;
      dhoti.current.rotation.z =
        -0.05 - stride - (wind.current ?? 0) * 0.09 * (0.7 + 0.3 * Math.sin(t * 2.1));
    }
  });

  return (
    <group ref={chest} position={[0, 1.02, 0]}>
      {/* torso */}
      <mesh material={mats.shirt} position={[0, 0.18, 0]} castShadow>
        <capsuleGeometry args={[0.155, 0.34, 4, 12]} />
      </mesh>
      {/* waist sash (traditional accent) */}
      <mesh material={mats.sash} position={[0, -0.05, 0]}>
        <cylinderGeometry args={[0.165, 0.17, 0.09, 16]} />
      </mesh>
      {/* dhoti skirt — wind reactive group */}
      <group ref={dhoti} position={[0, -0.1, 0]}>
        <mesh material={mats.dhoti} position={[0, -0.14, 0]}>
          <coneGeometry args={[0.185, 0.42, 14, 1, true]} />
        </mesh>
      </group>
      {/* neck + head */}
      <group ref={head} position={[0, 0.48, 0]}>
        <mesh material={mats.skin}>
          <cylinderGeometry args={[0.045, 0.05, 0.06, 10]} />
        </mesh>
        <mesh material={mats.skin} position={[0, 0.13, 0]} castShadow>
          <sphereGeometry args={[0.125, 20, 16]} />
        </mesh>
        {/* friendly face: eyes + smile (small dark spheres/torus arc) */}
        <mesh material={mats.hair} position={[0.05, 0.16, 0.11]}>
          <sphereGeometry args={[0.014, 8, 8]} />
        </mesh>
        <mesh material={mats.hair} position={[-0.05, 0.16, 0.11]}>
          <sphereGeometry args={[0.014, 8, 8]} />
        </mesh>
        {/* smile: downward arc (half torus flipped so it curves down) */}
        <mesh material={mats.hair} position={[0, 0.1, 0.115]} rotation={[0, 0, Math.PI]}>
          <torusGeometry args={[0.032, 0.005, 6, 12, Math.PI]} />
        </mesh>
        {/* moustache: upward arc above the smile */}
        <mesh material={mats.hair} position={[0, 0.135, 0.118]}>
          <torusGeometry args={[0.045, 0.006, 6, 10, Math.PI]} />
        </mesh>
        {/* hair cap under hat */}
        <mesh material={mats.hair} position={[0, 0.19, -0.01]}>
          <sphereGeometry args={[0.118, 14, 10, 0, Math.PI * 2, 0, Math.PI / 2]} />
        </mesh>
        {/* straw hat: brim + crown */}
        <group position={[0, 0.21, 0]} rotation={[0.06, 0, 0]}>
          <mesh material={mats.hat}>
            <cylinderGeometry args={[0.23, 0.24, 0.02, 20]} />
          </mesh>
          <mesh material={mats.hat} position={[0, 0.05, 0]}>
            <cylinderGeometry args={[0.1, 0.115, 0.1, 16]} />
          </mesh>
        </group>
        {/* ears */}
        <mesh material={mats.skin} position={[0.12, 0.12, 0]}>
          <sphereGeometry args={[0.026, 8, 8]} />
        </mesh>
        <mesh material={mats.skin} position={[-0.12, 0.12, 0]}>
          <sphereGeometry args={[0.026, 8, 8]} />
        </mesh>
      </group>
    </group>
  );
}

interface ArmProps {
  mats: Mats;
  side: 1 | -1;
  walk: React.RefObject<number>;
  /** which arm holds the tool */
  holdsTool?: boolean;
}

/** Arm: shoulder group (swings) → forearm (counter-swing) → hand. */
function Arm({ mats, side, walk, holdsTool = false }: ArmProps) {
  const shoulder = useRef<THREE.Group>(null);
  const forearm = useRef<THREE.Group>(null);
  const tool = useRef<THREE.Group>(null);

  useFrame(({ clock }) => {
    const w = walk.current ?? 0;
    const t = clock.elapsedTime;
    const phase = side === 1 ? 0 : Math.PI; // opposite arms
    if (shoulder.current) {
      shoulder.current.rotation.x =
        w < 0.82
          ? Math.sin(w * 24 + phase) * 0.55 - 0.05
          : 0.12 + Math.sin(t * 1.4) * 0.02; // relaxed rest pose + breath
    }
    if (forearm.current) {
      forearm.current.rotation.x =
        w < 0.82 ? -0.35 - Math.max(0, Math.sin(w * 24 + phase)) * 0.25 : -0.3;
    }
    if (tool.current && holdsTool) {
      // pendulum swing with stride; gentle rocking when idle
      tool.current.rotation.z =
        w < 0.82
          ? Math.sin(w * 24 + phase) * 0.12
          : Math.sin(t * 1.1) * 0.05;
    }
  });

  return (
    <group ref={shoulder} position={[side * 0.185, 1.32, 0]}>
      {/* upper arm */}
      <mesh material={mats.shirt} position={[0, -0.14, 0]} castShadow>
        <capsuleGeometry args={[0.045, 0.2, 3, 8]} />
      </mesh>
      <group ref={forearm} position={[0, -0.3, 0]}>
        {/* forearm — skin */}
        <mesh material={mats.skin} position={[0, -0.11, 0]}>
          <capsuleGeometry args={[0.04, 0.16, 3, 8]} />
        </mesh>
        {/* hand */}
        <mesh material={mats.skin} position={[0, -0.24, 0]}>
          <sphereGeometry args={[0.05, 10, 8]} />
        </mesh>
        {holdsTool && (
          <group ref={tool} position={[0, -0.26, 0.02]} rotation={[0.3, 0, 0]}>
            {/* hand hoe: wooden shaft + metal blade */}
            <mesh material={mats.wood} position={[0, 0.16, 0]}>
              <cylinderGeometry args={[0.017, 0.02, 0.62, 8]} />
            </mesh>
            <mesh material={mats.metal} position={[0, 0.47, 0.1]} rotation={[0.5, 0, 0]}>
              <boxGeometry args={[0.11, 0.02, 0.16]} />
            </mesh>
          </group>
        )}
      </group>
    </group>
  );
}

interface LegProps {
  mats: Mats;
  side: 1 | -1;
  walk: React.RefObject<number>;
}

/** Leg: hip group (swings) → shin (knee bend) → foot (sandal). */
function Leg({ mats, side, walk }: LegProps) {
  const hip = useRef<THREE.Group>(null);
  const shin = useRef<THREE.Group>(null);

  useFrame(() => {
    const w = walk.current ?? 0;
    const phase = side === 1 ? 0 : Math.PI;
    if (hip.current) {
      hip.current.rotation.x = w < 0.82 ? Math.sin(w * 24 + phase) * 0.5 : -0.04;
    }
    if (shin.current) {
      shin.current.rotation.x =
        w < 0.82 ? Math.max(0, -Math.sin(w * 24 + phase)) * 0.7 + 0.05 : 0.04;
    }
  });

  return (
    <group ref={hip} position={[side * 0.085, 0.62, 0]}>
      {/* thigh (dhoti colour) */}
      <mesh material={mats.dhoti} position={[0, -0.16, 0]} castShadow>
        <capsuleGeometry args={[0.062, 0.22, 3, 8]} />
      </mesh>
      <group ref={shin} position={[0, -0.34, 0]}>
        {/* shin (skin below knee — dhoti is knee-length) */}
        <mesh material={mats.skin} position={[0, -0.13, 0]}>
          <capsuleGeometry args={[0.05, 0.2, 3, 8]} />
        </mesh>
        {/* sandal */}
        <mesh material={mats.wood} position={[0, -0.28, 0.03]}>
          <boxGeometry args={[0.09, 0.03, 0.19]} />
        </mesh>
      </group>
    </group>
  );
}

export function FarmerCharacter({ walk, wind }: FarmerProps) {
  const mats = useMaterials();
  const root = useRef<THREE.Group>(null);

  useFrame((_, delta) => {
    const w = walk.current ?? 0;
    if (!root.current) return;
    // slow drift of position handled by parent timeline; here only tiny sway
    root.current.rotation.y = Math.sin(w * 6) * 0.02;
    void delta;
  });

  return (
    <group ref={root} dispose={null}>
      <UpperBody mats={mats} walk={walk} wind={wind} />
      <Arm mats={mats} side={1} walk={walk} holdsTool />
      <Arm mats={mats} side={-1} walk={walk} />
      <Leg mats={mats} side={1} walk={walk} />
      <Leg mats={mats} side={-1} walk={walk} />
      {/* soft contact shadow */}
      <ContactShadowBlob />
    </group>
  );
}

function ContactShadowBlob() {
  return (
    <mesh position={[0, 0.012, 0]} rotation={[-Math.PI / 2, 0, 0]}>
      <circleGeometry args={[0.42, 24]} />
      <meshBasicMaterial color="#1d2b1a" transparent opacity={0.28} depthWrite={false} />
    </mesh>
  );
}
