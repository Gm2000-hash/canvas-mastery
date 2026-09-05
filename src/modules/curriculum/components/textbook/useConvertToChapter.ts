import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { normalizeChapter, type LegacyLessonFields, type TextbookChapter } from "@/modules/curriculum/lib/textbook-chapter";

/** Calls the AI to restructure an existing reading into the textbook-chapter format. */
export function useConvertToChapter() {
  const [converting, setConverting] = useState(false);

  async function convert(input: { title: string; lesson?: LegacyLessonFields; markdown?: string; standards?: { code: string; description: string }[] }): Promise<TextbookChapter | null> {
    setConverting(true);
    const tId = toast.loading("Restructuring into a textbook chapter…");
    try {
      const { data, error } = await supabase.functions.invoke("convert-reading-to-chapter", { body: input });
      if (error) throw new Error((error as any).message ?? "Conversion failed");
      if (data?.error) throw new Error(typeof data.error === "string" ? data.error : "Conversion failed");
      toast.success("Chapter ready — review it, then save", { id: tId });
      return normalizeChapter(data.chapter, input.title);
    } catch (e: any) {
      toast.error(e?.message ?? "Conversion failed", { id: tId });
      return null;
    } finally {
      setConverting(false);
    }
  }
  return { convert, converting };
}
