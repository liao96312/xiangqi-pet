import { useCallback, useState } from 'react';
import { applyMove, createInitialBoard, type GameState, type Move } from '../game/xiangqi';
import { boardToFen, uciToMove } from '../game/fen';
import { moveNotation } from '../game/notation';
import type { UseXiangqiGameReturn } from '../game/useXiangqiGame';

export function useReview(game: UseXiangqiGameReturn) {
  const [reviewing, setReviewing] = useState(false);
  const [review, setReview] = useState('');

  const runReview = useCallback(async () => {
    if (game.state.history.length === 0) {
      setReview('还没走子，没东西可复盘');
      return;
    }
    if (!game.engineAvailable) {
      setReview('复盘需要强引擎：把 pikafish*.exe 放进 engines/ 后重启应用');
      return;
    }
    if (!window.xiangqiPet?.playAnalyze) {
      setReview('引擎桥接未就绪，请重启应用');
      return;
    }
    setReviewing(true);
    setReview('复盘中，请稍候...');
    try {
      let board = createInitialBoard();
      let worst = { loss: 0, text: '这盘走得挺稳，没发现明显失误' };
      for (let index = 0; index < game.state.history.length; index += 1) {
        const move = game.state.history[index];
        const turn = index % 2 === 0 ? 'red' : 'black';
        const beforeBoard = board;
        const before = await window.xiangqiPet.playAnalyze({ fen: boardToFen(beforeBoard, turn), movetime: 700 });
        if (!before.ok) {
          throw new Error(before.error || '引擎分析失败');
        }
        board = applyMove(board, move);
        const after = await window.xiangqiPet.playAnalyze({ fen: boardToFen(board, turn === 'red' ? 'black' : 'red'), movetime: 700 });
        if (!after.ok) {
          throw new Error(after.error || '引擎分析失败');
        }
        if (before.scoreCp == null || after.scoreCp == null) continue;
        const beforeRed = turn === 'red' ? before.scoreCp : -before.scoreCp;
        const afterRed = turn === 'red' ? -after.scoreCp : after.scoreCp;
        const loss = turn === 'red' ? beforeRed - afterRed : afterRed - beforeRed;
        const best = before.bestMove ? uciToMove(before.bestMove, beforeBoard) : null;
        if (loss > worst.loss) {
          worst = {
            loss,
            text: `第${Math.floor(index / 2) + 1}回合${turn === 'red' ? '红方' : '黑方'}亏 ${Math.round(loss)} 分，应走：${best ? moveNotation(beforeBoard, best) : '引擎未给出'}`
          };
        }
      }
      setReview(worst.text);
    } catch (error) {
      setReview(describeReviewError(error));
    } finally {
      setReviewing(false);
    }
  }, [game.state.history, game.engineAvailable]);

  return { reviewing, review, setReview, runReview };
}

function describeReviewError(error: unknown): string {
  const message = error instanceof Error ? error.message : String(error);
  if (message.includes('busy')) return '引擎正忙，请稍等几秒再复盘';
  if (message.includes('timeout') || message.includes('timed out')) return '引擎分析超时，请降低对局长度或重试';
  if (message.includes('not running') || message.includes('not found')) return '引擎未运行，请重启应用';
  return `复盘失败：${message}`;
}
