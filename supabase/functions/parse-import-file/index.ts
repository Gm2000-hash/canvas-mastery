// Curriculum suite: parse an uploaded document (docx/pptx/xlsx/pdf/txt/md/csv) into lesson drafts.
// Multipart form field: file. Output: { lessons: ParsedLesson[] }
import { aiJson, arr, json, serve, HttpError } from "../_shared/curriculum-ai.ts";
import { extractLessonsFromText, extractOfficeText } from "../_shared/extractLessons.ts";

const MAX = 10 * 1024 * 1024;

serve(async (req) => {
  const form = await req.formData().catch(() => null);
  const file = form?.get("file");
  if (!(file instanceof File)) throw new HttpError(400, "Upload a file in the 'file' field.");
  if (file.size > MAX) throw new HttpError(400, "File is larger than 10MB.");
  const ext = (file.name.split(".").pop() ?? "").toLowerCase();
  const bytes = new Uint8Array(await file.arrayBuffer());

  let text = "";
  if (["txt", "md", "csv"].includes(ext)) text = new TextDecoder().decode(bytes);
  else if (["docx", "pptx", "xlsx"].includes(ext)) text = await extractOfficeText(bytes, ext);
  else if (ext === "pdf") {
    // Let the model read the PDF directly (multimodal file input).
    const b64 = btoa(String.fromCharCode(...bytes.subarray(0, 4 * 1024 * 1024)));
    const out = await aiJson<{ text: string }>({
      system: "You transcribe documents faithfully. Respond with one valid JSON object only.",
      user: "",
      messages: [{
        role: "user",
        content: [
          { type: "text", text: `Transcribe all lesson-relevant text from this PDF (headings, objectives, steps, materials, assessments). Return JSON: {"text":string}` },
          { type: "file", file: { filename: file.name, file_data: `data:application/pdf;base64,${b64}` } },
        ],
      }],
      temperature: 0,
      maxTokens: 8000,
    });
    text = String(out.text ?? "");
  } else throw new HttpError(400, `Unsupported file type .${ext}`);

  const lessons = await extractLessonsFromText(text, file.name);
  if (!lessons.length) return json({ lessons: [], error: "No lesson content could be extracted from this file." }, 422);
  return json({ lessons: arr(lessons) });
});
