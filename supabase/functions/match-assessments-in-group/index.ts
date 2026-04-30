// Match equivalent assessments inside a single class group using Lovable AI.
// Strategy:
//   1. Pull all unassigned assignments belonging to the class group's classes.
//   2. Compute trigram-style similarity locally on names; build candidate pairs.
//   3. Ask the LLM to cluster borderline candidates into "same assessment" groups.
//   4. Persist results in assessment_match_suggestions.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

function normalize(s: string) {
  return (s || "")
    .toLowerCase()
    .replace(/<[^>]*>/g, " ")
    .replace(/\s+/g, " ")
    .replace(/[.,:;!?()\-_*"']/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function trigrams(s: string): Set<string> {
  const padded = `  ${s}  `;
  const out = new Set<string>();
  for (let i = 0; i < padded.length - 2; i++) out.add(padded.slice(i, i + 3));
  return out;
}

function similarity(a: string, b: string): number {
  if (!a || !b) return 0;
  if (a === b) return 1;
  const A = trigrams(a);
  const B = trigrams(b);
  let inter = 0;
  for (const t of A) if (B.has(t)) inter++;
  const union = A.size + B.size - inter;
  return union === 0 ? 0 : inter / union;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Missing auth" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } },
    );

    const { data: userData, error: userErr } = await supabase.auth.getUser();
    if (userErr || !userData?.user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const teacherId = userData.user.id;

    const body = await req.json().catch(() => ({}));
    const classGroupId: string | undefined = body?.class_group_id;
    if (!classGroupId) {
      return new Response(JSON.stringify({ error: "class_group_id required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Verify ownership
    const { data: cg } = await supabase
      .from("class_groups")
      .select("id")
      .eq("id", classGroupId)
      .eq("teacher_id", teacherId)
      .maybeSingle();
    if (!cg) {
      return new Response(JSON.stringify({ error: "Class group not found" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Class group's courses
    const { data: members } = await supabase
      .from("class_group_courses")
      .select("course_id")
      .eq("class_group_id", classGroupId)
      .eq("teacher_id", teacherId);
    const courseIds = (members ?? []).map((m: any) => m.course_id);
    if (courseIds.length < 2) {
      return new Response(
        JSON.stringify({ suggestions: [], message: "Add at least two classes to this group." }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // Pull unassigned assignments in those courses, with course names
    const { data: assignments, error: aErr } = await supabase
      .from("assignments")
      .select("id, name, kind, course_id, courses:course_id(name)")
      .eq("teacher_id", teacherId)
      .is("assignment_group_id", null)
      .in("course_id", courseIds);

    if (aErr) {
      return new Response(JSON.stringify({ error: aErr.message }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const items = (assignments ?? []).map((a: any) => ({
      id: a.id,
      name: a.name as string,
      norm: normalize(a.name),
      kind: a.kind as string,
      course_id: a.course_id as string,
      course_name: a.courses?.name as string | undefined,
    }));

    if (items.length < 2) {
      return new Response(JSON.stringify({ suggestions: [] }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Build candidate clusters with union-find on similarity >= 0.45
    const parent = new Map<string, string>();
    items.forEach((it) => parent.set(it.id, it.id));
    const find = (x: string): string => {
      const p = parent.get(x)!;
      if (p === x) return x;
      const r = find(p);
      parent.set(x, r);
      return r;
    };
    const union = (a: string, b: string) => {
      const ra = find(a);
      const rb = find(b);
      if (ra !== rb) parent.set(ra, rb);
    };

    const PAIR_SIM_THRESHOLD = 0.45;
    for (let i = 0; i < items.length; i++) {
      for (let j = i + 1; j < items.length; j++) {
        if (items[i].kind !== items[j].kind) continue;
        if (items[i].course_id === items[j].course_id) continue; // same class doesn't help
        const s = similarity(items[i].norm, items[j].norm);
        if (s >= PAIR_SIM_THRESHOLD) union(items[i].id, items[j].id);
      }
    }

    // Group items by root
    const clusters = new Map<string, typeof items>();
    for (const it of items) {
      const r = find(it.id);
      if (!clusters.has(r)) clusters.set(r, [] as any);
      clusters.get(r)!.push(it);
    }

    // Filter: clusters spanning 2+ classes
    const candidateClusters = [...clusters.values()].filter((cl) => {
      const courses = new Set(cl.map((c) => c.course_id));
      return cl.length >= 2 && courses.size >= 2;
    });

    if (candidateClusters.length === 0) {
      // Wipe stale pending suggestions for this group then return empty
      await supabase
        .from("assessment_match_suggestions")
        .delete()
        .eq("teacher_id", teacherId)
        .eq("class_group_id", classGroupId)
        .is("dismissed_at", null)
        .is("applied_group_id", null);
      return new Response(JSON.stringify({ suggestions: [] }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Ask LLM to confirm/refine each cluster
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    type Verdict = {
      cluster_id: number;
      decision: "same" | "different" | "split";
      groups: { name: string; assignment_ids: string[]; confidence: number; rationale: string }[];
    };

    const llmPayload = candidateClusters.map((cl, idx) => ({
      cluster_id: idx,
      assignments: cl.map((c) => ({
        id: c.id,
        name: c.name,
        course: c.course_name ?? null,
      })),
    }));

    let verdicts: Verdict[] = [];
    if (LOVABLE_API_KEY) {
      try {
        const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${LOVABLE_API_KEY}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            model: "google/gemini-2.5-flash",
            messages: [
              {
                role: "system",
                content:
                  "You help teachers identify when assignments from different class sections represent the SAME assessment (e.g. a Pre-ECA given in two periods). For each candidate cluster, decide whether the assignments are equivalent assessments. If yes, return ONE group with all ids and a clean canonical name. If only some match, split them into groups (each requires 2+ ids). If none match, return no groups. Ignore section/period markers and minor formatting differences.",
              },
              {
                role: "user",
                content: JSON.stringify({ clusters: llmPayload }),
              },
            ],
            tools: [
              {
                type: "function",
                function: {
                  name: "report_clusters",
                  description: "Report verdicts on candidate clusters",
                  parameters: {
                    type: "object",
                    properties: {
                      results: {
                        type: "array",
                        items: {
                          type: "object",
                          properties: {
                            cluster_id: { type: "number" },
                            decision: {
                              type: "string",
                              enum: ["same", "different", "split"],
                            },
                            groups: {
                              type: "array",
                              items: {
                                type: "object",
                                properties: {
                                  name: { type: "string" },
                                  assignment_ids: {
                                    type: "array",
                                    items: { type: "string" },
                                  },
                                  confidence: { type: "number" },
                                  rationale: { type: "string" },
                                },
                                required: [
                                  "name",
                                  "assignment_ids",
                                  "confidence",
                                  "rationale",
                                ],
                              },
                            },
                          },
                          required: ["cluster_id", "decision", "groups"],
                        },
                      },
                    },
                    required: ["results"],
                  },
                },
              },
            ],
            tool_choice: { type: "function", function: { name: "report_clusters" } },
          }),
        });

        if (res.status === 429 || res.status === 402) {
          // Surface but degrade gracefully — fall back to local clusters
          console.warn("AI rate-limit/credits:", res.status);
        } else if (res.ok) {
          const data = await res.json();
          const args = data?.choices?.[0]?.message?.tool_calls?.[0]?.function?.arguments;
          if (args) {
            const parsed = JSON.parse(args);
            verdicts = parsed?.results ?? [];
          }
        } else {
          console.warn("AI gateway error:", res.status, await res.text());
        }
      } catch (e) {
        console.warn("AI call failed", e);
      }
    }

    // Build suggestions to persist. If AI failed, fall back to local clusters as 'same'.
    type Suggestion = {
      assignment_ids: string[];
      suggested_name: string;
      confidence: number;
      rationale: string;
    };
    const suggestions: Suggestion[] = [];

    if (verdicts.length > 0) {
      for (const v of verdicts) {
        for (const g of v.groups) {
          const cl = candidateClusters[v.cluster_id];
          if (!cl) continue;
          const validIds = new Set(cl.map((c) => c.id));
          const ids = g.assignment_ids.filter((id) => validIds.has(id));
          if (ids.length < 2) continue;
          // Need 2+ classes
          const courseIdSet = new Set(
            cl.filter((c) => ids.includes(c.id)).map((c) => c.course_id),
          );
          if (courseIdSet.size < 2) continue;
          suggestions.push({
            assignment_ids: ids,
            suggested_name: g.name?.trim() || cl[0].name,
            confidence: Math.max(0, Math.min(1, g.confidence ?? 0.7)),
            rationale: g.rationale ?? "",
          });
        }
      }
    } else {
      for (const cl of candidateClusters) {
        suggestions.push({
          assignment_ids: cl.map((c) => c.id),
          suggested_name: cl[0].name,
          confidence: 0.6,
          rationale: "Name similarity (offline match — AI unavailable).",
        });
      }
    }

    // Replace prior pending suggestions for this group
    await supabase
      .from("assessment_match_suggestions")
      .delete()
      .eq("teacher_id", teacherId)
      .eq("class_group_id", classGroupId)
      .is("dismissed_at", null)
      .is("applied_group_id", null);

    if (suggestions.length > 0) {
      const rows = suggestions.map((s) => ({
        teacher_id: teacherId,
        class_group_id: classGroupId,
        assignment_ids: s.assignment_ids,
        suggested_name: s.suggested_name,
        confidence: s.confidence,
        rationale: s.rationale,
      }));
      const { error: insErr } = await supabase
        .from("assessment_match_suggestions")
        .insert(rows);
      if (insErr) {
        return new Response(JSON.stringify({ error: insErr.message }), {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    }

    return new Response(
      JSON.stringify({ suggestions, count: suggestions.length }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (e) {
    console.error("match-assessments-in-group error", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : String(e) }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
