import type { Piece } from './PieceLabel';

export function PieceSVG({ piece }: { piece: Piece }) {
  const isRed = piece.side === 'red';
  const label = isRed
    ? { king: '帅', advisor: '仕', elephant: '相', horse: '傌', rook: '俥', cannon: '炮', pawn: '兵' }[piece.type]
    : { king: '将', advisor: '士', elephant: '象', horse: '马', rook: '车', cannon: '砲', pawn: '卒' }[piece.type];

  return (
    <svg viewBox="0 0 80 80" width="100%" height="100%" style={{ overflow: 'visible' }}>
      <defs>
        <radialGradient id={`grad-${piece.side}`} cx="34%" cy="26%" r="72%">
          <stop offset="0%" stopColor="#fff1c8" />
          <stop offset="36%" stopColor="#efd194" />
          <stop offset="76%" stopColor="#c99450" />
          <stop offset="100%" stopColor="#865628" />
        </radialGradient>

        <linearGradient id={`rim-${piece.side}`} x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#fff0bd" />
          <stop offset="44%" stopColor="#be8748" />
          <stop offset="100%" stopColor="#63401f" />
        </linearGradient>

        <filter id={`shadow-${piece.side}`} x="-30%" y="-30%" width="160%" height="160%">
          <feDropShadow dx="0" dy="3" stdDeviation="2.4" floodColor="#26170b" floodOpacity="0.56" />
        </filter>

        <filter id={`engrave-${piece.side}`} x="-20%" y="-20%" width="140%" height="140%">
          <feGaussianBlur in="SourceAlpha" stdDeviation="0.8" result="blur" />
          <feOffset dx="0.8" dy="1.2" result="offsetBlur" />
          <feFlood floodColor={isRed ? '#5b120d' : '#080706'} floodOpacity="0.56" />
          <feComposite in2="offsetBlur" operator="in" result="shadow" />
          <feMerge>
            <feMergeNode in="shadow" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
      </defs>

      <circle cx="40" cy="40" r="36" fill={`url(#grad-${piece.side})`} filter={`url(#shadow-${piece.side})`} />
      <circle cx="40" cy="40" r="34" fill="none" stroke={`url(#rim-${piece.side})`} strokeWidth="2.2" />
      <circle cx="40" cy="40" r="29" fill="none" stroke={isRed ? '#a33429' : '#2e2b27'} strokeWidth="1.5" opacity="0.78" />
      <path d="M 18 29 A 27 27 0 0 1 55 16" fill="none" stroke="#fff5cf" strokeWidth="1.3" strokeLinecap="round" opacity="0.52" />
      <text
        x="40"
        y="54"
        textAnchor="middle"
        fontFamily="KaiTi, STKaiti, 'Microsoft YaHei', serif"
        fontSize="38"
        fontWeight="900"
        fill={isRed ? '#a1261f' : '#24211e'}
        filter={`url(#engrave-${piece.side})`}
      >
        {label}
      </text>
    </svg>
  );
}
