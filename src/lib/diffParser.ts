import type { DiffResult, DiffHunk, DiffLine } from './types';

/**
 * Parse a unified diff patch string from GitHub into our DiffResult format.
 */
export function parseGitHubPatch(filename: string, patch: string): DiffResult {
  const lines = patch.split('\n');
  const hunks: DiffHunk[] = [];
  let currentHunk: DiffHunk | null = null;

  for (const raw of lines) {
    const line = raw;
    if (line.startsWith('@@')) {
      // @@ -oldStart,oldLines +newStart,newLines @@ ...
      const match = line.match(/@@ -(\d+)(?:,(\d+))? \+(\d+)(?:,(\d+))? @@/);
      if (match) {
        if (currentHunk) {
          hunks.push(currentHunk);
        }
        currentHunk = {
          oldStart: parseInt(match[1]),
          oldLines: parseInt(match[2] || '1'),
          newStart: parseInt(match[3]),
          newLines: parseInt(match[4] || '1'),
          header: line,
          lines: [],
        };
      }
    } else if (currentHunk) {
      const kind: DiffLine['kind'] = line.startsWith('+')
        ? 'addition'
        : line.startsWith('-')
          ? 'deletion'
          : 'context';
      currentHunk.lines.push({ kind, content: line });
    }
  }

  if (currentHunk) {
    hunks.push(currentHunk);
  }

  return {
    filePath: filename,
    oldPath: null,
    hunks,
    isBinary: false,
    isTooLarge: false,
  };
}
