import { useEffect, useMemo, useRef, useState } from 'react';
import { chooseAiMove, difficulties, getDifficultyProfile, type DifficultyKey } from './ai';
import { getBookSuggestion, getBookSuggestions } from './bookGuide';
import { boardToFen, uciToMove } from './fen';
import { moveNotation } from './notation';
import { findMatchingLegalMove, sameMove, sameSquare } from './moveUtils';
import { undoAutoAi, undoManual, type MoveActor, type UndoEntry } from './undo';
import {
  createInitialState,
  getLegalMoves,
  makeMove,
  posKey,
  type GameState,
  type Move,
  type Pos
} from './xiangqi';

export type { DifficultyKey };

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

export { difficulties };

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

export type UseXiangqiGameReturn = ReturnType<typeof useXiangqiGame>;

export function useXiangqiGame() {
  const savedSettings = useMemo(readSavedSettings, []);
  const [state, setState] = useState<GameState>(() => createInitialState());
  const stateRef = useRef(state);
  const positionIdRef = useRef(0);
  const [undoStack, setUndoStack] = useState<UndoEntry[]>([]);
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

  function bumpPosition() {
    positionIdRef.current += 1;
  }

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
    if (!window.xiangqiPet?.analyze) return;
    window.xiangqiPet
      .analyze({ fen: boardToFen(state.board, state.turn), movetime: 450 })
      .then((result) => {
        if (cancelled || (!result.ok && result.error === 'Engine is busy')) return;
        setAnalysis(result);
        setEngineAvailable(result.ok && result.engine === 'pikafish');
      })
      .catch(() => {
        if (!cancelled) setAnalysis(null);
      });
    return () => {
      cancelled = true;
    };
  }, [state.board, state.turn]);

  useEffect(() => {
    if (autoAi && !thinking && !state.winner && state.turn !== playerSide) {
      const timer = window.setTimeout(() => makeAiMove(state), 180);
      return () => window.clearTimeout(timer);
    }
  }, [autoAi, playerSide, state, thinking]);

  function commitMove(fromState: GameState, move: Move, actor: MoveActor) {
    if (stateRef.current !== fromState) return null;
    const next = makeMove(fromState, move);
    if (next === fromState || next.history.length === fromState.history.length) return null;
    setUndoStack((stack) => [...stack, { previous: fromState, actor }]);
    setState(next);
    bumpPosition();
    return next;
  }

  function reset() {
    setState(createInitialState());
    setUndoStack([]);
    setSelected(null);
    setHint(null);
    setThinking(false);
    bumpPosition();
  }

  function switchSide() {
    setPlayerSide((side) => (side === 'red' ? 'black' : 'red'));
    setState(createInitialState());
    setUndoStack([]);
    setSelected(null);
    setHint(null);
    setThinking(false);
    bumpPosition();
  }

  function undo() {
    const result = autoAi ? undoAutoAi(undoStack) : undoManual(undoStack);
    if (!result) return;
    setState(result.state);
    setUndoStack(result.stack);
    setSelected(null);
    setHint(null);
    setThinking(false);
    bumpPosition();
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

      commitMove(state, move, 'player');
      setSelected(null);
      return;
    }

    setSelected(piece?.side === state.turn && (!autoAi || state.turn === playerSide) ? pos : null);
  }

  function showHint() {
    if (state.winner || thinking) return;
    const startPositionId = positionIdRef.current;
    setThinking(true);
    window.setTimeout(() => {
      if (positionIdRef.current !== startPositionId) {
        setThinking(false);
        return;
      }
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

      const profile = getDifficultyProfile(difficulty);
      const best = chooseAiMove(state.board, state.turn, Math.max(profile.depth, 2));
      setHint(best);
      setThinking(false);
      if (best) {
        setState((current) => ({ ...current, message: `${current.turn === 'red' ? '红方' : '黑方'}建议：${moveNotation(current.board, best)}` }));
      }
    }, 80);
  }

  function makeAiMove(inputState = state) {
    if (inputState.winner || stateRef.current !== inputState) return;
    const startPositionId = positionIdRef.current;
    const isCurrent = () => positionIdRef.current === startPositionId;
    const profile = getDifficultyProfile(difficulty);
    setThinking(true);
    window.setTimeout(async () => {
      if (!isCurrent()) return;
      const bookMove = bookPractice ? getBookSuggestion(inputState)?.move : null;
      if (bookMove) {
        const next = commitMove(inputState, bookMove, 'ai');
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
          const result = await window.xiangqiPet.playAnalyze({ fen: boardToFen(inputState.board, inputState.turn), movetime: profile.engineTime });
          if (!isCurrent()) return;
          const rawEngineMove = result.ok && result.bestMove ? uciToMove(result.bestMove, inputState.board) : null;
          const engineMove = rawEngineMove ? findMatchingLegalMove(inputState, rawEngineMove) : null;
          if (engineMove) {
            commitMove(inputState, engineMove, 'ai');
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
      if (best) commitMove(inputState, best, 'ai');
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
