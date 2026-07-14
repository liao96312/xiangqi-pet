export function CaptureBurst({ point }: { point: { left: string; top: string } }) {
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
