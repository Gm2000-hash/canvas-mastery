/**
 * Idaho First Steps: Understanding the World of Work through CTE
 * Standards data extracted from official IDCTE document.
 * https://cte.idaho.gov/wp-content/uploads/2023/07/Website-First-Steps-Standards-FINAL.pdf
 *
 * Applicable to grades 7–8. Uses "Domain X.Y.Z" coding convention.
 */

import type { IdahoGradeStandards, IdahoStandard } from "./idaho-standards-data";

const CAREERS_STANDARDS: IdahoStandard[] = [
  // ── Domain 1: Self-Evaluation ──
  { code: "Domain 1.1.A", description: "Take a personality inventory.", category: "essential" },
  { code: "Domain 1.1.B", description: "Document a reflection of the personality inventory results.", category: "essential" },
  { code: "Domain 1.2.A", description: "Use multiple methods to identify personal interests.", category: "essential" },
  { code: "Domain 1.2.B", description: "Document a reflection of the interest identification results.", category: "essential" },
  { code: "Domain 1.3.A", description: "Summarize personal importance of family and other relationships as they relate to school/work.", category: "essential" },
  { code: "Domain 1.3.B", description: "Assess desired lifestyle and associated cost.", category: "essential" },
  { code: "Domain 1.3.C", description: "Relate the importance of health and wellness to school/work.", category: "essential" },
  { code: "Domain 1.3.D", description: "Document a reflection of the values identification results.", category: "essential" },
  { code: "Domain 1.4.A", description: "Critical Thinking and Problem-Solving: Recognize and analyze a problem; identify and evaluate potential solutions and resources; use sound reasoning to choose a solution; implement the solution and evaluate the outcome.", category: "essential" },
  { code: "Domain 1.4.B", description: "Work Ethic: Define work ethic and explain its importance; demonstrate diligence, dependability, responsibility, and accountability in the workplace.", category: "essential" },
  { code: "Domain 1.4.C", description: "Information Security: Evaluate presence and risk on social media; follow protocols to maintain security of information, computers, networks, and facilities; demonstrate basic internet and email safety.", category: "essential" },
  { code: "Domain 1.4.D", description: "Communication: Use verbal, nonverbal, and active listening skills effectively; apply knowledge of communication skills to a career context.", category: "essential" },
  { code: "Domain 1.4.E", description: "Teamwork: Identify teamwork skills; describe the importance of teamwork in the workplace; apply teamwork skills in a collaborative setting.", category: "essential" },

  // ── Domain 2: Career Exploration ──
  { code: "Domain 2.1.A", description: "Express the purpose and value of work.", category: "essential" },
  { code: "Domain 2.1.B", description: "Summarize how one researches and chooses a career interest.", category: "essential" },
  { code: "Domain 2.1.C", description: "Use results of self-evaluation to identify related career clusters and occupations.", category: "essential" },
  { code: "Domain 2.1.D", description: "Explore multiple career clusters and occupations of interest (e.g., work site visits, speakers, case studies, shadowing, or community service).", category: "essential" },
  { code: "Domain 2.1.E", description: "Choose a cluster or occupation; research the education or training required, including program of study, labor market information, and wage compared to Idaho's living wage.", category: "essential" },
  { code: "Domain 2.2.A", description: "Describe how personal, career, and educational choices impact major life decisions.", category: "essential" },
  { code: "Domain 2.2.B", description: "Describe how your personal choices will affect workplace, school, and community.", category: "essential" },
  { code: "Domain 2.2.C", description: "Discuss the need for continuous career planning.", category: "essential" },

  // ── Domain 3: Future Planning ──
  { code: "Domain 3.1.A", description: "Having identified a career interest and program of study, research institutions offering the program according to personal preferences.", category: "essential" },
  { code: "Domain 3.1.B", description: "Research helpful high school courses and experiences.", category: "essential" },
  { code: "Domain 3.1.C", description: "Utilize a goal setting process to develop short-term and long-term personal, education, and career goals.", category: "essential" },
  { code: "Domain 3.1.D", description: "Manage time and resources and track progress throughout the term.", category: "essential" },
  { code: "Domain 3.2.A", description: "Explore available CTE programs.", category: "essential" },
  { code: "Domain 3.2.B", description: "Research the local CTSO options and benefits for participation therein.", category: "essential" },
  { code: "Domain 3.2.C", description: "Examine the benefits of participating in school and community activities.", category: "essential" },
  { code: "Domain 3.2.D", description: "Examine academic and other high school pathways.", category: "essential" },
  { code: "Domain 3.3.A", description: "Create a Career Pathway Plan (Four-Year Plan) aligned with personal, educational, and career goals.", category: "essential" },
  { code: "Domain 3.3.B", description: "Apply Career Pathway Plan to selection of high school courses and pathways.", category: "essential" },
];

export const CAREERS_7: IdahoGradeStandards = {
  subject: "Careers",
  grade: "7",
  label: "Careers Grade 7 (First Steps CTE)",
  standards: CAREERS_STANDARDS,
};

export const CAREERS_8: IdahoGradeStandards = {
  subject: "Careers",
  grade: "8",
  label: "Careers Grade 8 (First Steps CTE)",
  standards: CAREERS_STANDARDS,
};
