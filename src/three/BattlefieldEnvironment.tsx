import { useGLTF } from '@react-three/drei';
import { useEffect, useMemo } from 'react';
import * as THREE from 'three';
import { clone } from 'three/examples/jsm/utils/SkeletonUtils.js';
import type { GraphicsSettings } from './quality';

export type BattlefieldTheme = 'overcast' | 'dusk';

type BattlefieldEnvironmentProps = Pick<GraphicsSettings, 'environmentDetail' | 'battlefieldProps' | 'fireCount'> & {
  theme: BattlefieldTheme;
};

const ASSETS = {
  platform: './assets/environment/command-platform-hy3-v1.glb',
  wallLong: './assets/environment/wall-long-hy3-v1.glb',
  wallShort: './assets/environment/wall-short-hy3-v1.glb',
  tentRed: './assets/environment/tent-red-hy3-v1.glb',
  tentBlack: './assets/environment/tent-black-hy3-v1.glb',
  bannerRed: './assets/environment/banner-red-hy3-v1.glb',
  bannerBlack: './assets/environment/banner-black-hy3-v1.glb',
  barricade: './assets/environment/cheval-de-frise-hy3-v1.glb',
  brazier: './assets/environment/brazier-hy3-v1.glb',
  rubbleBrick: './assets/environment/rubble-brick-a-hy3-v1.glb',
  rubbleCharred: './assets/environment/rubble-charred-b-hy3-v1.glb',
  watchtower: './assets/environment/watchtower-hy3-v1.glb',
  warDrumRed: './assets/environment/war-drum-red-hy3-v1.glb',
  warDrumBlack: './assets/environment/war-drum-black-hy3-v1.glb',
  supplyCart: './assets/environment/supply-cart-hy3-v1.glb',
  weaponRack: './assets/environment/weapon-rack-hy3-v1.glb'
} as const;

const THEME_COLORS = {
  overcast: { sky: '#686d6d', ground: '#625b4d', earth: '#665d4c', mountainA: '#555b59', mountainB: '#60635f' },
  dusk: { sky: '#4f3631', ground: '#422d24', earth: '#594232', mountainA: '#403737', mountainB: '#4c403c' }
} as const;

const MOUNTAINS = [
  [-30, -1.7, -42, 13, 7], [-15, -2.1, -45, 16, 9], [2, -1.5, -48, 19, 10],
  [19, -2.2, -45, 15, 8], [33, -1.8, -42, 12, 7],
  [-30, -1.7, 42, 13, 7], [-15, -2.1, 45, 16, 9], [2, -1.5, 48, 19, 10],
  [19, -2.2, 45, 15, 8], [33, -1.8, 42, 12, 7]
] as const;

const RUBBLE_PROPS = [
  [ASSETS.rubbleBrick, -9.2, -7.2, 0.35, 0.48],
  [ASSETS.rubbleCharred, -9.7, 2.1, -0.45, 0.54],
  [ASSETS.rubbleBrick, 9.5, 4.8, -0.25, 0.46],
  [ASSETS.rubbleCharred, 8.9, -4.2, 0.62, 0.52],
  [ASSETS.rubbleBrick, -7.2, 9.7, 1.1, 0.44],
  [ASSETS.rubbleCharred, 7.2, -9.7, -1.05, 0.46]
] as const;

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
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.repeat.set(10, 10);
  texture.anisotropy = 4;
  return texture;
}

type EnvironmentAssetProps = {
  url: string;
  position: [number, number, number];
  rotation?: [number, number, number];
  scale?: number | [number, number, number];
  tint?: string;
};

function EnvironmentAsset({ url, position, rotation = [0, 0, 0], scale = 1, tint }: EnvironmentAssetProps) {
  const { scene } = useGLTF(url);
  const instance = useMemo(() => {
    const copy = clone(scene);
    copy.traverse((child) => {
      if (!(child instanceof THREE.Mesh)) return;
      child.castShadow = true;
      child.receiveShadow = true;
      if (tint) child.material = Array.isArray(child.material) ? child.material.map((material) => material.clone()) : child.material.clone();
      const materials = Array.isArray(child.material) ? child.material : [child.material];
      for (const material of materials) {
        if (!(material instanceof THREE.MeshStandardMaterial)) continue;
        if (tint) material.color.set(tint);
        for (const texture of [material.map, material.normalMap, material.roughnessMap, material.metalnessMap]) {
          if (texture) texture.anisotropy = Math.max(texture.anisotropy, 4);
        }
      }
    });
    return copy;
  }, [scene, tint]);
  return <primitive object={instance} position={position} rotation={rotation} scale={scale} />;
}

function Brazier({ position, lit }: { position: [number, number, number]; lit: boolean }) {
  return (
    <group position={position}>
      <EnvironmentAsset url={ASSETS.brazier} position={[0, 0, 0]} scale={0.9} />
      {lit ? <>
        <mesh position={[0, 0.82, 0]}><coneGeometry args={[0.16, 0.56, 7]} /><meshBasicMaterial color="#e58b3a" toneMapped={false} /></mesh>
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
      <mesh position={[0, -0.82, 0]} rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
        <planeGeometry args={[90, 90, full ? 32 : 1, full ? 32 : 1]} />
        <meshStandardMaterial map={mud} color={palette.earth} roughness={1} metalness={0} />
      </mesh>
      <EnvironmentAsset url={ASSETS.platform} position={[0, -0.58, 0]} tint={theme === 'dusk' ? '#8a6a54' : '#857b69'} />
      {MOUNTAINS.map(([x, y, z, radius, height], index) => (
        <mesh key={`mountain-${index}`} position={[x, y, z]} rotation={[0, seededNoise(index) * Math.PI, 0]}>
          <coneGeometry args={[radius, height, 7]} />
          <meshStandardMaterial color={index % 2 ? palette.mountainA : palette.mountainB} roughness={1} flatShading />
        </mesh>
      ))}
      <EnvironmentAsset url={ASSETS.wallLong} position={[-12.2, -0.77, -2.5]} rotation={[0, Math.PI / 2 + 0.08, 0]} tint={theme === 'dusk' ? '#705846' : '#756e60'} />
      <EnvironmentAsset url={ASSETS.wallShort} position={[12.1, -0.77, -2.1]} rotation={[0, -Math.PI / 2 - 0.1, 0]} tint={theme === 'dusk' ? '#705846' : '#756e60'} />
      {battlefieldProps ? <>
        <EnvironmentAsset url={ASSETS.tentRed} position={[-11.2, -0.77, 7.6]} rotation={[0, 0.35, 0]} />
        <EnvironmentAsset url={ASSETS.tentRed} position={[11.3, -0.77, 5.8]} rotation={[0, -0.55, 0]} scale={0.94} />
        <EnvironmentAsset url={ASSETS.tentBlack} position={[-11.4, -0.77, -6.2]} rotation={[0, 2.65, 0]} scale={0.94} />
        <EnvironmentAsset url={ASSETS.tentBlack} position={[11.4, -0.77, -8.4]} rotation={[0, -2.7, 0]} scale={0.9} />
        <EnvironmentAsset url={ASSETS.bannerRed} position={[-8.8, -0.77, 7.2]} rotation={[0, 0.25, 0]} scale={0.82} />
        <EnvironmentAsset url={ASSETS.bannerBlack} position={[8.8, -0.77, -7.2]} rotation={[0, Math.PI + 0.25, 0]} scale={0.82} />
        <EnvironmentAsset url={ASSETS.barricade} position={[-6.3, -0.77, 9.5]} rotation={[0, 0.08, 0]} />
        <EnvironmentAsset url={ASSETS.barricade} position={[6.4, -0.77, -9.5]} rotation={[0, Math.PI + 0.08, 0]} />
        <EnvironmentAsset url={ASSETS.watchtower} position={[-14.1, -0.77, -10.7]} rotation={[0, 0.32, 0]} scale={0.72} tint={theme === 'dusk' ? '#745942' : '#776c58'} />
        <EnvironmentAsset url={ASSETS.watchtower} position={[14.1, -0.77, 10.5]} rotation={[0, Math.PI + 0.32, 0]} scale={0.72} tint={theme === 'dusk' ? '#745942' : '#776c58'} />
        <EnvironmentAsset url={ASSETS.warDrumRed} position={[-8.3, -0.77, 8.4]} rotation={[0, 0.55, 0]} scale={0.78} />
        <EnvironmentAsset url={ASSETS.warDrumBlack} position={[8.3, -0.77, -8.4]} rotation={[0, Math.PI + 0.55, 0]} scale={0.78} />
        <EnvironmentAsset url={ASSETS.supplyCart} position={[-10.6, -0.77, -2.5]} rotation={[0, 1.28, 0]} scale={0.76} tint={theme === 'dusk' ? '#715844' : '#746a59'} />
        <EnvironmentAsset url={ASSETS.supplyCart} position={[10.6, -0.77, -2.5]} rotation={[0, -1.78, 0]} scale={0.76} tint={theme === 'dusk' ? '#715844' : '#746a59'} />
        <EnvironmentAsset url={ASSETS.weaponRack} position={[-9.8, -0.77, -7.5]} rotation={[0, 0.35, 0]} scale={0.82} tint="#756854" />
        <EnvironmentAsset url={ASSETS.weaponRack} position={[9.8, -0.77, 7.5]} rotation={[0, Math.PI + 0.35, 0]} scale={0.82} tint="#756854" />
        {RUBBLE_PROPS.map(([url, x, z, yaw, propScale], index) => (
          <EnvironmentAsset key={`rubble-${index}`} url={url} position={[x, -0.78, z]} rotation={[0, yaw, 0]} scale={propScale} tint={theme === 'dusk' ? '#66503f' : '#6f685a'} />
        ))}
      </> : null}
      {fireCount > 0 ? <Brazier position={[-7.7, -0.77, 6.2]} lit /> : null}
      {fireCount > 1 ? <Brazier position={[7.7, -0.77, -6.2]} lit /> : null}
      {fireCount > 2 ? <Brazier position={[7.5, -0.77, 6.3]} lit /> : null}
      {fireCount > 3 ? <Brazier position={[-7.5, -0.77, -6.3]} lit /> : null}
    </group>
  );
}
