function Marker({ x, y, edge }: { x: number; y: number; edge: 'left' | 'middle' | 'right' }) {
  const arms = [
    edge !== 'left' ? `M ${x - 14} ${y - 5} L ${x - 5} ${y - 5} L ${x - 5} ${y - 14}` : '',
    edge !== 'left' ? `M ${x - 14} ${y + 5} L ${x - 5} ${y + 5} L ${x - 5} ${y + 14}` : '',
    edge !== 'right' ? `M ${x + 14} ${y - 5} L ${x + 5} ${y - 5} L ${x + 5} ${y - 14}` : '',
    edge !== 'right' ? `M ${x + 14} ${y + 5} L ${x + 5} ${y + 5} L ${x + 5} ${y + 14}` : ''
  ].join(' ');
  return <path className="point-marker" d={arms} />;
}

export function BoardLines({ flipped }: { flipped: boolean }) {
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
