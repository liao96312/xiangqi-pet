import { useEffect, useMemo, useRef, useState } from 'react';
import { getBookSuggestion, getBookSuggestions } from './bookGuide';
import { boardToFen, moveToUci, uciToMove } from './fen';
import { moveNotation } from './notation';
import {
  applyMove,
  createInitialState,
  getBestMove,
  getLegalMoves,
  makeMove,
  posKey,
  type GameState,
  type Move,
  type Pos
} from './xiangqi';

export type DifficultyKey = 'book' | 'rookie' | 'normal' | 'advanced' | 'strong';

export interface AnalysisResult {
  ok: boolean;
  engine: 'pikafish' | 'none';
  bestMove?: string;
  scoreCp?: number;
  mate?: number;
  pv?: string[];
  depth?: number;
  error?: string;
}

export const difficulties: Array<{
  key: DifficultyKey;
  label: string;
  depth: number;
  blunderRate: number;
  delay: number;
  engineTime: number;
  useEngine: boolean;
}> = [
  { key: 'book', label: '谱招练习', depth: 1, blunderRate: 0, delay: 120, engineTime: 0, useEngine: false },
  { key: 'rookie', label: '入门', depth: 1, blunderRate: 0.8, delay: 120, engineTime: 0, useEngine: false },
  { key: 'normal', label: '普通', depth: 1, blunderRate: 0.35, delay: 180, engineTime: 0, useEngine: false },
  { key: 'advanced', label: '进阶', depth: 2, blunderRate: 0.08, delay: 240, engineTime: 900, useEngine: true },
  { key: 'strong', label: '又快又强', depth: 3, blunderRate: 0, delay: 80, engineTime: 1000, useEngine: true }
];

const SAVED_SETTINGS_KEY = 'xiangqi-pet-settings';

type SavedSettings = Partial<{
  autoAi: boolean;
  difficulty: DifficultyKey;
  playerSide: GameState['turn'];
}>;

function readSavedSettings(): SavedSettings {
  if (typeof window === 'undefined') return {};
  try {
    const raw = window.localStorage.getItem(SAVED_SETTINGS_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as SavedSettings;
    return {
      autoAi: typeof parsed.autoAi === 'boolean' ? parsed.autoAi : undefined,
      difficulty: isDifficultyKey(parsed.difficulty) ? parsed.difficulty : undefined,
      playerSide: parsed.playerSide === 'red' || parsed.playerSide === 'black' ? parsed.playerSide : undefined
    };
  } catch {
    return {};
  }
}

function writeSavedSettings(settings: Required<SavedSettings>) {
  try {
    window.localStorage.setItem(SAVED_SETTINGS_KEY, JSON.stringify(settings));
  } catch {
    // Ignore disabled storage; the game should still run.
  }
}

function isDifficultyKey(value: unknown): value is DifficultyKey {
  return typeof value === 'string' && difficulties.some((item) => item.key === value);
}

export function useXiangqiGame() {
  const savedSettings = useMemo(readSavedSettings, []);
  const [state, setState] = useState<GameState>(() => createInitialState());
  const stateRef = useRef(state);
  const [undoStack, setUndoStack] = useState<GameState[]>([]);
  const [selected, setSelected] = useState<Pos | null>(null);
  const [hint, setHint] = useState<Move | null>(null);
  const [thinking, setThinking] = useState(false);
  const [autoAi, setAutoAi] = useState(savedSettings.autoAi ?? true);
  const [playerSide, setPlayerSide] = useState<GameState['turn']>(savedSettings.playerSide ?? 'red');
  const [difficulty, setDifficulty] = useState<DifficultyKey>(savedSettings.difficulty ?? 'book');
  const [engineAvailable, setEngineAvailable] = useState(false);
  const [analysis, setAnalysis] = useState<AnalysisResult | null>(null);

  const legalMoves = useMemo(() => getLegalMoves(state.board, state.turn), [state.board, state.turn]);
  const bookPractice = difficulty === 'book';
  const bookSuggestions = useMemo(() => (bookPractice ? getBookSuggestions(state) : []), [bookPractice, state]);
  const bookSuggestion = bookSuggestions[0] ?? null;
  const canUndo = undoStack.length > 0;
  const legalByFrom = useMemo(() => {
    const map = new Map<string, Move[]>();
    for (const move of legalMoves) {
      const key = posKey(move.from);
      map.set(key, [...(map.get(key) ?? []), move]);
    }
    return map;
  }, [legalMoves]);

  useEffect(() => {
    stateRef.current = state;
  }, [state]);

  useEffect(() => {
    window.xiangqiPet?.engineStatus().then((status) => setEngineAvailable(status.available)).catch(() => setEngineAvailable(false));
  }, []);

  useEffect(() => {
    writeSavedSettings({ autoAi, difficulty, playerSide });
  }, [autoAi, difficulty, playerSide]);

  useEffect(() => {
    let cancelled = false;
    if (!window.xiangqiPet?.analyze || (autoAi && !state.winner && state.turn !== playerSide)) return;
    const timer = window.setTimeout(() => {
      window.xiangqiPet
        ?.analyze({
          fen: boardToFen(state.board, state.turn),
          moves: state.history.map(moveToUci),
          movetime: 450
        })
        .then((result) => {
          if (cancelled || (!result.ok && result.error === 'Engine is busy')) return;
          setAnalysis(result);
          setEngineAvailable(result.ok && result.engine === 'pikafish');
        })
        .catch(() => {
          if (!cancelled) setAnalysis(null);
        });
    }, 320);
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [autoAi, playerSide, state.board, state.history, state.turn, state.winner]);

  useEffect(() => {
    if (autoAi && !thinking && !state.winner && state.turn !== playerSide) {
      const timer = window.setTimeout(() => makeAiMove(state), 180);
      return () => window.clearTimeout(timer);
    }
  }, [autoAi, playerSide, state, thinking]);

  function commitMove(fromState: GameState, move: Move) {
    if (stateRef.current !== fromState) return null;
    const next = makeMove(fromState, move);
    if (next === fromState || next.history.length === fromState.history.length) return null;
    setUndoStack((stack) => [...stack, fromState]);
    setState(next);
    return next;
  }

  function reset() {
    setState(createInitialState());
    setUndoStack([]);
    setSelected(null);
    setHint(null);
    setThinking(false);
  }

  function switchSide() {
    setPlayerSide((side) => (side === 'red' ? 'black' : 'red'));
    setState(createInitialState());
    setUndoStack([]);
    setSelected(null);
    setHint(null);
    setThinking(false);
  }

  function undo() {
    setUndoStack((stack) => {
      const lastMove = state.history.at(-1);
      const lastMovedPiece = lastMove ? state.board[lastMove.to.row][lastMove.to.col] : null;
      const undoSteps =
        autoAi && state.turn === playerSide && lastMovedPiece?.side !== playerSide && stack.length >= 2 ? 2 : 1;
      const previous = stack.at(-undoSteps);
      if (!previous) return stack;
      setState(previous);
      setSelected(null);
      setHint(null);
      setThinking(false);
      return stack.slice(0, -undoSteps);
    });
  }

  function choose(pos: Pos) {
    if (thinking || state.winner) return;
    setHint(null);
    const piece = state.board[pos.row][pos.col];

    if (!selected) {
      if (piece?.side === state.turn && (!autoAi || state.turn === playerSide)) setSelected(pos);
      return;
    }

    const move = legalByFrom.get(posKey(selected))?.find((item) => sameSquare(item.to, pos));
    if (move) {
      if (bookPractice && bookSuggestions.length > 0 && !bookSuggestions.some((item) => sameMove(move, item.move))) {
        setHint(bookSuggestion.move);
        setSelected(null);
        setState((current) => ({ ...current, message: `走错谱，可走：${bookSuggestions.slice(0, 3).map((item) => item.label).join(' / ')}` }));
        return;
      }

      const next = commitMove(state, move);
      setSelected(null);
      return;
    }

    setSelected(piece?.side === state.turn && (!autoAi || state.turn === playerSide) ? pos : null);
  }

  function showHint() {
    if (state.winner || thinking) return;
    const hintState = state;
    setThinking(true);
    window.setTimeout(() => {
      if (stateRef.current !== hintState) return;
      if (bookPractice && bookSuggestion) {
        setHint(bookSuggestion.move);
        setThinking(false);
        setState((current) => ({ ...current, message: `谱招指导：${bookSuggestion.label}` }));
        return;
      }

      const rawEngineMove = analysis?.ok && analysis.bestMove ? uciToMove(analysis.bestMove, state.board) : null;
      const engineMove = rawEngineMove ? findMatchingLegalMove(state, rawEngineMove) : null;
      if (engineMove) {
        setHint(engineMove);
        setThinking(false);
        setState((current) => ({ ...current, message: `${current.turn === 'red' ? '红方' : '黑方'}强提示：${moveNotation(current.board, engineMove)}` }));
        return;
      }

      const profile = difficulties.find((item) => item.key === difficulty) ?? difficulties[2];
      const best = getBestMove(state.board, state.turn, Math.max(profile.depth, 2));
      setHint(best);
      setThinking(false);
      if (best) {
        setState((current) => ({ ...current, message: `${current.turn === 'red' ? '红方' : '黑方'}建议：${moveNotation(current.board, best)}` }));
      }
    }, 80);
  }

  function makeAiMove(inputState = state) {
    if (inputState.winner || stateRef.current !== inputState) return;
    const isCurrent = () => stateRef.current === inputState;
    const profile = difficulties.find((item) => item.key === difficulty) ?? difficulties[2];
    setThinking(true);
    window.setTimeout(async () => {
      if (!isCurrent()) return;
      const bookMove = bookPractice ? getBookSuggestion(inputState)?.move : null;
      if (bookMove) {
        const next = commitMove(inputState, bookMove);
        if (!next && isCurrent()) setState((current) => ({ ...current, message: '谱招应招失败，请悔棋后重试' }));
        setHint(null);
        setThinking(false);
        return;
      }

      if (bookPractice) {
        setState((current) => ({ ...current, message: '已脱谱，请悔棋或按谱招提示回到谱线' }));
        setHint(null);
        setThinking(false);
        return;
      }

      if (profile.useEngine && window.xiangqiPet?.playAnalyze) {
        try {
          const result = await window.xiangqiPet.playAnalyze({
            fen: boardToFen(inputState.board, inputState.turn),
            moves: inputState.history.map(moveToUci),
            movetime: profile.engineTime
          });
          if (!isCurrent()) return;
          const rawEngineMove = result.ok && result.bestMove ? uciToMove(result.bestMove, inputState.board) : null;
          const engineMove = rawEngineMove ? findMatchingLegalMove(inputState, rawEngineMove) : null;
          if (engineMove) {
            commitMove(inputState, engineMove);
            setHint(null);
            setThinking(false);
            return;
          }
        } catch {
          if (!isCurrent()) return;
          // Fall back to the embedded trainer below.
        }
      }

      if (!isCurrent()) return;
      const best = chooseAiMove(inputState.board, inputState.turn, profile.depth, profile.blunderRate);
      if (best) commitMove(inputState, best);
      setHint(null);
      setThinking(false);
    }, profile.delay);
  }

  return {
    state,
    selected,
    hint,
    thinking,
    autoAi,
    playerSide,
    bookPractice,
    difficulty,
    difficulties,
    engineAvailable,
    analysis,
    bookSuggestion,
    bookSuggestions,
    canUndo,
    legalTargets: selected ? legalByFrom.get(posKey(selected))?.map((move) => move.to) ?? [] : [],
    choose,
    reset,
    undo,
    switchSide,
    showHint,
    makeAiMove,
    setAutoAi,
    setDifficulty
  };
}

function chooseAiMove(board: GameState['board'], side: GameState['turn'], depth: number, blunderRate: number) {
  const allMoves = getLegalMoves(board, side);
  if (blunderRate >= 0.7 && allMoves.length > 0 && Math.random() < blunderRate) {
    return allMoves[Math.floor(Math.random() * allMoves.length)];
  }
  const best = getBestMove(board, side, depth);
  if (!best || blunderRate <= 0 || Math.random() > blunderRate) return best;

  const legal = allMoves
    .map((move) => {
      const reply = getBestMove(applyMove(board, move), side === 'red' ? 'black' : 'red', Math.max(1, depth - 1));
      return { ...move, score: -(reply?.score ?? 0) + (move.capture ? 40 : 0) };
    })
    .sort((a, b) => (b.score ?? 0) - (a.score ?? 0));

  if (legal.length <= 1) return best;
  const pool = legal.slice(0, Math.min(4, legal.length));
  return pool[Math.floor(Math.random() * pool.length)];
}

function findMatchingLegalMove(state: GameState, move: Move) {
  return getLegalMoves(state.board, state.turn).find((legal) => sameMove(legal, move));
}

function sameSquare(a: Pos, b: Pos) {
  return a.row === b.row && a.col === b.col;
}

function sameMove(a: Move, b: Move) {
  return sameSquare(a.from, b.from) && sameSquare(a.to, b.to);
}
