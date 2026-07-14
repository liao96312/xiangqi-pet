import { useEffect, useMemo, useState } from 'react';
import { AnalysisPanel } from './components/AnalysisPanel';
import { Board } from './components/Board';
import { BoardFlash } from './components/BoardFlash';
import { EvalBar } from './components/EvalBar';
import { GameTitlebar } from './components/GameTitlebar';
import { GameToolbar } from './components/GameToolbar';
import { MateBanner } from './components/MateBanner';
import { MoveList } from './components/MoveList';
import { PlayerStrip } from './components/PlayerStrip';
import { useBoardAnimation } from './hooks/useBoardAnimation';
import { useReview } from './hooks/useReview';
import { useWindowControls } from './hooks/useWindowControls';
import { useXiangqiGame } from './game/useXiangqiGame';
import { getCheckmateTactic, isPieceHanging, posKey } from './game/xiangqi';
import { moveNotation } from './game/notation';
import { pieceLabelView } from './components/PieceLabel';

const FLIPPED_VIEW_KEY = 'xiangqi-pet-flipped';
const DETAILS_OPEN_KEY = 'xiangqi-pet-details-open';

function readSavedFlipped() {
  try {
    return window.localStorage.getItem(FLIPPED_VIEW_KEY) === 'true';
  } catch {
    return false;
  }
}

function readSavedDetailsOpen() {
  try {
    return window.localStorage.getItem(DETAILS_OPEN_KEY) === 'true';
  } catch {
    return false;
  }
}

export default function App() {
  const game = useXiangqiGame();
  const animation = useBoardAnimation(game);
  const review = useReview(game);
  const windowControls = useWindowControls();

  const [compact, setCompact] = useState(false);
  const [flipped, setFlipped] = useState(readSavedFlipped);
  const [detailsOpen, setDetailsOpen] = useState(readSavedDetailsOpen);

  useEffect(() => {
    try {
      window.localStorage.setItem(FLIPPED_VIEW_KEY, String(flipped));
    } catch {
      // Ignore disabled storage.
    }
  }, [flipped]);

  useEffect(() => {
    try {
      window.localStorage.setItem(DETAILS_OPEN_KEY, String(detailsOpen));
    } catch {
      // Ignore disabled storage.
    }
  }, [detailsOpen]);

  const legalTargetKeys = useMemo(() => new Set(game.legalTargets.map(posKey)), [game.legalTargets]);
  const checkmateTactic = animation.checkmateTactic;
  const selectedHanging = !!game.selected && isPieceHanging(game.state.board, game.selected);

  const hintLine = useMemo(() => {
    if (game.hint) return moveNotation(game.state.board, game.hint);
    if (game.bookSuggestions.length) return `谱招：${game.bookSuggestions.slice(0, 3).map((item) => item.label).join(' / ')}`;
    if (checkmateTactic) return `${checkmateTactic.name}：${moveNotation(game.state.board, checkmateTactic.move)}`;
    if (selectedHanging) return '此子无保护，会被对面吃';
    if (game.bookPractice) return '已脱谱，请按谱招回到谱线';
    return '等你开口';
  }, [game.hint, game.bookSuggestions, checkmateTactic, game.state.board, selectedHanging, game.bookPractice]);

  const engineText = game.engineAvailable ? `Pikafish ${game.analysis?.depth ? `d${game.analysis.depth}` : '已连接'}` : '内置陪练';
  const statusText = windowControls.windowError || (game.thinking ? 'AI 正在想' : game.state.message);
  const modeText = game.autoAi ? `陪练开启 · 你执${game.playerSide === 'red' ? '红' : '黑'}` : '自由对弈';

  const lastMove = animation.lastMove;
  const captureLine = lastMove?.capture ? `吃掉${lastMove.capture.side === 'red' ? '红' : '黑'}${pieceLabelView(lastMove.capture)}` : '';
  const topSide = flipped ? 'red' : 'black';
  const bottomSide = flipped ? 'black' : 'red';

  if (compact) {
    return (
      <div className="pet-shell compact-shell">
        <GameTitlebar
          compact
          onToggleCompact={() => setCompact(false)}
          alwaysOnTop={windowControls.alwaysOnTop}
          onTogglePin={windowControls.togglePin}
          statusText={game.state.winner ? game.state.message : hintLine}
          onMinimize={() => windowControls.runWindowAction('minimize')}
          onHide={() => windowControls.runWindowAction('hide')}
          onClose={() => windowControls.runWindowAction('close')}
        />
      </div>
    );
  }

  return (
    <main className="pet-shell">
      <GameTitlebar
        compact={false}
        onToggleCompact={() => setCompact(true)}
        alwaysOnTop={windowControls.alwaysOnTop}
        onTogglePin={windowControls.togglePin}
        statusText={statusText}
        onMinimize={() => windowControls.runWindowAction('minimize')}
        onHide={() => windowControls.runWindowAction('hide')}
        onClose={() => windowControls.runWindowAction('close')}
      />

      <section className="game-layout">
        <div className="board-column">
          <PlayerStrip side={topSide} board={game.state.board} turn={game.state.turn} autoAi={game.autoAi} playerSide={game.playerSide} />

          <section className="board-stage">
            <Board
              board={game.state.board}
              selected={game.selected}
              legalTargetKeys={legalTargetKeys}
              hint={game.hint}
              checkmateMove={checkmateTactic?.move ?? null}
              lastMove={lastMove}
              moveAnimation={animation.moveAnimation}
              settleAnimation={animation.settleAnimation}
              captureBurst={animation.captureBurst}
              flipped={flipped}
              onChoose={game.choose}
            />
            {checkmateTactic ? <MateBanner key={`${checkmateTactic.name}-${posKey(checkmateTactic.move.from)}-${posKey(checkmateTactic.move.to)}`} tactic={checkmateTactic} board={game.state.board} /> : null}
            {animation.checkFlashKey ? <BoardFlash key={animation.checkFlashKey} text="将" /> : null}
            {animation.mateFlash ? <BoardFlash key={animation.mateFlash.key} text={animation.mateFlash.text} variant="mate" /> : null}
          </section>

          <PlayerStrip side={bottomSide} board={game.state.board} turn={game.state.turn} autoAi={game.autoAi} playerSide={game.playerSide} />
        </div>

        <GameToolbar
          game={game}
          flipped={flipped}
          onToggleFlip={() => setFlipped((value) => !value)}
          reviewing={review.reviewing}
          onReview={review.runReview}
          statusText={statusText}
          contextText={captureLine || hintLine}
          modeText={modeText}
          detailsOpen={detailsOpen}
          onToggleDetails={() => setDetailsOpen((value) => !value)}
        />
      </section>

      {detailsOpen ? (
        <section className="analysis-drawer" aria-label="局面详情">
          <EvalBar analysis={game.analysis} engineText={engineText} engineAvailable={game.engineAvailable} turn={game.state.turn} />
          <AnalysisPanel analysis={game.analysis} board={game.state.board} turn={game.state.turn} bookSuggestion={game.bookSuggestion} engineAvailable={game.engineAvailable} />
          {review.review ? <section className="review-panel">{review.review}</section> : null}
          <MoveList history={game.state.history} />
        </section>
      ) : null}

      {game.state.winner ? (
        <section className="result-banner" role="status" aria-live="polite">
          <strong>{game.state.winner === 'red' ? '红方胜' : '黑方胜'}</strong>
          <span>{game.state.message}</span>
          <button type="button" onClick={game.reset}>
            再来
          </button>
        </section>
      ) : null}
    </main>
  );
}
