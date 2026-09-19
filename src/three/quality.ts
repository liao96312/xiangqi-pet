export type GraphicsQuality = 'low' | 'medium' | 'high' | 'ultra';

export type GraphicsSettings = {
  dpr: [number, number];
  shadows: boolean;
  shadowMapSize: number;
  contactShadows: boolean;
  contactShadowResolution: number;
  idleAnimations: boolean;
  environmentDetail: 'silhouette' | 'full';
  battlefieldProps: boolean;
  fireCount: number;
};

export const GRAPHICS_SETTINGS: Record<GraphicsQuality, GraphicsSettings> = {
  low: {
    dpr: [1, 1],
    shadows: false,
    shadowMapSize: 512,
    contactShadows: false,
    contactShadowResolution: 256,
    idleAnimations: false,
    environmentDetail: 'silhouette',
    battlefieldProps: false,
    fireCount: 0
  },
  medium: {
    dpr: [1, 1.25],
    shadows: true,
    shadowMapSize: 1024,
    contactShadows: true,
    contactShadowResolution: 256,
    idleAnimations: true,
    environmentDetail: 'full',
    battlefieldProps: true,
    fireCount: 0
  },
  high: {
    dpr: [1, 1.5],
    shadows: true,
    shadowMapSize: 2048,
    contactShadows: true,
    contactShadowResolution: 512,
    idleAnimations: true,
    environmentDetail: 'full',
    battlefieldProps: true,
    fireCount: 2
  },
  ultra: {
    dpr: [1, 2],
    shadows: true,
    shadowMapSize: 4096,
    contactShadows: true,
    contactShadowResolution: 1024,
    idleAnimations: true,
    environmentDetail: 'full',
    battlefieldProps: true,
    fireCount: 4
  }
};

export function detectGraphicsQuality(): GraphicsQuality {
  if (typeof window === 'undefined') return 'high';
  const touch = window.matchMedia('(pointer: coarse)').matches;
  const cores = navigator.hardwareConcurrency ?? 4;
  const memory = (navigator as Navigator & { deviceMemory?: number }).deviceMemory;

  let renderer = '';
  try {
    const canvas = document.createElement('canvas');
    const gl = canvas.getContext('webgl2') ?? canvas.getContext('webgl');
    const debugInfo = gl?.getExtension('WEBGL_debug_renderer_info');
    if (gl && debugInfo) renderer = String(gl.getParameter(debugInfo.UNMASKED_RENDERER_WEBGL)).toLowerCase();
  } catch {
    // Hardware probing is an optional first-run hint.
  }

  const weakGpu = /(swiftshader|llvmpipe|software|mali-4|adreno \(tm\) [345]|intel.*hd graphics [2-4])/.test(renderer);
  const strongGpu = /(rtx|radeon rx|apple m[1-9]|geforce gtx 1[06-9]|arc a)/.test(renderer);
  if (weakGpu || cores <= 2 || (memory !== undefined && memory <= 2)) return 'low';
  if (touch) return cores >= 4 && (memory === undefined || memory >= 3) ? 'medium' : 'low';
  if (strongGpu && cores >= 8 && (memory === undefined || memory >= 8)) return 'ultra';
  if (cores >= 6 && (memory === undefined || memory >= 4)) return 'high';
  return 'medium';
}
