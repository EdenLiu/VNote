import { useEffect, useState } from 'react';
import { X } from 'lucide-react';
import type { WeeklyReportGroup } from '@shared/types';

/** Turn grouped report data into the copy-ready text format. */
export function formatWeeklyReport(groups: WeeklyReportGroup[]): string {
  return groups
    .map((group) => {
      const bullets = group.tasks.map(({ title, completionCount }) =>
        completionCount ? `- ${title} ×${completionCount}` : `- ${title}`,
      );
      return [`${group.listName}:`, ...bullets].join('\n');
    })
    .join('\n\n');
}

interface WeeklyReportModalProps {
  onClose: () => void;
  fetchReport: () => Promise<WeeklyReportGroup[] | undefined>;
}

export function WeeklyReportModal({ onClose, fetchReport }: WeeklyReportModalProps) {
  const [groups, setGroups] = useState<WeeklyReportGroup[] | undefined>();
  const [failed, setFailed] = useState(false);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    let cancelled = false;
    void fetchReport().then((result) => {
      if (cancelled) return;
      setGroups(result ?? []);
      setFailed(result === undefined);
    });
    return () => {
      cancelled = true;
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
      await navigator.clipboard.writeText(formatWeeklyReport(groups ?? []));
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1500);
    } catch {
      setCopied(false); // fall through: clipboard unavailable
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
          {groups === undefined ? (
            <p className="modal-message">Loading…</p>
          ) : failed ? (
            <p className="modal-message">Could not load the weekly report.</p>
          ) : groups.length === 0 ? (
            <p className="modal-message">No tasks completed this week.</p>
          ) : (
            <pre className="report-text">{formatWeeklyReport(groups)}</pre>
          )}
        </div>
        {groups && groups.length > 0 && !failed ? (
          <div className="modal-footer">
            {copied ? <span className="copy-confirmation">Copied!</span> : null}
            <button className="secondary-button modal-copy-button" onClick={handleCopy}>
              Copy to clipboard
            </button>
          </div>
        ) : null}
      </div>
    </div>
  );
}
