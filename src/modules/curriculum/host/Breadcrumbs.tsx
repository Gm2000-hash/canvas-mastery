import { ChevronRight } from "lucide-react";
import { Link } from "react-router-dom";

export type BreadcrumbItem = { label: string; path?: string };

export function Breadcrumbs({ items }: { items: BreadcrumbItem[] }) {
  return (
    <nav aria-label="Breadcrumb" className="flex items-center gap-1.5 text-sm text-muted-foreground min-w-0">
      {items.map((item, i) => {
        const last = i === items.length - 1;
        return (
          <span key={i} className="flex items-center gap-1.5 min-w-0">
            {i > 0 && <ChevronRight className="h-3.5 w-3.5 shrink-0 opacity-50" />}
            {item.path && !last ? (
              <Link to={item.path} className="hover:text-foreground transition-colors truncate">
                {item.label}
              </Link>
            ) : (
              <span className={last ? "font-medium text-foreground truncate" : "truncate"}>{item.label}</span>
            )}
          </span>
        );
      })}
    </nav>
  );
}
