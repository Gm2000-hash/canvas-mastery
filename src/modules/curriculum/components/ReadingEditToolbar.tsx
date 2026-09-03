import { useCallback } from 'react';
import { Button } from '@/components/ui/button';
import {
  Plus, Trash2, ChevronUp, ChevronDown, Video, Puzzle,
  Type, Heading1, Heading2, BookOpen, ListOrdered, AlignLeft,
  ALargeSmall, Space, Sparkles, Wand2, Undo2, RefreshCw,
} from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Tooltip, TooltipContent, TooltipTrigger, TooltipProvider } from '@/components/ui/tooltip';

/* ─── Types for a generic section-based editor ─── */

export type SectionKind = 'objectives' | 'key_terms' | 'intro' | 'explanation' | 'reading';

export interface EditorAction {
  type: 'move' | 'delete' | 'add' | 'insert-video' | 'insert-activity' | 'set-font' | 'set-size' | 'set-spacing' | 'ai-generate' | 'ai-undo' | 'ai-regenerate';
  section?: SectionKind;
  index?: number;
  direction?: 'up' | 'down';
  value?: string;
  aiKind?: 'paragraph' | 'objective' | 'key_term' | 'activity' | 'video';
  aiSection?: 'intro' | 'explanation' | 'reading';
}

interface ToolbarButtonProps {
  icon: React.ElementType;
  label: string;
  onClick: () => void;
  disabled?: boolean;
  destructive?: boolean;
}

function Btn({ icon: Icon, label, onClick, disabled, destructive }: ToolbarButtonProps) {
  return (
    <TooltipProvider delayDuration={200}>
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            variant="ghost"
            size="icon"
            className={`h-8 w-8 ${destructive ? 'hover:bg-destructive/10 hover:text-destructive' : ''}`}
            onClick={onClick}
            disabled={disabled}
          >
            <Icon className="h-3.5 w-3.5" />
          </Button>
        </TooltipTrigger>
        <TooltipContent side="bottom" className="text-xs">{label}</TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

/* ─── Section-level toolbar (appears above each section in edit mode) ─── */

interface SectionToolbarProps {
  section: SectionKind;
  index: number;
  total: number;
  onAction: (action: EditorAction) => void;
  label: string;
}

export function SectionToolbar({ section, index, total, onAction, label }: SectionToolbarProps) {
  return (
    <div className="flex items-center gap-1 mb-1">
      <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider flex-1">{label}</span>
      <Btn icon={ChevronUp} label="Move up" onClick={() => onAction({ type: 'move', section, index, direction: 'up' })} disabled={index === 0} />
      <Btn icon={ChevronDown} label="Move down" onClick={() => onAction({ type: 'move', section, index, direction: 'down' })} disabled={index >= total - 1} />
      <Btn icon={Trash2} label="Delete" onClick={() => onAction({ type: 'delete', section, index })} destructive />
    </div>
  );
}

/* ─── Item-level toolbar (per paragraph / key term / objective) ─── */

interface ItemToolbarProps {
  section: SectionKind;
  index: number;
  total: number;
  onAction: (action: EditorAction) => void;
}

export function ItemToolbar({ section, index, total, onAction }: ItemToolbarProps) {
  return (
    <div className="flex items-center gap-0.5 shrink-0">
      <Btn icon={ChevronUp} label="Move up" onClick={() => onAction({ type: 'move', section, index, direction: 'up' })} disabled={index === 0} />
      <Btn icon={ChevronDown} label="Move down" onClick={() => onAction({ type: 'move', section, index, direction: 'down' })} disabled={index >= total - 1} />
      <Btn icon={Trash2} label="Delete" onClick={() => onAction({ type: 'delete', section, index })} destructive />
    </div>
  );
}

/* ─── Main floating toolbar ─── */

interface ReadingEditToolbarProps {
  onAction: (action: EditorAction) => void;
  activeFont: string;
  activeFontSize: string;
  activeLineSpacing: string;
}

const FONTS = [
  { value: 'font-sans', label: 'Nunito (Default)' },
  { value: 'font-serif', label: 'Serif' },
  { value: 'font-mono', label: 'Monospace' },
];

const FONT_SIZES = [
  { value: 'text-xs', label: 'Small' },
  { value: 'text-sm', label: 'Medium (Default)' },
  { value: 'text-base', label: 'Large' },
  { value: 'text-lg', label: 'Extra Large' },
];

const LINE_SPACINGS = [
  { value: 'leading-snug', label: 'Compact' },
  { value: 'leading-relaxed', label: 'Relaxed (Default)' },
  { value: 'leading-loose', label: 'Spacious' },
  { value: 'leading-[2]', label: 'Double' },
];

export function ReadingEditToolbar({ onAction, activeFont, activeFontSize, activeLineSpacing }: ReadingEditToolbarProps) {
  return (
    <div className="sticky top-0 z-20 flex items-center gap-1 flex-wrap rounded-xl border border-border bg-card/95 backdrop-blur-sm p-1.5 shadow-md mb-4">
      {/* Insert Section */}
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="outline" size="sm" className="h-8 gap-1.5 text-xs">
            <Plus className="h-3.5 w-3.5" /> Add Section
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start">
          <DropdownMenuItem onClick={() => onAction({ type: 'add', section: 'objectives' })}>
            <ListOrdered className="h-4 w-4 mr-2" /> Objective
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => onAction({ type: 'add', section: 'key_terms' })}>
            <Type className="h-4 w-4 mr-2" /> Key Term
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => onAction({ type: 'add', section: 'intro' })}>
            <Heading1 className="h-4 w-4 mr-2" /> Introduction Paragraph
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => onAction({ type: 'add', section: 'explanation' })}>
            <Heading2 className="h-4 w-4 mr-2" /> Explanation Paragraph
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => onAction({ type: 'add', section: 'reading' })}>
            <BookOpen className="h-4 w-4 mr-2" /> Reading Paragraph
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <div className="w-px h-6 bg-border mx-1" />

      {/* AI Generate */}
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="outline" size="sm" className="h-8 gap-1.5 text-xs bg-primary/5 border-primary/20 text-primary hover:bg-primary/10">
            <Sparkles className="h-3.5 w-3.5" /> AI Generate
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" className="w-56">
          <DropdownMenuSub>
            <DropdownMenuSubTrigger>
              <BookOpen className="h-4 w-4 mr-2" /> Paragraph
            </DropdownMenuSubTrigger>
            <DropdownMenuSubContent>
              <DropdownMenuItem onClick={() => onAction({ type: 'ai-generate', aiKind: 'paragraph', aiSection: 'intro' })}>
                Introduction
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => onAction({ type: 'ai-generate', aiKind: 'paragraph', aiSection: 'explanation' })}>
                Explanation
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => onAction({ type: 'ai-generate', aiKind: 'paragraph', aiSection: 'reading' })}>
                Reading
              </DropdownMenuItem>
            </DropdownMenuSubContent>
          </DropdownMenuSub>
          <DropdownMenuItem onClick={() => onAction({ type: 'ai-generate', aiKind: 'objective' })}>
            <ListOrdered className="h-4 w-4 mr-2" /> Objective
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => onAction({ type: 'ai-generate', aiKind: 'key_term' })}>
            <Type className="h-4 w-4 mr-2" /> Key Term
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem onClick={() => onAction({ type: 'ai-generate', aiKind: 'activity' })}>
            <Puzzle className="h-4 w-4 mr-2" /> Activity Block
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => onAction({ type: 'ai-generate', aiKind: 'video' })}>
            <Video className="h-4 w-4 mr-2" /> Suggest Video
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <Button
        variant="ghost"
        size="sm"
        className="h-8 gap-1.5 text-xs text-primary hover:bg-primary/10"
        onClick={() => onAction({ type: 'ai-regenerate' })}
        title="Regenerate the last AI output"
      >
        <RefreshCw className="h-3.5 w-3.5" /> Regenerate
      </Button>
      <Button
        variant="ghost"
        size="sm"
        className="h-8 gap-1.5 text-xs"
        onClick={() => onAction({ type: 'ai-undo' })}
        title="Undo the last AI insertion"
      >
        <Undo2 className="h-3.5 w-3.5" /> Undo
      </Button>

      <div className="w-px h-6 bg-border mx-1" />

      {/* Insert Video */}
      <Button variant="ghost" size="sm" className="h-8 gap-1.5 text-xs" onClick={() => onAction({ type: 'insert-video' })}>
        <Video className="h-3.5 w-3.5" /> Video
      </Button>

      {/* Embed Activity */}
      <Button variant="ghost" size="sm" className="h-8 gap-1.5 text-xs" onClick={() => onAction({ type: 'insert-activity' })}>
        <Puzzle className="h-3.5 w-3.5" /> Activity
      </Button>

      <div className="w-px h-6 bg-border mx-1" />

      {/* Font */}
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="sm" className="h-8 gap-1.5 text-xs">
            <AlignLeft className="h-3.5 w-3.5" /> Font
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent>
          {FONTS.map(f => (
            <DropdownMenuItem key={f.value} onClick={() => onAction({ type: 'set-font', value: f.value })} className={activeFont === f.value ? 'bg-primary/10 text-primary' : ''}>
              {f.label}
            </DropdownMenuItem>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>

      {/* Text Size */}
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="sm" className="h-8 gap-1.5 text-xs">
            <ALargeSmall className="h-3.5 w-3.5" /> Size
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent>
          {FONT_SIZES.map(s => (
            <DropdownMenuItem key={s.value} onClick={() => onAction({ type: 'set-size', value: s.value })} className={activeFontSize === s.value ? 'bg-primary/10 text-primary' : ''}>
              {s.label}
            </DropdownMenuItem>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>

      {/* Line Spacing */}
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="sm" className="h-8 gap-1.5 text-xs">
            <Space className="h-3.5 w-3.5" /> Spacing
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent>
          {LINE_SPACINGS.map(s => (
            <DropdownMenuItem key={s.value} onClick={() => onAction({ type: 'set-spacing', value: s.value })} className={activeLineSpacing === s.value ? 'bg-primary/10 text-primary' : ''}>
              {s.label}
            </DropdownMenuItem>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}
