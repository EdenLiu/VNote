import type { ReactNode } from "react";

interface Props {
  icon: ReactNode;
  children: ReactNode;
}

export function EmptyState({ icon, children }: Props) {
  return (
    <div className="empty-state">
      {icon}
      <p>{children}</p>
    </div>
  );
}
