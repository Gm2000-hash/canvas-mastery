// Scraped from https://nextsteps.idaho.gov/curriculum (51 lessons)
export interface NextStepsLesson {
  title: string;
  estimatedTime: string;
  grades: string[];
  standard?: string;
  description: string;
  category: "Self-Evaluation" | "Career Exploration" | "Future Planning";
}

export const NEXTSTEPS_LESSONS: NextStepsLesson[] = [
  // --- Self-Evaluation (Domain 1.x) ---
  { title: "Personality Type: What Makes Me Unique?", estimatedTime: "Two 45 to 60-minute class periods", grades: ["7th", "8th"], standard: "Domain 1.1.A-B", description: "This lesson will provide students with tools to identify their personality and reflect on what makes them unique.", category: "Self-Evaluation" },
  { title: "What is Important to Me", estimatedTime: "One 45-60-minute class period", grades: ["7th", "8th"], standard: "Domain 1.2.A-B", description: "Students will explore different types of values and determine which ones are most important to them.", category: "Self-Evaluation" },
  { title: "How Does Health Impact My Work?", estimatedTime: "One 45-60-minute class period", grades: ["7th", "8th"], standard: "Domain 1.3.C-D", description: "This lesson will teach students about the components of physical and mental health related to school and career success.", category: "Self-Evaluation" },
  { title: "What Am I Good At", estimatedTime: "One 45-minute class period", grades: ["7th", "8th"], standard: "Domain 1.4.B.i", description: "This lesson will teach students what work ethic is and why it's important in the workplace.", category: "Self-Evaluation" },
  { title: "Evaluating My Work Ethic", estimatedTime: "One 45-60-minute class period", grades: ["7th", "8th"], standard: "Domain 1.4.B.ii-vii", description: "This lesson will help students apply their understanding of work ethic to realistic and familiar scenarios.", category: "Self-Evaluation" },
  { title: "How Important is My Social Media?", estimatedTime: "Two 45-minute class periods", grades: ["7th", "8th"], standard: "Domain 1.4.C.i-ii", description: "This lesson will have students make observations about their own social media usage and the risks involved.", category: "Self-Evaluation" },
  { title: "Creating a Professional Online Presence", estimatedTime: "Two 45-minute class periods", grades: ["7th", "8th"], standard: "Domain 1.4.C.iii-v", description: "This lesson will teach students the components of digital citizenship and prepare them to be responsible online.", category: "Self-Evaluation" },
  { title: "Don't Get Scammed!", estimatedTime: "One 45-60-minute class period", grades: ["7th", "8th"], standard: "Domain 1.4.C.vi-v", description: "This lesson will help students recognize signs to differentiate between a safe and unsafe email.", category: "Self-Evaluation" },

  // --- Career Exploration (Domain 2.x) ---
  { title: "Finding My Purpose In Work", estimatedTime: "Two 60 to 90-minute class periods", grades: ["7th", "8th"], standard: "Domain 2.1.A", description: "This lesson will introduce students to the purpose of work and how purpose and meaning connect to careers.", category: "Career Exploration" },
  { title: "Finding the \"U\" in Occ\"U\"pation", estimatedTime: "Two 45 to 60-minute class periods", grades: ["7th", "8th"], standard: "Domain 2.1.B-C", description: "This lesson will help students consider and understand their basic soft skills, values, and traits related to occupations.", category: "Career Exploration" },
  { title: "What Skills Will I Bring to My Career", estimatedTime: "One to two 45 to 60-minute class periods", grades: ["7th", "8th"], standard: "Domain 2.1.B-C", description: "This lesson will teach students a process for researching occupations and career interests.", category: "Career Exploration" },
  { title: "Going On a Job Hunt!", estimatedTime: "Work time over several class periods (up to one week)", grades: ["7th", "8th"], standard: "Domain 2.1.E", description: "Students will choose a career pathway to research using the results of self-evaluation activities.", category: "Career Exploration" },
  { title: "Your Choices Are Powerful!", estimatedTime: "Two 45 to 60-minute class periods", grades: ["7th", "8th"], standard: "Domain 2.2.A-C", description: "Students will evaluate how their choices have an impact on many different areas of their lives.", category: "Career Exploration" },

  // --- Future Planning (Domain 3.x) ---
  { title: "How Do I Get There?", estimatedTime: "One 45-minute class period", grades: ["8th"], standard: "Domain 3.1.A-B", description: "This lesson will help students develop a better understanding of the colleges and universities that interest them.", category: "Future Planning" },
  { title: "How Do I Balance it All?", estimatedTime: "One 45-60-minute class period", grades: ["8th"], standard: "Domain 3.1.D", description: "Students will take a self-inventory of time management skills and identify strategies for improvement.", category: "Future Planning" },
  { title: "Pursue Your Passions!", estimatedTime: "One 45-60-minute class period", grades: ["8th"], standard: "Domain 3.2.C-D", description: "This lesson will give students the opportunity to explore extracurricular pathways available in high school.", category: "Future Planning" },
  { title: "Career Pathway Plan: What is It?", estimatedTime: "Two 45 to 60-minute class periods", grades: ["8th"], standard: "Domain 3.3.A", description: "Idaho mandates the development of a parent-approved Career Pathway Plan (Four Year Plan) by eighth grade.", category: "Future Planning" },
  { title: "Career Pathway Plan: Let's Create It!", estimatedTime: "Two 45 to 60-minute class periods", grades: ["8th"], standard: "Domain 3.3.B", description: "Students will create their parent-approved Career Pathway Plan (Four Year Plan).", category: "Future Planning" },

  // --- Additional lessons (grades 8-12, no FirstSteps standard) ---
  { title: "Achieving Your Goals", estimatedTime: "90-120 minutes (can be split into two 45-60 minute lessons)", grades: ["8th"], description: "This lesson will help students identify SMART (Specific, Measurable, Attainable, Results-focused, Time-bound) goals.", category: "Future Planning" },
  { title: "Career Cluster", estimatedTime: "45-60 minutes", grades: ["8th"], description: "This lesson will help students understand the concept of career clusters and identify which ones interest them.", category: "Career Exploration" },
  { title: "Career Family Tree", estimatedTime: "15-30 minutes (homework required)", grades: ["8th"], description: "This lesson will help students look at the careers chosen by family members to gain more understanding.", category: "Career Exploration" },
  { title: "College & Career Vocabulary", estimatedTime: "45-60 minutes", grades: ["8th"], description: "This lesson will help students identify and understand vocabulary used when discussing college and career readiness.", category: "Future Planning" },
  { title: "CTE Intro", estimatedTime: "30-55 minutes", grades: ["8th"], description: "This lesson will introduce students to Idaho Career & Technical Education (CTE) and the six program areas.", category: "Career Exploration" },
  { title: "Learning Styles Survey", estimatedTime: "30-45 minutes", grades: ["8th"], description: "This lesson will help students identify and recognize their own learning styles.", category: "Self-Evaluation" },
  { title: "Plan Smart Intro", estimatedTime: "45-60 minutes", grades: ["8th"], description: "This lesson will guide students through the Plan Smart tool to compare different life scenarios.", category: "Future Planning" },
  { title: "Intro to Construction Careers", estimatedTime: "45 minutes", grades: ["8th", "9th", "10th"], description: "Students will gain a new appreciation for craft professions and learn about workforce landscapes.", category: "Career Exploration" },
  { title: "Breaking Barriers", estimatedTime: "15-50 minutes", grades: ["8th", "9th", "10th", "11th", "12th"], description: "This lesson will help students identify their own barriers and strengths through exploring the stories of others.", category: "Self-Evaluation" },
  { title: "Interest Profiler", estimatedTime: "30-45 minutes", grades: ["9th"], description: "This lesson will help students discover their interests and how they relate to the world of work.", category: "Self-Evaluation" },
  { title: "Future Finder", estimatedTime: "30-45 minutes", grades: ["9th"], description: "This lesson will help students match careers based on their unique answers of skills and interests.", category: "Career Exploration" },
  { title: "Overload & Dual Credit Courses", estimatedTime: "20-30 minutes", grades: ["9th"], description: "This lesson will help students identify what overload and dual credit courses are.", category: "Future Planning" },
  { title: "Paying for College", estimatedTime: "45-60 minutes", grades: ["9th"], description: "This lesson will help students understand how to look ahead and make decisions that will help them pay for college.", category: "Future Planning" },
  { title: "Your GPA – What Does it Mean?", estimatedTime: "45-60 minutes", grades: ["9th"], description: "This lesson will help students understand how GPAs are calculated and why they are important.", category: "Future Planning" },
  { title: "Are You Career Ready?", estimatedTime: "45-60 minutes", grades: ["10th"], description: "This lesson will help students understand and self-assess six professional competencies.", category: "Self-Evaluation" },
  { title: "Plan Smart", estimatedTime: "45-60 minutes", grades: ["10th"], description: "This lesson will help sophomore students explore and plan for their futures through the Plan Smart tool.", category: "Future Planning" },
  { title: "Soft Skills", estimatedTime: "20-120 minutes (can be broken into six 20-minute lessons)", grades: ["10th"], description: "This lesson breaks down into 6 mini lessons about different soft skills important for the workplace.", category: "Self-Evaluation" },
  { title: "Your GPA", estimatedTime: "30-45 minutes", grades: ["10th", "11th"], description: "This lesson will help students analyze where they currently stand with their GPA and tips to raise it.", category: "Future Planning" },
  { title: "Brag Sheets & References", estimatedTime: "30 minutes (plus optional at-home tasks)", grades: ["11th"], description: "This lesson will help students get organized to obtain the best letters of recommendation.", category: "Future Planning" },
  { title: "High School to Career Process: Looking at Careers", estimatedTime: "45-60 minutes", grades: ["11th"], description: "This lesson will help students with looking at and choosing careers based on their interests.", category: "Career Exploration" },
  { title: "High School to Career Process: Looking at Majors", estimatedTime: "45-60 minutes", grades: ["11th"], description: "This lesson will help students with looking at and choosing a major based on their career interests.", category: "Career Exploration" },
  { title: "High School to Career Process: Looking at Schools", estimatedTime: "45-60 minutes", grades: ["11th"], description: "This lesson will help students with looking at and choosing a school based on their career and major interests.", category: "Career Exploration" },
  { title: "Keeping Up with Deadlines", estimatedTime: "45-60 minutes", grades: ["11th"], description: "This lesson will help students understand the importance of deadlines and introduce them to various tools.", category: "Future Planning" },
  { title: "Request Transcripts", estimatedTime: "30-55 minutes", grades: ["11th"], description: "This lesson will help students learn the process and importance of requesting transcripts.", category: "Future Planning" },
  { title: "Schedule & Take the ACT / SAT", estimatedTime: "30-45 minutes", grades: ["11th"], description: "This lesson will help students understand the how, what, when, and where of college entrance exams.", category: "Future Planning" },
  { title: "Work Values", estimatedTime: "30-45 minutes", grades: ["11th"], description: "This lesson will help students examine their own values and lifestyle desires.", category: "Self-Evaluation" },
  { title: "Practicing Interview Questions", estimatedTime: "30-60 minutes", grades: ["11th", "12th"], description: "This lesson will give students the opportunity to gain understanding of common interview questions.", category: "Career Exploration" },
  { title: "Resumes", estimatedTime: "30-55 minutes", grades: ["11th", "12th"], description: "This activity will help students develop a vision for how to build a strong resume.", category: "Future Planning" },
  { title: "Scholarship Tracking", estimatedTime: "55 minutes", grades: ["11th", "12th"], description: "This lesson will help students explore how to research scholarships most effectively.", category: "Future Planning" },
  { title: "FAFSA", estimatedTime: "25-45 minutes", grades: ["11th", "12th"], description: "This lesson will help students become more familiar with the basics of the FAFSA and how to complete it.", category: "Future Planning" },
  { title: "Exploring Course Catalogs", estimatedTime: "45-60 minutes", grades: ["11th", "12th"], description: "This lesson will provide students with experience using the course catalog to contemplate majors.", category: "Future Planning" },
  { title: "College Cost Estimator", estimatedTime: "30-45 minutes", grades: ["12th"], description: "This lesson will help students explore the cost of colleges/universities in Idaho.", category: "Future Planning" },
  { title: "Establishing a Strong Support System", estimatedTime: "45-60 minutes", grades: ["12th"], description: "This lesson will help students identify and recognize their current support systems.", category: "Self-Evaluation" },
];
