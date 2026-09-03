import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/modules/curriculum/config/supabase";
import { useAuth } from "../config/auth";

export type Note = {
  id: string;
  user_id: string;
  parent_id: string | null;
  title: string;
  icon: string | null;
  content: any;
  content_text: string;
  tags: string[];
  sort_order: number;
  share_token: string | null;
  is_public: boolean;
  created_at: string;
  updated_at: string;
};

export type NoteTreeItem = Pick<Note, "id" | "parent_id" | "title" | "icon" | "sort_order" | "updated_at">;

function generateShareToken() {
  const chars = "abcdefghijklmnopqrstuvwxyz0123456789";
  let t = "";
  for (let i = 0; i < 16; i++) t += chars[Math.floor(Math.random() * chars.length)];
  return t;
}

export function useNotesTree() {
  const { user } = useAuth();
  return useQuery({
    queryKey: ["notes-tree", user?.id],
    enabled: !!user,
    queryFn: async (): Promise<NoteTreeItem[]> => {
      const { data, error } = await supabase
        .from("notes")
        .select("id, parent_id, title, icon, sort_order, updated_at")
        .order("sort_order", { ascending: true })
        .order("updated_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as NoteTreeItem[];
    },
  });
}

export function useNote(id: string | undefined) {
  return useQuery({
    queryKey: ["note", id],
    enabled: !!id,
    queryFn: async (): Promise<Note | null> => {
      if (!id) return null;
      const { data, error } = await supabase.from("notes").select("*").eq("id", id).maybeSingle();
      if (error) throw error;
      return data as Note | null;
    },
  });
}

export function useCreateNote() {
  const { user } = useAuth();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: { parent_id?: string | null; title?: string }) => {
      if (!user) throw new Error("Not authenticated");
      const { data, error } = await supabase
        .from("notes")
        .insert({
          user_id: user.id,
          parent_id: input.parent_id ?? null,
          title: input.title ?? "Untitled",
          content: {},
          content_text: "",
        })
        .select()
        .single();
      if (error) throw error;
      return data as Note;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["notes-tree"] });
    },
  });
}

export function useUpdateNote() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, updates }: { id: string; updates: Partial<Note> }) => {
      const { data, error } = await supabase
        .from("notes")
        .update(updates)
        .eq("id", id)
        .select()
        .single();
      if (error) throw error;
      return data as Note;
    },
    onSuccess: (_data, vars) => {
      qc.invalidateQueries({ queryKey: ["note", vars.id] });
      qc.invalidateQueries({ queryKey: ["notes-tree"] });
    },
  });
}

export function useDeleteNote() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("notes").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["notes-tree"] });
    },
  });
}

export function useToggleShareNote() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, makePublic, currentToken }: { id: string; makePublic: boolean; currentToken: string | null }) => {
      const updates: Partial<Note> = {
        is_public: makePublic,
        share_token: makePublic ? currentToken ?? generateShareToken() : currentToken,
      };
      const { data, error } = await supabase
        .from("notes")
        .update(updates)
        .eq("id", id)
        .select()
        .single();
      if (error) throw error;
      return data as Note;
    },
    onSuccess: (_data, vars) => {
      qc.invalidateQueries({ queryKey: ["note", vars.id] });
    },
  });
}

export function useSearchNotes(query: string) {
  return useQuery({
    queryKey: ["notes-search", query],
    enabled: query.trim().length > 0,
    queryFn: async () => {
      const trimmed = query.trim();
      // Use plainto_tsquery via .textSearch
      const { data, error } = await supabase
        .from("notes")
        .select("id, title, icon, content_text, tags, updated_at")
        .textSearch("search_vector", trimmed, { type: "websearch", config: "english" })
        .limit(20);
      if (error) {
        // Fallback: title ilike
        const { data: fb } = await supabase
          .from("notes")
          .select("id, title, icon, content_text, tags, updated_at")
          .ilike("title", `%${trimmed}%`)
          .limit(20);
        return fb ?? [];
      }
      return data ?? [];
    },
  });
}

export function useBacklinks(noteId: string | undefined) {
  return useQuery({
    queryKey: ["backlinks", noteId],
    enabled: !!noteId,
    queryFn: async () => {
      if (!noteId) return [];
      const { data, error } = await supabase
        .from("note_links")
        .select("source_note_id, source:notes!note_links_source_note_id_fkey(id, title, icon)")
        .eq("target_note_id", noteId);
      if (error) throw error;
      return (data ?? []).map((r: any) => r.source).filter(Boolean);
    },
  });
}

export function useReplaceNoteLinks() {
  return useMutation({
    mutationFn: async ({ sourceId, targetIds }: { sourceId: string; targetIds: string[] }) => {
      await supabase.from("note_links").delete().eq("source_note_id", sourceId);
      if (targetIds.length === 0) return;
      const rows = targetIds.map((target_note_id) => ({ source_note_id: sourceId, target_note_id }));
      await supabase.from("note_links").insert(rows);
    },
  });
}
