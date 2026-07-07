import { beforeEach, describe, expect, it, vi } from 'vitest';

const invokeMock = vi.fn();

vi.mock('@tauri-apps/api/core', () => ({
  invoke: invokeMock,
}));

describe('tauriCommands', () => {
  beforeEach(() => {
    invokeMock.mockReset();
  });

  it('passes stage file entries through to the Tauri command', async () => {
    invokeMock.mockResolvedValueOnce([]);
    const { stageFiles } = await import('../tauriCommands');

    await stageFiles('C:/repo', [{ path: 'a.txt' }]);

    expect(invokeMock).toHaveBeenCalledWith('stage_files', {
      path: 'C:/repo',
      files: [{ path: 'a.txt' }],
    });
  });
});
