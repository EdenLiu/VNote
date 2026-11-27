import { useRef, useState, type CSSProperties, type PointerEvent } from 'react';

interface Props {
  label: string;
  style: CSSProperties;
  chartDays: number;
  onMove: (days: number) => void;
  onOpen: () => void;
}

export function GanttPlanBar({ label, style, chartDays, onMove, onOpen }: Props) {
  const drag = useRef<{
    pointerId: number;
    track: HTMLElement;
    originX: number;
    originY: number;
    pixelsPerDay: number;
  } | null>(null);
  const suppressClick = useRef(false);
  const [offset, setOffset] = useState(0);

  const cancel = (pointerId: number | undefined) => {
    if (!drag.current || drag.current.pointerId !== pointerId) return;
    drag.current = null;
    suppressClick.current = true;
    setOffset(0);
  };

  const measure = (event: PointerEvent<HTMLButtonElement>) => {
    const active = drag.current;
    if (!active || active.pointerId !== event.pointerId) return;
    const dx = event.clientX - active.track.getBoundingClientRect().left - active.originX;
    if (Math.abs(dx) >= 4 || Math.abs(event.clientY - active.originY) >= 4) {
      suppressClick.current = true;
    }
    return suppressClick.current
      ? Math.sign(dx) * Math.round(Math.abs(dx) / active.pixelsPerDay)
      : 0;
  };

  return (
    <button
      className="gantt-bar"
      aria-label={label}
      title={label}
      style={{ ...style, transform: offset ? `translateX(${offset}px)` : undefined }}
      onPointerDown={(event) => {
        if (!event.isPrimary || event.button !== 0 || drag.current) return;
        suppressClick.current = false;
        const track = event.currentTarget.parentElement!;
        const bounds = track.getBoundingClientRect();
        if (!bounds.width) return;
        drag.current = {
          pointerId: event.pointerId,
          track,
          originX: event.clientX - bounds.left,
          originY: event.clientY,
          pixelsPerDay: bounds.width / chartDays,
        };
        event.currentTarget.setPointerCapture?.(event.pointerId);
      }}
      onPointerMove={(event) => {
        const days = measure(event);
        if (days !== undefined && drag.current) setOffset(days * drag.current.pixelsPerDay);
      }}
      onPointerUp={(event) => {
        const days = measure(event);
        if (days === undefined) return;
        drag.current = null;
        setOffset(0);
        if (days) onMove(days);
      }}
      onPointerCancel={(event) => cancel(event.pointerId)}
      onLostPointerCapture={(event) => cancel(event.pointerId)}
      onKeyDown={(event) => {
        if (event.key === 'Escape') cancel(drag.current?.pointerId);
      }}
      onClick={(event) => {
        if (!suppressClick.current || event.detail === 0) onOpen();
      }}
    />
  );
}
