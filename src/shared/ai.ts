export interface AiListAccess {
  id: string;
  name: string;
  allowAi: boolean;
}

export interface AiSettings {
  baseUrl: string;
  model: string;
  hasApiKey: boolean;
  includeNotes: boolean;
  lists: AiListAccess[];
}

export interface AiSettingsPatch {
  baseUrl?: string;
  model?: string;
  /** Omit to keep the current key, or pass null to remove it. */
  apiKey?: string | null;
  includeNotes?: boolean;
  listAccess?: Record<string, boolean>;
}
