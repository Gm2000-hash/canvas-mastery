// Curriculum suite: suggest an image prompt for a question, or generate the diagram image.
// mode "suggest_prompt" -> { suggested_prompt }
// default -> { image_url }
import { z } from "https://esm.sh/zod@3.23.8";
import { aiImage, aiJson, json, readBody, serve, storeImage, str, HttpError } from "../_shared/curriculum-ai.ts";

const Body = z.object({
  mode: z.literal("suggest_prompt").optional(),
  prompt: z.string().max(2000).optional(),
  question_text: z.string().max(4000),
  question_type: z.string().max(60).default("multiple_choice_question"),
  standard_code: z.string().max(60).optional(),
  standard_description: z.string().max(2000).optional(),
});

serve(async (req, ctx) => {
  const parsed = Body.safeParse(await readBody(req));
  if (!parsed.success) throw new HttpError(400, JSON.stringify(parsed.error.flatten().fieldErrors));
  const b = parsed.data;

  if (b.mode === "suggest_prompt") {
    const out = await aiJson<{ suggested_prompt: string }>({
      system: "You write concise prompts for an image generator that produces clean educational diagrams. Respond with one valid JSON object only.",
      user: `Question (${b.question_type}): ${b.question_text}${b.standard_code ? `\nStandard ${b.standard_code}: ${b.standard_description ?? ""}` : ""}\n\nWrite ONE prompt (40-80 words) for a labeled, textbook-style scientific diagram or illustration that would help students answer this question WITHOUT revealing the answer. Specify style: flat vector, white background, clear labels, no decorative text. Return JSON: {"suggested_prompt":string}`,
      temperature: 0.5,
      maxTokens: 400,
    });
    return json({ suggested_prompt: str(out.suggested_prompt) });
  }

  if (!b.prompt) throw new HttpError(400, "prompt is required");
  const dataUrl = await aiImage(`Educational textbook diagram, flat vector style, white background, clearly labeled, no watermark. ${b.prompt}`);
  const image_url = await storeImage(ctx, "activity-media", `${ctx.userId}/question-images/${crypto.randomUUID()}.png`, dataUrl);
  return json({ image_url });
});
