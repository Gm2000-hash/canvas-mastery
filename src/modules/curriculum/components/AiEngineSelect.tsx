import { Sparkles } from "lucide-react";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { AVAILABLE_MODELS, useAiPreferences, type ModelTier } from "@/modules/curriculum/hooks/useAiPreferences";

interface Props {
  /** Selected model id, or empty string / undefined to use the user's default for this tier. */
  value: string;
  onChange: (modelId: string) => void;
  /** Which task tier this generator falls into — controls the "(default)" label. */
  tier?: ModelTier;
  label?: string;
  className?: string;
}

const USE_DEFAULT = "__default__";

export function AiEngineSelect({ value, onChange, tier = "default", label = "AI Engine", className }: Props) {
  const { resolveLocal } = useAiPreferences();
  const currentDefault = resolveLocal(tier);
  const defaultModel = AVAILABLE_MODELS.find((m) => m.id === currentDefault);

  const selectValue = value && value.length > 0 ? value : USE_DEFAULT;

  const handleChange = (next: string) => {
    onChange(next === USE_DEFAULT ? "" : next);
  };

  return (
    <div className={`space-y-1.5 ${className || ""}`}>
      <Label className="text-xs flex items-center gap-1.5 text-muted-foreground">
        <Sparkles className="h-3 w-3" />
        {label}
      </Label>
      <Select value={selectValue} onValueChange={handleChange}>
        <SelectTrigger className="h-9 text-sm">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value={USE_DEFAULT}>
            Use my default ({defaultModel?.label || currentDefault})
          </SelectItem>
          {AVAILABLE_MODELS.map((m) => (
            <SelectItem key={m.id} value={m.id}>
              <div className="flex flex-col">
                <span>{m.label}</span>
                {m.description && (
                  <span className="text-[10px] text-muted-foreground">{m.description}</span>
                )}
              </div>
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}
