import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { CheckCircle2, Lock, MapPin, Trophy } from "lucide-react";
import { ActivityPlayer } from "../ActivityPlayer";
import { ACTIVITY_TYPES } from "@/modules/curriculum/lib/h5p-types";
import type { GameMapContent, ActivityType, ActivityContent } from "@/modules/curriculum/lib/h5p-types";

interface Props { content: GameMapContent; }

export function GameMapPlayer({ content }: Props) {
  const [completedStages, setCompletedStages] = useState<Set<string>>(new Set());
  const [activeStageId, setActiveStageId] = useState<string | null>(null);

  const activeStage = content.stages.find(s => s.id === activeStageId);

  const isUnlocked = (idx: number) => idx === 0 || completedStages.has(content.stages[idx - 1]?.id);
  const allDone = content.stages.length > 0 && content.stages.every(s => completedStages.has(s.id));

  const handleComplete = () => {
    if (activeStageId) {
      setCompletedStages(prev => new Set([...prev, activeStageId]));
      setActiveStageId(null);
    }
  };

  // Path lines
  const lines = content.stages.slice(0, -1).map((s, i) => {
    const next = content.stages[i + 1];
    const done = completedStages.has(s.id);
    return { x1: s.x, y1: s.y, x2: next.x, y2: next.y, done, key: `${s.id}-${next.id}` };
  });

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="font-semibold text-foreground flex items-center gap-2">
          <MapPin className="h-4 w-4 text-primary" /> {content.title}
        </h3>
        {allDone && (
          <Badge className="bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400">
            <Trophy className="h-3 w-3 mr-1" /> Complete!
          </Badge>
        )}
      </div>

      {/* Map canvas */}
      <div
        className="relative rounded-2xl border-2 border-border overflow-hidden"
        style={{
          height: 380,
          background: content.backgroundImage
            ? `url(${content.backgroundImage}) center/cover no-repeat`
            : undefined,
        }}
      >
        {!content.backgroundImage && (
          <div className="absolute inset-0 bg-muted/20" />
        )}

        {/* Path lines */}
        <svg className="absolute inset-0 w-full h-full pointer-events-none" style={{ zIndex: 1 }}>
          {lines.map(l => (
            <line
              key={l.key}
              x1={`${l.x1}%`} y1={`${l.y1}%`}
              x2={`${l.x2}%`} y2={`${l.y2}%`}
              stroke={l.done ? "hsl(var(--primary))" : "hsl(var(--muted-foreground))"}
              strokeWidth={l.done ? 4 : 2}
              strokeDasharray={l.done ? "none" : "6 4"}
              strokeOpacity={l.done ? 0.8 : 0.3}
            />
          ))}
        </svg>

        {/* Stage nodes */}
        {content.stages.map((stage, idx) => {
          const unlocked = isUnlocked(idx);
          const completed = completedStages.has(stage.id);

          return (
            <button
              key={stage.id}
              disabled={!unlocked}
              onClick={() => unlocked && !completed && setActiveStageId(stage.id)}
              className="absolute flex flex-col items-center group"
              style={{
                left: `${stage.x}%`,
                top: `${stage.y}%`,
                transform: "translate(-50%, -50%)",
                zIndex: 10,
              }}
            >
              <div className={`
                w-12 h-12 rounded-full flex items-center justify-center shadow-lg transition-all duration-200
                ${completed
                  ? "bg-green-500 text-white scale-100"
                  : unlocked
                    ? "bg-primary text-primary-foreground hover:scale-110 cursor-pointer animate-pulse"
                    : "bg-muted text-muted-foreground cursor-not-allowed opacity-60"
                }
              `}>
                {completed ? <CheckCircle2 className="h-5 w-5" /> : unlocked ? <span className="text-sm font-bold">{idx + 1}</span> : <Lock className="h-4 w-4" />}
              </div>
              <span className={`
                mt-1 text-[10px] font-semibold px-2 py-0.5 rounded-md max-w-[90px] truncate
                ${completed
                  ? "bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-400"
                  : unlocked
                    ? "bg-card text-foreground border border-border"
                    : "bg-muted/80 text-muted-foreground"
                }
              `}>
                {stage.label}
              </span>
            </button>
          );
        })}
      </div>

      <p className="text-xs text-muted-foreground text-center">
        {completedStages.size}/{content.stages.length} stages completed
      </p>

      {/* Stage activity dialog */}
      <Dialog open={!!activeStageId} onOpenChange={() => setActiveStageId(null)}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Badge variant="secondary" className="text-xs">
                {ACTIVITY_TYPES.find(a => a.type === activeStage?.type)?.label}
              </Badge>
              {activeStage?.label}
            </DialogTitle>
          </DialogHeader>
          {activeStage && (
            <div className="space-y-4">
              <ActivityPlayer
                type={activeStage.type as ActivityType}
                content={activeStage.content as ActivityContent}
              />
              <div className="flex justify-end">
                <Button onClick={handleComplete}>
                  <CheckCircle2 className="h-4 w-4 mr-1.5" /> Mark Complete
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
