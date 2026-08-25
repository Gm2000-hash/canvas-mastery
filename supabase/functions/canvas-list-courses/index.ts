// Lists every course the teacher's Canvas API token can see (active + completed teacher enrollments)
// without writing anything. Used by the "Import courses" dialog so the teacher can pick which to sync.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

type CanvasCreds = { base_url: string; api_token: string };

class CanvasApiError extends Error {
  constructor(
    readonly status: number,
    readonly responseBody: string,
  ) {
    super(`Canvas request failed (${status})`);
  }
}

function parseLinkHeader(header: string | null): Record<string, string> {
  const out: Record<string, string> = {};
  if (!header) return out;
  for (const part of header.split(",")) {
    const m = part.trim().match(/^<([^>]+)>;\s*rel="([^"]+)"$/);
    if (m) out[m[2]] = m[1];
  }
  return out;
}

async function canvasFetchAll<T>(creds: CanvasCreds, path: string): Promise<T[]> {
  const items: T[] = [];
  let url = `${creds.base_url}${path}${path.includes("?") ? "&" : "?"}per_page=100`;
  let safety = 0;
  while (url && safety < 30) {
    const res = await fetch(url, { headers: { Authorization: `Bearer ${creds.api_token}` } });
    if (!res.ok) {
      const t = await res.text().catch(() => "");
      throw new CanvasApiError(res.status, t.slice(0, 500));
    }
    const page = (await res.json()) as T[];
    items.push(...(Array.isArray(page) ? page : []));
    const links = parseLinkHeader(res.headers.get("Link"));
    url = links.next ?? "";
    safety++;
  }
  return items;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  try {
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    const userClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      global: { headers: { Authorization: req.headers.get("Authorization") ?? "" } },
    });
    const { data: userData, error: uErr } = await userClient.auth.getUser();
    if (uErr || !userData.user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const teacherId = userData.user.id;

    const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
    const { data: creds } = await admin
      .from("canvas_credentials").select("base_url, api_token").eq("teacher_id", teacherId).maybeSingle();
    if (!creds) {
      return new Response(JSON.stringify({ error: "No Canvas credentials. Connect Canvas first." }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Fetch all teacher courses across enrollment states (include term + total_students)
    const courses = await canvasFetchAll<any>(
      creds,
      "/api/v1/courses?enrollment_type=teacher&include[]=term&include[]=total_students&state[]=available&state[]=completed&state[]=unpublished",
    );

    // Compute school year label (July 1 → June 9 next year) from the best-available date
    function schoolYearLabel(iso: string | null | undefined): string | null {
      if (!iso) return null;
      const d = new Date(iso);
      if (isNaN(d.getTime())) return null;
      const y = d.getFullYear();
      const m = d.getMonth() + 1;
      return m >= 7 ? `${y}-${y + 1}` : `${y - 1}-${y}`;
    }

    // Cross-reference with already imported
    const { data: existing } = await admin
      .from("courses").select("canvas_course_id, discipline_id").eq("teacher_id", teacherId);
    const importedSet = new Map((existing ?? []).map((r) => [Number(r.canvas_course_id), r.discipline_id]));

    const items = courses.map((c) => {
      const dateForYear =
        c.end_at ?? c.term?.end_at ?? c.term?.start_at ?? c.start_at ?? null;
      return {
        canvas_course_id: c.id,
        name: c.name ?? `Course ${c.id}`,
        course_code: c.course_code ?? null,
        term: c.term?.name ?? null,
        workflow_state: c.workflow_state ?? null,
        total_students: c.total_students ?? null,
        end_at: c.end_at ?? c.term?.end_at ?? null,
        school_year: schoolYearLabel(dateForYear),
        already_imported: importedSet.has(Number(c.id)),
        current_discipline_id: importedSet.get(Number(c.id)) ?? null,
      };
    });

    return new Response(JSON.stringify({ success: true, courses: items }), {
      status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("canvas-list-courses error", e);
    if (e instanceof CanvasApiError && e.status === 401) {
      const tokenExpired = /expired access token|expired_at/i.test(e.responseBody);
      return new Response(JSON.stringify({
        error: tokenExpired
          ? "Your Canvas access token has expired. Create a new token in Canvas, then update it in Settings."
          : "Canvas rejected your access token. Update your Canvas connection in Settings.",
        code: tokenExpired ? "CANVAS_TOKEN_EXPIRED" : "CANVAS_TOKEN_INVALID",
      }), {
        // This is an expected, recoverable connection state. Returning JSON with
        // a 200 lets the client render the recovery action instead of treating it
        // as an uninspectable edge-function failure.
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
