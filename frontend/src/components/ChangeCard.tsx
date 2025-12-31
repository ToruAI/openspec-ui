import type { Change } from '../types';
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

interface ChangeCardProps {
  change: Change;
  onClick: () => void;
}

export function ChangeCard({ change, onClick }: ChangeCardProps) {
  const taskStats = change.taskStats;
  const progress = taskStats && taskStats.total > 0 ? (taskStats.done / taskStats.total) * 100 : 0;

  return (
    <Card
      className="cursor-pointer hover:bg-accent/50 transition-colors"
      onClick={onClick}
    >
      <CardContent className="p-3">
        <div className="flex items-start justify-between gap-2 mb-2">
          <h3 className="font-medium text-sm flex-1 line-clamp-2">
            {change.name}
          </h3>
          <Badge variant="secondary" className="text-xs whitespace-nowrap shrink-0">
            {change.sourceId}
          </Badge>
        </div>

        {/* Progress bar */}
        {taskStats && taskStats.total > 0 && (
          <div className="space-y-1 mb-2">
            <div className="flex justify-between text-xs text-muted-foreground">
              <span>{taskStats.done}/{taskStats.total} tasks</span>
              <span>{Math.round(progress)}%</span>
            </div>
            <div className="h-1.5 bg-muted rounded-full overflow-hidden">
              <div
                className="h-full bg-primary transition-all duration-300"
                style={{ width: `${progress}%` }}
              />
            </div>
          </div>
         )}

        <div className="flex gap-1 flex-wrap items-center">
          {change.hasProposal && (
            <Badge variant="outline" className="text-xs bg-blue-500/20 text-blue-400 border-blue-500/30">
              Proposal
            </Badge>
          )}
          {change.hasSpecs && (
            <Badge variant="outline" className="text-xs bg-green-500/20 text-green-400 border-green-500/30">
              Specs
            </Badge>
          )}
          {change.hasDesign && (
            <Badge variant="outline" className="text-xs bg-purple-500/20 text-purple-400 border-purple-500/30">
              Design
            </Badge>
          )}
        </div>
      </CardContent>
    </Card>
  );
}


