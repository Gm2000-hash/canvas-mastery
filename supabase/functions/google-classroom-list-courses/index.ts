// Lists the Google Classroom courses the teacher teaches. Output: { courses: [{id, name, section, state, link}] }
import { corsHeaders, errorResponse, gapiList, getAccessToken, json, requireUser } from "../_shared/googleAuth.ts";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  try {
    const { teacherId, admin } = await requireUser(req);
    const token = await getAccessToken(admin, teacherId);
    const list = await gapiList<any>(token, "https://classroom.googleapis.com/v1/courses?teacherId=me&courseStates=ACTIVE&courseStates=ARCHIVED&courseStates=PROVISIONED", "courses");
    const courses = list.map((c) => ({
      id: String(c.id), name: String(c.name ?? "Untitled"), section: c.section ?? null, state: c.courseState ?? null, link: c.alternateLink ?? null,
    })).sort((a, b) => (a.state === "ACTIVE" ? -1 : 1) - (b.state === "ACTIVE" ? -1 : 1) || a.name.localeCompare(b.name));
    return json({ courses });
  } catch (e) {
    return errorResponse(e);
  }
});
