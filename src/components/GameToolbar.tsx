import { Bot, ChevronDown, ChevronUp, Lightbulb, RefreshCcw, RotateCw, ScanSearch, Undo2 } from 'lucide-react';
import type { DifficultyKey, UseXiangqiGameReturn } from '../game/useXiangqiGame';

export function GameToolbar({
  game,
  flipped,
  onToggleFlip,
  reviewing,
  onReview,
  statusText,
  contextText,
  modeText,
  detailsOpen,
  onToggleDetails
}: {
  game: UseXiangqiGameReturn;
  flipped: boolean;
  onToggleFlip: () => void;
  reviewing: boolean;
  onReview: () => void;
  statusText: string;
  contextText: string;
  modeText: string;
  detailsOpen: boolean;
  onToggleDetails: () => void;
}) {
  const reviewDisabled = reviewing || game.thinking || !game.engineAvailable;
  const reviewTitle = !game.engineAvailable
    ? '复盘需安装 Pikafish 引擎'
    : reviewing
      ? '复盘中...'
      : '复盘本局';
  return (
    <aside className="command-panel" aria-label="对局控制">
      <section className={`turn-card ${game.state.turn}`} aria-live="polite">
        <span className="turn-kicker">
          <i /> {game.state.turn === 'red' ? '红方行棋' : '黑方行棋'}
        </span>
        <strong>{statusText}</strong>
        <p>{contextText}</p>
        <small>{modeText}</small>
      </section>

      <div className="command-actions">
        <ActionButton label="提示" title="AI 提示" active={!!game.hint} onClick={game.showHint} disabled={game.thinking || !!game.state.winner}>
          <Lightbulb size={17} />
        </ActionButton>
        <ActionButton label="AI 应招" title="让 AI 走一步" onClick={() => game.makeAiMove()} disabled={game.thinking || game.state.turn === game.playerSide}>
          <Bot size={17} />
        </ActionButton>
        <ActionButton label="悔棋" title="悔棋" onClick={game.undo} disabled={!game.canUndo || game.thinking}>
          <Undo2 size={17} />
        </ActionButton>
        <ActionButton label="复盘" title={reviewTitle} onClick={onReview} disabled={reviewDisabled}>
          <ScanSearch size={17} />
        </ActionButton>
        <ActionButton label="翻转" title="翻转视角" active={flipped} onClick={onToggleFlip}>
          <RotateCw size={17} />
        </ActionButton>
        <ActionButton label="新局" title="重新开局" onClick={game.reset}>
          <RefreshCcw size={17} />
        </ActionButton>
      </div>

      <div className="game-settings">
        <label className="setting-row" title="陪练难度">
          <span>难度</span>
          <select value={game.difficulty} onChange={(event) => game.setDifficulty(event.target.value as DifficultyKey)}>
            {game.difficulties.map((item) => (
              <option key={item.key} value={item.key}>
                {item.label}
              </option>
            ))}
          </select>
        </label>
        <button className="setting-row" type="button" title="开局换边" onClick={game.switchSide} disabled={game.thinking}>
          <span>执子</span>
          <strong>{game.playerSide === 'red' ? '红方' : '黑方'}</strong>
        </button>
        <button className={`setting-row ${game.autoAi ? 'active' : ''}`} type="button" onClick={() => game.setAutoAi(!game.autoAi)}>
          <span>自动陪练</span>
          <strong>{game.autoAi ? '开启' : '关闭'}</strong>
        </button>
      </div>

      <button className="details-toggle" type="button" onClick={onToggleDetails} aria-expanded={detailsOpen}>
        <span>局面详情</span>
        {detailsOpen ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
      </button>
    </aside>
  );
}

function ActionButton({
  label,
  title,
  children,
  active,
  disabled,
  onClick
}: {
  label: string;
  title: string;
  children: React.ReactNode;
  active?: boolean;
  disabled?: boolean;
  onClick: () => void;
}) {
  return (
    <button className={`action-button ${active ? 'active' : ''}`} type="button" title={title} onClick={onClick} disabled={disabled}>
      {children}
      <span>{label}</span>
    </button>
  );
}
