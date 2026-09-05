// Generates the image for one textbook figure from its illustrator brief.
// Input: { description, caption? }  Output: { image_url }
import { z } from "https://esm.sh/zod@3.23.8";
import { aiImage, json, readBody, serve, storeImage, HttpError } from "../_shared/curriculum-ai.ts";

const Body = z.object({
  description: z.string().min(5).max(2000),
  caption: z.string().max(500).optional(),
});

serve(async (req, ctx) => {
  const parsed = Body.safeParse(await readBody(req));
  if (!parsed.success) throw new HttpError(400, JSON.stringify(parsed.error.flatten().fieldErrors));
  const b = parsed.data;
  const dataUrl = await aiImage(`Textbook figure for a grade 6-12 science/humanities chapter. Clean educational illustration or labeled diagram, flat vector style, white background, accurate, no watermark, minimal text. ${b.description}${b.caption ? ` The figure should show: ${b.caption}` : ""}`);
  const image_url = await storeImage(ctx, "activity-media", `${ctx.userId}/chapter-figures/${crypto.randomUUID()}.png`, dataUrl);
  return json({ image_url });
});
