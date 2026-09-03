// Curriculum suite: turn a question into a visual/interactive manipulative.
// format "diagram" (rewrite only) | "drag_and_drop" | "image_hotspots"
// Output: { image_url?, activity_id?, activity_type?, suggested_question_text?, suggested_answers?, suggested_dok? }
import { z } from "https://esm.sh/zod@3.23.8";
import { aiImage, aiJson, arr, json, num, readBody, serve, storeImage, str, HttpError } from "../_shared/curriculum-ai.ts";

const Body = z.object({
  prompt: z.string().max(2000).default(""),
  question_text: z.string().max(4000),
  question_type: z.string().max(60).default("multiple_choice_question"),
  standard_code: z.string().max(60).optional(),
  format: z.enum(["diagram", "drag_and_drop", "image_hotspots"]),
  rewrite: z.boolean().default(false),
  current_dok: z.number().int().min(1).max(4).optional().nullable(),
});

serve(async (req, ctx) => {
  const parsed = Body.safeParse(await readBody(req));
  if (!parsed.success) throw new HttpError(400, JSON.stringify(parsed.error.flatten().fieldErrors));
  const b = parsed.data;
  const result: Record<string, unknown> = {};

  const targetDok = Math.min(4, Math.max(b.current_dok ?? 1, 2) + (b.rewrite ? 1 : 0));

  if (b.format === "diagram") {
    // Image is produced by generate-question-image; here we only rewrite.
    if (b.rewrite) {
      const out = await aiJson<Record<string, unknown>>({
        system: "You are an assessment specialist. Respond with one valid JSON object only.",
        user: `Original ${b.question_type}: ${b.question_text}\nA labeled diagram will be shown with the question: ${b.prompt}\n\nRewrite the question so students must analyze the diagram (target DOK ${targetDok}). Return JSON: {"suggested_question_text":string,"suggested_answers":[{"text":string,"weight":100|0}],"suggested_dok":number}`,
        maxTokens: 1200,
      });
      result.suggested_question_text = str(out.suggested_question_text);
      result.suggested_answers = out.suggested_answers;
      result.suggested_dok = num(out.suggested_dok, targetDok);
    }
    return json(result);
  }

  // Plan the interactive: labels/hotspots + the image prompt.
  const plan = await aiJson<Record<string, unknown>>({
    system: "You design interactive science diagrams. Respond with one valid JSON object only.",
    user: `Question (${b.question_type}): ${b.question_text}${b.standard_code ? `\nStandard: ${b.standard_code}` : ""}\nTeacher's visual idea: ${b.prompt || "(none)"}\nFormat: ${b.format === "drag_and_drop" ? "diagram with 4-6 NUMBERED blank label positions; students drag the correct term onto each number" : "diagram with 4-6 clickable hotspots; clicking reveals the part's name and description"}.

Return JSON: {"title":string,"image_prompt":string (describe the diagram for an image generator; for drag_and_drop say the labels are replaced by circled numbers 1..N and list what each number points to; for hotspots describe an unlabeled diagram),"parts":[{"n":number,"label":string,"description":string,"x":0-100,"y":0-100}]${b.rewrite ? `,"suggested_question_text":string,"suggested_answers":[{"text":string,"weight":100|0}],"suggested_dok":${targetDok}` : ""}}`,
    maxTokens: 1500,
  });

  const dataUrl = await aiImage(`Clean educational textbook diagram, flat vector, white background, no watermark. ${str(plan.image_prompt, b.prompt)}`);
  const image_url = await storeImage(ctx, "activity-media", `${ctx.userId}/manipulatives/${crypto.randomUUID()}.png`, dataUrl);
  const parts = arr<Record<string, unknown>>(plan.parts);

  let content: Record<string, unknown>;
  if (b.format === "drag_and_drop") {
    const items = parts.map((p) => ({ id: crypto.randomUUID(), label: str(p.label) }));
    content = {
      imageUrl: image_url,
      items,
      zones: parts.map((p, i) => ({ id: crypto.randomUUID(), label: `${num(p.n, i + 1)}`, correctItemIds: [items[i].id] })),
    };
  } else {
    content = {
      imageUrl: image_url,
      hotspots: parts.map((p, i) => ({
        id: crypto.randomUUID(),
        x: num(p.x, 20 + (i * 60) / Math.max(parts.length - 1, 1)),
        y: num(p.y, 50),
        title: str(p.label),
        content: str(p.description),
      })),
    };
  }

  const { data: act, error } = await ctx.supabase.from("h5p_activities")
    .insert({ user_id: ctx.userId, title: str(plan.title, `Manipulative: ${b.question_text.slice(0, 60)}`), activity_type: b.format, content })
    .select("id").single();
  if (error) throw new HttpError(500, error.message);

  result.image_url = image_url;
  result.activity_id = act.id;
  result.activity_type = b.format;
  if (b.rewrite) {
    result.suggested_question_text = str(plan.suggested_question_text);
    result.suggested_answers = plan.suggested_answers;
    result.suggested_dok = num(plan.suggested_dok, targetDok);
  }
  return json(result);
});
