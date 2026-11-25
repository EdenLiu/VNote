import { useEffect, useRef, useState } from 'react';
import { X } from 'lucide-react';
import type { WeeklyReportGroup } from '@shared/types';
import { formatWeeklyReport, reportSections } from './weeklyReportFormat';

interface WeeklyReportModalProps {
  open?: boolean;
  onClose: () => void;
  onOpenTask: (taskId: string) => void;
  fetchReport: () => Promise<WeeklyReportGroup[] | undefined>;
}

interface Draft {
  source: 'AI draft' | 'Manual draft';
  groups: WeeklyReportGroup[];
  text: string;
  edited?: boolean;
}

export function WeeklyReportModal({ open = true, ...props }: WeeklyReportModalProps) {
  const [draft, setDraft] = useState<Draft>();
  return open ? <ReportDialog {...props} draft={draft} setDraft={setDraft} /> : null;
}

function ReportDialog({
  onClose,
  onOpenTask,
  fetchReport,
  draft,
  setDraft,
}: WeeklyReportModalProps & {
  draft?: Draft;
  setDraft: (draft: Draft) => void;
}) {
  const [groups, setGroups] = useState<WeeklyReportGroup[] | undefined>();
  const [failed, setFailed] = useState(false);
  const [copied, setCopied] = useState(false);
  const [showDraft, setShowDraft] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState('');
  const [replacement, setReplacement] = useState<Draft>();
  const protectEdits = useRef(false);
  const active = useRef(true);
  const visibleGroups = showDraft ? draft?.groups : groups;

  useEffect(() => {
    let cancelled = false;
    active.current = true;
    void fetchReport().then((result) => {
      if (cancelled) return;
      setGroups(result ?? []);
      setFailed(result === undefined);
    });
    return () => {
      cancelled = true;
      active.current = false;
    };
  }, [fetchReport]);

  // Close on Escape
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(
        showDraft && draft ? draft.text : formatWeeklyReport(groups ?? []),
      );
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1500);
    } catch {
      setCopied(false); // fall through: clipboard unavailable
    }
  };

  const generate = async () => {
    setGenerating(true);
    setError('');
    setReplacement(undefined);
    protectEdits.current = Boolean(draft?.edited);
    try {
      const result = await window.vnote.generateWeeklyReportDraft();
      if (!active.current) return;
      const next: Draft = { source: 'AI draft', groups: result, text: formatWeeklyReport(result) };
      if (protectEdits.current) setReplacement(next);
      else setDraft(next);
      setShowDraft(true);
    } catch (cause) {
      if (active.current)
        setError(
          cause instanceof Error
            ? cause.message
            : 'Could not generate the draft. Retry generation.',
        );
    } finally {
      if (active.current) setGenerating(false);
    }
  };

  return (
    <div
      className="modal-overlay"
      role="dialog"
      aria-modal="true"
      aria-label="Weekly report"
      onClick={onClose}
    >
      <div className="modal" onClick={(event) => event.stopPropagation()}>
        <div className="modal-header">
          <h2 className="modal-title">Weekly Report</h2>
          <button className="icon-button-small" onClick={onClose} aria-label="Close">
            <X size={14} />
          </button>
        </div>
        <div className="modal-body">
          <div className="report-mode">
            <h3>{showDraft ? draft?.source : 'Local report'}</h3>
            {draft && (
              <button className="text-button" onClick={() => setShowDraft(!showDraft)}>
                {showDraft ? 'View local report' : 'View draft'}
              </button>
            )}
          </div>
          {error && (
            <p role="alert" className="ai-settings-error">
              {error}
              {!draft && (
                <button
                  className="text-button"
                  onClick={() => {
                    setDraft({ source: 'Manual draft', groups: [], text: '' });
                    setShowDraft(true);
                  }}
                >
                  Write draft
                </button>
              )}
            </p>
          )}
          {showDraft && draft && (
            <>
              {replacement && (
                <div className="report-replacement">
                  <span role="status">A new draft is ready.</span>
                  <button
                    className="text-button"
                    onClick={() => {
                      setDraft(replacement);
                      setReplacement(undefined);
                    }}
                  >
                    Use new draft
                  </button>
                  <button className="text-button" onClick={() => setReplacement(undefined)}>
                    Keep edits
                  </button>
                </div>
              )}
              <textarea
                aria-label={draft.source}
                className="report-editor"
                rows={9}
                value={draft.text}
                onChange={(event) => {
                  protectEdits.current = true;
                  setDraft({ ...draft, text: event.target.value, edited: true });
                }}
              />
              {draft.groups.length > 0 && <h3>Source tasks</h3>}
            </>
          )}
          {visibleGroups === undefined ? (
            <p className="modal-message">Loading…</p>
          ) : !showDraft && failed ? (
            <p className="modal-message">Could not load the weekly report.</p>
          ) : visibleGroups.length === 0 ? (
            !showDraft && <p className="modal-message">No tasks to report this week.</p>
          ) : (
            visibleGroups.map((group) => (
              <section key={group.listId} className="report-project" aria-label={group.listName}>
                <h3>{group.listName}</h3>
                {reportSections(group).map(({ heading, entries }) => (
                  <div key={heading}>
                    <h4>{heading}</h4>
                    <ul>
                      {entries.map(({ taskId, label }) => (
                        <li key={taskId}>
                          <button className="report-source" onClick={() => onOpenTask(taskId)}>
                            {label}
                          </button>
                        </li>
                      ))}
                    </ul>
                  </div>
                ))}
              </section>
            ))
          )}
        </div>
        <div className="modal-footer">
          {copied ? <span className="copy-confirmation">Copied!</span> : null}
          {(showDraft || (groups && groups.length > 0 && !failed)) && (
            <button className="secondary-button modal-copy-button" onClick={handleCopy}>
              {showDraft ? 'Copy draft' : 'Copy to clipboard'}
            </button>
          )}
          <button className="toolbar-report-button" disabled={generating} onClick={generate}>
            {generating ? 'Generating…' : error ? 'Retry' : 'Generate draft'}
          </button>
        </div>
      </div>
    </div>
  );
}
