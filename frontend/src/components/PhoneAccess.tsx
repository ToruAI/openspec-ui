import { useState } from 'react';
import { Check, Copy, Smartphone } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';

interface PhoneAccessProps {
  /** Set when the server listens on the network (`--host 0.0.0.0`) */
  lanUrl?: string | null;
  /** Address the server is bound to */
  host?: string;
  port?: number;
}

/** How to open this board on a phone: the address, or how to get one. */
export function PhoneAccess({ lanUrl, host, port }: PhoneAccessProps) {
  const listensOnNetwork = host === '0.0.0.0' || host === '::';
  const [open, setOpen] = useState(false);
  const [copied, setCopied] = useState(false);

  const copy = async () => {
    if (!lanUrl) return;
    try {
      await navigator.clipboard.writeText(lanUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // Clipboard blocked (plain http on some browsers): the address is selectable.
    }
  };

  return (
    <>
      <Button
        variant="ghost"
        size="icon"
        onClick={() => setOpen(true)}
        aria-label="Open on your phone"
        title="Open on your phone"
        className="h-9 w-9 text-muted-foreground"
      >
        <Smartphone className="h-4 w-4" />
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Open this board on your phone</DialogTitle>
            <DialogDescription>
              The board works on a phone: stages become tabs you swipe between, and it updates live.
            </DialogDescription>
          </DialogHeader>
          {lanUrl ? (
            <div className="space-y-3 text-sm">
              <p>On a phone on the same network, open:</p>
              <div className="flex items-center gap-2">
                <code className="flex-1 select-all rounded-md bg-muted px-3 py-2 font-mono text-sm break-all">{lanUrl}</code>
                <Button variant="outline" size="icon" onClick={copy} aria-label="Copy address">
                  {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                </Button>
              </div>
              <p className="text-xs text-muted-foreground">
                Anyone on this network can view the board while it runs. It stays read-only for changes and specs.
              </p>
            </div>
          ) : listensOnNetwork ? (
            <div className="space-y-3 text-sm">
              <p>
                The board listens on the network. On your phone, open this computer's address with port{' '}
                <code className="font-mono">{port}</code>.
              </p>
            </div>
          ) : (
            <div className="space-y-3 text-sm">
              <p>Right now the board only answers on this computer. Start it so your network can reach it:</p>
              <code className="block rounded-md bg-muted px-3 py-2 font-mono text-sm">openspec-ui --host 0.0.0.0</code>
              <p className="text-xs text-muted-foreground">
                The address for your phone then appears here and in the terminal. Anyone on the same network can view the
                board while it runs; changes and specs stay read-only.
              </p>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
