import { type ReactNode, useState, useEffect, useCallback, useRef } from 'react';

interface Props {
  children: ReactNode;
}

const MIN_WIDTH = 280;
const LOCAL_STORAGE_KEY = 'vnote:sidebar-width';

export function Sidebar({ children }: Props) {
  const [width, setWidth] = useState(() => {
    const saved = localStorage.getItem(LOCAL_STORAGE_KEY);
    return saved ? Number(saved) : MIN_WIDTH;
  });
  const widthRef = useRef(width);
  widthRef.current = width;

  const dragging = useRef(false);
  const startX = useRef(0);
  const startWidth = useRef(0);

  const onMouseDown = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault();
      dragging.current = true;
      startX.current = e.clientX;
      startWidth.current = widthRef.current;
      document.body.style.cursor = 'col-resize';
      document.body.style.userSelect = 'none';
    },
    [],
  );

  useEffect(() => {
    const onMouseMove = (e: MouseEvent) => {
      if (!dragging.current) return;
      const delta = e.clientX - startX.current;
      const maxWidth = window.innerWidth * 0.4;
      const next = Math.min(maxWidth, Math.max(MIN_WIDTH, startWidth.current + delta));
      setWidth(next);
      widthRef.current = next;
    };
    const onMouseUp = () => {
      if (!dragging.current) return;
      dragging.current = false;
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
      localStorage.setItem(LOCAL_STORAGE_KEY, String(Math.round(widthRef.current)));
    };
    document.addEventListener('mousemove', onMouseMove);
    document.addEventListener('mouseup', onMouseUp);
    return () => {
      document.removeEventListener('mousemove', onMouseMove);
      document.removeEventListener('mouseup', onMouseUp);
    };
  }, []);

  return (
    <aside className="sidebar" style={{ width }}>
      <div className="sidebar-inner">{children}</div>
      <div className="sidebar-resize-handle" onMouseDown={onMouseDown} />
    </aside>
  );
}
