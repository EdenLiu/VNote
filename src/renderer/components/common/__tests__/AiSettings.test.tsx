import { expect, it, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { App } from '../../../App';
import type { AiSettings, AiSettingsPatch } from '@shared/ai';

it('saves and reopens the shared service and list permissions without requesting a model', async () => {
  // jsdom does not implement the native dialog methods used by Chromium.
  HTMLDialogElement.prototype.showModal = function () {
    this.open = true;
  };
  HTMLDialogElement.prototype.close = function () {
    this.open = false;
  };
  const user = userEvent.setup();
  let saved: AiSettings = {
    baseUrl: '',
    model: '',
    hasApiKey: false,
    includeNotes: false,
    lists: [{ id: 'work', name: 'Work', allowAi: false }],
  };
  const fetch = vi.fn();
  vi.stubGlobal('fetch', fetch);
  const saveAiSettings = vi.fn(async (patch: AiSettingsPatch) => {
    saved = {
      baseUrl: patch.baseUrl ?? saved.baseUrl,
      model: patch.model ?? saved.model,
      hasApiKey: patch.apiKey === undefined ? saved.hasApiKey : Boolean(patch.apiKey),
      includeNotes: patch.includeNotes ?? saved.includeNotes,
      lists: saved.lists.map((list) => ({
        ...list,
        allowAi: patch.listAccess?.[list.id] ?? list.allowAi,
      })),
    };
    return saved;
  });
  const unexpectedCalls: string[] = [];
  window.vnote = new Proxy(
    {
      ...window.vnote,
      getState: vi
        .fn()
        .mockResolvedValue({ lists: [], tasks: [], categories: [], activeView: 'my-day' }),
      refreshSuggestions: vi.fn().mockResolvedValue([]),
      getAiSettings: vi.fn(async () => saved),
      saveAiSettings,
    },
    {
      get(target, key) {
        return key in target
          ? Reflect.get(target, key)
          : () => {
              unexpectedCalls.push(String(key));
            };
      },
    },
  );
  render(<App />);
  await user.click(screen.getByRole('button', { name: 'AI settings' }));
  await user.type(await screen.findByLabelText('Service URL'), 'https://model.example/v1');
  await user.type(screen.getByLabelText('Model'), 'summarizer');
  await user.type(screen.getByLabelText('API key'), 'secret');
  await user.click(screen.getByLabelText('Include task notes'));
  await user.click(screen.getByLabelText('Work'));
  await user.click(screen.getByRole('button', { name: 'Save' }));
  await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
  expect(saveAiSettings).toHaveBeenCalledWith({
    baseUrl: 'https://model.example/v1',
    model: 'summarizer',
    apiKey: 'secret',
    includeNotes: true,
    listAccess: { work: true },
  });
  await user.click(screen.getByRole('button', { name: 'AI settings' }));
  expect(await screen.findByLabelText('Service URL')).toHaveValue('https://model.example/v1');
  expect(screen.getByLabelText('Model')).toHaveValue('summarizer');
  expect(screen.getByLabelText('API key')).toHaveValue('');
  expect(screen.getByText('Key configured')).toBeVisible();
  expect(screen.getByLabelText('Include task notes')).toBeChecked();
  expect(screen.getByLabelText('Work')).toBeChecked();
  expect(unexpectedCalls).toEqual([]);
  expect(fetch).not.toHaveBeenCalled();
  vi.unstubAllGlobals();
});
