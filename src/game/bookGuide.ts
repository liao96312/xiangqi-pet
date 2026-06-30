import { boardToFen, uciToMove } from './fen';
import { moveNotation } from './notation';
import { applyMove, createInitialBoard, type Board, type GameState, type Move } from './xiangqi';

export interface BookSuggestion {
  book: string;
  line: string;
  source: string;
  move: Move;
  label: string;
  comment?: string;
}

interface BookLine {
  book: string;
  line: string;
  source: string;
  moves: Array<{
    uci: string;
    comment?: string;
  }>;
}

const bookLines: BookLine[] = [
  {
    book: '橘中秘',
    line: '顺炮横车破直车弃马',
    source: '橘中秘 卷上 第一编 全局着法（得先）第一局',
    moves: [
      { uci: 'h2e2', comment: '（一本）' },
      { uci: 'h7e7' },
      { uci: 'h0g2' },
      { uci: 'h9g7' },
      { uci: 'i0i1' },
      { uci: 'i9h9' },
      { uci: 'i1d1', comment: '策划由中路攻势扩展到侧翼。' },
      {
        uci: 'h9h3',
        comment: '此乃本谱主要着法。现代改进后主要有士6进5、马2进1、马2进3和车8进4等。'
      },
      { uci: 'd1d8', comment: '卡肋，是横车的主要急攻着法。' },
      { uci: 'b9a7' },
      { uci: 'a0a1', comment: '妙着，弃马。' },
      { uci: 'b7b0', comment: '古谱认为此着劣，应改走士6进5静观其变。' },
      { uci: 'b2b7', comment: '下着有多种变化。' },
      { uci: 'g7h9', comment: '马7退8是结果较差的一变。' },
      { uci: 'e2e6', comment: '去卒。' },
      { uci: 'f9e8' },
      { uci: 'a1d1' },
      { uci: 'e9f9' },
      { uci: 'd8d9', comment: '去士。' },
      { uci: 'e8d9', comment: '去车。' },
      { uci: 'd1f1' },
      { uci: 'e7f7' },
      { uci: 'f1f7', comment: '去炮。' },
      { uci: 'f9e9' },
      { uci: 'b7e7' }
    ]
  },
  {
    book: '现代开局',
    line: '中炮屏风马',
    source: '常见中炮对屏风马开局',
    moves: [
      { uci: 'h2e2', comment: '中炮起手，争中路。' },
      { uci: 'h9g7' },
      { uci: 'h0g2' },
      { uci: 'b9c7' },
      { uci: 'i0h0' },
      { uci: 'i9h9' }
    ]
  },
  {
    book: '现代开局',
    line: '中炮过河车',
    source: '常见中炮过河车开局',
    moves: [
      { uci: 'h2e2', comment: '中炮。' },
      { uci: 'b9c7' },
      { uci: 'h0g2' },
      { uci: 'h9g7' },
      { uci: 'i0h0' },
      { uci: 'i9h9' },
      { uci: 'h0h6', comment: '过河车压迫黑方。' }
    ]
  },
  {
    book: '现代开局',
    line: '仙人指路',
    source: '常见兵七进一体系',
    moves: [
      { uci: 'c3c4', comment: '仙人指路，先试探对方阵型。' },
      { uci: 'c6c5' },
      { uci: 'h0g2' },
      { uci: 'h9g7' },
      { uci: 'b0c2' },
      { uci: 'b9c7' }
    ]
  },
  {
    book: '现代开局',
    line: '飞相局',
    source: '常见飞相局布阵',
    moves: [
      { uci: 'c0e2', comment: '飞相稳健布阵。' },
      { uci: 'h9g7' },
      { uci: 'h0g2' },
      { uci: 'b9c7' },
      { uci: 'i0h0' },
      { uci: 'i9h9' }
    ]
  }
];

let cachedBook: Map<string, BookSuggestion[]> | null = null;

export function getBookSuggestion(state: GameState): BookSuggestion | null {
  return getBookSuggestions(state)[0] ?? null;
}

export function getBookSuggestions(state: GameState): BookSuggestion[] {
  return getBookMap().get(positionKey(state.board, state.turn)) ?? [];
}

function getBookMap() {
  if (cachedBook) return cachedBook;
  cachedBook = new Map<string, BookSuggestion[]>();
  for (const line of bookLines) {
    addBookLine(cachedBook, line);
  }
  return cachedBook;
}

function addBookLine(bookMap: Map<string, BookSuggestion[]>, line: BookLine) {
  let board = createInitialBoard();
  let turn: GameState['turn'] = 'red';
  for (const item of line.moves) {
    const move = uciToMove(item.uci, board);
    if (!move) break;
    const key = positionKey(board, turn);
    const suggestion = {
        book: line.book,
        line: line.line,
        source: line.source,
        move,
        label: moveNotation(board, move),
        comment: item.comment
      };
    const existing = bookMap.get(key) ?? [];
    if (!existing.some((item) => sameMove(item.move, move))) bookMap.set(key, [...existing, suggestion]);
    board = applyMove(board, move);
    turn = turn === 'red' ? 'black' : 'red';
  }
}

function sameMove(a: Move, b: Move) {
  return a.from.row === b.from.row && a.from.col === b.from.col && a.to.row === b.to.row && a.to.col === b.to.col;
}

function positionKey(board: Board, turn: GameState['turn']) {
  return boardToFen(board, turn).split(' ').slice(0, 2).join(' ');
}
