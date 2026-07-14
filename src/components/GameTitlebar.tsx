import { EyeOff, Minus, Pin, PinOff, Power } from 'lucide-react';
import { IconButton } from './IconButton';

export function GameTitlebar({
  compact,
  onToggleCompact,
  alwaysOnTop,
  onTogglePin,
  statusText,
  onMinimize,
  onHide,
  onClose
}: {
  compact: boolean;
  onToggleCompact: () => void;
  alwaysOnTop: boolean;
  onTogglePin: () => void;
  statusText: string;
  onMinimize: () => void;
  onHide: () => void;
  onClose: () => void;
}) {
  if (compact) {
    return (
      <header className="pet-titlebar">
        <button className="brand-chip" type="button" onClick={onToggleCompact} title="展开棋盘">
          棋
        </button>
        <span className="mini-status">{statusText}</span>
        <IconButton title="退出" onClick={onClose}>
          <Power size={16} />
        </IconButton>
      </header>
    );
  }

  return (
    <header className="pet-titlebar">
      <button className="brand-chip" type="button" onClick={onToggleCompact} title="收成小棋子">
        棋
      </button>
      <div className="title-copy">
        <strong>象棋桌宠 <small>练局</small></strong>
        <span>{statusText}</span>
      </div>
      <div className="window-actions">
        <IconButton title={alwaysOnTop ? '取消置顶' : '置顶'} onClick={onTogglePin}>
          {alwaysOnTop ? <Pin size={16} /> : <PinOff size={16} />}
        </IconButton>
        <IconButton title="最小化" onClick={onMinimize}>
          <Minus size={16} />
        </IconButton>
        <IconButton title="隐藏到托盘" onClick={onHide}>
          <EyeOff size={16} />
        </IconButton>
        <IconButton title="退出" onClick={onClose}>
          <Power size={16} />
        </IconButton>
      </div>
    </header>
  );
}
