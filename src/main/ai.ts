import type { AiSettings, AiSettingsPatch } from '../shared/ai.js';
import type { VNoteDatabase } from './database.js';

export type AiTaskScope = 'report' | 'candidates' | 'my-day';

/** This is the full allowlist at the cloud boundary. Never serialize the application's Task. */
export interface AiTask {
  id: string;
  listId: string;
  listName: string;
  title: string;
  completed: boolean;
  important: boolean;
  dueDate?: string;
  completedAt?: string;
  myDayDate?: string;
  notes?: string;
}

export function readAiTasks(db: VNoteDatabase, scope: AiTaskScope, day: string): AiTask[] {
  const filters = {
    report: '',
    candidates:
      'WHERE l.include_in_suggestions = 1 AND t.completed = 0 AND (md.day IS NULL OR md.day <> ?)',
    'my-day': 'WHERE md.day = ?',
  };
  const rows = db.select(
    `
    SELECT t.id, t.list_id, l.name list_name, t.title, t.completed, t.important, t.due_date,
      t.completed_at, md.day, CASE WHEN cfg.include_notes = 1 THEN t.notes END AS notes
    FROM ai_list_access a JOIN lists l ON l.id = a.list_id JOIN tasks t ON t.list_id = l.id
    LEFT JOIN my_day md ON md.task_id = t.id LEFT JOIN ai_settings cfg ON cfg.id = 1
    ${filters[scope]} ORDER BY t.created_at, t.rowid`,
    scope === 'report' ? [] : [day],
  );
  return rows.map((r) => ({
    id: String(r.id),
    listId: String(r.list_id),
    listName: String(r.list_name),
    title: String(r.title),
    completed: Boolean(r.completed),
    important: Boolean(r.important),
    ...(r.due_date && { dueDate: String(r.due_date) }),
    ...(scope === 'report' && r.completed_at && { completedAt: String(r.completed_at) }),
    ...(scope === 'my-day' && { myDayDate: day }),
    ...(r.notes && { notes: String(r.notes) }),
  }));
}

export interface AiSecretStore {
  encryptString(value: string): Buffer;
  decryptString(ciphertext: Buffer): string;
}

function serviceUrl(value: string): URL | undefined {
  if (!value) return undefined;
  const url = URL.canParse(value) ? new URL(value) : undefined;
  const loopback = url && ['localhost', '127.0.0.1', '[::1]'].includes(url.hostname);
  if (
    !url ||
    (url.protocol !== 'https:' && !(url.protocol === 'http:' && loopback)) ||
    url.username ||
    url.password ||
    url.search ||
    url.hash
  ) {
    throw new Error(
      'Enter an HTTPS service URL without credentials, query or fragment. Localhost also supports HTTP.',
    );
  }
  return url;
}

export async function requestAiCompletion(
  db: VNoteDatabase,
  secrets: AiSecretStore | undefined,
  instructions: string,
  data: unknown,
): Promise<string> {
  const config = db.select(
    'SELECT base_url, model, encrypted_key FROM ai_settings WHERE id = 1',
  )[0];
  if (!config?.base_url || !config.model || !config.encrypted_key) {
    throw new Error('Open AI settings and configure a service URL, model and API key.');
  }
  let key: string;
  try {
    if (!secrets) throw new Error();
    key = secrets.decryptString(Buffer.from(String(config.encrypted_key), 'base64'));
  } catch {
    throw new Error('Unlock your system keyring or replace the API key in AI settings.');
  }

  const base = serviceUrl(String(config.base_url))!.href.replace(/\/+$/, '');
  const endpoint = base.endsWith('/chat/completions') ? base : base + '/chat/completions';
  let response: Response;
  try {
    response = await fetch(endpoint, {
      method: 'POST',
      redirect: 'error',
      signal: AbortSignal.timeout(45000),
      headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: config.model,
        messages: [
          { role: 'system', content: instructions },
          { role: 'user', content: JSON.stringify(data) },
        ],
      }),
    });
  } catch {
    throw new Error('Could not reach the AI service. Check the service URL and retry.');
  }
  if (!response.ok) {
    throw new Error(`AI service returned HTTP ${response.status}. Check AI settings and retry.`);
  }
  const reply = await response.json().catch(() => undefined);
  const content = reply?.choices?.[0]?.message?.content;
  if (typeof content !== 'string' || !content.trim())
    throw new Error('Empty or invalid AI reply. Retry generation.');
  return content;
}

export function readAiSettings(db: VNoteDatabase): AiSettings {
  const config = db.select(
    'SELECT base_url, model, encrypted_key IS NOT NULL AS has_key, include_notes FROM ai_settings WHERE id = 1',
  )[0];
  const lists = db.select(`SELECT l.id, l.name, a.list_id
    FROM lists l LEFT JOIN ai_list_access a ON l.id = a.list_id
    ORDER BY l.created_at, l.rowid`);
  return {
    baseUrl: String(config?.base_url ?? ''),
    model: String(config?.model ?? ''),
    hasApiKey: Boolean(config?.has_key),
    includeNotes: Boolean(config?.include_notes),
    lists: lists.map((row) => ({
      id: String(row.id),
      name: String(row.name),
      allowAi: row.list_id !== null,
    })),
  };
}

export function writeAiSettings(
  db: VNoteDatabase,
  patch: AiSettingsPatch,
  secrets?: AiSecretStore,
) {
  db.transaction(() => {
    const config = db.select('SELECT * FROM ai_settings WHERE id = 1')[0];
    const oldUrl = String(config?.base_url ?? '');
    const baseUrl = patch.baseUrl?.trim() ?? oldUrl;
    const sameService = serviceUrl(baseUrl)?.origin === serviceUrl(oldUrl)?.origin;
    let encrypted = sameService ? (config?.encrypted_key ?? null) : null;
    if (patch.apiKey !== undefined) {
      const key = patch.apiKey?.trim();
      if (key && !secrets) throw new Error('Secure key storage is unavailable.');
      encrypted = key && secrets ? secrets.encryptString(key).toString('base64') : null;
    }
    db.run(
      'INSERT OR REPLACE INTO ai_settings (id, base_url, model, encrypted_key, include_notes) VALUES (1, ?, ?, ?, ?)',
      [
        baseUrl,
        patch.model?.trim() ?? config?.model ?? '',
        encrypted,
        Number(patch.includeNotes ?? Boolean(config?.include_notes)),
      ],
    );
    for (const [id, enabled] of Object.entries(patch.listAccess ?? {})) {
      if (enabled === true) {
        db.run('INSERT OR IGNORE INTO ai_list_access (list_id) SELECT id FROM lists WHERE id = ?', [
          id,
        ]);
      } else {
        db.run('DELETE FROM ai_list_access WHERE list_id = ?', [id]);
      }
    }
  });
  return readAiSettings(db);
}
