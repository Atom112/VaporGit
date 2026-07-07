import { describe, expect, it } from 'vitest';
import { parseGitHubPatch } from '../diffParser';

describe('parseGitHubPatch', () => {
  it('parses unified patch hunks and line kinds', () => {
    const result = parseGitHubPatch(
      'src/main.ts',
      '@@ -1,2 +1,3 @@\n context\n-old\n+new\n+extra',
    );

    expect(result.filePath).toBe('src/main.ts');
    expect(result.hunks).toHaveLength(1);
    expect(result.hunks[0]).toMatchObject({
      oldStart: 1,
      oldLines: 2,
      newStart: 1,
      newLines: 3,
    });
    expect(result.hunks[0].lines.map((line) => line.kind)).toEqual([
      'context',
      'deletion',
      'addition',
      'addition',
    ]);
  });
});
