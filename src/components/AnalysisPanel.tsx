import { useMemo } from 'react';
import { applyMove } from '../game/xiangqi';
import { uciToMove } from '../game/fen';
import { moveNotation } from '../game/notation';
import type { UseXiangqiGameReturn } from '../game/useXiangqiGame';

export function AnalysisPanel({
  analysis,
  board,
  turn,
  bookSuggestion,
  engineAvailable
}: {
  analysis: UseXiangqiGameReturn['analysis'];
  board: UseXiangqiGameReturn['state']['board'];
  turn: 'red' | 'black';
  bookSuggestion: UseXiangqiGameReturn['bookSuggestion'];
  engineAvailable: boolean;
}) {
  const best = analysis?.bestMove ? uciToMove(analysis.bestMove, board) : null;
  const pv = formatPrincipalVariation(analysis?.pv ?? [], board);
  const score = formatScore(analysis, turn);
  const statusText = !engineAvailable
    ? '未安装强引擎'
    : analysis?.ok
      ? score
      : '引擎分析中...';
  const hint = bookSuggestion?.comment || (best ? `最佳：${moveNotation(board, best)}` : engineAvailable ? '等待引擎输出最佳走法' : '把 pikafish*.exe 放进 engines/ 后重启启用强分析');

  return (
    <section className="analysis-panel">
      <div>
        <span>{bookSuggestion ? `${bookSuggestion.book} · ${bookSuggestion.line}` : '分析'}</span>
        <strong>{bookSuggestion ? `谱招：${bookSuggestion.label}` : statusText}</strong>
      </div>
      <p>{hint}</p>
      {bookSuggestion ? <p>来源：{bookSuggestion.source}</p> : null}
      {pv ? <p>主变：{pv}</p> : null}
    </section>
  );
}

function formatScore(analysis: UseXiangqiGameReturn['analysis'], turn: 'red' | 'black') {
  if (!analysis?.ok) return '等待引擎';
  if (analysis.mate) return `${analysis.mate > 0 ? (turn === 'red' ? '红方' : '黑方') : turn === 'red' ? '黑方' : '红方'}杀 ${Math.abs(analysis.mate)}`;
  const cp = analysis.scoreCp ?? 0;
  const redCp = turn === 'red' ? cp : -cp;
  return redCp >= 0 ? `红方 +${Math.round(redCp)}` : `黑方 +${Math.abs(Math.round(redCp))}`;
}

function formatPrincipalVariation(pv: string[], board: UseXiangqiGameReturn['state']['board']) {
  let currentBoard = board;
  const result: string[] = [];
  for (const uci of pv.slice(0, 4)) {
    const move = uciToMove(uci, currentBoard);
    if (!move) break;
    result.push(moveNotation(currentBoard, move));
    currentBoard = applyMove(currentBoard, move);
  }
  return result.join(' / ');
}
