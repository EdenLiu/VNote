import type { ReactNode } from "react";

interface Props {
  children: ReactNode;
}

export function DetailPane({ children }: Props) {
  return <aside className="detail-pane">{children}</aside>;
}
