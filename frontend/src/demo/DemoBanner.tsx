import { useState } from 'react';
import { X } from 'lucide-react';

const DISMISSED_KEY = 'openspec-demo-banner-dismissed';
const REPO_URL = 'https://github.com/ToruAI/openspec-ui';

function wasDismissed(): boolean {
  try {
    return sessionStorage.getItem(DISMISSED_KEY) === '1';
  } catch {
    return false;
  }
}

/** Shown only in the static live demo build; explains the sample data and how to run it for real. */
export function DemoBanner() {
  const [dismissed, setDismissed] = useState(wasDismissed);
  if (dismissed) return null;

  const dismiss = () => {
    setDismissed(true);
    try {
      sessionStorage.setItem(DISMISSED_KEY, '1');
    } catch {
      // Storage can be blocked; the banner then simply returns on reload.
    }
  };

  return (
    <div
      role="status"
      data-testid="demo-banner"
      className="flex items-center gap-3 border-b border-border/50 bg-muted/60 px-4 py-2 text-sm text-muted-foreground"
    >
      <p className="min-w-0 flex-1">
        This is a live demo with sample data. Run{' '}
        <code className="rounded bg-background/70 px-1.5 py-0.5 font-mono text-xs text-foreground">
          npx openspec-ui
        </code>{' '}
        in your own repo.{' '}
        <a
          href={REPO_URL}
          target="_blank"
          rel="noreferrer"
          className="font-medium text-foreground underline underline-offset-2 hover:text-primary"
        >
          View on GitHub
        </a>
      </p>
      <button
        type="button"
        onClick={dismiss}
        aria-label="Dismiss demo notice"
        className="shrink-0 rounded-md p-1 hover:bg-background/70 hover:text-foreground"
      >
        <X className="h-4 w-4" />
      </button>
    </div>
  );
}
