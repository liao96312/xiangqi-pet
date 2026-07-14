export function BoardFlash({ text, variant = 'check' }: { text: string; variant?: 'check' | 'mate' }) {
  return (
    <div className={`board-flash ${variant}`} aria-live="assertive" role="status">
      {text}
    </div>
  );
}
