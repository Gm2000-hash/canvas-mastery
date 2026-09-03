// Curriculum suite: generate a book cover. Input: { prompt, book_title } Output: { image: base64 data URL }
import { z } from "https://esm.sh/zod@3.23.8";
import { aiImage, json, readBody, serve, HttpError } from "../_shared/curriculum-ai.ts";

const Body = z.object({ prompt: z.string().min(1).max(1500), book_title: z.string().max(300).default("") });

serve(async (req) => {
  const parsed = Body.safeParse(await readBody(req));
  if (!parsed.success) throw new HttpError(400, JSON.stringify(parsed.error.flatten().fieldErrors));
  const { prompt, book_title } = parsed.data;
  const image = await aiImage(
    `Book cover illustration, portrait orientation (3:4), professional educational publishing style, rich color, strong focal image, room at the top for a title. ${book_title ? `The book is titled "${book_title}". ` : ""}${prompt}. Do not render any text or letters.`,
  );
  return json({ image });
});
