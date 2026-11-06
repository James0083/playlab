import type { ReactNode } from 'react';

interface GameShellProps {
  title: string;
  score?: number;
  remainingMs?: number | null;
  children: ReactNode;
}

export function GameShell({ title, score, remainingMs, children }: GameShellProps) {
  return (
    <div className="mg-shell">
      <header className="mg-header">
        <h1 className="mg-title">{title}</h1>
        <div className="mg-hud">
          {remainingMs != null && <span>{Math.ceil(remainingMs / 1000)}초</span>}
          {score != null && <strong>{score}점</strong>}
        </div>
      </header>
      <main className="mg-stage">{children}</main>
    </div>
  );
}
