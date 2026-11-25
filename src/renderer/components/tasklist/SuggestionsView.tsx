import { useState, type ReactNode } from 'react';
import type { MyDayRecommendation } from '@shared/ai';
import type { Task, TaskList } from '@shared/types';
import './suggestions.css';

interface Props {
  tasks: Task[];
  lists: TaskList[];
  today: string;
  onOpen: (task: Task) => void;
  onAccept: (id: string) => Promise<Task | undefined>;
  children: ReactNode;
}

export function SuggestionsView({ tasks, lists, today, onOpen, onAccept, children }: Props) {
  const [results, setResults] = useState<MyDayRecommendation[]>();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  async function recommend() {
    setBusy(true);
    setError('');
    setResults(undefined);
    try {
      setResults(await window.vnote.getAiRecommendations());
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Could not load AI recommendations.');
    } finally {
      setBusy(false);
    }
  }

  async function accept(id: string) {
    setBusy(true);
    try {
      const accepted = await onAccept(id);
      if (accepted) setResults((previous) => previous?.filter((item) => item.taskId !== id));
    } finally {
      setBusy(false);
    }
  }

  const cards = results?.flatMap(({ taskId, reason }) => {
    const task = tasks.find((item) => item.id === taskId);
    const list = lists.find((item) => item.id === task?.listId);
    if (!task || task.completed || task.myDayDate === today || !list?.includeInSuggestions)
      return [];
    return (
      <li key={task.id}>
        <div>
          <button className="suggestion-title" onClick={() => onOpen(task)}>
            {task.title}
          </button>
          <p>{reason}</p>
        </div>
        <button className="secondary-button" disabled={busy} onClick={() => void accept(task.id)}>
          Add to My Day
        </button>
      </li>
    );
  });

  return (
    <div className="suggestions-view">
      <section aria-label="AI recommendations">
        <header>
          <h2>AI recommendations</h2>
          <button
            className="toolbar-report-button"
            disabled={busy}
            onClick={() => void recommend()}
          >
            {error ? 'Retry' : 'Get AI recommendations'}
          </button>
        </header>
        {error && <p role="alert">{error}</p>}
        {busy && !results && <p role="status">Getting recommendations…</p>}
        {cards?.length === 0 && (
          <p role="status">No AI recommendations for today. Manage list access in AI settings.</p>
        )}
        {!!cards?.length && <ul>{cards}</ul>}
      </section>
      <section aria-label="Rule suggestions">
        <h2>Rule suggestions</h2>
        {children}
      </section>
    </div>
  );
}
