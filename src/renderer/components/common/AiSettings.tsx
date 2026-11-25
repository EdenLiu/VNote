import { useEffect, useRef, useState, type FormEvent } from 'react';
import { Settings2, X } from 'lucide-react';
import type { AiSettings, AiSettingsPatch } from '@shared/ai';

export function AiSettingsButton({ onSaved }: { onSaved?: () => void }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button className="secondary-button" onClick={() => setOpen(true)}>
        <Settings2 size={16} /> AI settings
      </button>
      {open && <SettingsDialog onClose={() => setOpen(false)} onSaved={onSaved} />}
    </>
  );
}

function SettingsDialog({ onClose, onSaved }: { onClose: () => void; onSaved?: () => void }) {
  const dialog = useRef<HTMLDialogElement>(null);
  const [settings, setSettings] = useState<AiSettings>();
  const [changes, setChanges] = useState<AiSettingsPatch>({});
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const element = dialog.current!;
    element.showModal();
    let active = true;
    window.vnote.getAiSettings().then(
      (value) => {
        if (active) setSettings(value);
      },
      () => {
        if (active) setError('Could not load AI settings. Close and reopen to retry.');
      },
    );
    return () => {
      active = false;
      element.close();
    };
  }, []);

  const save = async (event: FormEvent) => {
    event.preventDefault();
    if (!settings || saving) return;
    setSaving(true);
    try {
      await window.vnote.saveAiSettings(changes);
      onSaved?.();
      onClose();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Could not save AI settings. Retry.');
      setSaving(false);
    }
  };

  return (
    <dialog
      ref={dialog}
      className="modal ai-settings"
      aria-label="AI settings"
      onCancel={(event) => {
        event.preventDefault();
        if (!saving) onClose();
      }}
    >
      <div className="modal-header">
        <h2 className="modal-title">AI settings</h2>
        <button
          className="icon-button-small"
          aria-label="Close"
          onClick={onClose}
          disabled={saving}
        >
          <X size={16} />
        </button>
      </div>
      {error && (
        <p role="alert" className="ai-settings-error">
          {error}
        </p>
      )}
      {settings ? (
        <form onSubmit={save}>
          <fieldset disabled={saving} className="modal-body ai-settings-fields">
            <label>
              Service URL
              <input
                type="url"
                placeholder="https://api.example.com/v1"
                value={changes.baseUrl ?? settings.baseUrl}
                onChange={(e) => setChanges({ ...changes, baseUrl: e.target.value })}
              />
            </label>
            <small>Use the base URL of a Chat Completions compatible service.</small>
            <label>
              Model
              <input
                value={changes.model ?? settings.model}
                onChange={(e) => setChanges({ ...changes, model: e.target.value })}
              />
            </label>
            <label>
              API key
              <input
                type="password"
                autoComplete="new-password"
                spellCheck={false}
                value={changes.apiKey ?? ''}
                onChange={(e) => setChanges({ ...changes, apiKey: e.target.value || undefined })}
              />
            </label>
            {settings.hasApiKey && (
              <div className="ai-key-status">
                <small>{changes.apiKey === null ? 'Key will be removed' : 'Key configured'}</small>
                <button
                  type="button"
                  className="text-button"
                  onClick={() =>
                    setChanges({ ...changes, apiKey: changes.apiKey === null ? undefined : null })
                  }
                >
                  {changes.apiKey === null ? 'Undo' : 'Remove key'}
                </button>
              </div>
            )}
            {settings.hasApiKey &&
              changes.baseUrl !== undefined &&
              changes.baseUrl !== settings.baseUrl && (
                <small>Enter a new key when switching to another service.</small>
              )}
            <fieldset className="ai-settings-lists">
              <legend>Lists available to AI</legend>
              {settings.lists.map((list) => (
                <label key={list.id}>
                  <input
                    type="checkbox"
                    checked={changes.listAccess?.[list.id] ?? list.allowAi}
                    onChange={(e) =>
                      setChanges({
                        ...changes,
                        listAccess: { ...changes.listAccess, [list.id]: e.target.checked },
                      })
                    }
                  />
                  {list.name}
                </label>
              ))}
            </fieldset>
            <label className="ai-notes">
              <input
                type="checkbox"
                checked={changes.includeNotes ?? settings.includeNotes}
                onChange={(e) => setChanges({ ...changes, includeNotes: e.target.checked })}
              />
              Include task notes
            </label>
          </fieldset>
          <div className="modal-footer">
            <button className="toolbar-report-button" disabled={saving}>
              {saving ? 'Saving…' : 'Save'}
            </button>
          </div>
        </form>
      ) : (
        !error && <p className="modal-message">Loading…</p>
      )}
    </dialog>
  );
}
