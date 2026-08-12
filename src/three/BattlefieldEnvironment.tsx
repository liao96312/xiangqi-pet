import { RoundedBox } from '@react-three/drei';
import { useEffect, useMemo } from 'react';
import * as THREE from 'three';
import type { GraphicsSettings } from './quality';

export type BattlefieldTheme = 'overcast' | 'dusk';

type BattlefieldEnvironmentProps = Pick<GraphicsSettings, 'environmentDetail' | 'battlefieldProps' | 'fireCount'> & {
  theme: BattlefieldTheme;
};

const THEME_COLORS = {
  overcast: {
    sky: '#686d6d', ground: '#625b4d', earth: '#665d4c', mountainA: '#555b59', mountainB: '#60635f',
    wallA: '#42443f', wallB: '#59574d', tentRed: '#633b34', tentBlack: '#303d45'
  },
  dusk: {
    sky: '#4f3631', ground: '#422d24', earth: '#594232', mountainA: '#403737', mountainB: '#4c403c',
    wallA: '#40362f', wallB: '#5b493b', tentRed: '#71352b', tentBlack: '#29333d'
  }
} as const;

const MOUNTAINS = [
  [-30, -1.7, -42, 13, 7], [-15, -2.1, -45, 16, 9], [2, -1.5, -48, 19, 10],
  [19, -2.2, -45, 15, 8], [33, -1.8, -42, 12, 7],
  [-30, -1.7, 42, 13, 7], [-15, -2.1, 45, 16, 9], [2, -1.5, 48, 19, 10],
  [19, -2.2, 45, 15, 8], [33, -1.8, 42, 12, 7]
] as const;

const RUBBLE = [
  [-8.8, -0.39, -6.4, 0.8, 0.45, 0.6, 0.2], [-9.5, -0.42, 1.8, 1.1, 0.35, 0.55, -0.25],
  [8.9, -0.4, -3.1, 0.75, 0.42, 0.7, 0.55], [9.8, -0.43, 5.3, 1.2, 0.32, 0.6, -0.35],
  [-7.8, -0.44, 8.3, 0.65, 0.3, 0.48, 0.7], [7.4, -0.43, 8.7, 0.9, 0.34, 0.5, -0.5]
] as const;

const STAKES = [-7.2, -5.8, -4.4, 4.4, 5.8, 7.2] as const;

function seededNoise(index: number) {
  const value = Math.sin(index * 91.733 + 17.13) * 43758.5453;
  return value - Math.floor(value);
}

function createMudTexture(theme: BattlefieldTheme) {
  const palette = THEME_COLORS[theme];
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 512;
  const context = canvas.getContext('2d');
  if (!context) throw new Error('Unable to create battlefield texture');
  context.fillStyle = palette.ground;
  context.fillRect(0, 0, 512, 512);
  for (let index = 0; index < 420; index += 1) {
    const x = seededNoise(index * 3) * 512;
    const y = seededNoise(index * 3 + 1) * 512;
    const radius = 2 + seededNoise(index * 3 + 2) * 18;
    context.fillStyle = index % 3 === 0 ? 'rgba(24,20,16,.13)' : 'rgba(139,120,88,.08)';
    context.beginPath();
    context.ellipse(x, y, radius * 1.8, radius, seededNoise(index + 8) * Math.PI, 0, Math.PI * 2);
    context.fill();
  }
  context.strokeStyle = 'rgba(28,23,17,.22)';
  context.lineWidth = 2;
  for (let index = 0; index < 28; index += 1) {
    const x = seededNoise(index + 900) * 512;
    const y = seededNoise(index + 1200) * 512;
    context.beginPath();
    context.moveTo(x, y);
    context.lineTo(x + seededNoise(index + 1500) * 48 - 24, y + 18 + seededNoise(index + 1800) * 42);
    context.stroke();
  }
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.repeat.set(10, 10);
  texture.anisotropy = 4;
  return texture;
}

function Banner({ position, color, yaw = 0 }: { position: [number, number, number]; color: string; yaw?: number }) {
  return (
    <group position={position} rotation={[0, yaw, 0]}>
      <mesh position={[0, 1.45, 0]} castShadow><cylinderGeometry args={[0.035, 0.05, 3.1, 8]} /><meshStandardMaterial color="#30271e" roughness={0.9} /></mesh>
      <mesh position={[0.46, 2.25, 0]} castShadow><planeGeometry args={[0.9, 1.1]} /><meshStandardMaterial color={color} roughness={0.92} side={THREE.DoubleSide} /></mesh>
      <mesh position={[0.7, 1.8, 0]} rotation={[0, 0, -0.52]} castShadow><planeGeometry args={[0.6, 0.45]} /><meshStandardMaterial color={color} roughness={0.95} side={THREE.DoubleSide} /></mesh>
    </group>
  );
}

function Tent({ position, color, yaw }: { position: [number, number, number]; color: string; yaw: number }) {
  return (
    <group position={position} rotation={[0, yaw, 0]}>
      <mesh position={[0, 0.2, 0]} rotation={[0, Math.PI / 4, 0]} castShadow receiveShadow>
        <coneGeometry args={[1.6, 2.3, 4]} />
        <meshStandardMaterial color={color} roughness={0.96} />
      </mesh>
      <mesh position={[0, 1.55, 0]}><cylinderGeometry args={[0.04, 0.05, 1.2, 8]} /><meshStandardMaterial color="#3a2b20" roughness={1} /></mesh>
    </group>
  );
}

function Brazier({ position, lit }: { position: [number, number, number]; lit: boolean }) {
  return (
    <group position={position}>
      <mesh position={[0, 0.42, 0]} castShadow><cylinderGeometry args={[0.36, 0.24, 0.42, 8]} /><meshStandardMaterial color="#332d27" roughness={0.68} metalness={0.55} /></mesh>
      {lit ? <>
        <mesh position={[0, 0.82, 0]}><coneGeometry args={[0.18, 0.62, 7]} /><meshBasicMaterial color="#e58b3a" toneMapped={false} /></mesh>
        <pointLight position={[0, 1.05, 0]} color="#ff9c4c" intensity={16} distance={7} decay={2} />
      </> : null}
    </group>
  );
}

export function BattlefieldEnvironment({ environmentDetail, battlefieldProps, fireCount, theme }: BattlefieldEnvironmentProps) {
  const palette = THEME_COLORS[theme];
  const mud = useMemo(() => createMudTexture(theme), [theme]);
  useEffect(() => () => mud.dispose(), [mud]);
  const full = environmentDetail === 'full';

  return (
    <group>
      <mesh scale={[-1, 1, 1]}><sphereGeometry args={[58, 24, 12]} /><meshBasicMaterial color={palette.sky} side={THREE.BackSide} fog={false} /></mesh>
      <mesh position={[0, -0.79, 0]} rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
        <planeGeometry args={[90, 90, full ? 32 : 1, full ? 32 : 1]} />
        <meshStandardMaterial map={mud} color={palette.earth} roughness={1} metalness={0} />
      </mesh>
      <mesh position={[0, -0.65, 0]} receiveShadow castShadow>
        <cylinderGeometry args={[8.7, 9.15, 0.28, 32]} />
        <meshStandardMaterial color="#38352f" roughness={0.94} />
      </mesh>
      <mesh position={[0, -0.49, 0]} receiveShadow>
        <cylinderGeometry args={[8.45, 8.6, 0.07, 32]} />
        <meshStandardMaterial color="#595247" roughness={0.93} />
      </mesh>
      {MOUNTAINS.map(([x, y, z, radius, height], index) => (
        <mesh key={`mountain-${index}`} position={[x, y, z]} rotation={[0, seededNoise(index) * Math.PI, 0]}>
          <coneGeometry args={[radius, height, 7]} />
          <meshStandardMaterial color={index % 2 ? palette.mountainA : palette.mountainB} roughness={1} flatShading />
        </mesh>
      ))}
      <group position={[-11.5, 0, -2.5]} rotation={[0, 0.08, 0]}>
        <RoundedBox args={[2.1, 3.2, 8.5]} radius={0.08} smoothness={2} position={[0, 0.55, 0]} castShadow receiveShadow><meshStandardMaterial color={palette.wallA} roughness={0.98} /></RoundedBox>
        <mesh position={[0, 1.1, 0]}><boxGeometry args={[2.4, 0.3, 9]} /><meshStandardMaterial color={palette.wallB} roughness={0.9} /></mesh>
      </group>
      <group position={[11.5, 0, -2.5]} rotation={[0, -0.08, 0]}>
        <RoundedBox args={[2.1, 2.5, 7]} radius={0.08} smoothness={2} position={[0, 0.2, 0]} castShadow receiveShadow><meshStandardMaterial color={palette.wallA} roughness={0.98} /></RoundedBox>
        <mesh position={[0, 0.7, 0]}><boxGeometry args={[2.4, 0.28, 7.5]} /><meshStandardMaterial color={palette.wallB} roughness={0.92} /></mesh>
      </group>
      {battlefieldProps ? <>
        <Tent position={[-10.5, 0.35, 8.5]} color={palette.tentRed} yaw={0.35} />
        <Tent position={[10.7, 0.35, 8.1]} color={palette.tentBlack} yaw={-0.45} />
        <Tent position={[-10.8, 0.35, -10.8]} color={palette.tentRed} yaw={2.65} />
        <Tent position={[10.4, 0.35, -10.4]} color={palette.tentBlack} yaw={-2.7} />
        <Banner position={[-8.7, -0.5, 6.8]} color="#78372e" yaw={0.25} />
        <Banner position={[8.7, -0.5, -6.8]} color="#293b4a" yaw={Math.PI + 0.25} />
        {RUBBLE.map(([x, y, z, sx, sy, sz, yaw], index) => <mesh key={`rubble-${index}`} position={[x, y, z]} rotation={[0.18, yaw, 0.12]} castShadow receiveShadow><boxGeometry args={[sx, sy, sz]} /><meshStandardMaterial color={index % 2 ? '#4b4942' : '#5a5549'} roughness={1} /></mesh>)}
        {STAKES.map((x, index) => <group key={`stake-${index}`} position={[x, -0.28, index % 2 ? 8.9 : -8.9]} rotation={[0, index % 2 ? 0.15 : -0.15, -0.18]}><mesh castShadow><cylinderGeometry args={[0.08, 0.13, 2.2, 7]} /><meshStandardMaterial color="#3a2b20" roughness={1} /></mesh><mesh position={[0, 1.15, 0]}><coneGeometry args={[0.14, 0.45, 7]} /><meshStandardMaterial color="#241a14" roughness={1} /></mesh></group>)}
      </> : null}
      <Brazier position={[-7.7, -0.48, 6.2]} lit={fireCount > 0} />
      <Brazier position={[7.7, -0.48, -6.2]} lit={fireCount > 1} />
      {fireCount > 2 ? <Brazier position={[7.5, -0.48, 6.3]} lit /> : null}
      {fireCount > 3 ? <Brazier position={[-7.5, -0.48, -6.3]} lit /> : null}
    </group>
  );
}
