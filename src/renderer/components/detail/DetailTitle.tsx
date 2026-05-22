interface Props {
  value: string;
  onChange: (value: string) => void;
  onSave: () => void;
}

/** Editable title field at the top of the detail pane. */
export function DetailTitle({ value, onChange, onSave }: Props) {
  return (
    <input
      className="detail-title"
      value={value}
      onChange={(e) => onChange(e.target.value)}
      onBlur={onSave}
      onKeyDown={(e) => {
        if (e.key === 'Enter') onSave();
      }}
      placeholder="Task title"
    />
  );
}
