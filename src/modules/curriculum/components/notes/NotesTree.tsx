import { useMemo, useState } from "react";
import { useNavigate, useLocation } from "@/modules/curriculum/config/router";
import { ChevronRight, ChevronDown, Plus, MoreHorizontal, Trash2, FileText } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useNotesTree, useCreateNote, useDeleteNote, NoteTreeItem } from "@/modules/curriculum/hooks/useNotes";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

interface TreeNode extends NoteTreeItem {
  children: TreeNode[];
}

function buildTree(items: NoteTreeItem[]): TreeNode[] {
  const map = new Map<string, TreeNode>();
  items.forEach((i) => map.set(i.id, { ...i, children: [] }));
  const roots: TreeNode[] = [];
  map.forEach((node) => {
    if (node.parent_id && map.has(node.parent_id)) {
      map.get(node.parent_id)!.children.push(node);
    } else {
      roots.push(node);
    }
  });
  return roots;
}

interface RowProps {
  node: TreeNode;
  depth: number;
  expanded: Set<string>;
  setExpanded: (s: Set<string>) => void;
  activeId?: string;
}

function TreeRow({ node, depth, expanded, setExpanded, activeId }: RowProps) {
  const navigate = useNavigate();
  const createNote = useCreateNote();
  const deleteNote = useDeleteNote();
  const isOpen = expanded.has(node.id);
  const hasChildren = node.children.length > 0;
  const isActive = activeId === node.id;

  const toggle = (e: React.MouseEvent) => {
    e.stopPropagation();
    const next = new Set(expanded);
    if (isOpen) next.delete(node.id);
    else next.add(node.id);
    setExpanded(next);
  };

  const handleAddChild = async (e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      const child = await createNote.mutateAsync({ parent_id: node.id });
      const next = new Set(expanded);
      next.add(node.id);
      setExpanded(next);
      navigate(`/app/curriculum/notes/${child.id}`);
    } catch (err: any) {
      toast.error(err.message ?? "Could not create");
    }
  };

  const handleDelete = async () => {
    if (!confirm(`Delete "${node.title}" and all its sub-pages?`)) return;
    try {
      await deleteNote.mutateAsync(node.id);
      if (isActive) navigate("/app/curriculum/notes");
      toast.success("Deleted");
    } catch (err: any) {
      toast.error(err.message ?? "Could not delete");
    }
  };

  return (
    <>
      <div
        className={cn(
          "group flex items-center gap-0.5 rounded-md px-1 py-1 text-sm cursor-pointer hover:bg-sidebar-accent",
          isActive && "bg-sidebar-accent text-sidebar-accent-foreground font-medium",
        )}
        style={{ paddingLeft: `${depth * 12 + 4}px` }}
        onClick={() => navigate(`/app/curriculum/notes/${node.id}`)}
      >
        <button
          onClick={toggle}
          className="h-4 w-4 flex items-center justify-center shrink-0 text-muted-foreground hover:text-foreground"
        >
          {hasChildren ? (
            isOpen ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />
          ) : (
            <span className="h-3 w-3" />
          )}
        </button>
        <span className="text-base shrink-0 w-5 text-center">
          {node.icon || <FileText className="h-3.5 w-3.5 inline text-muted-foreground" />}
        </span>
        <span className="truncate flex-1 text-xs">{node.title || "Untitled"}</span>
        <div className="opacity-0 group-hover:opacity-100 flex items-center gap-0.5 shrink-0">
          <Button variant="ghost" size="icon" className="h-5 w-5" onClick={handleAddChild} title="Add subpage">
            <Plus className="h-3 w-3" />
          </Button>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" className="h-5 w-5" onClick={(e) => e.stopPropagation()}>
                <MoreHorizontal className="h-3 w-3" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" onClick={(e) => e.stopPropagation()}>
              <DropdownMenuItem onClick={handleDelete} className="text-destructive">
                <Trash2 className="h-3.5 w-3.5 mr-2" /> Delete
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
      {isOpen &&
        node.children.map((child) => (
          <TreeRow
            key={child.id}
            node={child}
            depth={depth + 1}
            expanded={expanded}
            setExpanded={setExpanded}
            activeId={activeId}
          />
        ))}
    </>
  );
}

export function NotesTree() {
  const { data: notes = [], isLoading } = useNotesTree();
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const location = useLocation();
  const activeId = location.pathname.startsWith("/app/curriculum/notes/")
    ? location.pathname.split("/")[2]
    : undefined;

  const tree = useMemo(() => buildTree(notes), [notes]);

  if (isLoading) {
    return <div className="px-2 py-1 text-xs text-muted-foreground">Loading…</div>;
  }
  if (tree.length === 0) {
    return (
      <div className="px-2 py-1 text-xs text-muted-foreground italic">
        No notes yet. Click + to create one.
      </div>
    );
  }
  return (
    <div className="px-1">
      {tree.map((node) => (
        <TreeRow
          key={node.id}
          node={node}
          depth={0}
          expanded={expanded}
          setExpanded={setExpanded}
          activeId={activeId}
        />
      ))}
    </div>
  );
}
