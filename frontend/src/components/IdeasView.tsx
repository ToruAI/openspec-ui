import { useState } from 'react';
import { Trash2, Lightbulb, Clock } from 'lucide-react';
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useIdeas, deleteIdea } from '../hooks/useApi';
import type { Idea } from '../types';
import { formatRelativeTime } from '../lib/utils';

interface IdeasViewProps {
  selectedSourceId: string | null;
}

export function IdeasView({ selectedSourceId }: IdeasViewProps) {
  const { ideas, loading, error, refetch } = useIdeas();
  const [deleteTarget, setDeleteTarget] = useState<Idea | null>(null);
  const [deleting, setDeleting] = useState(false);

  const filteredIdeas = selectedSourceId
    ? ideas.filter(idea => idea.sourceId === selectedSourceId)
    : ideas;

  const handleDelete = async () => {
    if (!deleteTarget) return;

    setDeleting(true);
    try {
      await deleteIdea(deleteTarget.id);
      setDeleteTarget(null);
      refetch();
    } catch (error) {
      console.error('Failed to delete idea:', error);
      alert('Failed to delete idea. Please try again.');
    } finally {
      setDeleting(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="text-sm text-muted-foreground">Loading ideas...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="text-sm text-red-500">Error loading ideas: {error.message}</div>
      </div>
    );
  }

  if (filteredIdeas.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-center">
        <Lightbulb className="h-12 w-12 text-muted-foreground/50 mb-4" />
        <h3 className="text-lg font-medium mb-2">No ideas yet</h3>
        <p className="text-sm text-muted-foreground max-w-md">
          Capture your quick thoughts and ideas here. AI agents can help you expand them into full proposals later.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {filteredIdeas.map((idea) => (
          <div
            key={idea.id}
            className="border border-border/50 rounded-lg p-5 hover:border-border/80 transition-colors bg-card group"
          >
            <div className="flex items-start justify-between gap-3 mb-3">
              <h3 className="font-semibold text-base line-clamp-2 flex-1">
                {idea.title}
              </h3>
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity"
                onClick={() => setDeleteTarget(idea)}
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
            <p className="text-sm text-muted-foreground line-clamp-3 mb-4 min-h-[4.5rem]">
              {idea.description || <em className="opacity-50">No description</em>}
            </p>
            <div className="flex items-center text-xs text-muted-foreground">
              <Clock className="h-3.5 w-3.5 mr-1.5" />
              {formatRelativeTime(idea.createdAt)}
            </div>
          </div>
        ))}
      </div>
      <Dialog open={!!deleteTarget} onOpenChange={(open: boolean) => !open && setDeleteTarget(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Idea</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete &quot;{deleteTarget?.title}&quot;? This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setDeleteTarget(null)}
            >
              Cancel
            </Button>
            <Button type="button" variant="destructive" onClick={handleDelete} disabled={deleting}>
              {deleting ? 'Deleting...' : 'Delete'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
