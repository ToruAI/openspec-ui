export type TaskBlock = { kind: 'markdown'; text: string } | { kind: 'task'; done: boolean; text: string; depth: number };

const TASK_LINE = /^(\s*)[-*+]\s+\[([ xX])\]\s+(.*)$/;

/** Split a tasks file into checkbox lines and the markdown between them. */
export function parseTasks(markdown: string): TaskBlock[] {
  const blocks: TaskBlock[] = [];
  let buffer: string[] = [];
  const flush = () => {
    const text = buffer.join('\n').trim();
    if (text) blocks.push({ kind: 'markdown', text });
    buffer = [];
  };
  for (const line of markdown.split('\n')) {
    const match = TASK_LINE.exec(line);
    if (match) {
      flush();
      blocks.push({
        kind: 'task',
        done: match[2] !== ' ',
        text: match[3],
        depth: Math.floor(match[1].replace(/\t/g, '  ').length / 2),
      });
    } else {
      buffer.push(line);
    }
  }
  flush();
  return blocks;
}
