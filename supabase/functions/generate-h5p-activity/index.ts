// Curriculum suite: generate interactive (H5P-style) activity content from a standard, lesson, lesson plan or book.
// Input: { activityType, sourceType, sourceId? | standardCode? + standardDescription? }
// Output: { content }
import { z } from "https://esm.sh/zod@3.23.8";
import { aiJson, arr, json, loadSourceContext, readBody, serve, HttpError } from "../_shared/curriculum-ai.ts";

const TYPES = [
  "fill_in_blanks", "drag_the_words", "accordion", "timeline", "multiple_choice", "true_false", "single_choice_set", "mark_the_words",
  "essay", "summary", "dialog_cards", "flashcards", "memory_game", "arithmetic_quiz", "drag_and_drop", "question_set", "personality_quiz",
  "game_map", "column", "course_presentation", "documentation_tool", "image_hotspots", "interactive_book", "interactive_video",
  "virtual_tour", "crossword", "agamotto",
] as const;

const Body = z.object({
  activityType: z.enum(TYPES),
  sourceType: z.string().max(40),
  sourceId: z.string().uuid().optional(),
  standardCode: z.string().max(60).optional(),
  standardDescription: z.string().max(3000).optional(),
});

// JSON shape + authoring guidance per type. `id` fields are filled server-side.
const SPEC: Record<string, { shape: string; guide: string }> = {
  fill_in_blanks: { shape: `{"text":string,"acceptAlternatives":true}`, guide: "Write 5-8 sentences; wrap each blank's answer in *asterisks* like 'Plants use *chlorophyll* to capture light.' One blank per sentence." },
  drag_the_words: { shape: `{"text":string,"showInstantFeedback":true}`, guide: "Write a 5-8 sentence paragraph; mark 6-10 draggable words with *asterisks*." },
  accordion: { shape: `{"panels":[{"title":string,"content":string}]}`, guide: "4-6 panels; content is 2-4 sentences of HTML." },
  timeline: { shape: `{"headline":string,"events":[{"date":string,"title":string,"description":string}]}`, guide: "5-8 chronological events (or process steps with 'Step 1'... as dates)." },
  multiple_choice: { shape: `{"question":string,"options":[{"text":string,"correct":boolean}],"multiAnswer":false}`, guide: "One question, 4 options, exactly one correct (multiAnswer false)." },
  true_false: { shape: `{"statement":string,"correctAnswer":boolean,"feedback":string}`, guide: "One nuanced statement with feedback explaining why." },
  single_choice_set: { shape: `{"questions":[{"question":string,"options":[string],"correctIndex":number}]}`, guide: "5-8 questions, 3-4 options each, correctIndex is 0-based." },
  mark_the_words: { shape: `{"text":string}`, guide: "A paragraph of 6-10 sentences; wrap each word students should mark in *asterisks* (e.g. all the nouns that are examples of the concept)." },
  essay: { shape: `{"question":string,"keywords":[{"text":string,"caseSensitive":false}],"maxWords":number}`, guide: "One open-ended prompt with 6-10 keywords a strong answer should contain." },
  summary: { shape: `{"intro":string,"groups":[{"statements":[string],"correctIndex":number}]}`, guide: "4-6 groups; each has 3 statements where exactly one (correctIndex) is the accurate summary statement." },
  dialog_cards: { shape: `{"cards":[{"front":string,"back":string}]}`, guide: "8-12 cards: front is a question/term, back the answer/explanation." },
  flashcards: { shape: `{"cards":[{"term":string,"definition":string}]}`, guide: "10-15 vocabulary cards." },
  memory_game: { shape: `{"pairs":[{"cardA":string,"cardB":string}]}`, guide: "6-8 matching pairs (term ↔ definition or cause ↔ effect); keep each side under 8 words." },
  arithmetic_quiz: { shape: `{"operations":["add","subtract","multiply","divide"],"maxNumber":number,"questionCount":number,"timeLimit":number}`, guide: "Pick operations and difficulty suited to the grade; timeLimit in seconds." },
  drag_and_drop: { shape: `{"items":[{"label":string}],"zones":[{"label":string,"correctItemLabels":[string]}]}`, guide: "3-5 category zones and 8-12 items; each item belongs to exactly one zone (reference by label)." },
  question_set: { shape: `{"questions":[{"type":"multiple_choice"|"true_false","content":object}],"passPercentage":70}`, guide: "6-8 mixed questions; multiple_choice content = {question,options:[{text,correct}],multiAnswer:false}; true_false content = {statement,correctAnswer,feedback}." },
  personality_quiz: { shape: `{"profiles":[{"name":string,"description":string}],"questions":[{"question":string,"options":[{"text":string,"profileScores":{"<profile name>":number}}]}]}`, guide: "3-4 profiles (e.g. scientist roles or concept 'types'), 6-8 questions with 3-4 options each; profileScores keys are profile names." },
  game_map: { shape: `{"title":string,"stages":[{"label":string,"x":0-100,"y":0-100,"type":"multiple_choice"|"true_false","content":object}]}`, guide: "5-7 stages laid out along a winding path (x,y percent), each a question (see question_set content shapes)." },
  column: { shape: `{"sections":[{"title":string,"content":string}]}`, guide: "4-6 sections of HTML content forming a mini-lesson." },
  course_presentation: { shape: `{"slides":[{"title":string,"content":string,"notes":string}]}`, guide: "8-12 slides; content is short HTML bullets; notes are speaker notes." },
  documentation_tool: { shape: `{"title":string,"fields":[{"label":string,"type":"text"|"textarea"|"number","required":boolean}]}`, guide: "A lab/report template with 6-10 fields (hypothesis, materials, data, conclusion...)." },
  image_hotspots: { shape: `{"imageUrl":"","hotspots":[{"x":0-100,"y":0-100,"title":string,"content":string}]}`, guide: "5-7 hotspots describing parts of a diagram the teacher will upload (leave imageUrl empty); spread x/y across the image." },
  interactive_book: { shape: `{"title":string,"chapters":[{"title":string,"content":string}]}`, guide: "4-6 chapters, each 3-5 paragraphs of HTML." },
  interactive_video: { shape: `{"videoUrl":"","interactions":[{"timestamp":number,"type":"label"|"question"|"link","content":string}]}`, guide: "Leave videoUrl empty; propose 6-8 timestamped interactions (seconds) for a typical 5-8 minute explainer video on this topic." },
  virtual_tour: { shape: `{"title":string,"scenes":[{"title":string,"description":string}]}`, guide: "5-7 scenes/stations, each with a vivid 3-4 sentence description and a guiding question." },
  crossword: { shape: `{"title":string,"words":[{"word":string,"clue":string,"direction":"across"|"down"}]}`, guide: "10-14 single words (letters only, no spaces) with concise clues; alternate across/down." },
  agamotto: { shape: `{"images":[{"imageUrl":"","label":string,"description":string}]}`, guide: "4-6 sequential frames (e.g. stages of a process); leave imageUrl empty." },
};

const uid = () => crypto.randomUUID();
const withIds = (xs: unknown): Array<Record<string, unknown> & { id: string }> => arr<Record<string, unknown>>(xs).map((x) => ({ ...x, id: uid() }));

/** Add ids / fix cross references so the content matches the client types exactly. */
function normalize(type: string, c: Record<string, unknown>): Record<string, unknown> {
  switch (type) {
    case "accordion": return { panels: withIds(c.panels) };
    case "timeline": return { headline: String(c.headline ?? ""), events: withIds(c.events) };
    case "multiple_choice": return { question: String(c.question ?? ""), options: withIds(c.options), multiAnswer: Boolean(c.multiAnswer) };
    case "single_choice_set": return { questions: withIds(c.questions) };
    case "summary": return { intro: String(c.intro ?? ""), groups: withIds(c.groups) };
    case "dialog_cards": return { cards: withIds(c.cards) };
    case "flashcards": return { cards: withIds(c.cards) };
    case "memory_game": return { pairs: withIds(c.pairs) };
    case "drag_and_drop": {
      const items = withIds(c.items);
      const zones = arr<Record<string, unknown>>(c.zones).map((z) => ({
        id: uid(),
        label: String(z.label ?? ""),
        correctItemIds: arr<string>(z.correctItemLabels ?? z.correctItemIds)
          .map((l) => items.find((i) => String(i.label).toLowerCase() === String(l).toLowerCase())?.id)
          .filter(Boolean),
      }));
      return { items, zones };
    }
    case "question_set":
      return {
        questions: arr<Record<string, unknown>>(c.questions).map((q) => ({
          id: uid(), type: q.type, content: normalize(String(q.type), (q.content ?? {}) as Record<string, unknown>),
        })),
        passPercentage: Number(c.passPercentage) || 70,
      };
    case "personality_quiz": {
      const profiles = withIds(c.profiles);
      const byName = new Map(profiles.map((p) => [String(p.name).toLowerCase(), p.id]));
      return {
        profiles,
        questions: arr<Record<string, unknown>>(c.questions).map((q) => ({
          id: uid(), question: q.question,
          options: arr<Record<string, unknown>>(q.options).map((o) => ({
            text: o.text,
            profileScores: Object.fromEntries(Object.entries((o.profileScores ?? {}) as Record<string, number>)
              .map(([k, v]) => [byName.get(k.toLowerCase()) ?? k, Number(v) || 0])),
          })),
        })),
      };
    }
    case "game_map":
      return {
        title: String(c.title ?? ""),
        stages: arr<Record<string, unknown>>(c.stages).map((s) => ({
          id: uid(), label: s.label, x: Number(s.x) || 50, y: Number(s.y) || 50, type: s.type,
          content: normalize(String(s.type), (s.content ?? {}) as Record<string, unknown>),
        })),
      };
    case "column": return { sections: withIds(c.sections) };
    case "course_presentation": return { slides: withIds(c.slides) };
    case "documentation_tool": return { title: String(c.title ?? ""), fields: withIds(c.fields) };
    case "image_hotspots": return { imageUrl: String(c.imageUrl ?? ""), hotspots: withIds(c.hotspots) };
    case "interactive_book": return { title: String(c.title ?? ""), chapters: withIds(c.chapters) };
    case "interactive_video": return { videoUrl: String(c.videoUrl ?? ""), interactions: withIds(c.interactions) };
    case "virtual_tour": return { title: String(c.title ?? ""), scenes: withIds(c.scenes) };
    case "crossword": return { title: String(c.title ?? ""), words: withIds(c.words).map((w) => ({ ...w, word: String(w.word).replace(/[^a-z]/gi, "").toUpperCase() })) };
    case "agamotto": return { images: withIds(c.images) };
    default: return c; // fill_in_blanks, drag_the_words, true_false, mark_the_words, essay, arithmetic_quiz
  }
}

serve(async (req, ctx) => {
  const parsed = Body.safeParse(await readBody(req));
  if (!parsed.success) throw new HttpError(400, JSON.stringify(parsed.error.flatten().fieldErrors));
  const b = parsed.data;
  const source = await loadSourceContext(ctx, b.sourceType, b.sourceId, b.standardCode, b.standardDescription);
  const spec = SPEC[b.activityType];

  const raw = await aiJson<Record<string, unknown>>({
    system: "You author interactive classroom activities for grades 6-12. Content must be accurate, grade-appropriate and directly grounded in the source. Respond with one valid JSON object only — no markdown, no ids.",
    user: `SOURCE MATERIAL:\n${source}\n\nCreate a "${b.activityType.replace(/_/g, " ")}" activity.\nGuidance: ${spec.guide}\nReturn JSON exactly matching this shape: ${spec.shape}`,
    maxTokens: 5000,
  });
  const content = normalize(b.activityType, raw);
  return json({ content });
});
