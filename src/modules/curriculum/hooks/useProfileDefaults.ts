import { useProfile, SUBJECT_OPTIONS } from "@/modules/curriculum/config/profile";
import { ALL_IDAHO_STANDARDS } from "@/modules/curriculum/lib/idaho-standards-data";

/**
 * Returns smart defaults derived from the user's profile preferences.
 */
export function useProfileDefaults() {
  const { profile } = useProfile();

  const subjects = profile?.subjects ?? [];
  const grades = profile?.grade_levels ?? [];

  // Determine default framework: if user teaches Science, default to NGSS; otherwise Idaho
  const hasScience = subjects.includes("Science");
  const hasIdahoSubjects = subjects.some(s => s !== "Science");
  const defaultFramework: "ngss" | "idaho" = hasIdahoSubjects ? "idaho" : hasScience ? "ngss" : "idaho";

  // Compute the best default Idaho grade filter (e.g. "ELA|6")
  const idahoSubjects = subjects.filter(s => s !== "Science");
  let defaultIdahoFilter = "all";
  if (idahoSubjects.length > 0 && grades.length > 0) {
    // Pick first matching subject+grade combo that exists in our data
    for (const subj of idahoSubjects) {
      for (const grade of grades) {
        const match = ALL_IDAHO_STANDARDS.find(gs => gs.subject === subj && gs.grade === grade);
        if (match) {
          defaultIdahoFilter = `${subj}|${grade}`;
          break;
        }
      }
      if (defaultIdahoFilter !== "all") break;
    }
  }

  // Map profile grade to lesson planner format (e.g. "7" → "7th Grade")
  const gradeToLabel = (g: string) => {
    const num = parseInt(g);
    if (isNaN(num)) return "";
    const suffix = num === 1 ? "st" : num === 2 ? "nd" : num === 3 ? "rd" : "th";
    return `${num}${suffix} Grade`;
  };

  const defaultGradeLevel = grades.length === 1
    ? gradeToLabel(grades[0])
    : grades.length > 1
      ? `${gradeToLabel(grades[0])}`
      : "";

  // Map subjects to discipline for lesson planner
  const subjectToDiscipline: Record<string, string> = {
    "Science": "Life Science",
    "Careers": "Careers",
  };
  const defaultDiscipline = subjects.length > 0 ? (subjectToDiscipline[subjects[0]] || "") : "";

  return {
    subjects,
    grades,
    defaultFramework,
    defaultIdahoFilter,
    defaultGradeLevel,
    defaultDiscipline,
  };
}
