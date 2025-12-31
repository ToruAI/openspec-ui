import { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Plus, Trash2, AlertCircle, FolderOpen, Loader2, Check } from 'lucide-react';
import { getConfig, updateSources, type SourceConfig } from '../hooks/useApi';
import { cn } from '@/lib/utils';

interface SettingsModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function SettingsModal({ open, onOpenChange }: SettingsModalProps) {
  const [sources, setSources] = useState<SourceConfig[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  
  // New source state
  const [newName, setNewName] = useState('');
  const [newPath, setNewPath] = useState('');

  // Load config when opened
  useEffect(() => {
    if (open) {
      loadConfig();
    }
  }, [open]);

  // Clear success message after delay
  useEffect(() => {
    if (success) {
      const timer = setTimeout(() => setSuccess(false), 2000);
      return () => clearTimeout(timer);
    }
  }, [success]);

  async function loadConfig() {
    try {
      setLoading(true);
      const config = await getConfig();
      setSources(config.sources);
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load configuration');
    } finally {
      setLoading(false);
    }
  }

  async function handleAddSource() {
    if (!newName.trim() || !newPath.trim()) return;

    const newSource: SourceConfig = {
      name: newName.trim(),
      path: newPath.trim()
    };

    // Optimistic update
    const updatedSources = [...sources, newSource];
    setSources(updatedSources);
    setNewName('');
    setNewPath('');

    try {
      setLoading(true);
      await updateSources(updatedSources);
      setError(null);
      setSuccess(true);
    } catch (e) {
      // Revert on error
      setError(e instanceof Error ? e.message : 'Failed to update configuration');
      // Reload actual state
      loadConfig();
    } finally {
      setLoading(false);
    }
  }

  async function handleRemoveSource(index: number) {
    const updatedSources = sources.filter((_, i) => i !== index);
    setSources(updatedSources);

    try {
      setLoading(true);
      await updateSources(updatedSources);
      setError(null);
      setSuccess(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to update configuration');
      loadConfig();
    } finally {
      setLoading(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[600px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FolderOpen className="h-5 w-5 text-primary" />
            Settings
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-6 py-4">
          <div className="space-y-4">
            <div>
              <h3 className="text-sm font-semibold leading-none">Sources</h3>
              <p className="text-sm text-muted-foreground mt-1.5">
                Configure OpenSpec source repositories. Changes are applied immediately.
              </p>
            </div>

            {error && (
              <div className="flex items-start gap-3 p-4 text-sm border border-destructive/50 bg-destructive/5 rounded-lg">
                <AlertCircle className="h-5 w-5 text-destructive shrink-0 mt-0.5" />
                <div>
                  <div className="font-medium text-destructive">Error</div>
                  <div className="text-muted-foreground mt-0.5">{error}</div>
                </div>
              </div>
            )}

            {success && (
              <div className="flex items-center gap-2 p-3 text-sm border border-emerald-500/50 bg-emerald-500/5 rounded-lg text-emerald-600 dark:text-emerald-400">
                <Check className="h-4 w-4" />
                <span className="font-medium">Changes saved successfully</span>
              </div>
            )}

            {/* Source list */}
            <div className="border border-border/50 rounded-xl overflow-hidden bg-card/50">
              {sources.length > 0 ? (
                <div className="divide-y divide-border/50">
                  {sources.map((source, i) => (
                    <div 
                      key={i} 
                      className="flex items-center justify-between p-4 hover:bg-muted/30 transition-colors"
                    >
                      <div className="grid gap-1 min-w-0">
                        <div className="font-medium flex items-center gap-2">
                          <span className="w-2 h-2 rounded-full bg-[var(--accent-emerald)]" />
                          {source.name}
                        </div>
                        <div className="text-xs text-muted-foreground font-mono truncate max-w-[300px] sm:max-w-[400px]">
                          {source.path}
                        </div>
                      </div>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => handleRemoveSource(i)}
                        disabled={loading}
                        className="text-destructive hover:text-destructive hover:bg-destructive/10 h-8 w-8 rounded-lg shrink-0"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="p-8 text-center">
                  <div className="w-12 h-12 rounded-xl bg-muted/50 flex items-center justify-center mx-auto mb-3">
                    <FolderOpen className="h-6 w-6 text-muted-foreground/50" />
                  </div>
                  <div className="text-sm text-muted-foreground">
                    No sources configured
                  </div>
                  <p className="text-xs text-muted-foreground/70 mt-1">
                    Add a source below to get started
                  </p>
                </div>
              )}
            </div>

            {/* Add new source form */}
            <div className="grid gap-4 p-4 border border-border/50 rounded-xl bg-muted/30">
              <div className="text-sm font-medium flex items-center gap-2">
                <Plus className="h-4 w-4 text-primary" />
                Add New Source
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="name" className="text-xs">Name</Label>
                  <Input
                    id="name"
                    placeholder="e.g. brain-gate"
                    value={newName}
                    onChange={(e) => setNewName(e.target.value)}
                    disabled={loading}
                    className="h-9 bg-background/50"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="path" className="text-xs">Path</Label>
                  <Input
                    id="path"
                    placeholder="/path/to/repo/openspec"
                    value={newPath}
                    onChange={(e) => setNewPath(e.target.value)}
                    disabled={loading}
                    className="h-9 bg-background/50 font-mono text-sm"
                  />
                </div>
              </div>
              <Button 
                onClick={handleAddSource} 
                disabled={!newName || !newPath || loading}
                className={cn(
                  "w-full sm:w-auto sm:ml-auto transition-all",
                  loading && "opacity-70"
                )}
              >
                {loading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Saving...
                  </>
                ) : (
                  <>
                    <Plus className="mr-2 h-4 w-4" />
                    Add Source
                  </>
                )}
              </Button>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
