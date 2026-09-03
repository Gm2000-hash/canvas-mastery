// Curriculum suite: tag free-text items with standards.
// Input: { questions: [{id, question_text}], framework: "ngss"|"idaho", subject?, grade?, keyTermsMap?, standardsList? }
// Output: { tags: [{ id, question_id, standards: [{code, description, matched_terms}] }] }
import { json, readBody, serve, HttpError } from "../_shared/curriculum-ai.ts";
import { Body, tag } from "../_shared/standardsTag.ts";

serve(async (req, ctx) => {
  const parsed = Body.safeParse(await readBody(req));
  if (!parsed.success) throw new HttpError(400, JSON.stringify(parsed.error.flatten().fieldErrors));
  return json({ tags: await tag(ctx, parsed.data) });
});
