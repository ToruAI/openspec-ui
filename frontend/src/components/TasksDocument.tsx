import ReactMarkdown from 'react-markdown';
import { Check } from 'lucide-react';
import { cn } from '@/lib/utils';
import { parseTasks } from '@/lib/tasks';

const prose =
  'prose prose-sm dark:prose-invert max-w-none prose-headings:font-semibold prose-a:text-primary prose-code:text-sm break-words';

/**
 * A tasks file as a read-only checklist. Plain markdown would print "[x]";
 * GitHub-style task lists need a plugin this view does not otherwise use.
 */
export function TasksDocument({ content }: { content: string }) {
  const blocks = parseTasks(content);
  return (
    <div className="space-y-1">
      {blocks.map((block, i) =>
        block.kind === 'markdown' ? (
          <article key={i} className={cn(prose, 'pt-2 first:pt-0 prose-headings:mb-2 prose-headings:mt-3')}>
            <ReactMarkdown>{block.text}</ReactMarkdown>
          </article>
        ) : (
          <div
            key={i}
            className="flex items-start gap-2.5 py-0.5 text-sm"
            style={{ paddingLeft: `${block.depth * 1.25}rem` }}
          >
            <span
              className={cn(
                'mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded border',
                block.done ? 'border-emerald-600 bg-emerald-600 text-white dark:border-emerald-500 dark:bg-emerald-500' : 'border-muted-foreground/50'
              )}
              aria-hidden
            >
              {block.done && <Check className="h-3 w-3" strokeWidth={3} />}
            </span>
            <span className={cn(block.done && 'text-muted-foreground')}>
              <span className="sr-only">{block.done ? 'Done: ' : 'To do: '}</span>
              {block.text.replace(/`/g, '')}
            </span>
          </div>
        )
      )}
    </div>
  );
}
