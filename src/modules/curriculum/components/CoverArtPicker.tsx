import { useState, useRef, useCallback } from "react";
import ReactCrop, { type Crop, type PixelCrop } from "react-image-crop";
import "react-image-crop/dist/ReactCrop.css";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { supabase } from "@/modules/curriculum/config/supabase";
import { Loader2, Upload, Sparkles, ImageIcon, Crop as CropIcon, Trash2 } from "lucide-react";
import { toast } from "sonner";

interface CoverArtPickerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  bookId: string;
  bookTitle: string;
  currentCoverUrl?: string | null;
  onCoverUpdated: (coverUrl: string) => void;
  onCoverRemoved?: () => void;
}

function getCroppedBlob(image: HTMLImageElement, crop: PixelCrop): Promise<Blob> {
  const canvas = document.createElement("canvas");
  const scaleX = image.naturalWidth / image.width;
  const scaleY = image.naturalHeight / image.height;
  canvas.width = crop.width * scaleX;
  canvas.height = crop.height * scaleY;
  const ctx = canvas.getContext("2d")!;
  ctx.drawImage(
    image,
    crop.x * scaleX, crop.y * scaleY,
    crop.width * scaleX, crop.height * scaleY,
    0, 0,
    canvas.width, canvas.height,
  );
  return new Promise((resolve, reject) => {
    canvas.toBlob(blob => blob ? resolve(blob) : reject(new Error("Canvas toBlob failed")), "image/png");
  });
}

export function CoverArtPicker({ open, onOpenChange, bookId, bookTitle, currentCoverUrl, onCoverUpdated, onCoverRemoved }: CoverArtPickerProps) {
  const [uploading, setUploading] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [prompt, setPrompt] = useState(`Book cover for "${bookTitle}"`);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);

  // Crop state
  const [cropSrc, setCropSrc] = useState<string | null>(null);
  const [crop, setCrop] = useState<Crop>();
  const [completedCrop, setCompletedCrop] = useState<PixelCrop>();
  const cropImgRef = useRef<HTMLImageElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [pendingFile, setPendingFile] = useState<{ ext: string } | null>(null);

  const resetCrop = () => {
    setCropSrc(null);
    setCrop(undefined);
    setCompletedCrop(undefined);
    setPendingFile(null);
  };

  const uploadToStorage = async (file: File | Blob, ext: string): Promise<string> => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error("Not authenticated");
    const filePath = `${user.id}/${bookId}-cover.${ext}`;
    await supabase.storage.from("book-covers").remove([filePath]);
    const { error } = await supabase.storage.from("book-covers").upload(filePath, file, {
      contentType: ext === "png" ? "image/png" : "image/jpeg",
      upsert: true,
    });
    if (error) throw error;
    const { data: signed } = await supabase.storage.from("book-covers").createSignedUrl(filePath, 60 * 60 * 24 * 365 * 10);
    return (signed?.signedUrl ?? "") + `&t=${Date.now()}`;
  };

  const saveCoverUrl = async (url: string) => {
    const { error } = await supabase
      .from("library_books")
      .update({ cover_url: url } as any)
      .eq("id", bookId);
    if (error) throw error;
    onCoverUpdated(url);
    onOpenChange(false);
    toast.success("Cover art updated!");
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    e.target.value = "";
    if (!file.type.startsWith("image/")) { toast.error("Please select an image file"); return; }
    if (file.size > 10 * 1024 * 1024) { toast.error("Image must be under 10 MB"); return; }

    const ext = file.name.split(".").pop()?.toLowerCase() || "jpg";
    setPendingFile({ ext: ext === "png" ? "png" : "jpg" });

    const reader = new FileReader();
    reader.onload = () => {
      setCropSrc(reader.result as string);
      setCrop(undefined);
      setCompletedCrop(undefined);
    };
    reader.readAsDataURL(file);
  };

  const handleCropSave = async () => {
    if (!cropImgRef.current || !pendingFile) return;
    setUploading(true);
    try {
      let blob: Blob;
      if (completedCrop && completedCrop.width > 0 && completedCrop.height > 0) {
        blob = await getCroppedBlob(cropImgRef.current, completedCrop);
      } else {
        // No crop selected — use original
        const res = await fetch(cropSrc!);
        blob = await res.blob();
      }
      const url = await uploadToStorage(blob, "png");
      await saveCoverUrl(url);
      resetCrop();
    } catch (err: any) {
      console.error("Upload failed:", err);
      toast.error(err.message || "Failed to upload cover image");
    } finally {
      setUploading(false);
    }
  };

  const handleGenerate = async () => {
    if (!prompt.trim()) { toast.error("Please enter a description for the cover art"); return; }
    setGenerating(true);
    setPreviewUrl(null);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error("Not authenticated");
      const response = await supabase.functions.invoke("generate-cover-art", {
        body: { prompt: prompt.trim(), book_title: bookTitle },
      });
      if (response.error) throw new Error(response.error.message);
      const imageBase64 = response.data?.image;
      if (!imageBase64) throw new Error("No image generated");
      const dataUrl = imageBase64.startsWith("data:") ? imageBase64 : `data:image/png;base64,${imageBase64}`;
      setPreviewUrl(dataUrl);
    } catch (err: any) {
      console.error("Generation failed:", err);
      toast.error(err.message || "Failed to generate cover art");
    } finally {
      setGenerating(false);
    }
  };

  const handleSaveGenerated = async () => {
    if (!previewUrl) return;
    setUploading(true);
    try {
      const res = await fetch(previewUrl);
      const blob = await res.blob();
      const url = await uploadToStorage(blob, "png");
      await saveCoverUrl(url);
    } catch (err: any) {
      console.error("Save failed:", err);
      toast.error(err.message || "Failed to save cover");
    } finally {
      setUploading(false);
    }
  };

  // If we're in cropping mode, show the crop UI
  if (cropSrc) {
    return (
      <Dialog open={open} onOpenChange={(o) => { if (!o) resetCrop(); onOpenChange(o); }}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <CropIcon className="h-4 w-4" /> Crop Cover Image
            </DialogTitle>
            <DialogDescription>Drag to select the area you want to use, or save as-is.</DialogDescription>
          </DialogHeader>
          <div className="flex justify-center max-h-[60vh] overflow-auto rounded-lg border border-border bg-muted/30">
            <ReactCrop crop={crop} onChange={c => setCrop(c)} onComplete={c => setCompletedCrop(c)}>
              <img
                ref={cropImgRef}
                src={cropSrc}
                alt="Crop preview"
                style={{ maxHeight: "55vh", maxWidth: "100%" }}
              />
            </ReactCrop>
          </div>
          <div className="flex gap-2 justify-end">
            <Button variant="outline" onClick={resetCrop}>Back</Button>
            <Button onClick={handleCropSave} disabled={uploading} className="gap-1.5">
              {uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
              {completedCrop && completedCrop.width > 0 ? "Crop & Save" : "Save Original"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Choose Cover Art</DialogTitle>
          <DialogDescription>Upload an image or generate cover art with AI for "{bookTitle}"</DialogDescription>
        </DialogHeader>

        <Tabs defaultValue="upload" className="space-y-4">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="upload" className="gap-1.5">
              <Upload className="h-3.5 w-3.5" />
              Upload
            </TabsTrigger>
            <TabsTrigger value="generate" className="gap-1.5">
              <Sparkles className="h-3.5 w-3.5" />
              AI Generate
            </TabsTrigger>
          </TabsList>

          <TabsContent value="upload" className="space-y-4">
            <div
              onClick={() => fileInputRef.current?.click()}
              className="border-2 border-dashed border-border rounded-xl p-8 text-center cursor-pointer hover:border-primary/50 hover:bg-primary/5 transition-colors"
            >
              {uploading ? (
                <Loader2 className="h-8 w-8 animate-spin text-primary mx-auto" />
              ) : (
                <>
                  <ImageIcon className="h-8 w-8 text-muted-foreground/40 mx-auto mb-2" />
                  <p className="text-sm text-muted-foreground">Click to select an image</p>
                  <p className="text-xs text-muted-foreground/60 mt-1">JPG, PNG, or WebP — max 10 MB</p>
                </>
              )}
            </div>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={handleFileSelect}
            />
          </TabsContent>

          <TabsContent value="generate" className="space-y-4">
            <div className="space-y-2">
              <Input
                placeholder="Describe the cover art you want..."
                value={prompt}
                onChange={e => setPrompt(e.target.value)}
                disabled={generating}
              />
              <Button onClick={handleGenerate} disabled={generating || !prompt.trim()} className="w-full gap-2">
                {generating ? (
                  <><Loader2 className="h-4 w-4 animate-spin" /> Generating...</>
                ) : (
                  <><Sparkles className="h-4 w-4" /> Generate Cover Art</>
                )}
              </Button>
            </div>

            {previewUrl && (
              <div className="space-y-3">
                <div className="rounded-xl overflow-hidden border border-border aspect-[3/4] bg-muted">
                  <img src={previewUrl} alt="Generated cover" className="w-full h-full object-cover" />
                </div>
                <div className="flex gap-2">
                  <Button variant="outline" onClick={handleGenerate} disabled={generating} className="flex-1">
                    Regenerate
                  </Button>
                  <Button onClick={handleSaveGenerated} disabled={uploading} className="flex-1 gap-1.5">
                    {uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                    Use This Cover
                  </Button>
                </div>
              </div>
            )}
          </TabsContent>
        </Tabs>

        {currentCoverUrl && onCoverRemoved && (
          <div className="border-t border-border pt-3 mt-2">
            <Button
              variant="outline"
              size="sm"
              className="w-full text-destructive hover:text-destructive gap-2"
              onClick={async () => {
                try {
                  const coverPath = currentCoverUrl.split("/book-covers/")[1];
                  if (coverPath) await supabase.storage.from("book-covers").remove([coverPath]);
                  await supabase.from("library_books").update({ cover_url: null }).eq("id", bookId);
                  onCoverRemoved();
                  onOpenChange(false);
                  toast.success("Cover removed");
                } catch {
                  toast.error("Failed to remove cover");
                }
              }}
            >
              <Trash2 className="h-4 w-4" />
              Remove Current Cover
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
