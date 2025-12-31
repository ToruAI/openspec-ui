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
import { Plus, Trash2, AlertCircle } from 'lucide-react';
import { getConfig, updateSources, type SourceConfig } from '../hooks/useApi';

interface SettingsModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function SettingsModal({ open, onOpenChange }: SettingsModalProps) {
  const [sources, setSources] = useState<SourceConfig[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  // New source state
  const [newName, setNewName] = useState('');
  const [newPath, setNewPath] = useState('');

  // Load config when opened
  useEffect(() => {
    if (open) {
      loadConfig();
    }
  }, [open]);

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
          <DialogTitle>Settings</DialogTitle>
        </DialogHeader>

        <div className="space-y-6 py-4">
          <div className="space-y-4">
            <h3 className="text-sm font-medium leading-none">Sources</h3>
            <p className="text-sm text-muted-foreground">
              Configure OpenSpec source repositories. Changes are applied immediately.
            </p>

            {error && (
              <div className="flex items-center gap-2 p-3 text-sm text-destructive border border-destructive/50 bg-destructive/10 rounded-md">
                <AlertCircle className="h-4 w-4" />
                <div className="font-medium">Error: {error}</div>
              </div>
            )}

            <div className="border rounded-md divide-y">
              {sources.map((source, i) => (
                <div key={i} className="flex items-center justify-between p-3">
                  <div className="grid gap-1">
                    <div className="font-medium">{source.name}</div>
                    <div className="text-xs text-muted-foreground font-mono truncate max-w-[300px] sm:max-w-[400px]">
                      {source.path}
                    </div>
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => handleRemoveSource(i)}
                    disabled={loading}
                    className="text-destructive hover:text-destructive"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              ))}
              {sources.length === 0 && (
                <div className="p-4 text-center text-sm text-muted-foreground">
                  No sources configured.
                </div>
              )}
            </div>

            <div className="grid gap-4 p-4 border rounded-md bg-muted/50">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="name">Name</Label>
                  <Input
                    id="name"
                    placeholder="e.g. brain-gate"
                    value={newName}
                    onChange={(e) => setNewName(e.target.value)}
                    disabled={loading}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="path">Path</Label>
                  <Input
                    id="path"
                    placeholder="/path/to/repo/openspec"
                    value={newPath}
                    onChange={(e) => setNewPath(e.target.value)}
                    disabled={loading}
                  />
                </div>
              </div>
              <Button 
                onClick={handleAddSource} 
                disabled={!newName || !newPath || loading}
                className="w-full sm:w-auto ml-auto"
              >
                <Plus className="mr-2 h-4 w-4" /> Add Source
              </Button>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

