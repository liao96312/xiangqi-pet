export function IconButton({
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
