// Legacy NGSS-only tagger: forwards to the shared standards-tagger logic with framework "ngss".
import { z } from "https://esm.sh/zod@3.23.8";
import { json, readBody, serve, HttpError } from "../_shared/curriculum-ai.ts";
import { tag } from "../_shared/standardsTag.ts";

const Body = z.object({
  questions: z.array(z.object({ id: z.union([z.number(), z.string()]), question_text: z.string().max(6000) })).min(1).max(25),
});

serve(async (req, ctx) => {
  const parsed = Body.safeParse(await readBody(req));
  if (!parsed.success) throw new HttpError(400, JSON.stringify(parsed.error.flatten().fieldErrors));
  const tags = await tag(ctx, { questions: parsed.data.questions, framework: "ngss" });
  return json({ tags: tags.map((t) => ({ question_id: t.question_id, standards: t.standards.map((s) => ({ code: (s as {code:string}).code, description: (s as {description:string}).description })) })) });
});
