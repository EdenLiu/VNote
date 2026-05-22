interface Props {
  value: string;
  onChange: (value: string) => void;
  onSave: () => void;
}

/** Rich-text / plain-text notes section. */
export function NotesSection({ value, onChange, onSave }: Props) {
  return (
    <label className="detail-block">
      Notes
      <textarea
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onBlur={onSave}
        rows={5}
        placeholder="Add notes..."
      />
    </label>
  );
}
