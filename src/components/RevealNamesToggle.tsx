// Per-page toggle to reveal real student names. Each reveal is audited
// server-side, requires the user's security PIN, and includes an optional reason.
import { useState } from "react";
import { Eye, EyeOff, Loader2, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

type Props = {
  revealed: boolean;
  loading?: boolean;
  onReveal: (pin: string, reason?: string) => Promise<boolean> | boolean;
  onHide: () => void;
  disabled?: boolean;
};

export function RevealNamesToggle({ revealed, loading, onReveal, onHide, disabled }: Props) {
  const [open, setOpen] = useState(false);
  const [pin, setPin] = useState("");
  const [reason, setReason] = useState("");
  const [submitting, setSubmitting] = useState(false);

  if (revealed) {
    return (
      <Button
        variant="outline"
        size="sm"
        className="h-9"
        onClick={onHide}
        disabled={disabled}
        title="Hide real names"
      >
        <EyeOff className="h-4 w-4 mr-1.5" /> Hide real names
      </Button>
    );
  }

  return (
    <>
      <Button
        variant="outline"
        size="sm"
        className="h-9"
        onClick={() => setOpen(true)}
        disabled={disabled || loading}
        title="Show real names (logged)"
      >
        {loading ? <Loader2 className="h-4 w-4 mr-1.5 animate-spin" /> : <Eye className="h-4 w-4 mr-1.5" />}
        Show real names
      </Button>

      <Dialog open={open} onOpenChange={(o) => { setOpen(o); if (!o) { setPin(""); setReason(""); } }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <ShieldCheck className="h-5 w-5 text-primary" /> Reveal real student names?
            </DialogTitle>
            <DialogDescription>
              Enter your security PIN to confirm. Real names will be shown only on this page until you hide them again.
              Each reveal is recorded in your privacy log.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-2">
              <Label htmlFor="reveal-pin">Security PIN</Label>
              <Input
                id="reveal-pin"
                type="password"
                autoComplete="off"
                value={pin}
                onChange={(e) => setPin(e.target.value)}
                minLength={6}
                maxLength={12}
                placeholder="6–12 characters"
                autoFocus
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="reveal-reason">Reason (optional)</Label>
              <Input
                id="reveal-reason"
                value={reason}
                placeholder="e.g. Parent meeting, IEP review"
                onChange={(e) => setReason(e.target.value)}
                maxLength={200}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setOpen(false)}>Cancel</Button>
            <Button
              onClick={async () => {
                if (pin.length < 6) return;
                setSubmitting(true);
                const ok = await onReveal(pin, reason.trim() || undefined);
                setSubmitting(false);
                if (ok !== false) {
                  setOpen(false);
                  setPin(""); setReason("");
                }
              }}
              disabled={submitting || loading || pin.length < 6}
            >
              {(submitting || loading) && <Loader2 className="h-4 w-4 mr-1.5 animate-spin" />}
              Reveal
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
