// Shared framework metadata used by both the UI and the edge functions.
// "framework" identifies which standards system a teacher follows for a given
// (subject, grade). It lets the same state/subject/grade hold multiple
// libraries side-by-side (e.g. an Idaho science teacher who follows NGSS
// nationally as well as Idaho-specific standards).

export type FrameworkId =
  | "STATE"
  | "NGSS"
  | "CCSS_MATH"
  | "CCSS_ELA"
  | "C3_SS"
  | "AP"
  | "IB"
  | "CUSTOM";

export type Framework = {
  id: FrameworkId;
  label: string;
  shortLabel: string;
  description: string;
  // If true, the framework is national/global and the "state" picker becomes
  // optional context (e.g. NGSS doesn't depend on the state).
  national: boolean;
  // Subjects this framework typically covers. UI uses this to filter.
  subjects?: string[];
  // Custom libraries can't be auto-seeded.
  seedable: boolean;
};

export const FRAMEWORKS: Framework[] = [
  {
    id: "STATE",
    label: "State standards",
    shortLabel: "State",
    description: "Your state's official content standards.",
    national: false,
    seedable: true,
  },
  {
    id: "NGSS",
    label: "Next Generation Science Standards (NGSS)",
    shortLabel: "NGSS",
    description: "National K-12 science framework. Codes like MS-PS1-1, HS-LS3-2.",
    national: true,
    subjects: ["Science"],
    seedable: true,
  },
  {
    id: "CCSS_MATH",
    label: "Common Core Math (CCSS-M)",
    shortLabel: "CCSS-M",
    description: "Common Core State Standards for Mathematics.",
    national: true,
    subjects: ["Math"],
    seedable: true,
  },
  {
    id: "CCSS_ELA",
    label: "Common Core ELA (CCSS-ELA)",
    shortLabel: "CCSS-ELA",
    description: "Common Core State Standards for English Language Arts & Literacy.",
    national: true,
    subjects: ["ELA"],
    seedable: true,
  },
  {
    id: "C3_SS",
    label: "C3 Social Studies Framework",
    shortLabel: "C3",
    description: "College, Career, and Civic Life framework for Social Studies.",
    national: true,
    subjects: ["Social Studies"],
    seedable: true,
  },
  {
    id: "AP",
    label: "AP Course Frameworks",
    shortLabel: "AP",
    description: "College Board Advanced Placement learning objectives.",
    national: true,
    seedable: true,
  },
  {
    id: "IB",
    label: "IB Subject Guides",
    shortLabel: "IB",
    description: "International Baccalaureate subject guides.",
    national: true,
    seedable: true,
  },
  {
    id: "CUSTOM",
    label: "Custom (district / personal)",
    shortLabel: "Custom",
    description: "Add standards by hand on the Standards page.",
    national: false,
    seedable: false,
  },
];

export function getFramework(id?: string | null): Framework {
  return FRAMEWORKS.find((f) => f.id === id) ?? FRAMEWORKS[0];
}

/**
 * Default framework when a teacher hasn't explicitly chosen one:
 * Science follows NGSS; every other subject follows the state's standards.
 * Mirrors public.default_framework_for_subject() in the database.
 */
export function defaultFrameworkForSubject(subject?: string | null): FrameworkId {
  return subject === "Science" ? "NGSS" : "STATE";
}

export const SUBJECTS = [
  "Math",
  "ELA",
  "Science",
  "Social Studies",
  "Health/PE",
  "World Languages",
  "Visual Arts",
  "Music",
  "CTE",
  "Computer Science",
];

export const GRADES = [
  "K", "1", "2", "3", "4", "5", "6", "7", "8", "9", "10", "11", "12", "HS",
];

export const STATES = [
  "AL","AK","AZ","AR","CA","CO","CT","DE","FL","GA","HI","ID","IL","IN","IA",
  "KS","KY","LA","ME","MD","MA","MI","MN","MS","MO","MT","NE","NV","NH","NJ",
  "NM","NY","NC","ND","OH","OK","OR","PA","RI","SC","SD","TN","TX","UT","VT",
  "VA","WA","WV","WI","WY","DC",
];
