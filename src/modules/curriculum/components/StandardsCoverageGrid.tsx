import React from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { ALL_SUBSTANDARDS } from "@/modules/curriculum/lib/ngss-data";
import { ALL_IDAHO_STANDARDS, type IdahoGradeStandards } from "@/modules/curriculum/lib/idaho-standards-data";
import { AlertTriangle, CheckCircle2, Sparkles } from "lucide-react";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

export interface GapClickTarget {
  code: string;
  description: string;
  framework: "NGSS" | "Idaho";
  subject: string;
}

interface StandardsCoverageGridProps {
  questions: { id: string; standards: { ngss_code: string }[]; dok_level?: number | null }[];
  onGapClick?: (target: GapClickTarget) => void;
  showNGSS?: boolean;
  activeIdahoSubjects?: string[];
}

/** Color tone for a standard based on how many DoK 3+ questions cover it. */
export function rigorTone(highDokCount: number): "red" | "yellow" | "green" {
  if (highDokCount >= 10) return "green";
  if (highDokCount >= 4) return "yellow";
  return "red";
}

const DISCIPLINES: { key: string; label: string; coreIdeas: string[] }[] = [
  { key: "LS", label: "Life Science", coreIdeas: ["MS-LS1", "MS-LS2", "MS-LS3", "MS-LS4"] },
  { key: "ESS", label: "Earth & Space Science", coreIdeas: ["MS-ESS1", "MS-ESS2", "MS-ESS3"] },
  { key: "PS", label: "Physical Science", coreIdeas: ["MS-PS1", "MS-PS2", "MS-PS3", "MS-PS4"] },
];

function StandardChip({
  code,
  displayCode,
  description,
  count,
  highDokCount,
  onGapClick,
}: {
  code: string;
  displayCode: string;
  description: string;
  count: number;
  highDokCount: number;
  onGapClick?: () => void;
}) {
  const tone = rigorTone(highDokCount);
  const toneClass =
    tone === "green"
      ? "bg-success/15 text-success border border-success/30 hover:bg-success/25 hover:border-success/50"
      : tone === "yellow"
        ? "bg-warning/15 text-warning border border-warning/30 hover:bg-warning/25 hover:border-warning/50"
        : "bg-destructive/10 text-destructive border border-destructive/30 ring-1 ring-destructive/20 hover:bg-destructive/20 hover:ring-destructive/40";

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <button
          type="button"
          onClick={onGapClick ? onGapClick : undefined}
          className={`px-1.5 py-0.5 rounded text-[10px] font-mono leading-tight transition-colors cursor-pointer ${toneClass}`}
        >
          {displayCode}
          {count > 0 && <span className="ml-0.5 font-semibold">({highDokCount}/{count})</span>}
        </button>
      </TooltipTrigger>
      <TooltipContent side="top" className="max-w-xs">
        <p className="font-semibold text-xs">{code}</p>
        <p className="text-xs text-muted-foreground">{description}</p>
        <p className="text-xs font-medium mt-1">
          {highDokCount} question{highDokCount !== 1 ? "s" : ""} at DoK 3+ of {count} total
        </p>
        <p className="text-[10px] text-muted-foreground">
          Goal: ≥10 DoK 3+ for green, 4–9 for yellow, ≤3 for red.
        </p>
        <p className="text-xs font-medium mt-1 text-primary flex items-center gap-1">
          <Sparkles className="h-3 w-3" /> Click to generate questions
        </p>
      </TooltipContent>
    </Tooltip>
  );
}

function CoverageHeader({
  title,
  coveredCount,
  totalStandards,
  coveragePct,
  gapCount,
}: {
  title: string;
  coveredCount: number;
  totalStandards: number;
  coveragePct: number;
  gapCount: number;
}) {
  return (
    <>
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-sm font-semibold text-foreground">{title}</h3>
          <p className="text-xs text-muted-foreground mt-0.5">
            {coveredCount}/{totalStandards} standards assessed ({coveragePct}%)
            {gapCount > 0 && (
              <span className="text-destructive font-medium"> · {gapCount} gap{gapCount !== 1 ? "s" : ""}</span>
            )}
          </p>
        </div>
        {gapCount === 0 ? (
          <div className="flex items-center gap-1.5 text-xs text-success font-medium">
            <CheckCircle2 className="h-4 w-4" /> Full Coverage
          </div>
        ) : (
          <div className="flex items-center gap-1.5 text-xs text-destructive font-medium">
            <AlertTriangle className="h-4 w-4" /> Gaps Found
          </div>
        )}
      </div>
      <Progress value={coveragePct} className="h-2" />
    </>
  );
}

function NGSSCoverageSection({
  countMap,
  highDokMap,
  onGapClick,
}: {
  countMap: Map<string, number>;
  highDokMap: Map<string, number>;
  onGapClick?: (target: GapClickTarget) => void;
}) {
  const allStandards = Object.values(ALL_SUBSTANDARDS).flat();
  const totalStandards = allStandards.length;
  const coveredCount = allStandards.filter(s => (countMap.get(s.code) || 0) > 0).length;
  const gapCount = totalStandards - coveredCount;
  const coveragePct = totalStandards > 0 ? Math.round((coveredCount / totalStandards) * 100) : 0;

  return (
    <Card>
      <CardContent className="p-4 space-y-4">
        <CoverageHeader
          title="NGSS Science Coverage"
          coveredCount={coveredCount}
          totalStandards={totalStandards}
          coveragePct={coveragePct}
          gapCount={gapCount}
        />
        <TooltipProvider delayDuration={200}>
          <div className="space-y-3">
            {DISCIPLINES.map(disc => {
              const discStandards = disc.coreIdeas.flatMap(ci => ALL_SUBSTANDARDS[ci] || []);
              const discCovered = discStandards.filter(s => (countMap.get(s.code) || 0) > 0).length;
              const discTotal = discStandards.length;

              return (
                <div key={disc.key}>
                  <p className="text-xs font-medium text-muted-foreground mb-1.5">
                    {disc.label}
                    <span className="ml-1.5 text-[10px] font-normal">({discCovered}/{discTotal})</span>
                  </p>
                  <div className="flex flex-wrap gap-1">
                    {disc.coreIdeas.flatMap(ci =>
                      (ALL_SUBSTANDARDS[ci] || []).map(sub => (
                        <StandardChip
                          key={sub.code}
                          code={sub.code}
                          displayCode={sub.code.replace("MS-", "")}
                          description={sub.description}
                          count={countMap.get(sub.code) || 0}
                          highDokCount={highDokMap.get(sub.code) || 0}
                          onGapClick={onGapClick ? () => onGapClick({ code: sub.code, description: sub.description, framework: "NGSS", subject: "Science" }) : undefined}
                        />
                      ))
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </TooltipProvider>
      </CardContent>
    </Card>
  );
}

function IdahoCoverageSection({
  subject,
  gradeStandards,
  countMap,
  highDokMap,
  onGapClick,
}: {
  subject: string;
  gradeStandards: IdahoGradeStandards[];
  countMap: Map<string, number>;
  highDokMap: Map<string, number>;
  onGapClick?: (target: GapClickTarget) => void;
}) {
  const allStandards = gradeStandards.flatMap(gs => gs.standards);
  const totalStandards = allStandards.length;
  const coveredCount = allStandards.filter(s => (countMap.get(s.code) || 0) > 0).length;
  const gapCount = totalStandards - coveredCount;
  const coveragePct = totalStandards > 0 ? Math.round((coveredCount / totalStandards) * 100) : 0;

  const subjectLabel = subject === "ELA" ? "ELA" : subject === "Math" ? "Mathematics" : "Social Studies";

  return (
    <Card>
      <CardContent className="p-4 space-y-4">
        <CoverageHeader
          title={`Idaho ${subjectLabel} Coverage`}
          coveredCount={coveredCount}
          totalStandards={totalStandards}
          coveragePct={coveragePct}
          gapCount={gapCount}
        />
        <TooltipProvider delayDuration={200}>
          <div className="space-y-3">
            {gradeStandards.map(gs => {
              const gsCovered = gs.standards.filter(s => (countMap.get(s.code) || 0) > 0).length;
              const gsTotal = gs.standards.length;

              return (
                <div key={gs.label}>
                  <p className="text-xs font-medium text-muted-foreground mb-1.5">
                    {gs.label}
                    <span className="ml-1.5 text-[10px] font-normal">({gsCovered}/{gsTotal})</span>
                  </p>
                  <div className="flex flex-wrap gap-1">
                    {gs.standards.map(std => (
                      <StandardChip
                        key={std.code}
                        code={std.code}
                        displayCode={std.code}
                        description={std.description}
                        count={countMap.get(std.code) || 0}
                        highDokCount={highDokMap.get(std.code) || 0}
                        onGapClick={onGapClick ? () => onGapClick({ code: std.code, description: std.description, framework: "Idaho", subject }) : undefined}
                      />
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        </TooltipProvider>
      </CardContent>
    </Card>
  );
}

export function StandardsCoverageGrid({ questions, onGapClick, showNGSS = true, activeIdahoSubjects = [] }: StandardsCoverageGridProps) {
  // Build question count maps across all standards: total + DoK 3+ only
  const countMap = new Map<string, number>();
  const highDokMap = new Map<string, number>();
  for (const q of questions) {
    const isHighDok = (q.dok_level ?? 0) >= 3;
    for (const s of q.standards) {
      countMap.set(s.ngss_code, (countMap.get(s.ngss_code) || 0) + 1);
      if (isHighDok) {
        highDokMap.set(s.ngss_code, (highDokMap.get(s.ngss_code) || 0) + 1);
      }
    }
  }

  // Group Idaho standards by subject
  const idahoBySubject = new Map<string, IdahoGradeStandards[]>();
  for (const subj of activeIdahoSubjects) {
    idahoBySubject.set(subj, ALL_IDAHO_STANDARDS.filter(gs => gs.subject === subj));
  }

  return (
    <div className="space-y-4">
      {showNGSS && <NGSSCoverageSection countMap={countMap} highDokMap={highDokMap} onGapClick={onGapClick} />}
      {activeIdahoSubjects.map(subj => {
        const gradeStandards = idahoBySubject.get(subj) || [];
        if (gradeStandards.length === 0) return null;
        return (
          <IdahoCoverageSection
            key={subj}
            subject={subj}
            gradeStandards={gradeStandards}
            countMap={countMap}
            highDokMap={highDokMap}
            onGapClick={onGapClick}
          />
        );
      })}
    </div>
  );
}
