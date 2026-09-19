import { OrbitControls, RoundedBox, useAnimations, useGLTF } from '@react-three/drei';
import { Canvas, useFrame, useThree, type RootState, type ThreeEvent } from '@react-three/fiber';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import * as THREE from 'three';
import { SkeletonUtils, type OrbitControls as OrbitControlsImpl } from 'three-stdlib';
import { posKey, type Piece, type PieceType, type Pos } from '../game/xiangqi';
import {
  BOARD_HIGHLIGHT_Y,
  BOARD_MARK_Y,
  BOARD_RING_Y,
  BOARD_TOP,
  boardToWorld,
  homeFacingYaw,
  lerpYaw,
  movementFacingYaw,
  worldToBoard
} from '../three/boardGeometry';
import { BattlefieldEnvironment, type BattlefieldTheme } from '../three/BattlefieldEnvironment';
import { detectGraphicsQuality, GRAPHICS_SETTINGS, type GraphicsQuality } from '../three/quality';
import { PIECE_LABELS, TACTICAL_TOKEN_TYPES, tacticalTokenStyle } from '../three/tacticalTokens';
import { solveBoardFraming, type BoardView } from '../three/viewport';
import type { BoardProps } from './Board';

type Point = [number, number, number];
type Board3DProps = BoardProps & { onRenderFailure?: () => void; onFlippedChange?: (flipped: boolean) => void };
type UnitAction = 'idle' | 'move' | 'attack' | 'hit' | 'death';
type VisualMoveAnimation = NonNullable<BoardProps['moveAnimation']> & { movingPiece: Piece };

const MODEL_YAW_CORRECTION: Record<PieceType, number> = {
  pawn: 0,
  cannon: 0,
  horse: -Math.PI / 2,
  rook: Math.PI / 2,
  advisor: 0,
  elephant: Math.PI / 2,
  king: 0
};

const MODEL_FORWARD_OFFSET: Record<PieceType, number> = {
  pawn: 0,
  cannon: 0,
  horse: 0.18,
  rook: 0.18,
  advisor: 0,
  elephant: 0.18,
  king: 0
};

const QUALITY_KEY = 'xiangqi-pet-3d-quality';
const THEME_KEY = 'xiangqi-pet-3d-theme';

const SCENE_THEMES = {
  overcast: {
    background: '#686d6d', fog: '#646968', hemisphereSky: '#bac4c5', hemisphereGround: '#302820',
    key: '#e4d7bd', keyIntensity: 2.65, fill: '#829aa7', fillIntensity: 0.86, cameraFill: '#cfdadc',
    boardBase: '#292b28', boardTrim: '#5b574b', boardFace: '#5f5b4e'
  },
  dusk: {
    background: '#4f3631', fog: '#4d3832', hemisphereSky: '#b78b70', hemisphereGround: '#241915',
    key: '#ffb064', keyIntensity: 3.35, fill: '#657b99', fillIntensity: 0.72, cameraFill: '#d3b3a0',
    boardBase: '#272421', boardTrim: '#684c35', boardFace: '#655040'
  }
} as const;

function readSavedQuality(): GraphicsQuality {
  const qaQuality = new URLSearchParams(window.location.search).get('quality');
  if (qaQuality === 'low' || qaQuality === 'medium' || qaQuality === 'high' || qaQuality === 'ultra') return qaQuality;
  try {
    const saved = window.localStorage.getItem(QUALITY_KEY);
    if (saved === 'low' || saved === 'medium' || saved === 'high' || saved === 'ultra') return saved;
  } catch {
    // Ignore disabled storage.
  }
  return detectGraphicsQuality();
}

function readSavedTheme(): BattlefieldTheme {
  const qaTheme = new URLSearchParams(window.location.search).get('qa3d');
  if (qaTheme === 'dusk' || qaTheme === 'overcast') return qaTheme;
  try {
    return window.localStorage.getItem(THEME_KEY) === 'dusk' ? 'dusk' : 'overcast';
  } catch {
    return 'overcast';
  }
}

function readInitialView(): BoardView {
  const view = new URLSearchParams(window.location.search).get('view');
  if (view === 'tactical' || view === 'overhead' || view === 'cinematic' || view === 'seat') return view;
  return 'seat';
}

export function Board3D({ onRenderFailure, onFlippedChange, ...props }: Board3DProps) {
  const reducedMotion = useReducedMotion();
  const visualMoves = useVisualMoveAnimations(props.moveAnimation, props.board, reducedMotion);
  const [view, setView] = useState<BoardView>(readInitialView);
  const [quality, setQuality] = useState<GraphicsQuality>(readSavedQuality);
  const [theme, setTheme] = useState<BattlefieldTheme>(readSavedTheme);
  const [recoveryNotice, setRecoveryNotice] = useState('');
  const renderer = useRef<THREE.WebGLRenderer | null>(null);
  const renderFailure = useRef(onRenderFailure);
  const contextLost = useRef(false);
  const fallbackTimer = useRef(0);
  renderFailure.current = onRenderFailure;
  const settings = GRAPHICS_SETTINGS[quality];

  const stepQualityDown = useCallback(() => {
    setQuality((current) => {
      const order: GraphicsQuality[] = ['low', 'medium', 'high', 'ultra'];
      return order[Math.max(0, order.indexOf(current) - 1)];
    });
  }, []);

  const handleContextLost = useCallback(() => {
    if (contextLost.current) return;
    contextLost.current = true;
    setRecoveryNotice('图形驱动已重置，正在降低画质…');
    stepQualityDown();
    window.clearTimeout(fallbackTimer.current);
    fallbackTimer.current = window.setTimeout(() => renderFailure.current?.(), 2500);
  }, [stepQualityDown]);

  const handleContextRestored = useCallback(() => {
    contextLost.current = false;
    window.clearTimeout(fallbackTimer.current);
    setRecoveryNotice('');
  }, []);

  const handleCanvasCreated = useCallback(({ gl }: RootState) => {
    gl.outputColorSpace = THREE.SRGBColorSpace;
    gl.toneMapping = THREE.ACESFilmicToneMapping;
    gl.toneMappingExposure = 1.08;
    gl.setClearColor('#77766f', 1);
    renderer.current = gl;

    gl.domElement.addEventListener('webglcontextlost', (event) => {
      event.preventDefault();
      handleContextLost();
    });
    gl.domElement.addEventListener('webglcontextrestored', handleContextRestored);
  }, [handleContextLost, handleContextRestored]);

  useEffect(() => {
    const poll = window.setInterval(() => {
      const lost = renderer.current?.getContext().isContextLost() ?? false;
      if (lost) handleContextLost();
      else if (contextLost.current) handleContextRestored();
    }, 500);
    return () => {
      window.clearInterval(poll);
      window.clearTimeout(fallbackTimer.current);
    };
  }, [handleContextLost, handleContextRestored]);

  useEffect(() => {
    try {
      window.localStorage.setItem(QUALITY_KEY, quality);
    } catch {
      // Ignore disabled storage.
    }
  }, [quality]);

  useEffect(() => {
    try {
      window.localStorage.setItem(THEME_KEY, theme);
    } catch {
      // Ignore disabled storage.
    }
  }, [theme]);

  return (
    <section
      className="board-wrap board-wrap-3d"
      aria-label="中国象棋三维棋盘"
      data-view={view}
      data-flipped={props.flipped ? 'true' : 'false'}
      data-quality={quality}
      data-theme={theme}
    >
      <div className="xiangqi-board board-3d-canvas">
        <Canvas
          shadows={settings.shadows}
          camera={{ position: [8.8, 8.7, 10.2], fov: 46, near: 0.1, far: 120 }}
          dpr={reducedMotion ? [1, 1] : settings.dpr}
          gl={{ alpha: true, antialias: quality !== 'low' }}
          onCreated={handleCanvasCreated}
          fallback={<div className="board-3d-fallback">3D 棋盘不可用，已切换为 2D</div>}
        >
          <FrameBudgetGuard onSlow={stepQualityDown} />
          <Scene {...props} visualMoves={visualMoves} reducedMotion={reducedMotion} view={view} quality={quality} theme={theme} />
        </Canvas>
      </div>
      {recoveryNotice ? <div className="board3d-recovery" role="status">{recoveryNotice}</div> : null}
      <div className="board3d-hud" aria-label="三维视图设置">
        <div className="board3d-view-switch" role="group" aria-label="镜头视图">
          <button className={view === 'seat' && !props.flipped ? 'active' : ''} type="button" onClick={() => { onFlippedChange?.(false); setView('seat'); }}>红方席位</button>
          <button className={view === 'seat' && props.flipped ? 'active' : ''} type="button" onClick={() => { onFlippedChange?.(true); setView('seat'); }}>黑方席位</button>
          <button className={view === 'overhead' ? 'active' : ''} type="button" onClick={() => setView('overhead')}>俯视</button>
          <button className={view === 'cinematic' ? 'active' : ''} type="button" onClick={() => setView('cinematic')}>电影</button>
          <button className={view === 'tactical' ? 'active' : ''} type="button" onClick={() => setView('tactical')}>战术</button>
          <button type="button" title="沿用全局翻转视角" onClick={() => onFlippedChange?.(!props.flipped)}>翻转 180°</button>
        </div>
        <label>
          <span>画质</span>
          <select value={quality} onChange={(event) => setQuality(event.target.value as GraphicsQuality)}>
            <option value="low">低</option>
            <option value="medium">中</option>
            <option value="high">高</option>
            <option value="ultra">极高</option>
          </select>
        </label>
        <label>
          <span>天候</span>
          <select value={theme} onChange={(event) => setTheme(event.target.value as BattlefieldTheme)}>
            <option value="overcast">阴天战场</option>
            <option value="dusk">黄昏烽火</option>
          </select>
        </label>
      </div>
      <Board3DAccessibility {...props} />
    </section>
  );
}

function FrameBudgetGuard({ onSlow }: { onSlow: () => void }) {
  const elapsed = useRef(0);
  const measured = useRef(0);
  const frames = useRef(0);
  const finished = useRef(false);

  useFrame((_, delta) => {
    if (finished.current) return;
    elapsed.current += delta;
    if (elapsed.current < 6) return;
    measured.current += Math.min(delta, 0.1);
    frames.current += 1;
    if (frames.current < 180) return;
    finished.current = true;
    if (measured.current / frames.current > 1 / 28) onSlow();
  });
  return null;
}

function useVisualMoveAnimations(animation: BoardProps['moveAnimation'], board: BoardProps['board'], reducedMotion: boolean) {
  const [active, setActive] = useState<VisualMoveAnimation[]>([]);
  const lastReceivedKey = useRef('');
  const timers = useRef(new Map<string, number>());

  useEffect(() => {
    if (!animation) {
      lastReceivedKey.current = '';
      timers.current.forEach((timer) => window.clearTimeout(timer));
      timers.current.clear();
      setActive([]);
      return;
    }
    if (lastReceivedKey.current === animation.key) return;
    lastReceivedKey.current = animation.key;

    const arrival = animation.reverse ? animation.move.from : animation.move.to;
    const movingPiece = board[arrival.row][arrival.col];
    if (!movingPiece) return;

    const visual = { ...animation, movingPiece };
    const originKey = posKey(animation.reverse ? animation.move.to : animation.move.from);
    setActive((current) => [
      ...current.filter((item) => {
        if (item.key === visual.key) return false;
        const itemArrival = item.reverse ? item.move.from : item.move.to;
        const sameUnitMovedAgain = posKey(itemArrival) === originKey
          && item.movingPiece.side === movingPiece.side
          && item.movingPiece.type === movingPiece.type;
        const priorMoverCaptured = !animation.reverse
          && posKey(itemArrival) === posKey(animation.move.to)
          && animation.move.capture?.side === item.movingPiece.side
          && animation.move.capture?.type === item.movingPiece.type;
        return !sameUnitMovedAgain && !priorMoverCaptured;
      }),
      visual
    ]);

    window.clearTimeout(timers.current.get(animation.key));
    const duration = reducedMotion ? 70 : animation.move.capture && !animation.reverse ? 740 : 280;
    const timer = window.setTimeout(() => {
      timers.current.delete(animation.key);
      setActive((current) => current.filter((item) => item.key !== animation.key));
    }, duration);
    timers.current.set(animation.key, timer);
  }, [animation, board, reducedMotion]);

  useEffect(() => () => {
    timers.current.forEach((timer) => window.clearTimeout(timer));
    timers.current.clear();
  }, []);
  return active;
}

function Scene({ board, selected, legalTargetKeys, hint, checkmateMove, lastMove, settleAnimation, captureBurst, flipped, onChoose, visualMoves, reducedMotion, view, quality, theme }: BoardProps & { visualMoves: VisualMoveAnimation[]; reducedMotion: boolean; view: BoardView; quality: GraphicsQuality; theme: BattlefieldTheme }) {
  const settings = GRAPHICS_SETTINGS[quality];
  const palette = SCENE_THEMES[theme];
  const selectedKey = selected ? posKey(selected) : '';
  const hintFrom = hint ? posKey(hint.from) : '';
  const hintTo = hint ? posKey(hint.to) : '';
  const mateFrom = checkmateMove ? posKey(checkmateMove.from) : '';
  const mateTo = checkmateMove ? posKey(checkmateMove.to) : '';
  const lastFrom = lastMove ? posKey(lastMove.from) : '';
  const lastTo = lastMove ? posKey(lastMove.to) : '';
  const movingKeys = new Set(visualMoves.map((animation) => posKey(animation.reverse ? animation.move.from : animation.move.to)));
  const captureMoves = visualMoves.filter((animation) => !animation.reverse && animation.move.capture);
  const fallbackCapturePoint = !captureMoves.length && captureBurst ? boardToWorld(captureBurst.pos) : null;
  const calibrationMode = import.meta.env.DEV && new URLSearchParams(window.location.search).has('calibrate3d');
  const qaDynamic = new URLSearchParams(window.location.search).get('scenario') === 'dynamic';
  const tacticalTextures = useTacticalTokenTextures();

  if (calibrationMode) return <OrientationCalibration />;

  return (
    <>
      <color attach="background" args={[palette.background]} />
      <fog attach="fog" args={[palette.fog, 22, 62]} />
      <CameraRig view={view} flipped={flipped} reducedMotion={reducedMotion} />
      {qaDynamic ? <QaBoardProjection /> : null}
      <CameraFillLight color={palette.cameraFill} />
      <hemisphereLight args={[palette.hemisphereSky, palette.hemisphereGround, 1.35]} />
      <directionalLight
        position={[-8, 16, 10]}
        intensity={palette.keyIntensity}
        color={palette.key}
        castShadow={settings.shadows}
        shadow-mapSize-width={settings.shadowMapSize}
        shadow-mapSize-height={settings.shadowMapSize}
        shadow-camera-near={1}
        shadow-camera-far={32}
        shadow-camera-left={-7}
        shadow-camera-right={7}
        shadow-camera-top={7}
        shadow-camera-bottom={-7}
        shadow-bias={-0.00015}
      />
      <directionalLight position={[7, 10, -9]} color={palette.fill} intensity={palette.fillIntensity} />
      <group>
        <BattlefieldEnvironment environmentDetail={settings.environmentDetail} battlefieldProps={settings.battlefieldProps} fireCount={settings.fireCount} theme={theme} />
        <XiangqiBoard theme={theme} />
        <BoardPickSurface onChoose={onChoose} />
        {board.map((row, rowIndex) =>
          row.map((piece, colIndex) => {
            if (!piece) return null;
            const pos = { row: rowIndex, col: colIndex };
            const key = posKey(pos);
            if (movingKeys.has(key)) return null;
            const common = {
              key,
              piece,
              position: boardToWorld(pos),
              selected: selectedKey === key,
              settled: settleAnimation ? posKey(settleAnimation.pos) === key : false,
              reducedMotion
            };
            return view === 'tactical'
              ? <TacticalToken {...common} flipped={flipped} texture={tacticalTextures[tokenTextureKey(piece)]} />
              : <Piece3D {...common} animateIdle={settings.idleAnimations} />;
          })
        )}
        {visualMoves.map((animation) => {
          const from = boardToWorld(animation.reverse ? animation.move.to : animation.move.from);
          const to = boardToWorld(animation.reverse ? animation.move.from : animation.move.to);
          const capturedPiece = !animation.reverse ? animation.move.capture ?? null : null;
          const travel = { key: animation.key, from, to, capture: !!capturedPiece };
          return view === 'tactical'
            ? <TacticalToken key={animation.key} piece={animation.movingPiece} position={to} travel={travel} selected={false} reducedMotion={reducedMotion} flipped={flipped} texture={tacticalTextures[tokenTextureKey(animation.movingPiece)]} />
            : <Piece3D key={animation.key} piece={animation.movingPiece} position={to} travel={travel} selected={false} reducedMotion={reducedMotion} animateIdle={settings.idleAnimations} />;
        })}
        {captureMoves.map((animation) => {
          const position = boardToWorld(animation.move.to);
          return (
            <group key={`capture-sequence-${animation.key}`}>
              {view === 'tactical' ? (
                <TacticalToken piece={animation.move.capture!} position={position} selected={false} captured reducedMotion={reducedMotion} flipped={flipped} texture={tacticalTextures[tokenTextureKey(animation.move.capture!)]} />
              ) : (
                <Piece3D piece={animation.move.capture!} position={position} selected={false} captured reducedMotion={reducedMotion} animateIdle={settings.idleAnimations} />
              )}
              <CaptureMarker position={position} delayed />
              <CaptureCameraPulse reducedMotion={reducedMotion} />
            </group>
          );
        })}
        {fallbackCapturePoint ? <CaptureMarker key={`capture-marker-${captureBurst?.key}`} position={fallbackCapturePoint} delayed={false} /> : null}
        {Array.from(legalTargetKeys).map((key) => {
          const pos = parsePosKey(key);
          return <Highlight key={`legal-${key}`} position={boardToWorld(pos)} color="#4d9a72" />;
        })}
        {hintFrom ? <Highlight position={boardToWorld(parsePosKey(hintFrom))} color="#d7a33d" /> : null}
        {hintTo ? <Highlight position={boardToWorld(parsePosKey(hintTo))} color="#f1c76f" strong /> : null}
        {mateFrom ? <Highlight position={boardToWorld(parsePosKey(mateFrom))} color="#8b55ba" strong /> : null}
        {mateTo ? <Highlight position={boardToWorld(parsePosKey(mateTo))} color="#d8a84f" strong /> : null}
        {lastFrom ? <Highlight position={boardToWorld(parsePosKey(lastFrom))} color="#477cb0" /> : null}
        {lastTo ? <Highlight position={boardToWorld(parsePosKey(lastTo))} color={lastMove?.capture ? '#bd4d3d' : '#6c9bc4'} strong /> : null}
      </group>
    </>
  );
}

function QaBoardProjection() {
  const { camera, gl } = useThree();
  const lastValue = useRef('');

  useFrame(() => {
    const rect = gl.domElement.getBoundingClientRect();
    const projected: Record<string, [number, number]> = {};
    for (let row = 0; row < 10; row += 1) {
      for (let col = 0; col < 9; col += 1) {
        const [x, y, z] = boardToWorld({ row, col });
        const point = new THREE.Vector3(x, y, z).project(camera);
        projected[`${row}-${col}`] = [
          rect.left + (point.x + 1) * rect.width / 2,
          rect.top + (1 - point.y) * rect.height / 2
        ];
      }
    }
    const value = JSON.stringify(projected);
    if (value !== lastValue.current) {
      gl.domElement.dataset.qaBoardProjection = value;
      lastValue.current = value;
    }
  });

  return null;
}

const CALIBRATION_TYPES: PieceType[] = ['pawn', 'cannon', 'rook', 'horse', 'advisor', 'elephant', 'king'];

function OrientationCalibration() {
  return (
    <>
      <CalibrationCamera />
      <color attach="background" args={['#151311']} />
      <hemisphereLight args={['#e5ddd0', '#251a14', 2.2]} />
      <directionalLight position={[-5, 10, 7]} intensity={4} castShadow />
      <gridHelper args={[16, 16, '#9a6e35', '#493725']} position={[0, 0, 0]} />
      {(['black', 'red'] as const).flatMap((side, sideIndex) =>
        CALIBRATION_TYPES.map((type, index) => (
          <CalibrationUnit key={`${side}-${type}`} type={type} side={side} position={[(index - 3) * 1.65, 0.04, sideIndex === 0 ? -1.65 : 1.65]} />
        ))
      )}
    </>
  );
}

function CalibrationCamera() {
  const { camera } = useThree();
  useEffect(() => {
    camera.position.set(0, 8.2, 11.5);
    camera.lookAt(0, 0.7, 0);
    if (camera instanceof THREE.PerspectiveCamera) {
      camera.fov = 42;
      camera.updateProjectionMatrix();
    }
  }, [camera]);
  return null;
}

function CalibrationUnit({ type, side, position }: { type: PieceType; side: Piece['side']; position: Point }) {
  const arrow = useMemo(
    () => new THREE.ArrowHelper(new THREE.Vector3(0, 0, 1), new THREE.Vector3(0, 0.04, 0), 0.78, side === 'red' ? 0xff4433 : 0x66b9ff, 0.18, 0.1),
    [side]
  );

  return (
    <group position={position} rotation={[0, homeFacingYaw(side), 0]}>
      <primitive object={arrow} />
      <mesh position={[0, 0.72, 0]}>
        <boxGeometry args={[0.92, 1.42, 0.92]} />
        <meshBasicMaterial color={side === 'red' ? '#ff6655' : '#77c7ff'} wireframe transparent opacity={0.28} depthWrite={false} />
      </mesh>
      <PieceGlyph type={type} side={side} color={side === 'red' ? '#b64235' : '#302d29'} selected={false} animateIdle={false} action="idle" />
    </group>
  );
}

function CameraRig({ view, flipped, reducedMotion }: { view: BoardView; flipped: boolean; reducedMotion: boolean }) {
  const { camera, size } = useThree();
  const controls = useRef<OrbitControlsImpl>(null);
  const goalPosition = useRef(new THREE.Vector3());
  const goalTarget = useRef(new THREE.Vector3());
  const transitioning = useRef(true);
  const framing = useMemo(() => solveBoardFraming(size.width, size.height, flipped, view), [size.width, size.height, flipped, view]);

  useEffect(() => {
    goalPosition.current.set(...framing.position);
    goalTarget.current.set(...framing.target);
    const overhead = view === 'tactical' || view === 'overhead';
    camera.up.set(0, overhead ? 0 : 1, overhead ? (flipped ? 1 : -1) : 0);
    if (camera instanceof THREE.PerspectiveCamera) {
      camera.fov = framing.fov;
      camera.updateProjectionMatrix();
    }
    transitioning.current = true;
    if (reducedMotion) {
      camera.position.copy(goalPosition.current);
      if (overhead) camera.lookAt(goalTarget.current);
      else {
        controls.current?.target.copy(goalTarget.current);
        controls.current?.update();
      }
      transitioning.current = false;
    }
  }, [camera, framing, flipped, reducedMotion, view]);

  useFrame((_, delta) => {
    if (!transitioning.current) return;
    const damping = 1 - Math.exp(-delta * 6.5);
    camera.position.lerp(goalPosition.current, damping);
    if (view === 'tactical' || view === 'overhead') camera.lookAt(goalTarget.current);
    else {
      controls.current?.target.lerp(goalTarget.current, damping);
      controls.current?.update();
    }
    if (camera.position.distanceToSquared(goalPosition.current) < 0.0005) {
      camera.position.copy(goalPosition.current);
      if (view === 'tactical' || view === 'overhead') camera.lookAt(goalTarget.current);
      transitioning.current = false;
    }
  });

  return (
    <OrbitControls
      ref={controls}
      makeDefault
      enabled={view === 'seat' || view === 'cinematic'}
      enableDamping
      dampingFactor={0.08}
      enablePan={false}
      enableRotate={view === 'seat' || view === 'cinematic'}
      rotateSpeed={framing.rotateSpeed}
      minDistance={framing.minDistance}
      maxDistance={framing.maxDistance}
      minPolarAngle={framing.minPolarAngle}
      maxPolarAngle={framing.maxPolarAngle}
      minAzimuthAngle={framing.minAzimuthAngle}
      maxAzimuthAngle={framing.maxAzimuthAngle}
      target={framing.target}
    />
  );
}

function CameraFillLight({ color }: { color: string }) {
  const light = useRef<THREE.DirectionalLight>(null);
  const target = useMemo(() => new THREE.Object3D(), []);
  const { camera, scene } = useThree();

  useEffect(() => {
    target.position.set(0, 0.5, 0);
    scene.add(target);
    if (light.current) light.current.target = target;
    return () => { scene.remove(target); };
  }, [scene, target]);

  useFrame(() => {
    light.current?.position.copy(camera.position);
    target.updateMatrixWorld();
  });
  return <directionalLight ref={light} intensity={0.72} color={color} />;
}

function XiangqiBoard({ theme }: { theme: BattlefieldTheme }) {
  const palette = SCENE_THEMES[theme];
  const markings = useMemo(() => createBoardMarkingsTexture(theme), [theme]);

  useEffect(() => () => markings.dispose(), [markings]);

  return (
    <group>
      <RoundedBox args={[10.05, 0.58, 11.05]} radius={0.16} smoothness={4} position={[0, -0.25, 0]} castShadow receiveShadow>
        <meshStandardMaterial color={palette.boardBase} roughness={0.88} metalness={0.08} />
      </RoundedBox>
      <RoundedBox args={[9.78, 0.18, 10.78]} radius={0.09} smoothness={3} position={[0, 0.015, 0]} castShadow receiveShadow>
        <meshStandardMaterial color={palette.boardTrim} roughness={0.48} metalness={0.62} />
      </RoundedBox>
      <RoundedBox args={[9.52, 0.14, 10.52]} radius={0.07} smoothness={3} position={[0, 0.05, 0]} castShadow receiveShadow>
        <meshPhysicalMaterial color={palette.boardFace} roughness={0.82} metalness={0.03} clearcoat={0.06} clearcoatRoughness={0.84} />
      </RoundedBox>
      <mesh position={[0, BOARD_MARK_Y, 0]} rotation={[-Math.PI / 2, 0, 0]} receiveShadow renderOrder={1}>
        <planeGeometry args={[9, 10]} />
        <meshStandardMaterial
          map={markings}
          roughness={0.82}
          metalness={0.02}
          polygonOffset
          polygonOffsetFactor={-1}
          polygonOffsetUnits={-1}
        />
      </mesh>
    </group>
  );
}

function createBoardMarkingsTexture(theme: BattlefieldTheme) {
  const canvas = document.createElement('canvas');
  canvas.width = 1152;
  canvas.height = 1280;
  const context = canvas.getContext('2d');
  if (!context) throw new Error('无法创建棋盘纹理');

  const worldToCanvas = (x: number, z: number) => ({
    x: ((x + 4.5) / 9) * canvas.width,
    y: ((z + 5) / 10) * canvas.height
  });
  const segment = (x1: number, z1: number, x2: number, z2: number) => {
    const from = worldToCanvas(x1, z1);
    const to = worldToCanvas(x2, z2);
    context.moveTo(from.x, from.y);
    context.lineTo(to.x, to.y);
  };

  context.fillStyle = theme === 'dusk' ? '#685040' : '#625f52';
  context.fillRect(0, 0, canvas.width, canvas.height);
  const textureNoise = (index: number) => {
    const value = Math.sin(index * 78.233 + 11.17) * 43758.5453;
    return value - Math.floor(value);
  };
  for (let index = 0; index < 520; index += 1) {
    const x = textureNoise(index * 4) * canvas.width;
    const y = textureNoise(index * 4 + 1) * canvas.height;
    const radius = 2 + textureNoise(index * 4 + 2) * 18;
    context.fillStyle = index % 3 === 0 ? 'rgba(31,27,21,.075)' : 'rgba(196,177,132,.045)';
    context.beginPath();
    context.ellipse(x, y, radius * 2.2, radius, textureNoise(index * 4 + 3) * Math.PI, 0, Math.PI * 2);
    context.fill();
  }
  context.strokeStyle = 'rgba(31,27,21,.16)';
  context.lineWidth = 2;
  for (let index = 0; index < 22; index += 1) {
    const x = textureNoise(index + 3000) * canvas.width;
    const y = textureNoise(index + 4000) * canvas.height;
    context.beginPath();
    context.moveTo(x, y);
    context.lineTo(x + textureNoise(index + 5000) * 90 - 45, y + 16 + textureNoise(index + 6000) * 70);
    context.stroke();
  }
  context.lineCap = 'square';
  context.lineJoin = 'miter';

  const drawGrid = (strokeStyle: string, lineWidth: number, offset = 0) => {
    context.save();
    context.translate(offset, offset);
    context.beginPath();
    for (let row = 0; row < 10; row += 1) segment(-4, row - 4.5, 4, row - 4.5);
    segment(-4, -4.5, -4, 4.5);
    segment(4, -4.5, 4, 4.5);
    for (let col = 1; col < 8; col += 1) {
      const x = col - 4;
      segment(x, -4.5, x, -0.5);
      segment(x, 0.5, x, 4.5);
    }
    segment(-1, -4.5, 1, -2.5);
    segment(1, -4.5, -1, -2.5);
    segment(-1, 2.5, 1, 4.5);
    segment(1, 2.5, -1, 4.5);
    context.strokeStyle = strokeStyle;
    context.lineWidth = lineWidth;
    context.stroke();
    context.restore();
  };

  drawGrid('rgba(25, 22, 18, 0.42)', 13, 2);
  drawGrid('#29251f', 7);
  drawGrid('rgba(169, 151, 108, 0.28)', 2, -1);

  context.save();
  context.fillStyle = '#302a22';
  context.strokeStyle = 'rgba(184, 164, 119, 0.25)';
  context.lineWidth = 2;
  context.textAlign = 'center';
  context.textBaseline = 'middle';
  context.font = '700 72px KaiTi, STKaiti, SimSun, serif';
  const riverY = worldToCanvas(0, 0).y;
  context.strokeText('楚 河', worldToCanvas(-2, 0).x, riverY);
  context.fillText('楚 河', worldToCanvas(-2, 0).x, riverY);
  context.strokeText('汉 界', worldToCanvas(2, 0).x, riverY);
  context.fillText('汉 界', worldToCanvas(2, 0).x, riverY);
  context.restore();

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = 8;
  texture.wrapS = THREE.ClampToEdgeWrapping;
  texture.wrapT = THREE.ClampToEdgeWrapping;
  texture.needsUpdate = true;
  return texture;
}

function BoardPickSurface({ onChoose }: { onChoose: (pos: Pos) => void }) {
  const chooseAtPoint = (event: ThreeEvent<MouseEvent>) => {
    event.stopPropagation();
    const pos = worldToBoard(event.point.x, event.point.z);
    if (pos) onChoose(pos);
  };

  return (
    <mesh position={[0, BOARD_HIGHLIGHT_Y + 0.006, 0]} rotation={[-Math.PI / 2, 0, 0]} onClick={chooseAtPoint} renderOrder={8}>
      <planeGeometry args={[9, 10]} />
      <meshBasicMaterial transparent opacity={0} depthWrite={false} colorWrite={false} />
    </mesh>
  );
}

function Highlight({ position, color, strong = false }: { position: Point; color: string; strong?: boolean }) {
  return (
    <mesh position={[position[0], BOARD_HIGHLIGHT_Y, position[2]]} rotation={[-Math.PI / 2, 0, 0]} renderOrder={4}>
      <ringGeometry args={[strong ? 0.3 : 0.18, strong ? 0.42 : 0.28, 32]} />
      <meshBasicMaterial color={color} transparent opacity={strong ? 0.78 : 0.52} depthWrite={false} polygonOffset polygonOffsetFactor={-2} />
    </mesh>
  );
}

function CaptureMarker({ position, delayed }: { position: Point; delayed: boolean }) {
  const ring = useRef<THREE.Mesh>(null);
  const material = useRef<THREE.MeshBasicMaterial>(null);
  const elapsed = useRef(0);

  useFrame((_, delta) => {
    elapsed.current += delta;
    const delay = delayed ? 0.27 : 0;
    const progress = THREE.MathUtils.clamp((elapsed.current - delay) / 0.3, 0, 1);
    if (ring.current) {
      ring.current.visible = progress > 0 && progress < 1;
      ring.current.scale.setScalar(0.72 + progress * 1.15);
    }
    if (material.current) material.current.opacity = (1 - progress) * 0.9;
  });

  return (
    <mesh ref={ring} position={[position[0], BOARD_HIGHLIGHT_Y + 0.004, position[2]]} rotation={[-Math.PI / 2, 0, 0]} visible={!delayed} renderOrder={5}>
      <ringGeometry args={[0.34, 0.52, 32]} />
      <meshBasicMaterial ref={material} color="#d74f3a" transparent opacity={0.9} depthWrite={false} toneMapped={false} />
    </mesh>
  );
}

function CaptureCameraPulse({ reducedMotion }: { reducedMotion: boolean }) {
  const { camera } = useThree();
  const elapsed = useRef(0);
  const baseFov = useRef(camera instanceof THREE.PerspectiveCamera ? camera.fov : 40);

  useEffect(() => {
    if (!(camera instanceof THREE.PerspectiveCamera)) return;
    baseFov.current = camera.fov;
    return () => {
      camera.fov = baseFov.current;
      camera.updateProjectionMatrix();
    };
  }, [camera]);

  useFrame((_, delta) => {
    if (reducedMotion || !(camera instanceof THREE.PerspectiveCamera)) return;
    elapsed.current += delta;
    const progress = THREE.MathUtils.clamp((elapsed.current - 0.27) / 0.22, 0, 1);
    camera.fov = baseFov.current + Math.sin(progress * Math.PI) * 0.9;
    camera.updateProjectionMatrix();
  });
  return null;
}

type TacticalTextureMap = Record<string, THREE.CanvasTexture>;

function tokenTextureKey(piece: Piece) {
  return `${piece.side}-${piece.type}`;
}

function useTacticalTokenTextures(): TacticalTextureMap {
  const textures = useMemo(() => {
    const result: TacticalTextureMap = {};
    for (const side of ['red', 'black'] as const) {
      for (const type of TACTICAL_TOKEN_TYPES) {
        const piece: Piece = { side, type };
        result[tokenTextureKey(piece)] = createTacticalTokenTexture(piece);
      }
    }
    return result;
  }, []);

  useEffect(() => () => Object.values(textures).forEach((texture) => texture.dispose()), [textures]);
  return textures;
}

function createTacticalTokenTexture(piece: Piece) {
  const style = tacticalTokenStyle(piece);
  const canvas = document.createElement('canvas');
  canvas.width = 256;
  canvas.height = 256;
  const context = canvas.getContext('2d');
  if (!context) throw new Error('无法创建战术棋子纹理');

  const center = 128;
  context.clearRect(0, 0, 256, 256);
  context.strokeStyle = style.ornament;
  context.lineWidth = 8;
  context.beginPath();
  context.arc(center, center, 104, 0, Math.PI * 2);
  context.stroke();
  context.strokeStyle = piece.side === 'red' ? 'rgba(255,231,181,.58)' : 'rgba(188,222,226,.5)';
  context.lineWidth = 3;
  context.beginPath();
  context.arc(center, center, 88, 0, Math.PI * 2);
  context.stroke();

  context.save();
  context.translate(center, center);
  context.rotate(Math.PI / 4);
  context.strokeStyle = `${style.ornament}99`;
  context.lineWidth = 4;
  context.strokeRect(-66, -66, 132, 132);
  context.restore();

  context.fillStyle = style.glyph;
  context.strokeStyle = piece.side === 'red' ? '#3b100d' : '#071014';
  context.lineWidth = 8;
  context.lineJoin = 'round';
  context.textAlign = 'center';
  context.textBaseline = 'middle';
  context.font = '900 128px KaiTi, STKaiti, SimSun, serif';
  context.strokeText(style.label, center, center + 8);
  context.fillText(style.label, center, center + 8);

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = 8;
  texture.needsUpdate = true;
  return texture;
}

function TacticalToken({ piece, position, texture, flipped, selected, settled = false, travel, captured = false, reducedMotion = false }: {
  piece: Piece;
  position: Point;
  texture: THREE.CanvasTexture;
  flipped: boolean;
  selected: boolean;
  settled?: boolean;
  travel?: { key: string; from: Point; to: Point; capture?: boolean };
  captured?: boolean;
  reducedMotion?: boolean;
}) {
  const root = useRef<THREE.Group>(null);
  const elapsed = useRef(0);
  const from = useRef(new THREE.Vector3());
  const to = useRef(new THREE.Vector3());
  const style = tacticalTokenStyle(piece);

  useEffect(() => {
    elapsed.current = 0;
    if (!root.current) return;
    root.current.scale.setScalar(settled ? 1.08 : 1);
    root.current.rotation.set(0, 0, 0);
    if (travel) {
      from.current.set(...travel.from);
      to.current.set(...travel.to);
      root.current.position.copy(from.current);
    } else {
      root.current.position.set(...position);
    }
  }, [captured, position, settled, travel?.key]);

  useFrame((_, delta) => {
    if (!root.current) return;
    if (captured) {
      const duration = reducedMotion ? 0.04 : 0.42;
      elapsed.current = Math.min(duration, elapsed.current + delta);
      const progress = elapsed.current / duration;
      root.current.scale.setScalar(Math.max(0.04, 1 - progress));
      root.current.rotation.y = progress * Math.PI * 0.7;
      return;
    }
    if (!travel) {
      const pulse = !reducedMotion && selected ? 1 + Math.sin(performance.now() * 0.008) * 0.045 : 1;
      root.current.scale.setScalar((settled ? 1.08 : 1) * pulse);
      return;
    }
    const duration = reducedMotion ? 0.04 : travel.capture ? 0.7 : 0.26;
    elapsed.current = Math.min(duration, elapsed.current + delta);
    const linear = elapsed.current / duration;
    const moveStart = travel.capture && !reducedMotion ? 0.56 : 0;
    if (linear < moveStart) return;
    const travelLinear = THREE.MathUtils.clamp((linear - moveStart) / Math.max(0.01, 1 - moveStart), 0, 1);
    const progress = 1 - (1 - THREE.MathUtils.clamp(travelLinear / 0.82, 0, 1)) ** 3;
    root.current.position.lerpVectors(from.current, to.current, progress);
  });

  return (
    <group ref={root} position={travel ? undefined : position} renderOrder={6}>
      <mesh position={[0, 0.055, 0]} castShadow receiveShadow>
        <cylinderGeometry args={[0.43, 0.45, 0.1, style.sides]} />
        <meshStandardMaterial color={style.bodyEdge} roughness={0.62} metalness={0.46} />
      </mesh>
      <mesh position={[0, 0.112, 0]} rotation={[-Math.PI / 2, 0, flipped ? Math.PI : 0]} renderOrder={7}>
        <circleGeometry args={[0.405, style.sides]} />
        <meshStandardMaterial color={style.inner} roughness={0.58} metalness={0.2} polygonOffset polygonOffsetFactor={-1} />
      </mesh>
      <mesh position={[0, 0.116, 0]} rotation={[-Math.PI / 2, 0, flipped ? Math.PI : 0]} renderOrder={8}>
        <planeGeometry args={[0.78, 0.78]} />
        <meshBasicMaterial map={texture} transparent alphaTest={0.08} depthWrite={false} toneMapped={false} polygonOffset polygonOffsetFactor={-2} />
      </mesh>
      <mesh position={[0, 0.008, 0]} rotation={[-Math.PI / 2, 0, 0]} renderOrder={5}>
        <ringGeometry args={[selected ? 0.48 : 0.45, selected ? 0.55 : 0.5, style.sides]} />
        <meshBasicMaterial color={selected ? '#ffe09a' : style.ornament} transparent opacity={selected ? 0.95 : 0.72} depthWrite={false} toneMapped={false} />
      </mesh>
    </group>
  );
}

function Piece3D({ piece, position, selected, settled = false, travel, captured = false, reducedMotion = false, animateIdle = true }: { piece: Piece; position: Point; selected: boolean; settled?: boolean; travel?: { key: string; from: Point; to: Point; capture?: boolean }; captured?: boolean; reducedMotion?: boolean; animateIdle?: boolean }) {
  const placement = useRef<THREE.Group>(null);
  const runtime = useRef<THREE.Group>(null);
  const elapsed = useRef(0);
  const impactElapsed = useRef(0);
  const from = useRef(new THREE.Vector3());
  const to = useRef(new THREE.Vector3());
  const travelYaw = useRef(homeFacingYaw(piece.side));
  const homeYaw = homeFacingYaw(piece.side);
  const [action, setAction] = useState<UnitAction>(captured ? 'idle' : travel?.capture ? 'attack' : travel ? 'move' : 'idle');
  const actionRef = useRef<UnitAction>(action);

  const changeAction = useCallback((next: UnitAction) => {
    if (actionRef.current === next) return;
    actionRef.current = next;
    setAction(next);
  }, []);

  useEffect(() => {
    elapsed.current = 0;
    impactElapsed.current = 0;
    changeAction(captured ? 'idle' : travel?.capture ? 'attack' : travel ? 'move' : 'idle');
    if (placement.current) {
      placement.current.rotation.x = 0;
      placement.current.rotation.z = 0;
      placement.current.scale.setScalar(settled ? 1.08 : 1);
    }
    if (runtime.current) runtime.current.rotation.y = homeYaw;
    if (!travel || !placement.current) return;
    from.current.set(...travel.from);
    to.current.set(...travel.to);
    placement.current.position.copy(from.current);
    travelYaw.current = movementFacingYaw(travel.from, travel.to);
    if (runtime.current) runtime.current.rotation.y = travelYaw.current;
  }, [captured, changeAction, homeYaw, settled, travel?.key]);

  useFrame((_, delta) => {
    if (!placement.current) return;
    if (captured) {
      const duration = reducedMotion ? 0.04 : 0.7;
      impactElapsed.current = Math.min(duration, impactElapsed.current + delta);
      const linear = impactElapsed.current / duration;
      const hitAt = reducedMotion ? 0 : 0.38;
      const deathAt = reducedMotion ? 0 : 0.5;
      if (linear >= deathAt) changeAction('death');
      else if (linear >= hitAt) changeAction('hit');

      const deathProgress = THREE.MathUtils.clamp((linear - deathAt) / Math.max(0.01, 1 - deathAt), 0, 1);
      const hitShake = linear >= hitAt && linear < deathAt ? Math.sin((linear - hitAt) * 140) * 0.035 : 0;
      const pawnFall = piece.type === 'pawn' ? 0.12 : Math.PI * 0.43;
      placement.current.position.set(position[0] + hitShake, position[1] - deathProgress * 0.16, position[2]);
      placement.current.rotation.x = pawnFall * deathProgress;
      placement.current.rotation.z = (piece.side === 'red' ? 1 : -1) * deathProgress * 0.16;
      placement.current.scale.setScalar(Math.max(0.08, 1 - deathProgress * 0.92));
      return;
    }
    if (!travel) {
      const now = performance.now();
      const bob = !reducedMotion && selected ? Math.sin(now * 0.006) * 0.025 : 0;
      placement.current.position.y = position[1] + bob;
      placement.current.rotation.z = !reducedMotion && selected ? Math.sin(now * 0.004) * 0.018 : 0;
      placement.current.scale.setScalar(settled ? 1.08 : 1);
      if (runtime.current) runtime.current.rotation.y = homeYaw;
      return;
    }
    placement.current.scale.setScalar(1);
    const duration = reducedMotion ? 0.04 : travel.capture ? 0.7 : 0.26;
    elapsed.current = Math.min(duration, elapsed.current + delta);
    const linear = elapsed.current / duration;
    const moveStart = travel.capture && !reducedMotion ? 0.56 : 0;
    if (linear < moveStart) {
      placement.current.position.copy(from.current);
      return;
    }
    changeAction('move');
    const travelLinear = THREE.MathUtils.clamp((linear - moveStart) / Math.max(0.01, 1 - moveStart), 0, 1);
    const moveProgress = THREE.MathUtils.clamp(travelLinear / 0.82, 0, 1);
    const progress = 1 - (1 - moveProgress) ** 3;
    placement.current.position.lerpVectors(from.current, to.current, progress);
    if (!reducedMotion && piece.type !== 'pawn' && moveProgress < 1) placement.current.position.y += Math.sin(moveProgress * Math.PI * 4) * 0.018;
    if (runtime.current && !travel.capture) {
      const turnHome = THREE.MathUtils.smoothstep(travelLinear, 0.82, 1);
      runtime.current.rotation.y = lerpYaw(travelYaw.current, homeYaw, turnHome);
    }
  });

  const materialColor = piece.side === 'red' ? '#b64235' : '#302d29';

  return (
    <group ref={placement} position={travel ? undefined : position} scale={settled ? 1.08 : 1}>
      <FactionRing side={piece.side} selected={selected} />
      <group ref={runtime} rotation={[0, homeYaw, 0]}>
        <PieceGlyph type={piece.type} side={piece.side} color={materialColor} selected={selected} animateIdle={animateIdle} action={action} />
      </group>
    </group>
  );
}

function FactionRing({ side, selected }: { side: Piece['side']; selected: boolean }) {
  const red = side === 'red';
  return (
    <mesh position={[0, BOARD_RING_Y - BOARD_TOP, 0]} rotation={[-Math.PI / 2, 0, red ? 0 : Math.PI / 4]} renderOrder={3}>
      <ringGeometry args={[selected ? 0.34 : 0.3, selected ? 0.46 : 0.39, red ? 32 : 4]} />
      <meshBasicMaterial color={red ? '#dc3f2e' : '#6fa2c9'} transparent opacity={selected ? 0.95 : 0.58} depthWrite={false} toneMapped={false} />
    </mesh>
  );
}

function PieceGlyph({ type, side, color, selected, animateIdle, action }: { type: PieceType; side: Piece['side']; color: string; selected: boolean; animateIdle: boolean; action: UnitAction }) {
  let glyph: React.ReactNode;
  if (type === 'pawn') glyph = <BlenderPawnGlyph side={side} selected={selected} animateIdle={animateIdle} action={action} />;
  else if (type === 'cannon') glyph = <BlenderCannonGlyph side={side} selected={selected} />;
  else if (type === 'horse') glyph = <BlenderHorseGlyph side={side} selected={selected} />;
  else if (type === 'rook') glyph = <BlenderChariotGlyph side={side} selected={selected} />;
  else if (type === 'advisor') glyph = <BlenderGuardGlyph side={side} selected={selected} />;
  else if (type === 'elephant') glyph = <BlenderElephantGlyph side={side} selected={selected} />;
  else glyph = <BlenderGeneralGlyph side={side} selected={selected} />;

  return (
    <group
      position={[0, 0, MODEL_FORWARD_OFFSET[type]]}
      rotation={[0, MODEL_YAW_CORRECTION[type], 0]}
    >
      {glyph}
    </group>
  );
}

const BLENDER_PAWN_ASSETS = {
  red: './assets/pawn-infantry-red-hy3-v1.glb',
  black: './assets/pawn-infantry-black-hy3-v1.glb'
} as const;

function BlenderPawnGlyph({ side, selected, animateIdle, action: unitAction }: { side: Piece['side']; selected: boolean; animateIdle: boolean; action: UnitAction }) {
  const animationRoot = useRef<THREE.Group>(null);
  const { scene, animations } = useGLTF(BLENDER_PAWN_ASSETS[side]);
  const { actions } = useAnimations(animations, animationRoot);
  const model = useMemo(() => {
    const clone = SkeletonUtils.clone(scene);
    clone.traverse((object) => {
      if (!(object instanceof THREE.Mesh)) return;
      object.castShadow = true;
      object.receiveShadow = true;
      object.material = Array.isArray(object.material)
        ? object.material.map((entry) => entry.clone())
        : object.material.clone();
    });
    return clone;
  }, [scene]);

  useEffect(() => {
    model.traverse((object) => {
      if (!(object instanceof THREE.Mesh)) return;
      const materials = Array.isArray(object.material) ? object.material : [object.material];
      materials.forEach((entry) => {
        if (!(entry instanceof THREE.MeshStandardMaterial)) return;
        entry.emissive.set(selected ? '#142c54' : '#000000');
        entry.emissiveIntensity = selected ? 0.62 : 0;
      });
    });
  }, [model, selected]);

  useEffect(() => {
    const prefix = side === 'red' ? 'RedPawn' : 'BlackZu';
    const suffixes: Record<UnitAction, string> = {
      idle: '_Idle',
      move: '_Move',
      attack: '_Attack',
      hit: '_Hit',
      death: '_Death'
    };
    const durations: Record<Exclude<UnitAction, 'idle'>, number> = {
      move: 0.25,
      attack: 0.29,
      hit: 0.09,
      death: 0.34
    };
    const suffix = suffixes[unitAction];
    const animationAction = actions[`${prefix}${suffix}`] ?? Object.entries(actions).find(([name]) => name.endsWith(suffix))?.[1];
    if (!animationAction) return;
    animationAction.reset();
    animationAction.enabled = true;
    animationAction.setEffectiveWeight(1);
    if (suffix !== '_Idle') {
      animationAction.paused = false;
      animationAction.setLoop(THREE.LoopOnce, 1);
      animationAction.clampWhenFinished = true;
      animationAction.setDuration(durations[unitAction as Exclude<UnitAction, 'idle'>]);
      animationAction.fadeIn(0.04).play();
    } else {
      animationAction.setLoop(THREE.LoopRepeat, Infinity);
      animationAction.clampWhenFinished = false;
      animationAction.paused = !animateIdle;
      animationAction.fadeIn(animateIdle ? 0.18 : 0).play();
    }
    return () => { animationAction.fadeOut(suffix === '_Idle' ? 0.18 : 0.04); };
  }, [actions, side, animateIdle, unitAction]);

  return (
    <group ref={animationRoot} position={[0, 0.01, 0]} scale={selected ? 0.90 : 0.86}>
      <primitive object={model} />
    </group>
  );
}

useGLTF.preload(BLENDER_PAWN_ASSETS.red);
useGLTF.preload(BLENDER_PAWN_ASSETS.black);

const BLENDER_CANNON_ASSETS = {
  red: './assets/cannon-red-hy3-v1.glb',
  black: './assets/cannon-black-hy3-v1.glb'
} as const;

function BlenderCannonGlyph({ side, selected }: { side: Piece['side']; selected: boolean }) {
  const { scene } = useGLTF(BLENDER_CANNON_ASSETS[side]);
  const model = useMemo(() => {
    const clone = scene.clone(true);
    clone.traverse((object) => {
      if (!(object instanceof THREE.Mesh)) return;
      object.castShadow = true;
      object.receiveShadow = true;
      object.material = Array.isArray(object.material)
        ? object.material.map((entry) => entry.clone())
        : object.material.clone();
    });
    return clone;
  }, [scene]);

  useEffect(() => {
    model.traverse((object) => {
      if (!(object instanceof THREE.Mesh)) return;
      const materials = Array.isArray(object.material) ? object.material : [object.material];
      materials.forEach((entry) => {
        if (!(entry instanceof THREE.MeshStandardMaterial)) return;
        entry.emissive.set(selected ? '#142c54' : '#000000');
        entry.emissiveIntensity = selected ? 0.62 : 0;
      });
    });
  }, [model, selected]);

  return (
    <group position={[0, 0.01, 0]} scale={selected ? 0.77 : 0.73}>
      <primitive object={model} />
    </group>
  );
}

useGLTF.preload(BLENDER_CANNON_ASSETS.red);
useGLTF.preload(BLENDER_CANNON_ASSETS.black);

const BLENDER_HORSE_ASSETS = {
  red: './assets/horse-red-hy3-v1.glb',
  black: './assets/horse-black-hy3-v1.glb'
} as const;

const BLENDER_CHARIOT_ASSETS = {
  red: './assets/chariot-red-hy3-v1.glb',
  black: './assets/chariot-black-hy3-v1.glb'
} as const;

const BLENDER_GUARD_ASSETS = {
  red: './assets/guard-red-hy3-v1.glb',
  black: './assets/guard-black-hy3-v1.glb'
} as const;

const BLENDER_ELEPHANT_ASSETS = {
  red: './assets/elephant-red-hy3-v1.glb',
  black: './assets/elephant-black-hy3-v1.glb'
} as const;

const BLENDER_GENERAL_ASSETS = {
  red: './assets/general-red-hy3-v2.glb',
  black: './assets/general-black-hy3-v2.glb'
} as const;

function StaticHy3Glyph({ asset, selected, scale }: { asset: string; selected: boolean; scale: number }) {
  const { scene } = useGLTF(asset);
  const model = useMemo(() => {
    const clone = scene.clone(true);
    clone.traverse((object) => {
      if (!(object instanceof THREE.Mesh)) return;
      object.castShadow = true;
      object.receiveShadow = true;
      object.material = Array.isArray(object.material)
        ? object.material.map((entry) => entry.clone())
        : object.material.clone();
    });
    return clone;
  }, [scene]);

  useEffect(() => {
    model.traverse((object) => {
      if (!(object instanceof THREE.Mesh)) return;
      const materials = Array.isArray(object.material) ? object.material : [object.material];
      materials.forEach((entry) => {
        if (!(entry instanceof THREE.MeshStandardMaterial)) return;
        entry.emissive.set(selected ? '#142c54' : '#000000');
        entry.emissiveIntensity = selected ? 0.62 : 0;
      });
    });
  }, [model, selected]);

  return (
    <group position={[0, 0.03, 0]} scale={selected ? scale * 1.05 : scale}>
      <primitive object={model} />
    </group>
  );
}

function BlenderHorseGlyph({ side, selected }: { side: Piece['side']; selected: boolean }) {
  return <StaticHy3Glyph asset={BLENDER_HORSE_ASSETS[side]} selected={selected} scale={0.82} />;
}

function BlenderChariotGlyph({ side, selected }: { side: Piece['side']; selected: boolean }) {
  return <StaticHy3Glyph asset={BLENDER_CHARIOT_ASSETS[side]} selected={selected} scale={0.52} />;
}

function BlenderGuardGlyph({ side, selected }: { side: Piece['side']; selected: boolean }) {
  return <StaticHy3Glyph asset={BLENDER_GUARD_ASSETS[side]} selected={selected} scale={0.72} />;
}

function BlenderElephantGlyph({ side, selected }: { side: Piece['side']; selected: boolean }) {
  return <StaticHy3Glyph asset={BLENDER_ELEPHANT_ASSETS[side]} selected={selected} scale={0.52} />;
}

function BlenderGeneralGlyph({ side, selected }: { side: Piece['side']; selected: boolean }) {
  // The v2 sovereign is a broad seated composition with a full mantle. Keep
  // its crown and dragon shoulders readable without covering adjacent guards.
  return <StaticHy3Glyph asset={BLENDER_GENERAL_ASSETS[side]} selected={selected} scale={0.52} />;
}

useGLTF.preload(BLENDER_HORSE_ASSETS.red);
useGLTF.preload(BLENDER_HORSE_ASSETS.black);
useGLTF.preload(BLENDER_CHARIOT_ASSETS.red);
useGLTF.preload(BLENDER_CHARIOT_ASSETS.black);
useGLTF.preload(BLENDER_GUARD_ASSETS.red);
useGLTF.preload(BLENDER_GUARD_ASSETS.black);
useGLTF.preload(BLENDER_ELEPHANT_ASSETS.red);
useGLTF.preload(BLENDER_ELEPHANT_ASSETS.black);
useGLTF.preload(BLENDER_GENERAL_ASSETS.red);
useGLTF.preload(BLENDER_GENERAL_ASSETS.black);

function Board3DAccessibility({ board, onChoose }: Pick<BoardProps, 'board' | 'onChoose'>) {
  return (
    <div className="board3d-a11y-grid" aria-label="中国象棋三维棋盘操作层">
      {board.map((row, rowIndex) =>
        row.map((piece, colIndex) => {
          const pos = { row: rowIndex, col: colIndex };
          const label = piece ? `${piece.side === 'red' ? '红' : '黑'}${PIECE_LABELS[piece.type][piece.side]}` : '空位';
          return (
            <button key={posKey(pos)} type="button" aria-label={`${label}，第 ${colIndex + 1} 路第 ${rowIndex + 1} 线`} onClick={() => onChoose(pos)}>
              {label}
            </button>
          );
        })
      )}
    </div>
  );
}

function parsePosKey(key: string): Pos {
  const [row, col] = key.split('-').map(Number);
  return { row, col };
}

function useReducedMotion() {
  const [reducedMotion, setReducedMotion] = useState(false);

  useEffect(() => {
    const media = window.matchMedia('(prefers-reduced-motion: reduce)');
    const update = () => setReducedMotion(media.matches);
    update();
    media.addEventListener('change', update);
    return () => media.removeEventListener('change', update);
  }, []);

  return reducedMotion;
}
