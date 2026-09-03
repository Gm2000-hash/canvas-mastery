/**
 * UDL Supports templates — common starting structures teachers can apply
 * to the lesson's `udl_supports` JSON. Each template is a complete, classroom-
 * ready scaffold tuned to a recognizable lesson archetype. The teacher then
 * edits placeholders to match their actual content.
 *
 * Templates intentionally include {{topic}} tokens that get replaced with the
 * lesson title at apply-time so the result feels personalized, not generic.
 */

export interface VocabularyScaffold {
  term: string;
  student_friendly: string;
  visual_cue: string;
}

export interface UdlSupportsShape {
  engagement?: {
    hook?: string;
    student_choice?: string[];
    collaboration?: string;
    sustain_effort?: string;
    self_regulation_prompt?: string;
  };
  representation?: {
    visual?: string;
    auditory?: string;
    text_supports?: string;
    vocabulary_scaffolds?: VocabularyScaffold[];
    big_idea_highlight?: string;
    background_activation?: string;
  };
  action_expression?: {
    response_modes?: string[];
    physical_action_options?: string;
    planning_scaffold?: string;
    progress_checkpoint?: string;
    flexible_assessment?: string;
  };
  reflection_prompt?: string;
}

export interface UdlTemplate {
  id: string;
  name: string;
  tagline: string;
  description: string;
  bestFor: string[];
  build: (topic: string) => UdlSupportsShape;
}

const t = (s: string, topic: string) => s.replace(/\{\{topic\}\}/g, topic || "today's topic");

export const UDL_TEMPLATES: UdlTemplate[] = [
  {
    id: "vocabulary-heavy",
    name: "Vocabulary-Heavy",
    tagline: "New academic terms front and center",
    description:
      "Use when a lesson hinges on mastering 4–8 new academic terms (intro to a unit, a science core idea, a history era).",
    bestFor: ["Unit openers", "Science core ideas", "Domain-specific vocabulary"],
    build: (topic) => ({
      engagement: {
        hook: t(
          "Display 4 mystery terms from {{topic}} on the board. Students try to guess the connection in pairs before any teaching happens — frame it as a puzzle, not a vocab list.",
          topic,
        ),
        student_choice: [
          "Pick the term you want to teach the class about",
          "Pick your study format: flashcards, concept map, or sketchnote",
          "Choose a partner or work solo for vocabulary practice",
        ],
        collaboration: t(
          "Pairs use a 'Each One Teach One' protocol — each partner is assigned 2 terms, teaches them to their partner using a kid-friendly definition + drawing, then partners quiz each other.",
          topic,
        ),
        sustain_effort: t(
          "Tier vocabulary work: Tier 1 = match term to definition, Tier 2 = use term in a sentence about {{topic}}, Tier 3 = explain how two terms connect. Give immediate verbal feedback during pair work.",
          topic,
        ),
        self_regulation_prompt:
          "Before the exit ticket: 'Which term still feels foggy? Star it on your sheet so I know to come back to it tomorrow.'",
      },
      representation: {
        visual: t(
          "Anchor chart with each term + a labeled diagram or icon. Project a Frayer model template (definition / characteristics / examples / non-examples) for {{topic}} terms.",
          topic,
        ),
        auditory: t(
          "Record a 60-second audio clip pronouncing each {{topic}} term and using it in a sentence — post in Canvas so students can replay during practice.",
          topic,
        ),
        text_supports: t(
          "Provide a vocabulary tracker handout with sentence stems: 'A ___ is ___ because ___' and 'A ___ is different from a ___ because ___' for {{topic}} terms.",
          topic,
        ),
        vocabulary_scaffolds: [
          { term: "[Term 1]", student_friendly: "In simple words…", visual_cue: "Picture / gesture / analogy" },
          { term: "[Term 2]", student_friendly: "In simple words…", visual_cue: "Picture / gesture / analogy" },
          { term: "[Term 3]", student_friendly: "In simple words…", visual_cue: "Picture / gesture / analogy" },
          { term: "[Term 4]", student_friendly: "In simple words…", visual_cue: "Picture / gesture / analogy" },
        ],
        big_idea_highlight: t(
          "By the end of class, students can use the {{topic}} terms accurately to explain the core idea of the lesson in their own words.",
          topic,
        ),
        background_activation: t(
          "2-minute quick-write: 'What do you already know — or think you know — about {{topic}}? It's okay to be wrong.' Read 2–3 aloud anonymously.",
          topic,
        ),
      },
      action_expression: {
        response_modes: ["Sketch a labeled diagram", "Write a 3-sentence explanation", "Record a voice memo using the terms"],
        physical_action_options: t(
          "Term-sort gallery walk: post {{topic}} terms around the room with definitions in a separate stack — students physically match them in pairs.",
          topic,
        ),
        planning_scaffold:
          "Frayer-model graphic organizer with checkboxes — students self-check: 'Did I include a definition, characteristics, an example, AND a non-example?'",
        progress_checkpoint:
          "Mid-class: thumbs up / sideways / down on each term as I name it. Anyone with a sideways or down gets a sentence stem partner check.",
        flexible_assessment: t(
          "Choose one: (a) write a paragraph using all 4 {{topic}} terms, (b) record a 90-second voice explanation, or (c) draw a labeled concept map connecting the terms.",
          topic,
        ),
      },
      reflection_prompt: t(
        "Which {{topic}} term clicked for you today, and which one do you still need to wrestle with? Why?",
        topic,
      ),
    }),
  },
  {
    id: "project-based",
    name: "Project-Based",
    tagline: "Multi-day inquiry with a tangible product",
    description:
      "Use when students are building, designing, modeling, or creating something over one or more class periods toward a real product.",
    bestFor: ["Design challenges", "Model-building", "Multi-day investigations"],
    build: (topic) => ({
      engagement: {
        hook: t(
          "Open with a real-world artifact or short clip showing the problem {{topic}} solves in the wild. End with: 'Your job this week is to design your own solution.'",
          topic,
        ),
        student_choice: [
          "Choose your project medium: physical model, digital prototype, or annotated diagram",
          "Pick your team or work as a designer-of-one",
          "Choose which constraint you'll prioritize (cost, durability, ease-of-use, etc.)",
        ],
        collaboration: t(
          "Design teams of 3 with rotating roles: Lead Designer (drives decisions), Materials Manager (tracks resources), Documenter (captures process for {{topic}}). Roles rotate each work day.",
          topic,
        ),
        sustain_effort: t(
          "Mid-project critique protocol — teams swap models and give 'I like / I wonder / What if' feedback. Display milestone checklist publicly so progress is visible.",
          topic,
        ),
        self_regulation_prompt:
          "Daily 2-minute design journal: 'What worked today? What got me stuck? What's my first move tomorrow?'",
      },
      representation: {
        visual: t(
          "Display a pinboard of past student examples (or pro examples) of {{topic}} solutions. Provide a labeled 'parts of a good solution' anchor chart.",
          topic,
        ),
        auditory: t(
          "Share a 3-minute podcast or interview clip of a real designer/engineer talking about {{topic}}. Replay key quote during work time.",
          topic,
        ),
        text_supports: t(
          "Project planning packet: design brief, constraints checklist, materials log, and a one-page rubric. All on one double-sided handout for {{topic}}.",
          topic,
        ),
        vocabulary_scaffolds: [
          { term: "[Design term 1]", student_friendly: "In simple words…", visual_cue: "Picture / gesture / analogy" },
          { term: "[Design term 2]", student_friendly: "In simple words…", visual_cue: "Picture / gesture / analogy" },
          { term: "[Design term 3]", student_friendly: "In simple words…", visual_cue: "Picture / gesture / analogy" },
        ],
        big_idea_highlight: t(
          "Students walk away knowing: a good {{topic}} solution balances trade-offs — there's rarely one 'right' answer.",
          topic,
        ),
        background_activation: t(
          "Show two existing {{topic}} solutions side-by-side. Students vote (sticker / hand-raise) for which is better and defend their choice in 1 sentence.",
          topic,
        ),
      },
      action_expression: {
        response_modes: [
          "Build a physical prototype",
          "Design a digital prototype (Figma / slides)",
          "Sketch an annotated blueprint",
          "Record a pitch video",
        ],
        physical_action_options: t(
          "Hands-on prototyping with named materials (cardboard, tape, manipulatives, breadboard, etc. — list per {{topic}}). Movement allowed: students travel to materials station as needed.",
          topic,
        ),
        planning_scaffold: t(
          "Design Cycle organizer: Define → Sketch → Build → Test → Iterate. Students must initial each box before moving to the next phase of their {{topic}} project.",
          topic,
        ),
        progress_checkpoint:
          "End-of-day stand-up (3 min): each team shares 1 win, 1 stuck point, 1 next step. Teacher logs stuck points to address tomorrow.",
        flexible_assessment: t(
          "Final share day, choose: (a) live demo with Q&A, (b) recorded pitch video, (c) gallery-walk poster with annotated photos of the {{topic}} prototype.",
          topic,
        ),
      },
      reflection_prompt: t(
        "What was the hardest design decision you had to make on your {{topic}} project, and what did it teach you about how solutions get built?",
        topic,
      ),
    }),
  },
  {
    id: "discussion-based",
    name: "Discussion-Based",
    tagline: "Talk-heavy, evidence-grounded discourse",
    description:
      "Use for Socratic seminars, text-based discussions, debates, or any class period where the main learning happens through structured talk.",
    bestFor: ["Socratic seminars", "Text-based discussions", "Debates", "ELA / SS analysis"],
    build: (topic) => ({
      engagement: {
        hook: t(
          "Project a single provocative question about {{topic}} on the board with no context. Students do a 60-second silent journal response before any discussion.",
          topic,
        ),
        student_choice: [
          "Pick which discussion role you'll take: speaker, evidence-tracker, or summarizer",
          "Choose your seat position (inner circle / outer circle / observer)",
          "Pick your discussion entry point (which prompt to respond to first)",
        ],
        collaboration: t(
          "Fishbowl format: 6–8 students in inner circle discuss {{topic}} while outer circle tracks evidence and contributions on a discussion map. Swap halfway.",
          topic,
        ),
        sustain_effort: t(
          "Provide discussion sentence stems on the desk ('I'd push back on that because…', 'Building on what ___ said…'). Track airtime so quiet voices get invited in.",
          topic,
        ),
        self_regulation_prompt:
          "Mid-discussion pause: 'Has my talk helped move us forward, or have I been holding the floor? What's one thing I should do next?'",
      },
      representation: {
        visual: t(
          "Anchor chart of the {{topic}} text/argument with key passages numbered for easy citation. Display the discussion question(s) prominently.",
          topic,
        ),
        auditory: t(
          "Read the most contested passage of {{topic}} aloud (or play a recorded read-aloud) before discussion opens, so all students enter on equal auditory footing.",
          topic,
        ),
        text_supports: t(
          "Annotated text packet with margin space, plus a discussion stems card and an evidence-tracker template for {{topic}}.",
          topic,
        ),
        vocabulary_scaffolds: [
          { term: "[Discourse term, e.g., 'claim']", student_friendly: "What you're trying to prove", visual_cue: "Pointing-up gesture" },
          { term: "[Discourse term, e.g., 'evidence']", student_friendly: "Proof from the text", visual_cue: "Quote-marks gesture" },
          { term: "[Topic-specific term]", student_friendly: "In simple words…", visual_cue: "Picture / gesture / analogy" },
        ],
        big_idea_highlight: t(
          "By the end of class, students can articulate a defensible position on {{topic}} backed by at least 2 specific pieces of evidence.",
          topic,
        ),
        background_activation: t(
          "Quick poll (hands or sticker): 'On a 1-5 scale, how strongly do you agree with [claim about {{topic}}]?' before any discussion. Repoll at end to surface shifts.",
          topic,
        ),
      },
      action_expression: {
        response_modes: [
          "Speak in the inner circle",
          "Track evidence on a written discussion map",
          "Submit a written closing argument",
          "Record a 60-second audio response",
        ],
        physical_action_options:
          "Allow movement between inner and outer circle at signaled moments. Students may stand to make a point if seated talk feels stuck.",
        planning_scaffold:
          "Pre-discussion prep sheet: 'My claim is ___. My strongest evidence is ___. A counter-argument I'm ready to address is ___.' Students reference during talk.",
        progress_checkpoint:
          "Halftime check: each student writes one sentence — 'The strongest point so far has been ___ because ___.' Read 2 aloud before resuming.",
        flexible_assessment: t(
          "End of class, choose: (a) written claim-evidence-reasoning paragraph on {{topic}}, (b) 90-second recorded oral defense, or (c) annotated diagram of the argument map.",
          topic,
        ),
      },
      reflection_prompt: t(
        "Did anything you heard today change or sharpen your thinking on {{topic}}? What was it, and why did it land?",
        topic,
      ),
    }),
  },
  {
    id: "lab-investigation",
    name: "Lab / Investigation",
    tagline: "Hands-on inquiry with data collection",
    description:
      "Use for science labs, experiments, observations, or any lesson where students gather and analyze data to answer a question.",
    bestFor: ["Science labs", "Field observations", "Data collection", "Cause-effect investigations"],
    build: (topic) => ({
      engagement: {
        hook: t(
          "Open with a 'discrepant event' demo about {{topic}} — something visually surprising that breaks students' expectations. Pause and ask: 'What just happened?'",
          topic,
        ),
        student_choice: [
          "Pick your lab partner or work solo with teacher check-ins",
          "Choose which variable you'll investigate first",
          "Choose your data-recording format: table, sketch, or photo log",
        ],
        collaboration: t(
          "Lab teams of 2–3 with rotating roles: Procedure Reader, Data Recorder, Materials Handler. Roles must rotate each trial of the {{topic}} investigation.",
          topic,
        ),
        sustain_effort:
          "Display a 'What scientists do when stuck' poster: re-read procedure, check setup, talk it out, ask another team. Praise process behaviors aloud, not just results.",
        self_regulation_prompt:
          "Before each new trial: 'What's my prediction? What would change my mind? How will I know if my data is solid?'",
      },
      representation: {
        visual: t(
          "Project a labeled diagram of the lab setup for {{topic}}. Provide a sample data table with one row already filled in as a model.",
          topic,
        ),
        auditory: t(
          "Walk the room narrating safety norms and procedure cues during setup. Record a 90-second procedure overview and post for replay.",
          topic,
        ),
        text_supports: t(
          "Lab packet with: procedure (numbered steps), data table, claim-evidence-reasoning template, and a glossary of key {{topic}} terms.",
          topic,
        ),
        vocabulary_scaffolds: [
          { term: "Variable", student_friendly: "Anything you can change or measure", visual_cue: "Sliding-hand gesture" },
          { term: "[Topic term 1]", student_friendly: "In simple words…", visual_cue: "Picture / gesture / analogy" },
          { term: "[Topic term 2]", student_friendly: "In simple words…", visual_cue: "Picture / gesture / analogy" },
        ],
        big_idea_highlight: t(
          "By the end of the lab, students can use their data to make and defend a claim about {{topic}}.",
          topic,
        ),
        background_activation: t(
          "Pre-lab quick-write: 'What do you predict will happen, and why?' Star predictions on a class chart so we can compare to actual data.",
          topic,
        ),
      },
      action_expression: {
        response_modes: [
          "Hands-on data collection",
          "Sketch labeled observations",
          "Write claim-evidence-reasoning paragraph",
          "Record a verbal explanation of results",
        ],
        physical_action_options: t(
          "Full hands-on manipulation of materials for the {{topic}} setup. Designate a 'reset zone' so teams can pause, reorganize, and re-run.",
          topic,
        ),
        planning_scaffold:
          "Pre-lab planner: 'What am I changing? What am I measuring? What am I keeping the same?' Must be initialed before materials are released.",
        progress_checkpoint: t(
          "After trial 2 of 3 for {{topic}}: pause for 'data check' — does your data look reasonable? Compare with one other team and adjust if needed.",
          topic,
        ),
        flexible_assessment: t(
          "Choose your post-lab product: (a) written CER paragraph, (b) labeled scientific poster, (c) recorded 2-minute lab debrief explaining what your data shows about {{topic}}.",
          topic,
        ),
      },
      reflection_prompt: t(
        "How did your actual results compare to your prediction about {{topic}}? What does the gap (or match) tell you?",
        topic,
      ),
    }),
  },
  {
    id: "direct-instruction",
    name: "Direct Instruction + Practice",
    tagline: "Mini-lecture, modeled examples, guided practice",
    description:
      "Use when introducing a new procedure, skill, or concept that benefits from explicit teaching followed by structured practice.",
    bestFor: ["New skills/procedures", "Math procedures", "Worked examples", "Skill practice days"],
    build: (topic) => ({
      engagement: {
        hook: t(
          "Open with a short 'why this matters' story — a real situation where {{topic}} solves a problem students recognize. Keep it under 90 seconds.",
          topic,
        ),
        student_choice: [
          "Choose your practice difficulty: warm-up, on-level, or stretch",
          "Pick your practice format: worksheet, whiteboard, or digital",
          "Choose to work solo, with a partner, or with the teacher",
        ],
        collaboration: t(
          "Pair-share after each modeled example: 'Explain the move I just did to your partner using the {{topic}} vocabulary.' Cold-call 2 pairs to share out.",
          topic,
        ),
        sustain_effort:
          "Use a visible 'I do / We do / You do' progression bar so students see the gradual release. Praise effort during the 'we do' phase explicitly.",
        self_regulation_prompt:
          "Before independent practice: 'Rate your confidence 1-4. If you're below 3, grab a worked example to keep on your desk.'",
      },
      representation: {
        visual: t(
          "Step-by-step worked example projected and left visible during practice. Color-code each step of the {{topic}} procedure consistently.",
          topic,
        ),
        auditory: t(
          "Think-aloud during the 'I do' — narrate every decision. Record the think-aloud and post it so students can replay during practice on {{topic}}.",
          topic,
        ),
        text_supports: t(
          "Provide a 'steps card' summarizing the {{topic}} procedure in 4–6 bullet points, plus 2 fully worked examples on the back.",
          topic,
        ),
        vocabulary_scaffolds: [
          { term: "[Key term 1]", student_friendly: "In simple words…", visual_cue: "Picture / gesture / analogy" },
          { term: "[Key term 2]", student_friendly: "In simple words…", visual_cue: "Picture / gesture / analogy" },
          { term: "[Key term 3]", student_friendly: "In simple words…", visual_cue: "Picture / gesture / analogy" },
        ],
        big_idea_highlight: t(
          "Students walk away able to perform the {{topic}} procedure independently and explain WHY each step happens.",
          topic,
        ),
        background_activation: t(
          "Warm-up: 1 problem that uses prerequisite skills for {{topic}}. Review in 3 minutes before introducing the new move.",
          topic,
        ),
      },
      action_expression: {
        response_modes: ["Whiteboard work", "Worksheet practice", "Digital practice (e.g., DeltaMath)", "Verbal explanation to a partner"],
        physical_action_options:
          "Stand-and-share: students walk to the board to demonstrate one step of the procedure. Manipulatives available for students who need them.",
        planning_scaffold: t(
          "Annotated steps-card students reference during practice. Empty box at the bottom: 'My personal trick for remembering the {{topic}} procedure is ___.'",
          topic,
        ),
        progress_checkpoint:
          "After 3 practice problems: thumbs up / sideways / down. Pull a small group of sideways/downs for a re-teach while others continue.",
        flexible_assessment: t(
          "Exit ticket choice: (a) solve 2 {{topic}} problems showing all steps, (b) explain the procedure in writing, or (c) record a 60-second screen-cast solving one problem.",
          topic,
        ),
      },
      reflection_prompt: t(
        "Where in the {{topic}} procedure did you have to slow down most? What does that tell you about what to practice next?",
        topic,
      ),
    }),
  },
  {
    id: "reading-comprehension",
    name: "Reading Comprehension",
    tagline: "Close reading and meaning-making from text",
    description:
      "Use for any lesson centered on reading a text — article, primary source, short story, science reading — and building comprehension.",
    bestFor: ["Close reading", "Primary source analysis", "Article-of-the-week", "Science readings"],
    build: (topic) => ({
      engagement: {
        hook: t(
          "Pre-reading hook: show one striking image, headline, or quote from the {{topic}} text. Students predict what the reading is about in 1 sentence.",
          topic,
        ),
        student_choice: [
          "Choose your annotation lens (e.g., main ideas, surprises, questions)",
          "Pick your reading mode: silent solo, partner-read, or follow-the-audio",
          "Choose your post-reading product (summary, sketch, or one-pager)",
        ],
        collaboration: t(
          "After silent first read of the {{topic}} text, 'Stronger Together' partner protocol: each partner shares one passage they marked + their thinking, then writes a shared 2-sentence summary.",
          topic,
        ),
        sustain_effort:
          "Chunk the text — pause every 1–2 paragraphs for a quick check or jot. Celebrate stamina ('That was 4 paragraphs without stopping — go you!').",
        self_regulation_prompt:
          "Mid-reading: 'Am I tracking the main idea, or am I just decoding words? If I'm lost, where did I lose the thread?'",
      },
      representation: {
        visual: t(
          "Provide an annotated copy of paragraph 1 of the {{topic}} text as a model. Include a key for annotation marks (★ = main idea, ? = confused, ! = surprise).",
          topic,
        ),
        auditory: t(
          "Audio recording of the {{topic}} text available (teacher-read or text-to-speech). Some students follow along; others listen first then read.",
          topic,
        ),
        text_supports: t(
          "Provide the {{topic}} text with: numbered paragraphs, glossary of hard words in the margin, and a 'main idea per paragraph' tracking column.",
          topic,
        ),
        vocabulary_scaffolds: [
          { term: "[Hard word 1]", student_friendly: "In simple words…", visual_cue: "Picture / gesture / analogy" },
          { term: "[Hard word 2]", student_friendly: "In simple words…", visual_cue: "Picture / gesture / analogy" },
          { term: "[Hard word 3]", student_friendly: "In simple words…", visual_cue: "Picture / gesture / analogy" },
          { term: "[Hard word 4]", student_friendly: "In simple words…", visual_cue: "Picture / gesture / analogy" },
        ],
        big_idea_highlight: t(
          "By the end, students can summarize the central idea of the {{topic}} text in 2 sentences and cite one passage that supports it.",
          topic,
        ),
        background_activation: t(
          "Pre-reading turn-and-talk: 'What do you already know about {{topic}}? What questions do you have before we read?'",
          topic,
        ),
      },
      action_expression: {
        response_modes: [
          "Annotated text",
          "Written summary or one-pager",
          "Sketchnote of the reading",
          "Verbal retell to a partner",
        ],
        physical_action_options:
          "Allow flexible seating during reading (floor, standing desk, hallway nook). Movement break between reading and writing phases.",
        planning_scaffold: t(
          "'GIST' summary scaffold: in 20 words or fewer, what is this {{topic}} text really about? Provide the box and a word counter.",
          topic,
        ),
        progress_checkpoint:
          "Halfway through: '3-2-1 check' — write 3 things you understand, 2 questions, 1 word you don't know yet.",
        flexible_assessment: t(
          "Choose: (a) written 1-paragraph response to a text-based question, (b) sketchnote of the {{topic}} reading, or (c) recorded 90-second oral summary with one cited passage.",
          topic,
        ),
      },
      reflection_prompt: t(
        "What's one part of the {{topic}} text you're still thinking about — a question, a surprise, or something you disagree with?",
        topic,
      ),
    }),
  },
];

/**
 * Deep-merge templates over an existing udl_supports object.
 * mode: 'overwrite' replaces all fields; 'fill_empty' only fills where current is empty.
 */
export function applyTemplate(
  current: UdlSupportsShape | undefined,
  template: UdlSupportsShape,
  mode: "overwrite" | "fill_empty",
): UdlSupportsShape {
  if (mode === "overwrite") return template;

  const cur = current || {};
  const isEmpty = (v: unknown) => v === undefined || v === null || v === "" || (Array.isArray(v) && v.length === 0);

  const mergeSection = <T extends Record<string, any>>(curSec: T | undefined, tplSec: T | undefined): T => {
    const out: Record<string, any> = { ...curSec };
    if (!tplSec) return out as T;
    for (const k of Object.keys(tplSec)) {
      if (isEmpty(out[k])) out[k] = tplSec[k];
    }
    return out as T;
  };

  return {
    engagement: mergeSection(cur.engagement, template.engagement),
    representation: mergeSection(cur.representation, template.representation),
    action_expression: mergeSection(cur.action_expression, template.action_expression),
    reflection_prompt: isEmpty(cur.reflection_prompt) ? template.reflection_prompt : cur.reflection_prompt,
  };
}

/** Returns true if the udl_supports object has any non-empty content. */
export function hasUdlContent(u: UdlSupportsShape | undefined): boolean {
  if (!u) return false;
  const check = (v: unknown): boolean => {
    if (v === undefined || v === null) return false;
    if (typeof v === "string") return v.trim().length > 0;
    if (Array.isArray(v)) return v.length > 0;
    if (typeof v === "object") return Object.values(v as Record<string, unknown>).some(check);
    return false;
  };
  return check(u);
}
