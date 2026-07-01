import { useEffect, useMemo, useRef, useState } from 'react';
import { EyeOff, Lightbulb, Minus, Pin, PinOff, Power, RefreshCcw, ScanSearch, Sparkles, Undo2 } from 'lucide-react';
import { useXiangqiGame } from './game/useXiangqiGame';
import { applyMove, createInitialBoard, getCheckmateTactic, isInCheck, isPieceHanging, isPieceProtected, posKey, type Move } from './game/xiangqi';
import { boardToFen, uciToMove } from './game/fen';
import { moveNotation } from './game/notation';
import type { Pos } from './game/xiangqi';

const FLIPPED_VIEW_KEY = 'xiangqi-pet-flipped';

type MoveAnimation = {
  key: string;
  move: Move;
  reverse?: boolean;
};

function readSavedFlipped() {
  try {
    return window.localStorage.getItem(FLIPPED_VIEW_KEY) === 'true';
  } catch {
    return false;
  }
}

export default function App() {
  const game = useXiangqiGame();
  const [compact, setCompact] = useState(false);
  const [alwaysOnTop, setAlwaysOnTop] = useState(false);
  const [windowError, setWindowError] = useState('');
  const [reviewing, setReviewing] = useState(false);
  const [review, setReview] = useState('');
  const [flipped, setFlipped] = useState(readSavedFlipped);
  const [moveAnimation, setMoveAnimation] = useState<MoveAnimation | null>(null);
  const [settleAnimation, setSettleAnimation] = useState<{ key: string; pos: Pos } | null>(null);
  const [captureBurst, setCaptureBurst] = useState<{ key: string; pos: Pos } | null>(null);
  const [checkFlashKey, setCheckFlashKey] = useState('');
  const [mateFlash, setMateFlash] = useState<{ key: string; text: string } | null>(null);
  const previousHistoryRef = useRef<Move[]>(game.state.history);

  useEffect(() => {
    window.xiangqiPet?.getAlwaysOnTop().then(setAlwaysOnTop).catch(() => {});
  }, []);

  useEffect(() => {
    try {
      window.localStorage.setItem(FLIPPED_VIEW_KEY, String(flipped));
    } catch {
      // Ignore disabled storage; the button still works for this session.
    }
  }, [flipped]);

  const legalTargetKeys = useMemo(() => new Set(game.legalTargets.map(posKey)), [game.legalTargets]);
  const checkmateTactic = useMemo(() => getCheckmateTactic(game.state.board, game.state.turn), [game.state.board, game.state.turn]);
  const selectedHanging = !!game.selected && isPieceHanging(game.state.board, game.selected);
  const lastMove = game.state.history.at(-1) ?? null;
  const lastMoveKey = lastMove ? `${game.state.history.length}-${posKey(lastMove.from)}-${posKey(lastMove.to)}` : '';
  const isCheckingSide = !game.state.winner && isInCheck(game.state.board, game.state.turn);
  const finalMateTactic = useMemo(() => getFinalMateTactic(game.state.history, game.state.winner), [game.state.history, game.state.winner]);
  const captureLine = lastMove?.capture ? `吃掉${lastMove.capture.side === 'red' ? '红' : '黑'}${pieceLabelView(lastMove.capture)}` : '';
  const hintLine = game.hint
    ? moveNotation(game.state.board, game.hint)
    : game.bookSuggestions.length
      ? `谱招：${game.bookSuggestions.slice(0, 3).map((item) => item.label).join(' / ')}`
      : checkmateTactic
        ? `${checkmateTactic.name}：${moveNotation(game.state.board, checkmateTactic.move)}`
        : selectedHanging
          ? '此子无保护，会被对面吃'
      : game.bookPractice
        ? '已脱谱，请按谱招回到谱线'
        : '等你开口';
  const engineText = game.engineAvailable ? `Pikafish ${game.analysis?.depth ? `d${game.analysis.depth}` : '已连接'}` : '内置陪练';

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
    if (!lastMoveKey || !isCheckingSide) return;
    setCheckFlashKey(lastMoveKey);
    const timeout = window.setTimeout(() => setCheckFlashKey(''), 900);
    return () => window.clearTimeout(timeout);
  }, [isCheckingSide, lastMoveKey]);

  useEffect(() => {
    if (!lastMoveKey || !game.state.winner) return;
    setMateFlash({ key: lastMoveKey, text: finalMateTactic?.name ?? '绝杀' });
    const timeout = window.setTimeout(() => setMateFlash(null), 1100);
    return () => window.clearTimeout(timeout);
  }, [finalMateTactic?.name, game.state.winner, lastMoveKey]);

  async function togglePin() {
    try {
      const next = await window.xiangqiPet?.toggleAlwaysOnTop();
      if (typeof next === 'boolean') setAlwaysOnTop(next);
      setWindowError('');
    } catch {
      setWindowError('窗口控制失败');
    }
  }

  async function runWindowAction(action: 'minimize' | 'hide' | 'close') {
    try {
      const api = window.xiangqiPet;
      if (!api) throw new Error('missing preload');
      await api[action]();
      setWindowError('');
    } catch {
      setWindowError('窗口控制失败');
    }
  }

  async function runReview() {
    if (!window.xiangqiPet?.playAnalyze || game.state.history.length === 0) {
      setReview(game.state.history.length === 0 ? '还没走子，没东西可复盘' : '强引擎没连上，复盘不可用');
      return;
    }
    setReviewing(true);
    setReview('复盘中...');
    try {
      let board = createInitialBoard();
      let worst = { loss: 0, text: '没发现明显问题' };
      for (let index = 0; index < game.state.history.length; index += 1) {
        const move = game.state.history[index];
        const turn = index % 2 === 0 ? 'red' : 'black';
        const beforeBoard = board;
        const before = await window.xiangqiPet.playAnalyze({ fen: boardToFen(beforeBoard, turn), movetime: 700 });
        board = applyMove(board, move);
        const after = await window.xiangqiPet.playAnalyze({ fen: boardToFen(board, turn === 'red' ? 'black' : 'red'), movetime: 700 });
        if (!before.ok || !after.ok || before.scoreCp == null || after.scoreCp == null) continue;
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
    } catch {
      setReview('复盘失败，稍后再试');
    } finally {
      setReviewing(false);
    }
  }

  if (compact) {
    return (
      <div className="pet-shell compact-shell">
        <header className="pet-titlebar">
          <button className="brand-chip" type="button" onClick={() => setCompact(false)} title="展开棋盘">
            棋
          </button>
          <span className="mini-status">{game.state.winner ? game.state.message : hintLine}</span>
          <IconButton title="退出" onClick={() => runWindowAction('close')}>
            <Power size={16} />
          </IconButton>
        </header>
      </div>
    );
  }

  return (
    <main className="pet-shell">
      <header className="pet-titlebar">
        <button className="brand-chip" type="button" onClick={() => setCompact(true)} title="收成小棋子">
          棋
        </button>
        <div className="title-copy">
          <strong>象棋桌宠</strong>
          <span>{windowError || (game.thinking ? 'AI 正在想' : game.state.message)}</span>
        </div>
        <div className="window-actions">
          <IconButton title={alwaysOnTop ? '取消置顶' : '置顶'} onClick={togglePin}>
            {alwaysOnTop ? <Pin size={16} /> : <PinOff size={16} />}
          </IconButton>
          <IconButton title="最小化" onClick={() => runWindowAction('minimize')}>
            <Minus size={16} />
          </IconButton>
          <IconButton title="隐藏到托盘" onClick={() => runWindowAction('hide')}>
            <EyeOff size={16} />
          </IconButton>
          <IconButton title="退出" onClick={() => runWindowAction('close')}>
            <Power size={16} />
          </IconButton>
        </div>
      </header>

      <section className="status-strip">
        <span className={game.state.turn === 'red' ? 'side-pill red' : 'side-pill black'}>{game.state.turn === 'red' ? '红方' : '黑方'}</span>
        <span>{game.autoAi ? `陪练开启 · 你执${game.playerSide === 'red' ? '红' : '黑'}` : '自由对弈'}</span>
        <span>{captureLine || `提示：${hintLine}`}</span>
      </section>

      <EvalBar analysis={game.analysis} engineText={engineText} turn={game.state.turn} />
      <AnalysisPanel analysis={game.analysis} board={game.state.board} turn={game.state.turn} bookSuggestion={game.bookSuggestion} />
      {review ? <section className="review-panel">{review}</section> : null}

      <section className="board-stage">
        <Board board={game.state.board} selected={game.selected} legalTargetKeys={legalTargetKeys} hint={game.hint} checkmateMove={checkmateTactic?.move ?? null} lastMove={lastMove} moveAnimation={moveAnimation} settleAnimation={settleAnimation} captureBurst={captureBurst} flipped={flipped} onChoose={game.choose} />
        {checkmateTactic ? <MateBanner key={`${checkmateTactic.name}-${posKey(checkmateTactic.move.from)}-${posKey(checkmateTactic.move.to)}`} tactic={checkmateTactic} board={game.state.board} /> : null}
        {checkFlashKey ? <BoardFlash key={checkFlashKey} text="将" /> : null}
        {mateFlash ? <BoardFlash key={mateFlash.key} text={mateFlash.text} variant="mate" /> : null}
      </section>

      <MoveList history={game.state.history} />

      {game.state.winner ? (
        <section className="result-banner" role="status" aria-live="polite">
          <strong>{game.state.winner === 'red' ? '红方胜' : '黑方胜'}</strong>
          <span>{game.state.message}</span>
          <button type="button" onClick={game.reset}>
            再来
          </button>
        </section>
      ) : null}

      <footer className="toolbar">
        <IconButton title="AI 提示" active={!!game.hint} onClick={game.showHint} disabled={game.thinking || !!game.state.winner}>
          <Lightbulb size={18} />
        </IconButton>
        <IconButton title="AI 走一步" onClick={() => game.makeAiMove()} disabled={game.thinking || game.state.turn === game.playerSide}>
          <Sparkles size={18} />
        </IconButton>
        <IconButton title="悔棋" onClick={game.undo} disabled={!game.canUndo || game.thinking}>
          <Undo2 size={18} />
        </IconButton>
        <IconButton title="复盘" onClick={runReview} disabled={reviewing || game.thinking}>
          <ScanSearch size={18} />
        </IconButton>
        <button className="toggle" type="button" title="开局换边" onClick={game.switchSide} disabled={game.thinking}>
          执{game.playerSide === 'red' ? '红' : '黑'}
        </button>
        <button className={flipped ? 'toggle active' : 'toggle'} type="button" title="翻转视角" onClick={() => setFlipped((value) => !value)}>
          翻转
        </button>
        <label className="difficulty-select" title="陪练难度">
          <span>难度</span>
          <select value={game.difficulty} onChange={(event) => game.setDifficulty(event.target.value as typeof game.difficulty)}>
            {game.difficulties.map((item) => (
              <option key={item.key} value={item.key}>
                {item.label}
              </option>
            ))}
          </select>
        </label>
        <button className={game.autoAi ? 'toggle active' : 'toggle'} type="button" onClick={() => game.setAutoAi(!game.autoAi)}>
          陪练
        </button>
        <IconButton title="重开" onClick={game.reset}>
          <RefreshCcw size={18} />
        </IconButton>
      </footer>
    </main>
  );
}

function MoveList({ history }: { history: Move[] }) {
  const items = useMemo(() => {
    let board = createInitialBoard();
    return history.map((move, index) => {
      const label = moveNotation(board, move);
      board = applyMove(board, move);
      return {
        index,
        label,
        round: Math.floor(index / 2) + 1,
        side: index % 2 === 0 ? '红' : '黑'
      };
    });
  }, [history]);

  if (items.length === 0) {
    return <section className="move-list empty">尚未走子</section>;
  }

  return (
    <section className="move-list" aria-label="走法列表">
      {items.map((item) => (
        <span className="move-list-item" key={item.index}>
          {item.round}.{item.side} {item.label}
        </span>
      ))}
    </section>
  );
}

function MateBanner({ tactic, board }: { tactic: NonNullable<ReturnType<typeof getCheckmateTactic>>; board: ReturnType<typeof useXiangqiGame>['state']['board'] }) {
  return (
    <section className="mate-banner" aria-live="polite">
      <span>绝杀</span>
      <strong>{tactic.name}</strong>
      <em>{moveNotation(board, tactic.move)} · {tactic.description}</em>
    </section>
  );
}

function BoardFlash({ text, variant = 'check' }: { text: string; variant?: 'check' | 'mate' }) {
  return (
    <div className={`board-flash ${variant}`} aria-live="assertive" role="status">
      {text}
    </div>
  );
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

function sameMove(a: Move, b: Move) {
  return a.from.row === b.from.row && a.from.col === b.from.col && a.to.row === b.to.row && a.to.col === b.to.col;
}

function AnalysisPanel({
  analysis,
  board,
  turn,
  bookSuggestion
}: {
  analysis: ReturnType<typeof useXiangqiGame>['analysis'];
  board: ReturnType<typeof useXiangqiGame>['state']['board'];
  turn: 'red' | 'black';
  bookSuggestion: ReturnType<typeof useXiangqiGame>['bookSuggestion'];
}) {
  const best = analysis?.bestMove ? uciToMove(analysis.bestMove, board) : null;
  const pv = formatPrincipalVariation(analysis?.pv ?? [], board);
  const score = formatScore(analysis, turn);

  return (
    <section className="analysis-panel">
      <div>
        <span>{bookSuggestion ? `${bookSuggestion.book} · ${bookSuggestion.line}` : '分析'}</span>
        <strong>{bookSuggestion ? `谱招：${bookSuggestion.label}` : analysis?.ok ? score : '未连接强引擎'}</strong>
      </div>
      <p>{bookSuggestion?.comment || (best ? `最佳：${moveNotation(board, best)}` : '把 pikafish*.exe 放进 engines/ 后启用强分析')}</p>
      {bookSuggestion ? <p>来源：{bookSuggestion.source}</p> : null}
      {pv ? <p>主变：{pv}</p> : null}
    </section>
  );
}

function formatScore(analysis: ReturnType<typeof useXiangqiGame>['analysis'], turn: 'red' | 'black') {
  if (!analysis?.ok) return '等待引擎';
  if (analysis.mate) return `${analysis.mate > 0 ? (turn === 'red' ? '红方' : '黑方') : turn === 'red' ? '黑方' : '红方'}杀 ${Math.abs(analysis.mate)}`;
  const cp = analysis.scoreCp ?? 0;
  const redCp = turn === 'red' ? cp : -cp;
  return redCp >= 0 ? `红方 +${Math.round(redCp)}` : `黑方 +${Math.abs(Math.round(redCp))}`;
}

function formatPrincipalVariation(pv: string[], board: ReturnType<typeof useXiangqiGame>['state']['board']) {
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

function EvalBar({ analysis, engineText, turn }: { analysis: ReturnType<typeof useXiangqiGame>['analysis']; engineText: string; turn: 'red' | 'black' }) {
  const cp = analysis?.scoreCp ?? 0;
  const redCp = turn === 'red' ? cp : -cp;
  const clamped = Math.max(-600, Math.min(600, redCp));
  const redPercent = 50 + (clamped / 600) * 42;
  const label = analysis?.mate
    ? `${analysis.mate > 0 ? '红方' : '黑方'}杀 ${Math.abs(analysis.mate)}`
    : redCp >= 0
      ? `红方 +${Math.round(redCp)}`
      : `黑方 +${Math.abs(Math.round(redCp))}`;

  return (
    <section className="eval-panel">
      <div className="eval-meta">
        <span>{engineText}</span>
        <strong>{analysis?.ok ? label : '等待强引擎'}</strong>
      </div>
      <div className="eval-track" aria-label="局面评分">
        <span className="eval-red" style={{ width: `${redPercent}%` }} />
        <span className="eval-zero" />
      </div>
    </section>
  );
}

function Board({
  board,
  selected,
  legalTargetKeys,
  hint,
  checkmateMove,
  lastMove,
  moveAnimation,
  settleAnimation,
  captureBurst,
  flipped,
  onChoose
}: {
  board: ReturnType<typeof useXiangqiGame>['state']['board'];
  selected: Pos | null;
  legalTargetKeys: Set<string>;
  hint: ReturnType<typeof useXiangqiGame>['hint'];
  checkmateMove: Move | null;
  lastMove: ReturnType<typeof useXiangqiGame>['state']['history'][number] | null;
  moveAnimation: MoveAnimation | null;
  settleAnimation: { key: string; pos: Pos } | null;
  captureBurst: { key: string; pos: Pos } | null;
  flipped: boolean;
  onChoose: (pos: Pos) => void;
}) {
  const hintFrom = hint ? posKey(hint.from) : '';
  const hintTo = hint ? posKey(hint.to) : '';
  const mateFrom = checkmateMove ? posKey(checkmateMove.from) : '';
  const mateTo = checkmateMove ? posKey(checkmateMove.to) : '';
  const lastFrom = lastMove ? posKey(lastMove.from) : '';
  const lastTo = lastMove ? posKey(lastMove.to) : '';
  const lastWasCapture = !!lastMove?.capture;
  const selectedKey = selected ? posKey(selected) : '';
  const selectedUnprotected = selected && board[selected.row][selected.col] ? !isPieceProtected(board, selected) : false;
  const selectedHanging = selected ? isPieceHanging(board, selected) : false;
  const displayPos = (pos: Pos) => (flipped ? { row: 9 - pos.row, col: 8 - pos.col } : pos);
  const point = (pos: Pos) => {
    const display = displayPos(pos);
    return {
      left: `${5.5556 + display.col * 11.1111}%`,
      top: `${9 + display.row * 9}%`
    };
  };
  const movingPiece = moveAnimation
    ? moveAnimation.reverse
      ? board[moveAnimation.move.from.row][moveAnimation.move.from.col]
      : board[moveAnimation.move.to.row][moveAnimation.move.to.col]
    : null;
  const movingArrivalKey = moveAnimation ? posKey(moveAnimation.reverse ? moveAnimation.move.from : moveAnimation.move.to) : '';
  const settleKey = settleAnimation ? posKey(settleAnimation.pos) : '';

  return (
    <section className="board-wrap" aria-label="中国象棋棋盘">
      <div className="xiangqi-board">
        <BoardLines flipped={flipped} />
        {captureBurst ? <CaptureBurst key={captureBurst.key} point={point(captureBurst.pos)} /> : null}
        {movingPiece && moveAnimation ? (
          <MovingPiece
            key={moveAnimation.key}
            piece={movingPiece}
            from={point(moveAnimation.reverse ? moveAnimation.move.to : moveAnimation.move.from)}
            to={point(moveAnimation.reverse ? moveAnimation.move.from : moveAnimation.move.to)}
            reverse={moveAnimation.reverse}
          />
        ) : null}
        {board.map((row, rowIndex) =>
          row.map((piece, colIndex) => {
            const pos = { row: rowIndex, col: colIndex };
            const key = posKey(pos);
            const classes = [
              'cell',
              selectedKey === key ? 'selected' : '',
              selectedKey === key && selectedUnprotected ? 'unprotected' : '',
              selectedKey === key && selectedHanging ? 'hanging' : '',
              legalTargetKeys.has(key) ? 'legal' : '',
              lastFrom === key ? 'last-from' : '',
              lastTo === key ? 'last-to' : '',
              lastTo === key && lastWasCapture ? 'capture-to' : '',
              movingArrivalKey === key ? 'move-arriving' : '',
              settleKey === key ? 'move-settled' : '',
              hintFrom === key ? 'hint-from' : '',
              hintTo === key ? 'hint-to' : '',
              mateFrom === key ? 'mate-from' : '',
              mateTo === key ? 'mate-to' : ''
            ]
.filter(Boolean)
              .join(' ');
            return (
              <button className={classes} key={key} style={point(pos)} type="button" onClick={() => onChoose(pos)} aria-label={`位置 ${colIndex + 1},${rowIndex + 1}`}>
                {piece ? <span className={`piece ${piece.side}`}>{pieceLabelView(piece)}</span> : null}
              </button>
            );
          })
        )}
      </div>
    </section>
  );
}

function MovingPiece({
  piece,
  from,
  to,
  reverse
}: {
  piece: NonNullable<ReturnType<typeof useXiangqiGame>['state']['board'][number][number]>;
  from: { left: string; top: string };
  to: { left: string; top: string };
  reverse?: boolean;
}) {
  const [settled, setSettled] = useState(false);

  useEffect(() => {
    const frame = window.requestAnimationFrame(() => setSettled(true));
    return () => window.cancelAnimationFrame(frame);
  }, []);

  return (
    <span className={reverse ? 'moving-cell reverse' : 'moving-cell'} style={settled ? to : from} aria-hidden="true">
      <span className={`piece ${piece.side}`}>{pieceLabelView(piece)}</span>
    </span>
  );
}

function CaptureBurst({ point }: { point: { left: string; top: string } }) {
  return (
    <span className="capture-burst" style={point} aria-hidden="true">
      <i />
      <i />
      <i />
      <i />
      <i />
      <i />
    </span>
  );
}

function BoardLines({ flipped }: { flipped: boolean }) {
  const verticals = Array.from({ length: 9 }, (_, index) => 50 + index * 100);
  const horizontals = Array.from({ length: 10 }, (_, index) => 90 + index * 90);
  const topFiles = flipped ? ['9', '8', '7', '6', '5', '4', '3', '2', '1'] : ['1', '2', '3', '4', '5', '6', '7', '8', '9'];
  const bottomFiles = flipped ? ['1', '2', '3', '4', '5', '6', '7', '8', '9'] : ['9', '8', '7', '6', '5', '4', '3', '2', '1'];
  const markers = [
    [1, 2],
    [7, 2],
    [0, 3],
    [2, 3],
    [4, 3],
    [6, 3],
    [8, 3],
    [0, 6],
    [2, 6],
    [4, 6],
    [6, 6],
    [8, 6],
    [1, 7],
    [7, 7]
  ];
  return (
    <svg className="board-lines" viewBox="0 0 900 1000" aria-hidden="true">
      {topFiles.map((label, index) => (
        <text className="file-label top-label" key={`top-${label}`} x={50 + index * 100} y="36">
          {label}
        </text>
      ))}
      {bottomFiles.map((label, index) => (
        <text className="file-label bottom-label" key={`bottom-${label}`} x={50 + index * 100} y="988">
          {label}
        </text>
      ))}
      <rect x="50" y="90" width="800" height="810" rx="0" />
      {verticals.slice(1, -1).map((x) => (
        <path key={x} d={`M ${x} 90 L ${x} 450 M ${x} 540 L ${x} 900`} />
      ))}
      {horizontals.slice(1, -1).map((y) => (
        <line key={y} x1="50" y1={y} x2="850" y2={y} />
      ))}
      <path d="M 350 90 L 550 270 M 550 90 L 350 270 M 350 720 L 550 900 M 550 720 L 350 900" />
      {markers.map(([col, row]) => (
        <Marker key={`${col}-${row}`} x={50 + col * 100} y={90 + row * 90} edge={col === 0 ? 'left' : col === 8 ? 'right' : 'middle'} />
      ))}
      <text className="river-text" x="245" y="506">
        楚河
      </text>
      <text className="river-text" x="655" y="506">
        汉界
      </text>
    </svg>
  );
}

function Marker({ x, y, edge }: { x: number; y: number; edge: 'left' | 'middle' | 'right' }) {
  const arms = [
    edge !== 'left' ? `M ${x - 14} ${y - 5} L ${x - 5} ${y - 5} L ${x - 5} ${y - 14}` : '',
    edge !== 'left' ? `M ${x - 14} ${y + 5} L ${x - 5} ${y + 5} L ${x - 5} ${y + 14}` : '',
    edge !== 'right' ? `M ${x + 14} ${y - 5} L ${x + 5} ${y - 5} L ${x + 5} ${y - 14}` : '',
    edge !== 'right' ? `M ${x + 14} ${y + 5} L ${x + 5} ${y + 5} L ${x + 5} ${y + 14}` : ''
  ].join(' ');
  return <path className="point-marker" d={arms} />;
}

function pieceLabelView(piece: NonNullable<ReturnType<typeof useXiangqiGame>['state']['board'][number][number]>) {
  const labels = {
    red: {
      king: '帅',
      advisor: '仕',
      elephant: '相',
      horse: '傌',
      rook: '俥',
      cannon: '炮',
      pawn: '兵'
    },
    black: {
      king: '将',
      advisor: '士',
      elephant: '象',
      horse: '马',
      rook: '车',
      cannon: '砲',
      pawn: '卒'
    }
  } as const;
  return labels[piece.side][piece.type];
}

function IconButton({
  title,
  children,
  onClick,
  disabled,
  active
}: {
  title: string;
  children: React.ReactNode;
  onClick?: () => void;
  disabled?: boolean;
  active?: boolean;
}) {
  return (
    <button className={active ? 'icon-button active' : 'icon-button'} type="button" title={title} aria-label={title} onClick={onClick} disabled={disabled}>
      {children}
    </button>
  );
}
