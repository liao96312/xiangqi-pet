import { useEffect, useMemo, useRef, useState } from 'react';
import { applyMove, createInitialBoard, getCheckmateTactic, isInCheck, posKey, type Move, type Pos } from '../game/xiangqi';
import { sameMove } from '../game/moveUtils';
import type { UseXiangqiGameReturn } from '../game/useXiangqiGame';

type MoveAnimation = {
  key: string;
  move: Move;
  reverse?: boolean;
};

export function useBoardAnimation(game: UseXiangqiGameReturn) {
  const [moveAnimation, setMoveAnimation] = useState<MoveAnimation | null>(null);
  const [settleAnimation, setSettleAnimation] = useState<{ key: string; pos: Pos } | null>(null);
  const [captureBurst, setCaptureBurst] = useState<{ key: string; pos: Pos } | null>(null);
  const [checkFlashKey, setCheckFlashKey] = useState('');
  const [mateFlash, setMateFlash] = useState<{ key: string; text: string } | null>(null);
  const previousHistoryRef = useRef<Move[]>(game.state.history);

  const checkmateTactic = useMemo(() => getCheckmateTactic(game.state.board, game.state.turn), [game.state.board, game.state.turn]);
  const lastMove = game.state.history.at(-1) ?? null;
  const lastMoveKey = lastMove ? `${game.state.history.length}-${posKey(lastMove.from)}-${posKey(lastMove.to)}` : '';
  const isCheckingSide = !game.state.winner && isInCheck(game.state.board, game.state.turn);
  const finalMateTactic = useMemo(() => getFinalMateTactic(game.state.history, game.state.winner), [game.state.history, game.state.winner]);

  useEffect(() => {
    const previous = previousHistoryRef.current;
    const current = game.state.history;
    const timers: number[] = [];

    if (current.length > previous.length) {
      const move = current.at(-1);
      if (move) {
        const key = `${current.length}-${posKey(move.from)}-${posKey(move.to)}`;
        setMoveAnimation({ key, move });
        if (move.capture) setCaptureBurst({ key, pos: move.to });
        timers.push(window.setTimeout(() => setMoveAnimation(null), 260));
        timers.push(window.setTimeout(() => setSettleAnimation({ key, pos: move.to }), 235));
        timers.push(window.setTimeout(() => setSettleAnimation(null), 520));
        timers.push(window.setTimeout(() => setCaptureBurst(null), 520));
      }
    } else if (current.length < previous.length && previous.length - current.length <= 2) {
      const move = previous.at(-1);
      if (move) {
        const key = `undo-${previous.length}-${posKey(move.to)}-${posKey(move.from)}`;
        setMoveAnimation({ key, move, reverse: true });
        timers.push(window.setTimeout(() => setMoveAnimation(null), 260));
        timers.push(window.setTimeout(() => setSettleAnimation({ key, pos: move.from }), 235));
        timers.push(window.setTimeout(() => setSettleAnimation(null), 520));
      }
    }

    previousHistoryRef.current = current;
    return () => timers.forEach((timer) => window.clearTimeout(timer));
  }, [game.state.history]);

  useEffect(() => {
    if (!lastMoveKey || !isCheckingSide) {
      // 条件不满足时也要清理，避免快速连招下 DOM 节点残留
      setCheckFlashKey('');
      return;
    }
    setCheckFlashKey(lastMoveKey);
    const timeout = window.setTimeout(() => setCheckFlashKey(''), 900);
    return () => window.clearTimeout(timeout);
  }, [isCheckingSide, lastMoveKey]);

  useEffect(() => {
    if (!lastMoveKey || !game.state.winner) {
      // 同上：绝杀弹字在重开或条件变化时必须清理
      setMateFlash(null);
      return;
    }
    setMateFlash({ key: lastMoveKey, text: finalMateTactic?.name ?? '绝杀' });
    const timeout = window.setTimeout(() => setMateFlash(null), 1100);
    return () => window.clearTimeout(timeout);
  }, [finalMateTactic?.name, game.state.winner, lastMoveKey]);

  return {
    moveAnimation,
    settleAnimation,
    captureBurst,
    checkFlashKey,
    mateFlash,
    checkmateTactic,
    lastMove
  };
}

function getFinalMateTactic(history: Move[], winner: 'red' | 'black' | null) {
  const lastMove = history.at(-1);
  if (!winner || !lastMove) return null;

  let board = createInitialBoard();
  for (const move of history.slice(0, -1)) {
    board = applyMove(board, move);
  }

  const tactic = getCheckmateTactic(board, winner);
  return tactic && sameMove(tactic.move, lastMove) ? tactic : null;
}
