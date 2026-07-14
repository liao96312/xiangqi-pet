import type { UseXiangqiGameReturn } from '../game/useXiangqiGame';

export function EvalBar({
  analysis,
  engineText,
  engineAvailable,
  turn
}: {
  analysis: UseXiangqiGameReturn['analysis'];
  engineText: string;
  engineAvailable: boolean;
  turn: 'red' | 'black';
}) {
  const cp = analysis?.scoreCp ?? 0;
  const redCp = turn === 'red' ? cp : -cp;
  const clamped = Math.max(-600, Math.min(600, redCp));
  const redPercent = 50 + (clamped / 600) * 42;
  const statusLabel = !engineAvailable
    ? '未安装强引擎'
    : analysis?.ok
      ? analysis.mate
        ? `${analysis.mate > 0 ? '红方' : '黑方'}杀 ${Math.abs(analysis.mate)}`
        : redCp >= 0
          ? `红方 +${Math.round(redCp)}`
          : `黑方 +${Math.abs(Math.round(redCp))}`
      : '引擎分析中...';

  return (
    <section className="eval-panel">
      <div className="eval-meta">
        <span>{engineText}</span>
        <strong>{statusLabel}</strong>
      </div>
      <div className="eval-track" aria-label="局面评分">
        <span className="eval-red" style={{ width: `${redPercent}%` }} />
        <span className="eval-zero" />
      </div>
    </section>
  );
}
