import { useState } from "react";
import { Link } from "react-router-dom";
import { Menu } from "lucide-react";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";

const NAV = [
  { label: "Units", to: "/app/curriculum/lesson-planner" },
  { label: "Lessons", to: "/app/curriculum/lessons" },
  { label: "Library", to: "/app/curriculum/library" },
  { label: "Standards", to: "/app/curriculum/standards" },
  { label: "Activities", to: "/app/curriculum/activities" },
  { label: "Question Bank", to: "/app/curriculum/question-bank" },
  { label: "Notes", to: "/app/curriculum/notes" },
];

export function AppNavSheet() {
  const [open, setOpen] = useState(false);
  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <Button variant="ghost" size="icon" aria-label="Open navigation">
          <Menu className="h-5 w-5" />
        </Button>
      </SheetTrigger>
      <SheetContent side="left" className="w-64">
        <p className="mb-4 text-sm font-semibold text-foreground">Curriculum Suite</p>
        <nav className="flex flex-col gap-1">
          {NAV.map((item) => (
            <Link
              key={item.to}
              to={item.to}
              onClick={() => setOpen(false)}
              className="rounded-md px-3 py-2 text-sm text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
            >
              {item.label}
            </Link>
          ))}
        </nav>
      </SheetContent>
    </Sheet>
  );
}
