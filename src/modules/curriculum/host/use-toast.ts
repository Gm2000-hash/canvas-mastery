import { toast as sonnerToast } from "sonner";

type ToastArgs = {
  title?: string;
  description?: string;
  variant?: "default" | "destructive";
};

export function toast({ title, description, variant }: ToastArgs) {
  const message = title ?? description ?? "";
  const options = description && title ? { description } : undefined;
  if (variant === "destructive") return sonnerToast.error(message, options);
  return sonnerToast.success(message, options);
}

export function useToast() {
  return { toast, dismiss: sonnerToast.dismiss };
}
