/**
 * Idaho State Essential Standards data extracted from official Idaho Department of Education
 * "Essential Standards Extended Guide" documents (2024).
 *
 * Organized by subject → grade → category (essential / supporting / additional / teacher_guidance / big_idea).
 */

export interface IdahoStandard {
  code: string;
  description: string;
  category: "essential" | "supporting" | "additional" | "teacher_guidance" | "big_idea";
}

export interface IdahoGradeStandards {
  subject: string;
  grade: string;
  label: string;
  standards: IdahoStandard[];
}

// ────────────────────────────────────────
// ELA Grade 6
// ────────────────────────────────────────
const ELA_6: IdahoGradeStandards = {
  subject: "ELA",
  grade: "6",
  label: "ELA Grade 6",
  standards: [
    // Teacher Guidance
    { code: "RC.6.1", description: "Independently and proficiently read and comprehend texts representing a balance of genres, cultures, and perspectives that exhibit complexity at the lower end of the grades 6–8 band.", category: "teacher_guidance" },
    { code: "RC.6.2", description: "Regularly engage in a volume of reading, independently, with peers, or with modest support related to the topics and themes being studied to build knowledge and vocabulary.", category: "teacher_guidance" },
    { code: "RC.6.4", description: "Read grade-level text with accuracy, automaticity, appropriate rate, and expression in successive readings to support comprehension.", category: "teacher_guidance" },
    { code: "RS.6.2", description: "Read a series of texts organized around a variety of conceptually related topics to build knowledge about the world.", category: "teacher_guidance" },
    { code: "W.6.1", description: "Develop flexibility in writing by routinely engaging in the production of shorter and longer pieces for a range of tasks, purposes, and audiences.", category: "teacher_guidance" },

    // Essential
    { code: "RC.6.3", description: "Draw several pieces of evidence from grade-level texts to support claims and inferences, including quoting and paraphrasing from texts accurately.", category: "essential" },
    { code: "RC.6.5a", description: "Explain stated or implied themes of texts, including how they are developed using specific details from the texts.", category: "essential" },
    { code: "RC.6.5b", description: "Describe how characters respond or change as the plot moves toward a resolution.", category: "essential" },
    { code: "RC.6.6a", description: "Explain stated or implied central ideas from texts, including how they are developed using specific details from the texts; provide a summary of texts distinct from personal opinions.", category: "essential" },
    { code: "RC.6.6b", description: "Explain in detail how a key individual, event, or idea is introduced, illustrated, and elaborated in texts through examples or anecdotes.", category: "essential" },
    { code: "RC.6.6d", description: "Trace the argument and specific claims in texts, distinguishing claims that are supported by evidence and reasons from claims that are not.", category: "essential" },
    { code: "VD.6.1a", description: "Use context (e.g., the overall meaning of a sentence or paragraph; a word's position or function in a sentence) as a clue to the meaning of a word or phrase.", category: "essential" },
    { code: "RS.6.1", description: "Conduct brief as well as multi-day research tasks to take some action or share findings orally or in writing by formulating research questions and refocusing the inquiry when appropriate; gathering and assessing the relevance and usefulness of information from multiple reliable sources; and paraphrasing or quoting the data and conclusions of others, providing basic bibliographic information for sources, and respecting copyright guidelines for use of images.", category: "essential" },
    { code: "W.6.2", description: "Write arguments that introduce and support a distinct point of view with relevant claims, evidence and reasoning; demonstrate an understanding of the topic; and provide a concluding section that follows from the argument presented.", category: "essential" },
    { code: "W.6.3", description: "Write informational texts that introduce the topic, develop the focus with relevant facts, definitions, concrete details, quotations, and examples from multiple sources using appropriate strategies; and provide a concluding section that follows from the information presented.", category: "essential" },
    { code: "W.6.4", description: "Write personal or fictional narratives that establish a situation and narrator; engage and orient the reader to the context; use narrative techniques such as description, dialogue, pacing, concrete words and sensory details to develop the characters, event(s), or experience(s); and provide a conclusion that follows from the narrated event(s).", category: "essential" },
    { code: "ODC.6.1", description: "Engage in collaborative discussions about grade-level topics and texts with peers by following agreed-upon rules for collegial discussions, setting specific goals, and carrying out assigned roles.", category: "essential" },
    { code: "ODC.6.2", description: "Interpret information presented in diverse media and formats and explain how it contributes to a topic, text, or issue under study.", category: "essential" },
    { code: "ODC.6.3", description: "Delineate a speaker's argument and specific claims, distinguishing claims that are supported by reasons and evidence from claims that are not.", category: "essential" },
    { code: "GC.6.1a", description: "Identify the eight basic parts of speech (noun, pronoun, verb, adverb, adjective, conjunction, preposition, interjection).", category: "essential" },
    { code: "GC.6.2a", description: "Use commas, parentheses, and dashes to set off nonrestrictive or parenthetical elements.", category: "essential" },

    // Supporting
    { code: "RC.6.5c", description: "Describe how a particular sentence, chapter, scene, or stanza fits into the overall structure of texts and contributes to the development of the theme, setting, or plot.", category: "supporting" },
    { code: "RC.6.5", description: "Use evidence from literature to demonstrate understanding of grade-level texts.", category: "supporting" },
    { code: "RC.6.5d", description: "Explain how authors develop the point of view of the narrator or speaker in texts.", category: "supporting" },
    { code: "RC.6.6", description: "Use evidence from nonfiction works to demonstrate understanding of grade-level texts.", category: "supporting" },
    { code: "RC.6.6c", description: "Explain how a specific sentence, paragraph, chapter, or section fits into the overall structure of texts and contributes to the development of the ideas.", category: "supporting" },
    { code: "RC.6.6e", description: "Compare and contrast one author's presentation of events with that of another.", category: "supporting" },
    { code: "VD.6.1", description: "Determine or clarify the meaning of unknown and multiple-meaning words and phrases based on grade-level content, choosing flexibly from a range of strategies.", category: "supporting" },
    { code: "VD.6.1b", description: "Use common Greek or Latin affixes and roots as clues to the meaning of a word.", category: "supporting" },
    { code: "VD.6.1c", description: "Consult reference materials (e.g., dictionaries, glossaries, thesauruses), print or digital, to find the pronunciation of a word and determine and clarify its precise meaning and its part of speech.", category: "supporting" },
    { code: "VD.6.1d", description: "Verify the preliminary determination of the meaning of a word or phrase (e.g., by checking the inferred meaning in context or in a dictionary).", category: "supporting" },
    { code: "VD.6.2", description: "Determine how words and phrases provide meaning and nuance to grade-level texts.", category: "supporting" },
    { code: "VD.6.2a", description: "Interpret figurative language (e.g., personification, idioms) in context.", category: "supporting" },
    { code: "VD.6.2b", description: "Use the relationship between particular words (e.g., cause/effect, part/whole, item/category) to better understand each of the words.", category: "supporting" },
    { code: "VD.6.2c", description: "Distinguish among the connotations (associations) of words with similar denotations (definitions).", category: "supporting" },
    { code: "VD.6.2d", description: "Analyze the impact of a specific word choice on meaning, tone, or mood.", category: "supporting" },
    { code: "VD.6.3", description: "Acquire and use accurately general academic and content-specific words and phrases occurring in grade-level reading and content; gather vocabulary knowledge when considering a word or phrase important to comprehension or expression.", category: "supporting" },
    { code: "W.6.5", description: "Produce clear and coherent organizational structures of multiple paragraphs in which facts and ideas are logically grouped.", category: "supporting" },
    { code: "W.6.6", description: "With support from adults and peers, develop and strengthen writing as needed by planning, revising, editing, rewriting, or trying a new approach appropriate to audience and purpose.", category: "supporting" },
    { code: "W.6.7", description: "Write by hand or with technology to produce and publish writing as well as to interact and collaborate with others.", category: "supporting" },
    { code: "ODC.6.4", description: "Report orally on a topic or text or present an argument, sequencing ideas logically and using pertinent descriptions, facts, and details to accentuate main ideas or themes.", category: "supporting" },
    { code: "ODC.6.7", description: "Compare and contrast a written story to a digital version, contrasting what is 'seen' and 'heard' when reading the text with what is perceived when listened to or watched.", category: "supporting" },
    { code: "GC.6.1", description: "Demonstrate command of the conventions of English grammar and usage when writing or speaking.", category: "supporting" },
    { code: "GC.6.1b", description: "Recognize that a word performs different functions according to its position in the sentence.", category: "supporting" },
    { code: "GC.6.1c", description: "Use pronouns correctly regarding case, number, and person, including intensive pronouns.", category: "supporting" },
    { code: "GC.6.1d", description: "Recognize and correct vague pronouns (i.e., ones with unclear or ambiguous antecedents).", category: "supporting" },
    { code: "GC.6.1e", description: "Recognize and correct inappropriate shifts in pronoun number and person.", category: "supporting" },
    { code: "GC.6.1f", description: "Expand, combine, or reduce sentences for meaning, reader/listener interest, and style.", category: "supporting" },
    { code: "GC.6.2", description: "Demonstrate command of the conventions of English punctuation and capitalization when writing and reading aloud to create meaning.", category: "supporting" },
    { code: "GC.6.2b", description: "Colons to separate hours and minutes and to introduce a list.", category: "supporting" },
    { code: "GC.6.3", description: "Spell derivatives correctly by applying knowledge of bases and affixes.", category: "supporting" },

    // Additional
    { code: "RC.6.5e", description: "Compare and contrast texts in different forms or genres in terms of their approaches to similar themes and topics.", category: "additional" },
    { code: "ODC.6.5", description: "Consider the source of information gathered digitally through such means as domains and the quality of evidence presented.", category: "additional" },
    { code: "ODC.6.6", description: "Follow safety practices and ethical guidelines when gathering, sharing, and using information.", category: "additional" },
    { code: "ODC.6.8", description: "Include digital components (e.g., graphics, images, music, sound) in presentations to clarify information.", category: "additional" },
    { code: "GC.6.1g", description: "Recognize variations from standard English in their own and others' writing and speaking and identify and use strategies to improve expression in conventional language.", category: "additional" },
  ],
};

// ────────────────────────────────────────
// ELA Grade 7
// ────────────────────────────────────────
const ELA_7: IdahoGradeStandards = {
  subject: "ELA",
  grade: "7",
  label: "ELA Grade 7",
  standards: [
    // Teacher Guidance
    { code: "RC.7.1", description: "Independently and proficiently read and comprehend texts representing a balance of genres, cultures, and perspectives that exhibit complexity at the lower end of the grades 6–8 band.", category: "teacher_guidance" },
    { code: "RC.7.2", description: "Regularly engage in a volume of reading, independently, with peers, or with modest support related to the topics and themes being studied to build knowledge and vocabulary.", category: "teacher_guidance" },
    { code: "RC.7.4", description: "Read grade-level text with accuracy, automaticity, appropriate rate, and expression in successive readings to support comprehension.", category: "teacher_guidance" },
    { code: "RS.7.2", description: "Read a series of texts organized around a variety of conceptually related topics to build knowledge about the world.", category: "teacher_guidance" },
    { code: "W.7.1", description: "Develop flexibility in writing by routinely engaging in the production of shorter and longer pieces for a range of tasks, purposes, and audiences.", category: "teacher_guidance" },

    // Essential
    { code: "RC.7.3", description: "Draw several pieces of evidence from grade-level texts to support claims and inferences, including quoting or paraphrasing from texts accurately and tracing where in texts relevant evidence is located.", category: "essential" },
    { code: "RC.7.5a", description: "Explain stated or implied themes, analyzing their development over the course of texts; provide objective summaries of literary texts.", category: "essential" },
    { code: "RC.7.5b", description: "Explain how particular elements of stories or dramas interact, including how the setting shapes the characters or plot.", category: "essential" },
    { code: "RC.7.6a", description: "Explain stated or implied central ideas of texts, analyzing their development over the course of texts; provide objective summaries of texts.", category: "essential" },
    { code: "RC.7.6c", description: "Compare and contrast the structure of two or more texts and analyze how the differing structure of each text contributes to its meaning and development of ideas.", category: "essential" },
    { code: "RC.7.6d", description: "Trace the argument and specific claims in texts and assess whether the evidence is sufficient to support the claims.", category: "essential" },
    { code: "VD.7.2d", description: "Analyze the impact of a specific word choice on meaning, tone, or mood, including the impact of repeated use of certain images.", category: "essential" },
    { code: "RS.7.1", description: "Conduct brief as well as multi-day research tasks to take some action or share findings orally or in writing by formulating research questions and generating additional questions for further research.", category: "essential" },
    { code: "W.7.2", description: "Write arguments that introduce and support a well-defined point of view with appropriate claims, relevant evidence and clear reasoning, demonstrate a keen understanding of the topic or text, and provide a concluding section.", category: "essential" },
    { code: "W.7.3", description: "Write informational texts that introduce the topic clearly; develop the focus with relevant facts, definitions, concrete details, quotations, or other information and examples from multiple sources.", category: "essential" },
    { code: "W.7.4", description: "Write personal or fictional narratives that establish a situation and narrator; engage and orient the reader to the context and point of view; use narrative techniques such as description, dialogue, pacing.", category: "essential" },
    { code: "ODC.7.1", description: "Engage in collaborative discussions about grade-level topics and texts by following rules for collegial discussions, defining individual roles, and setting specific goals.", category: "essential" },
    { code: "ODC.7.2", description: "Analyze the main ideas and supporting details presented in diverse media and formats and explain how the ideas clarify a topic, text, or issue under study.", category: "essential" },
    { code: "ODC.7.3", description: "Delineate a speaker's argument and specific claims, evaluating the soundness of the reasoning and the relevance and sufficiency of the evidence.", category: "essential" },
    { code: "GC.7.1e", description: "Expand, combine, or reduce sentences for meaning, reader/listener interest, and style.", category: "essential" },
    { code: "GC.7.2b", description: "Use commas to separate coordinate adjectives.", category: "essential" },

    // Supporting
    { code: "RC.7.5", description: "Use evidence from literature to demonstrate understanding of grade-level texts.", category: "supporting" },
    { code: "RC.7.5d", description: "Explain how authors develop and contrast the point of view of different characters or narrators in texts.", category: "supporting" },
    { code: "RC.7.6", description: "Use evidence from nonfiction works to demonstrate understanding of grade-level texts.", category: "supporting" },
    { code: "RC.7.6b", description: "Analyze the relationships or interactions between individuals, events, and ideas in texts.", category: "supporting" },
    { code: "RC.7.6e", description: "Compare and contrast how two or more authors writing about the same topic shape their presentations of key information.", category: "supporting" },
    { code: "VD.7.1", description: "Determine or clarify the meaning of unknown and multiple-meaning words and phrases based on grade-level content.", category: "supporting" },
    { code: "VD.7.1a", description: "Use context as a clue to the meaning of a word or phrase.", category: "supporting" },
    { code: "VD.7.1c", description: "Consult general and specialized reference materials to find the pronunciation and meaning of a grade-level word.", category: "supporting" },
    { code: "VD.7.1d", description: "Verify the preliminary determination of the meaning of a word or phrase.", category: "supporting" },
    { code: "VD.7.2", description: "Determine how words and phrases provide meaning and nuance to grade-level texts.", category: "supporting" },
    { code: "VD.7.2a", description: "Interpret figurative language (e.g., euphemism, oxymoron) in context.", category: "supporting" },
    { code: "VD.7.2b", description: "Use the relationship between particular words (e.g., synonym/antonym, analogy) to better understand each of the words.", category: "supporting" },
    { code: "VD.7.2c", description: "Distinguish among the connotations of words with similar denotations.", category: "supporting" },
    { code: "VD.7.3", description: "Acquire and use accurately general academic and content-specific words and phrases occurring in grade-level reading and content.", category: "supporting" },
    { code: "W.7.5", description: "Produce clear and coherent organizational structures in which ideas and other information are logically grouped.", category: "supporting" },
    { code: "W.7.6", description: "With support from adults and peers, develop and strengthen writing as needed by planning, revising, editing, rewriting, or trying a new approach.", category: "supporting" },
    { code: "W.7.7", description: "Write by hand or with technology to produce and publish writing and link to and cite sources.", category: "supporting" },
    { code: "ODC.7.4", description: "Report orally on a topic or text or present an argument, emphasizing salient points in a focused, coherent manner.", category: "supporting" },
    { code: "ODC.7.7", description: "Compare and contrast a text to an audio, video, or digital version of the text, analyzing each medium's portrayal of the subject.", category: "supporting" },
    { code: "GC.7.1", description: "Demonstrate command of the conventions of English grammar and usage when writing or speaking.", category: "supporting" },
    { code: "GC.7.1a", description: "Identify the eight basic parts of speech.", category: "supporting" },
    { code: "GC.7.1c", description: "Place phrases and clauses correctly within a sentence, recognizing and correcting misplaced and dangling modifiers.", category: "supporting" },
    { code: "GC.7.1d", description: "Choose among simple, compound, complex, and compound-complex sentences to signal differing relationships among ideas.", category: "supporting" },
    { code: "GC.7.1f", description: "Adapt speech to a variety of contexts and tasks, demonstrating command of formal English when indicated or appropriate.", category: "supporting" },
    { code: "GC.7.2", description: "Demonstrate command of the conventions of English punctuation and capitalization when writing and reading aloud.", category: "supporting" },
    { code: "GC.7.2a", description: "Use commas, parentheses, and dashes to set off nonrestrictive/parenthetical elements.", category: "supporting" },
    { code: "GC.7.3", description: "Spell derivatives correctly by applying knowledge of bases and affixes.", category: "supporting" },

    // Additional
    { code: "RC.7.5c", description: "Compare and contrast the structure of two or more stories, poems, and plays and analyze how the differing structure of each literary text contributes to its meaning and style.", category: "additional" },
    { code: "RC.7.5e", description: "Compare and contrast fictional portrayals of a time, place, or character and historical accounts of the same period.", category: "additional" },
    { code: "VD.7.1b", description: "Use common Greek or Latin affixes and roots as clues to the meaning of a word.", category: "additional" },
    { code: "ODC.7.5", description: "Engage in positive, safe, legal, and ethical behavior when using information and communication technologies.", category: "additional" },
    { code: "ODC.7.6", description: "Consider the reliability of websites and blog posts.", category: "additional" },
    { code: "ODC.7.8", description: "Include digital components in presentations to clarify claims and findings and emphasize salient points.", category: "additional" },
    { code: "GC.7.1b", description: "Explain the function of phrases and clauses in general and their function in specific sentences.", category: "additional" },
  ],
};

// ────────────────────────────────────────
// ELA Grade 8
// ────────────────────────────────────────
const ELA_8: IdahoGradeStandards = {
  subject: "ELA",
  grade: "8",
  label: "ELA Grade 8",
  standards: [
    // Teacher Guidance
    { code: "RC.8.1", description: "Independently and proficiently read and comprehend texts representing a balance of genres, cultures, and perspectives that exhibit complexity at the lower end of the grades 6–8 band.", category: "teacher_guidance" },
    { code: "RC.8.2", description: "Regularly engage in a volume of reading, independently, with peers, or with modest support related to the topics and themes being studied to build knowledge and vocabulary.", category: "teacher_guidance" },
    { code: "RC.8.4", description: "Read grade-level text with accuracy, automaticity, appropriate rate, and expression in successive readings to support comprehension.", category: "teacher_guidance" },
    { code: "RS.8.2", description: "Read a series of texts organized around a variety of conceptually related topics to build knowledge about the world.", category: "teacher_guidance" },
    { code: "W.8.1", description: "Develop flexibility in writing by routinely engaging in the production of shorter and longer pieces for a range of tasks, purposes, and audiences.", category: "teacher_guidance" },

    // Essential
    { code: "RC.8.3", description: "Draw several pieces of evidence from grade-level texts that strongly support both what is said explicitly and what is implied, including quoting and paraphrasing from relevant sections and accurately citing textual references.", category: "essential" },
    { code: "RC.8.5a", description: "Explain stated or implied themes, analyzing their development over the course of texts, and the relationship of characters, setting, and plot to those themes.", category: "essential" },
    { code: "RC.8.5d", description: "Analyze how differences in the points of view of the characters and the audience or reader created with dramatic irony result in such effects as suspense or humor.", category: "essential" },
    { code: "RC.8.6a", description: "Explain stated or implied central ideas of texts, analyzing their development over the course of the texts, including the relationship of individuals, ideas, or events to the central ideas; provide objective summaries.", category: "essential" },
    { code: "RC.8.6d", description: "Trace the argument and specific claims in texts, distinguishing claims that are supported by evidence and reasons from claims that are not.", category: "essential" },
    { code: "VD.8.1a", description: "Use context as a clue to the meaning of a word or phrase.", category: "essential" },
    { code: "VD.8.2c", description: "Distinguish among the connotations of words with similar denotations.", category: "essential" },
    { code: "RS.8.1", description: "Conduct brief as well as multi-day research tasks to take some action or share findings orally or in writing by formulating research questions and generating additional questions that allow for multiple avenues of exploration.", category: "essential" },
    { code: "W.8.2", description: "Write arguments or make claims that support well-defined points of view effectively with relevant evidence and clear reasoning.", category: "essential" },
    { code: "W.8.3", description: "Write informational texts that introduce the topic clearly; preview what is to follow by establishing and maintaining a clear focus with relevant, well-chosen facts, definitions, concrete details, quotations, and examples from multiple sources.", category: "essential" },
    { code: "W.8.4", description: "Write personal or fictional narratives that establish a situation and narrator; engage and orient the reader to the context and one or multiple points of view; use a variety of techniques.", category: "essential" },
    { code: "ODC.8.1", description: "Engage in collaborative discussions about grade-level topics and texts with peers by following rules for collegial discussions and decision-making.", category: "essential" },
    { code: "ODC.8.2", description: "Analyze the purpose of information presented in diverse media and formats and evaluate the intent behind its presentation.", category: "essential" },
    { code: "GC.8.2a", description: "Use commas, ellipsis, and dashes when writing and reading aloud to indicate a pause, break, or omission.", category: "essential" },

    // Supporting
    { code: "RC.8.5", description: "Use evidence from literature to demonstrate understanding of grade-level texts.", category: "supporting" },
    { code: "RC.8.5b", description: "Analyze how characters are revealed through particular lines of dialogue or events in literary texts.", category: "supporting" },
    { code: "RC.8.5c", description: "Analyze how authors structure texts to advance a plot, explaining how each event gives rise to the next or foreshadows a future event.", category: "supporting" },
    { code: "RC.8.6", description: "Use evidence from nonfiction works to demonstrate understanding of grade-level texts.", category: "supporting" },
    { code: "RC.8.6b", description: "Analyze how texts make connections among and distinctions between individuals, ideas, or events.", category: "supporting" },
    { code: "RC.8.6c", description: "Analyze the structural elements of a text, including the role of specific sentences, paragraphs, and text features in developing and refining key concepts.", category: "supporting" },
    { code: "RC.8.6e", description: "Analyze cases in which two or more texts provide conflicting information on the same topic and identify where the texts disagree.", category: "supporting" },
    { code: "VD.8.1", description: "Determine or clarify the meaning of unknown and multiple-meaning words and phrases based on grade-level content.", category: "supporting" },
    { code: "VD.8.1c", description: "Consult general and specialized reference materials to find the pronunciation and meaning of a grade-level word.", category: "supporting" },
    { code: "VD.8.2", description: "Determine how words and phrases provide meaning and nuance to grade-level texts.", category: "supporting" },
    { code: "VD.8.2b", description: "Use the relationship between particular words to better understand each of the words.", category: "supporting" },
    { code: "VD.8.2d", description: "Analyze the impact of specific word choices on meaning and tone, including analogies or allusions to other texts.", category: "supporting" },
    { code: "VD.8.3", description: "Acquire and use accurately general academic and content-specific words and phrases occurring in grade-level reading and content.", category: "supporting" },
    { code: "W.8.5", description: "Produce clear and coherent organizational structures in which ideas and other information are logically grouped.", category: "supporting" },
    { code: "W.8.6", description: "With support from adults and peers, develop and strengthen writing as needed by planning, revising, editing, rewriting, or trying a new approach.", category: "supporting" },
    { code: "W.8.7", description: "Write by hand or with technology to produce and publish writing, link to and cite sources.", category: "supporting" },
    { code: "ODC.8.3", description: "Analyze a speaker's argument and specific claims, evaluating the soundness of the reasoning and relevance and sufficiency of the evidence.", category: "supporting" },
    { code: "ODC.8.4", description: "Report orally on a topic or text or present an argument, emphasizing salient points in a focused, coherent manner.", category: "supporting" },
    { code: "GC.8.1", description: "Demonstrate command of the conventions of English grammar and usage when writing or speaking.", category: "supporting" },
    { code: "GC.8.1a", description: "Recognize and correct inappropriate shifts in verb voice and mood.", category: "supporting" },
    { code: "GC.8.1c", description: "Form and use verbs in the active and passive voice to achieve particular effects.", category: "supporting" },
    { code: "GC.8.1e", description: "Expand, combine, or reduce sentences for meaning, reader/listener interest, and style.", category: "supporting" },
    { code: "GC.8.1f", description: "Adapt speech to a variety of contexts and tasks, demonstrating command of formal English when indicated or appropriate.", category: "supporting" },
    { code: "GC.8.2", description: "Demonstrate command of the conventions of English punctuation and capitalization when writing and reading aloud.", category: "supporting" },
    { code: "GC.8.3", description: "Spell derivatives correctly by applying knowledge of bases and affixes.", category: "supporting" },

    // Additional
    { code: "RC.8.5e", description: "Relate themes, patterns of events, or character types from myths, traditional stories, or religious works to contemporary stories, poems, or drama.", category: "additional" },
    { code: "VD.8.1b", description: "Use common Greek or Latin affixes and roots as clues to the meaning of a word.", category: "additional" },
    { code: "VD.8.1d", description: "Verify the preliminary determination of the meaning of a word or phrase by checking the inferred meaning in context or in a dictionary.", category: "additional" },
    { code: "VD.8.2a", description: "Interpret figurative language (e.g., verbal irony, puns) in context.", category: "additional" },
    { code: "ODC.8.5", description: "Demonstrate an understanding of and respect for the rights and obligations of using and sharing intellectual property.", category: "additional" },
    { code: "ODC.8.6", description: "Consider the evidence websites or blog posts use to support their position.", category: "additional" },
    { code: "ODC.8.7", description: "Evaluate the advantages and disadvantages of using different mediums—print or digital text.", category: "additional" },
    { code: "ODC.8.8", description: "Integrate digital displays into presentations to clarify information, strengthen claims and evidence, and add interest.", category: "additional" },
    { code: "GC.8.1b", description: "Form and use verbs in the indicative, imperative, interrogative, and conditional mood.", category: "additional" },
    { code: "GC.8.1d", description: "Explain the function of verbals (gerunds, participles, infinitives) in general and their function in particular sentences.", category: "additional" },
  ],
};

// ────────────────────────────────────────
// Math Grade 6
// ────────────────────────────────────────
const MATH_6: IdahoGradeStandards = {
  subject: "Math",
  grade: "6",
  label: "Math Grade 6",
  standards: [
    // Big Ideas
    { code: "6.RP.A", description: "Understand ratio and rate concepts and use ratio and rate reasoning to solve problems.", category: "big_idea" },
    { code: "6.NS.A", description: "Apply and extend previous understandings of multiplication and division to divide fractions by fractions.", category: "big_idea" },
    { code: "6.NS.B", description: "Compute fluently with multi-digit numbers and find common factors and multiples.", category: "big_idea" },
    { code: "6.NS.C", description: "Apply and extend previous understandings of numbers to the system of rational numbers.", category: "big_idea" },
    { code: "6.EE.A", description: "Apply and extend previous understandings of arithmetic to algebraic expressions.", category: "big_idea" },
    { code: "6.EE.B", description: "Reason about and solve one-variable equations and inequalities.", category: "big_idea" },
    { code: "6.EE.C", description: "Represent and analyze quantitative relationships between two variables.", category: "big_idea" },
    { code: "6.SP.A", description: "Develop understanding of statistical variability.", category: "big_idea" },
    { code: "6.SP.B", description: "Summarize and describe distributions.", category: "big_idea" },

    // Essential
    { code: "6.RP.A.3", description: "Use ratio and rate reasoning to solve real-world and mathematical problems, e.g., by reasoning about tables of equivalent ratios, tape diagrams, double number line diagrams, or equations.", category: "essential" },
    { code: "6.NS.A.1", description: "Interpret and compute quotients of fractions, and solve word problems involving division of fractions by fractions.", category: "essential" },
    { code: "6.NS.B.3", description: "Fluently add, subtract, multiply, and divide multi-digit decimals using the standard algorithm for each operation.", category: "essential" },
    { code: "6.G.A.1", description: "Find the area of right triangles, other triangles, special quadrilaterals, and polygons by composing into rectangles or decomposing into triangles and other shapes.", category: "essential" },
    { code: "6.NS.C.5", description: "Understand that positive and negative numbers are used together to describe quantities having opposite directions or values.", category: "essential" },
    { code: "6.NS.C.6", description: "Understand a rational number as a point on the number line. Extend number line diagrams and coordinate axes to represent points with negative number coordinates.", category: "essential" },
    { code: "6.EE.A.2", description: "Write, read, and evaluate expressions in which letters stand for numbers.", category: "essential" },
    { code: "6.EE.B.7", description: "Solve real-world and mathematical problems by writing and solving equations of the form x + p = q and px = q.", category: "essential" },
    { code: "6.EE.C.9", description: "Use variables to represent two quantities in a real-world problem that change in relationship to one another; write equations to represent the relationship.", category: "essential" },
    { code: "6.SP.A.2", description: "Understand that a set of data collected to answer a statistical question has a distribution, which can be described by its center, spread, and overall shape.", category: "essential" },

    // Supporting
    { code: "6.RP.A.1", description: "Understand the concept of a ratio and use ratio language to describe a ratio relationship between two quantities.", category: "supporting" },
    { code: "6.RP.A.2", description: "Understand the concept of a unit rate associated with a ratio a:b with b ≠ 0.", category: "supporting" },
    { code: "6.RP.A.3a", description: "Make tables of equivalent ratios relating quantities with whole-number measurements, find missing values in the tables, and plot the pairs of values on the coordinate plane.", category: "supporting" },
    { code: "6.RP.A.3b", description: "Solve unit-rate problems, including those involving unit pricing and constant speed.", category: "supporting" },
    { code: "6.RP.A.3c", description: "Find a percent of a quantity as a rate per 100; solve problems involving finding the whole, given a part and the percent.", category: "supporting" },
    { code: "6.RP.A.3d", description: "Use ratio reasoning to convert measurement units within and between measurement systems.", category: "supporting" },
    { code: "6.NS.B.2", description: "Fluently divide multi-digit numbers using the standard algorithm.", category: "supporting" },
    { code: "6.NS.B.4", description: "Find the greatest common factor of two whole numbers less than or equal to 100 and the least common multiple of two whole numbers less than or equal to 12.", category: "supporting" },
    { code: "6.G.A.2", description: "Find the volume of a right rectangular prism with fractional edge lengths by packing it with unit cubes.", category: "supporting" },
    { code: "6.NS.C.6a", description: "Recognize opposite signs of numbers as indicating locations on opposite sides of 0 on the number line.", category: "supporting" },
    { code: "6.NS.C.6b", description: "Understand signs of numbers in ordered pairs as indicating locations in quadrants of the coordinate plane.", category: "supporting" },
    { code: "6.NS.C.6c", description: "Find and position integers and other rational numbers on a horizontal or vertical number line diagram.", category: "supporting" },
    { code: "6.NS.7", description: "Understand ordering and absolute value of rational numbers.", category: "supporting" },
    { code: "6.NS.C.7a", description: "Interpret statements of inequality as statements about the relative position of two numbers on a number line diagram.", category: "supporting" },
    { code: "6.NS.C.7b", description: "Write, interpret, and explain statements of order for rational numbers in real-world contexts.", category: "supporting" },
    { code: "6.NS.C.7c", description: "Understand the absolute value of a rational number as its distance from 0 on the number line.", category: "supporting" },
    { code: "6.NS.C.8", description: "Solve real-world and mathematical problems by graphing points in all four quadrants of the coordinate plane.", category: "supporting" },
    { code: "6.EE.A.1", description: "Write and evaluate numerical expressions involving whole-number exponents.", category: "supporting" },
    { code: "6.EE.A.2a", description: "Write expressions that record operations with numbers and with letters standing for numbers.", category: "supporting" },
    { code: "6.EE.A.2c", description: "Evaluate expressions at specific values of their variables. Include expressions that arise from formulas used in real-world problems.", category: "supporting" },
    { code: "6.EE.A.3", description: "Apply the properties of operations to generate equivalent expressions.", category: "supporting" },
    { code: "6.EE.A.4", description: "Identify when two expressions are equivalent.", category: "supporting" },
    { code: "6.EE.B.5", description: "Understand solving an equation or inequality as a process of answering a question: Which values from a specified set make the equation or inequality true?", category: "supporting" },
    { code: "6.EE.B.6", description: "Use variables to represent numbers and write expressions when solving a real-world or mathematical problem.", category: "supporting" },
    { code: "6.SP.A.1", description: "Recognize a statistical question as one that anticipates variability in the data related to the question.", category: "supporting" },
    { code: "6.SP.B.4", description: "Display numerical data in plots on a number line, including dot plots, histograms, and box plots.", category: "supporting" },
    { code: "6.SP.B.5", description: "Summarize numerical data sets in relation to their context.", category: "supporting" },

    // Additional
    { code: "6.G.A.4", description: "Represent three-dimensional figures using nets made up of rectangles and triangles and use the nets to find the surface area.", category: "additional" },
    { code: "6.G.A.3", description: "Draw polygons in the coordinate plane given coordinates for the vertices; use coordinates to find the length of a side and area.", category: "additional" },
    { code: "6.NS.C.7d", description: "Distinguish comparisons of absolute value from statements about order.", category: "additional" },
    { code: "6.EE.B.8", description: "Write an inequality of the form x > c or x < c to represent a constraint or condition in a real-world or mathematical problem.", category: "additional" },
    { code: "6.EE.B.8a", description: "Recognize that inequalities of the form x > c or x < c have infinitely many solutions.", category: "additional" },
    { code: "6.EE.B.8b", description: "Represent solutions of such inequalities on number line diagrams.", category: "additional" },
    { code: "6.EE.A.2b", description: "Identify parts of an expression using mathematical terms (e.g., sum, term, product, factor, quotient, coefficient).", category: "additional" },
    { code: "6.SP.A.3", description: "Recognize that a measure of center for a numerical data set summarizes all of its values with a single number.", category: "additional" },
  ],
};

// ────────────────────────────────────────
// Math Grade 7
// ────────────────────────────────────────
const MATH_7: IdahoGradeStandards = {
  subject: "Math",
  grade: "7",
  label: "Math Grade 7",
  standards: [
    // Big Ideas
    { code: "7.RP.A", description: "Analyze proportional relationships and use them to solve real-world and mathematical problems.", category: "big_idea" },
    { code: "7.NS.A", description: "Apply and extend previous understandings of operations with fractions to add, subtract, multiply, and divide rational numbers.", category: "big_idea" },
    { code: "7.EE.A", description: "Use properties of operations to generate equivalent expressions.", category: "big_idea" },
    { code: "7.EE.B", description: "Solve real-life and mathematical problems using numerical and algebraic expressions and equations.", category: "big_idea" },
    { code: "7.G.A", description: "Draw, construct, and describe geometrical figures and describe the relationships between them.", category: "big_idea" },
    { code: "7.G.B", description: "Solve real-life and mathematical problems involving angle measure, area, surface area, and volume.", category: "big_idea" },
    { code: "7.SP.A", description: "Use random sampling to draw inferences about a population.", category: "big_idea" },
    { code: "7.SP.B", description: "Draw informal comparative inferences about two populations.", category: "big_idea" },
    { code: "7.SP.C", description: "Investigate chance processes and develop, use, and evaluate probability models.", category: "big_idea" },

    // Essential
    { code: "7.RP.A.2", description: "Recognize and represent proportional relationships between quantities.", category: "essential" },
    { code: "7.RP.A.2a", description: "Decide whether two quantities are in a proportional relationship, e.g., by testing for equivalent ratios in a table or graphing on a coordinate plane.", category: "essential" },
    { code: "7.RP.A.2b", description: "Identify the constant of proportionality in tables, graphs, equations, diagrams, and verbal descriptions of proportional relationships.", category: "essential" },
    { code: "7.NS.A.1b", description: "Understand p + q as the number located a distance |q| from p, in the positive or negative direction depending on whether q is positive or negative.", category: "essential" },
    { code: "7.NS.A.1c", description: "Understand subtraction of rational numbers as adding the additive inverse.", category: "essential" },
    { code: "7.NS.A.2a", description: "Understand that multiplication is extended from fractions to rational numbers by requiring that operations continue to satisfy the properties of operations.", category: "essential" },
    { code: "7.NS.A.2b", description: "Understand that integers can be divided, provided that the divisor is not zero, and every quotient of integers is a rational number.", category: "essential" },
    { code: "7.EE.B.4", description: "Use variables to represent quantities in a real-world or mathematical problem, and construct simple equations and inequalities to solve problems.", category: "essential" },
    { code: "7.G.A.1", description: "Solve problems involving scale drawings of geometric figures, including computing actual lengths and areas from a scale drawing.", category: "essential" },
    { code: "7.SP.A.2", description: "Use data from a random sample about an unknown characteristic of a population. Generate multiple samples to gauge the variation in estimates or predictions.", category: "essential" },

    // Supporting
    { code: "7.RP.A.1", description: "Compute unit rates associated with ratios of fractions, including ratios of lengths, areas and other quantities.", category: "supporting" },
    { code: "7.RP.A.2c", description: "Represent proportional relationships by equations.", category: "supporting" },
    { code: "7.RP.A.2d", description: "Explain what a point (x, y) on the graph of a proportional relationship means in terms of the situation.", category: "supporting" },
    { code: "7.RP.A.3", description: "Use proportional relationships to solve multi-step ratio, rate, and percent problems.", category: "supporting" },
    { code: "7.NS.A.1", description: "Apply and extend previous understandings of addition and subtraction to add and subtract integers and other rational numbers.", category: "supporting" },
    { code: "7.NS.A.1a", description: "Describe situations in which opposite quantities combine to make zero.", category: "supporting" },
    { code: "7.NS.A.1d", description: "Apply properties of operations as strategies to add and subtract rational numbers.", category: "supporting" },
    { code: "7.NS.A.2", description: "Apply and extend previous understandings of multiplication and division and of fractions to multiply and divide integers and other rational numbers.", category: "supporting" },
    { code: "7.NS.A.2c", description: "Apply properties of operations as strategies to multiply and divide rational numbers.", category: "supporting" },
    { code: "7.NS.A.3", description: "Solve real-world and mathematical problems involving the four operations with integers and other rational numbers.", category: "supporting" },
    { code: "7.EE.A.1", description: "Apply properties of operations to add, subtract, factor, and expand linear expressions with rational coefficients.", category: "supporting" },
    { code: "7.EE.A.2", description: "Understand that rewriting an expression in different forms in a problem context can shed light on the problem.", category: "supporting" },
    { code: "7.EE.B.3", description: "Solve multi-step real-life and mathematical problems posed with positive and negative rational numbers in any form.", category: "supporting" },
    { code: "7.EE.B.4a", description: "Solve word problems leading to equations of the form px + q = r and p(x + q) = r.", category: "supporting" },
    { code: "7.EE.B.4b", description: "Solve word problems leading to inequalities of the form px + q > r or px + q < r.", category: "supporting" },
    { code: "7.G.B.4", description: "Understand the attributes and measurements of circles.", category: "supporting" },
    { code: "7.G.B.4b", description: "Develop an understanding of circle attributes including radius, diameter, circumference, and area.", category: "supporting" },
    { code: "7.G.B.4c", description: "Informally derive and know the formulas for the area and circumference of a circle and use them to solve problems.", category: "supporting" },
    { code: "7.G.B.5", description: "Use facts about supplementary, complementary, vertical, and adjacent angles to write equations and solve for an unknown angle.", category: "supporting" },
    { code: "7.G.B.6", description: "Generalize strategies for finding area, volume, and surface areas of two- and three-dimensional objects.", category: "supporting" },
    { code: "7.SP.A.1", description: "Understand that statistics can be used to gain information about a population by examining a sample of the population.", category: "supporting" },
    { code: "7.SP.C.6", description: "Approximate the (theoretical) probability of a chance event by collecting data and observing its long-run relative frequency.", category: "supporting" },
    { code: "7.SP.C.8b", description: "Represent sample spaces for compound events using methods such as organized lists, tables, and tree diagrams.", category: "supporting" },

    // Additional
    { code: "7.NS.A.2d", description: "Convert a rational number to a decimal using long division; know that the decimal form of a rational number terminates or eventually repeats.", category: "additional" },
    { code: "7.G.A.2", description: "Draw two-dimensional geometric shapes with given conditions. Focus on constructing triangles from three measures of angles or sides.", category: "additional" },
    { code: "7.G.A.3", description: "Describe the shape of the two-dimensional face of the figure that results from slicing three-dimensional figures.", category: "additional" },
    { code: "7.G.B.4a", description: "Know that a circle is a two-dimensional shape created by connecting all of the points equidistant from a fixed point.", category: "additional" },
    { code: "7.SP.B.3", description: "Informally assess the degree of visual overlap of two numerical data distributions with similar variabilities.", category: "additional" },
    { code: "7.SP.B.4", description: "Use measures of center and measures of variability for numerical data from random samples to draw informal comparative inferences about two populations.", category: "additional" },
    { code: "7.SP.C.5", description: "Understand that the probability of a chance event is a number between 0 and 1 that expresses the likelihood of the event occurring.", category: "additional" },
    { code: "7.SP.C.7", description: "Develop a probability model and use it to find probabilities of events.", category: "additional" },
    { code: "7.SP.C.7a", description: "Develop a uniform probability model by assigning equal probability to all outcomes.", category: "additional" },
    { code: "7.SP.C.7b", description: "Develop a probability model by observing frequencies in data generated from a chance process.", category: "additional" },
    { code: "7.SP.C.8", description: "Find probabilities of compound events using organized lists, tables, tree diagrams, and simulation.", category: "additional" },
    { code: "7.SP.C.8a", description: "Understand that the probability of a compound event is the fraction of outcomes in the sample space for which the compound event occurs.", category: "additional" },
    { code: "7.SP.C.8c", description: "Design and use a simulation to generate frequencies for compound events.", category: "additional" },
  ],
};

// ────────────────────────────────────────
// Math Grade 8
// ────────────────────────────────────────
const MATH_8: IdahoGradeStandards = {
  subject: "Math",
  grade: "8",
  label: "Math Grade 8",
  standards: [
    // Big Ideas
    { code: "8.NS.A", description: "Know that there are numbers that are not rational and approximate them by rational numbers.", category: "big_idea" },
    { code: "8.EE.A", description: "Work with radicals and integer exponents.", category: "big_idea" },
    { code: "8.EE.B", description: "Understand the connections between proportional relationships, lines, and linear equations.", category: "big_idea" },
    { code: "8.EE.C", description: "Analyze and solve linear equations and pairs of simultaneous linear equations.", category: "big_idea" },
    { code: "8.F.A", description: "Define, evaluate, and compare functions.", category: "big_idea" },
    { code: "8.F.B", description: "Use functions to model relationships between quantities.", category: "big_idea" },
    { code: "8.SP.A", description: "Investigate patterns of association in bivariate data.", category: "big_idea" },
    { code: "8.G.A", description: "Understand congruence and similarity using physical models, transparencies, or geometry software.", category: "big_idea" },
    { code: "8.G.B", description: "Understand and apply the Pythagorean Theorem.", category: "big_idea" },
    { code: "8.G.C", description: "Solve real-world and mathematical problems involving volume of cylinders, cones, and spheres.", category: "big_idea" },

    // Essential
    { code: "8.EE.A.1", description: "Know and apply the properties of integer exponents to generate equivalent numerical expressions.", category: "essential" },
    { code: "8.EE.C.7b", description: "Solve linear equations with rational number coefficients, including equations whose solutions require expanding expressions using the distributive property and collecting like terms.", category: "essential" },
    { code: "8.EE.C.8c", description: "Solve real-world and mathematical problems leading to two linear equations in two variables.", category: "essential" },
    { code: "8.EE.B.5", description: "Graph proportional relationships, interpreting the unit rate as the slope of the graph. Compare two different proportional relationships represented in different ways.", category: "essential" },
    { code: "8.F.A.2", description: "Compare properties of two functions each represented in a different way (algebraically, graphically, numerically in tables, or by verbal descriptions).", category: "essential" },
    { code: "8.F.B.4", description: "Construct a function to model a linear relationship between two quantities. Determine the rate of change and initial value of the function.", category: "essential" },
    { code: "8.SP.A.2", description: "Know that straight lines are widely used to model relationships between two quantitative variables. Informally fit a straight line and assess the model fit.", category: "essential" },
    { code: "8.SP.A.4", description: "Understand that patterns of association can also be seen in bivariate categorical data by displaying frequencies and relative frequencies in a two-way table.", category: "essential" },
    { code: "8.G.A.2", description: "Understand that a two-dimensional figure is congruent to another if the second can be obtained from the first by a sequence of rotations, reflections, and translations.", category: "essential" },
    { code: "8.G.A.4", description: "Understand that a two-dimensional figure is similar to another if the second can be obtained from the first by a sequence of rotations, reflections, translations, and dilations.", category: "essential" },
    { code: "8.G.B.7", description: "Apply the Pythagorean Theorem to determine unknown side lengths in right triangles in real-world and mathematical problems in two and three dimensions.", category: "essential" },
    { code: "8.G.B.8", description: "Apply the Pythagorean Theorem to find the distance between two points in a coordinate system.", category: "essential" },

    // Supporting
    { code: "8.EE.A.2", description: "Use square root and cube root symbols to represent solutions to equations of the form x² = p and x³ = p.", category: "supporting" },
    { code: "8.EE.A.3", description: "Use numbers expressed in scientific notation to estimate very large or very small quantities.", category: "supporting" },
    { code: "8.EE.A.4", description: "Perform operations with numbers expressed in scientific notation.", category: "supporting" },
    { code: "8.EE.C.7", description: "Solve linear equations in one variable.", category: "supporting" },
    { code: "8.EE.C.7a", description: "Give examples of linear equations in one variable with one solution, infinitely many solutions, or no solutions.", category: "supporting" },
    { code: "8.EE.B.6", description: "Use similar triangles to explain why the slope is the same between any two distinct points on a non-vertical line in the coordinate plane.", category: "supporting" },
    { code: "8.F.A.3", description: "Interpret the equation y = mx + b as defining a linear function, whose graph is a straight line; give examples of functions that are not linear.", category: "supporting" },
    { code: "8.SP.A.3", description: "Use the equation of a linear model to solve problems in the context of bivariate measurement data, interpreting the slope and intercept.", category: "supporting" },
    { code: "8.F.A.1", description: "Understand that a function is a rule that assigns to each input exactly one output.", category: "supporting" },
    { code: "8.SP.A.1", description: "Construct and interpret scatter plots for bivariate measurement data to investigate patterns of association between two quantities.", category: "supporting" },
    { code: "8.G.A.1", description: "Verify experimentally the properties of rotations, reflections, and translations.", category: "supporting" },
    { code: "8.G.A.3", description: "Describe the effect of dilations, translations, rotations, and reflections on two-dimensional figures using coordinates.", category: "supporting" },
    { code: "8.G.B.6", description: "Analyze and justify the Pythagorean Theorem and its converse using pictures, diagrams, narratives, or models.", category: "supporting" },

    // Additional
    { code: "8.NS.A.1", description: "Know that numbers that are not rational are called irrational. Understand informally that every number has a decimal expansion.", category: "additional" },
    { code: "8.NS.A.2", description: "Use rational approximations of irrational numbers to compare the size of irrational numbers.", category: "additional" },
    { code: "8.EE.C.8", description: "Analyze and solve pairs of simultaneous linear equations.", category: "additional" },
    { code: "8.EE.C.8a", description: "Understand that solutions to a system of two linear equations correspond to points of intersection of their graphs.", category: "additional" },
    { code: "8.EE.C.8b", description: "Solve systems of two linear equations in two variables algebraically.", category: "additional" },
    { code: "8.F.B.5", description: "Describe qualitatively the functional relationship between two quantities by analyzing and sketching a graph.", category: "additional" },
    { code: "8.G.A.5", description: "Use informal arguments to establish facts about the angle sum and exterior angle of triangles, about the angles created when parallel lines are cut by a transversal.", category: "additional" },
    { code: "8.G.C.9", description: "Know the formulas for the volumes of cones, cylinders, and spheres and use them to solve real-world and mathematical problems.", category: "additional" },
  ],
};

// ────────────────────────────────────────
// Social Studies – World Geography & History (Grades 6-9)
// ────────────────────────────────────────
const SS_WGH: IdahoGradeStandards = {
  subject: "Social Studies",
  grade: "6-9",
  label: "World Geography & History (Grades 6-9)",
  standards: [
    // Essential
    { code: "6-9.WG.1.1", description: "Describe major aspects of the civilizations in regions throughout the world prior to European contact including government, religion/belief systems, arts/architecture, technology, physical geography, economics, and social order.", category: "essential" },
    { code: "6-9.WG.1.4", description: "Investigate the historical origins, central beliefs, and spread of major religions and belief systems, including Judaism, Christianity, Islam, Sikhism, Hinduism, Buddhism, and Confucianism and Indigenous knowledge and belief systems.", category: "essential" },
    { code: "6-9.WH.1.4", description: "Analyze the characteristics of early civilizations throughout the world, including government, religion/belief systems, arts/architecture, technology, physical geography, economics, and social order.", category: "essential" },
    { code: "6-9.WH.1.9", description: "Explain the relationship between religion and belief systems and people's understanding of the natural world.", category: "essential" },
    { code: "6-9.WG.6.2", description: "Explain and use the components of maps, compare different map projections, and explain the appropriate uses for each.", category: "essential" },
    { code: "6-9.WH.1.1", description: "Analyze types of evidence used by anthropologists, archaeologists, and other scholars to reconstruct early human and cultural development.", category: "essential" },
    { code: "6-9.WH.1.7", description: "Identify examples of how writing, art, architecture, mathematics, and science have evolved over time.", category: "essential" },
    { code: "6-9.WH.1.8", description: "Analyze different social classes and their impact on societies and civilizations throughout the world.", category: "essential" },
    { code: "6-9.WH.6.1", description: "Synthesize evidence from information sources including artifacts, primary and secondary sources, charts, graphs, and/or images to interpret historical events.", category: "essential" },
    { code: "6-9.WG.2.5", description: "Identify major biomes and explain ways in which the natural environment and climate of places in regions throughout the world are related to affect settlement patterns and everyday life.", category: "essential" },
    { code: "6-9.WG.2.14", description: "Give examples of how landforms, water, climate, and natural vegetation have influenced historical trends and developments in regions throughout the world.", category: "essential" },
    { code: "6-9.WH.2.10", description: "Describe why the conservation of resources is necessary to maintain a healthy environment.", category: "essential" },
    { code: "6-9.WG.2.7", description: "Identify the names and locations of countries and major cities in regions around the world.", category: "essential" },
    { code: "6-9.WG.2.9", description: "Identify patterns of population distribution and growth in regions throughout the world and explain changes in these patterns that have occurred over time.", category: "essential" },
    { code: "6-9.WH.2.2", description: "Identify the main reasons for major migrations of people.", category: "essential" },
    { code: "6-9.WH.2.5", description: "Explain how transportation routes stimulate the growth of cities and the exchange of goods, knowledge, and technology.", category: "essential" },
    { code: "6-9.WG.6.3", description: "Analyze visual and statistical data presented in charts, tables, graphs, maps, and other graphic organizers to assist in interpreting a historical event.", category: "essential" },
    { code: "6-9.WG.3.1", description: "Describe abundance, scarcity, and distribution of resources; explain their impact on decision-making, such as trade, settlement, stewardship of the natural environment, and development of infrastructure.", category: "essential" },
    { code: "6-9.WG.3.3", description: "Compare the standard of living of various regions today using quality of life indicators and discuss their impact on everyday life locally, nationally, and globally.", category: "essential" },
    { code: "6-9.WG.3.7", description: "Investigate how physical geography, natural resources, specialization, and trade have influenced the way people meet their material needs.", category: "essential" },
    { code: "6-9.WH.3.3", description: "Analyze the role of money and alternative means of exchange.", category: "essential" },
    { code: "6-9.WG.4.1", description: "Identify the major forms of government in regions throughout the world and compare them with the government of the United States.", category: "essential" },
    { code: "6-9.WH.4.2", description: "Analyze the various political systems that shaped civilizations throughout the world, including the City-State, Monarchy, Republic, Nation-State, or Democracy.", category: "essential" },
    { code: "6-9.WG.5.1", description: "Discuss how social institutions, including the family, religion, and education, influence behavior in different societies in regions throughout the world.", category: "essential" },
    { code: "6-9.WG.5.3", description: "Define ethnocentrism and give examples of how it can lead to miscommunication and cultural misunderstandings.", category: "essential" },
    { code: "6-9.WG.5.5", description: "Describe the costs and benefits of global connections including trading, seeking solutions to mutual problems, learning from technological advances, acquiring new perspectives, and benefiting from developments in culture.", category: "essential" },
    { code: "6-9.WH.5.1", description: "Explain the political, economic, religious, or cultural causes of conflicts in various civilizations and their consequences.", category: "essential" },
    { code: "6-9.WH.5.4", description: "Analyze the causes, events, and consequences of the Holocaust while exploring the impacts of discrimination and prejudice.", category: "essential" },

    // Supporting
    { code: "6-9.WH.1.2", description: "Describe the characteristics of early hunter-gatherer communities.", category: "supporting" },
    { code: "6-9.WH.1.3", description: "Describe how hunter-gatherer communities developed into agricultural sedentary settlements.", category: "supporting" },
    { code: "6-9.WH.1.10", description: "Explain how religion and belief systems shaped the development of civilizations.", category: "supporting" },
    { code: "6-9.WH.1.11", description: "Discuss how religion, belief systems, economics, and politics influenced social behavior and were used to maintain social order.", category: "supporting" },
    { code: "6-9.WH.1.12", description: "Examine why the diversity of religion and belief systems across cultural, social, political, and economic institutions have been sources of conflict.", category: "supporting" },
    { code: "6-9.WG.6.1", description: "Explain how and why events may be interpreted differently according to the points of view of participants and observers.", category: "supporting" },
    { code: "6-8.WG.1.2", description: "Examine the impact of Europeans and indigenous cultures on one another in regions throughout the world.", category: "supporting" },
    { code: "6-9.WH.1.5", description: "Explain how humans adapted the environment to maintain population growth and develop the first civilizations.", category: "supporting" },
    { code: "6-9.WH.1.6", description: "Identify the technological advances developed by Ancient, Middle Age, Early-Modern, and Modern societies and civilizations throughout the world.", category: "supporting" },
    { code: "6-9.WG.2.1", description: "Apply latitude and longitude to locate places on Earth.", category: "supporting" },
    { code: "6-9.WG.2.3", description: "Describe the relative location of people, places, and objects by using positional words, including cardinal directions and distance.", category: "supporting" },
    { code: "6-9.WG.2.4", description: "Locate, map, and describe the climate of regions throughout the world and analyze their impact on human activity and living conditions.", category: "supporting" },
    { code: "6-9.WG.2.15", description: "Describe various views that affect environmental issues in regions throughout the world.", category: "supporting" },
    { code: "6-9.WG.2.16", description: "Explain how human-caused changes in the physical environment in one place can cause changes in another place.", category: "supporting" },
    { code: "6-9.WH.2.4", description: "Describe how physical features, such as mountain ranges, fertile plains, and rivers led to the development of cultural regions.", category: "supporting" },
    { code: "6-9.WH.2.6", description: "Explain the impact of waterways on civilizations.", category: "supporting" },
    { code: "6-9.WG.2.6", description: "Analyze and give examples of the consequences of human impact on the physical environment, including the role of technology.", category: "supporting" },
    { code: "6-9.WG.2.10", description: "Compare and contrast cultural patterns in regions throughout the world, such as language, religion, and ethnic.", category: "supporting" },
    { code: "6-9.WH.2.3", description: "Explain how climate affects human migration and settlement.", category: "supporting" },
    { code: "6-9.WH.2.9", description: "Explain how the rapid growth of cities can lead to economic, social, political, and technological problems and innovations.", category: "supporting" },
    { code: "6-9.WG.2.11", description: "Analyze the locations of the major manufacturing and agricultural areas in regions throughout the world.", category: "supporting" },
    { code: "6-9.WG.2.12", description: "Analyze the availability of natural resources in regions throughout the world.", category: "supporting" },
    { code: "6-9.WH.2.7", description: "Explain how the resources of an area can be the source of conflict between competing groups.", category: "supporting" },
    { code: "6-9.WH.2.8", description: "Illustrate how the population growth rate impacts a nation's resources.", category: "supporting" },
    { code: "6-9.WG.3.2", description: "Describe how different economic systems guide decisions about what to produce, how to produce, and for whom to produce.", category: "supporting" },
    { code: "6-9.WG.3.4", description: "Analyze current economic issues using a variety of sources representing multiple perspectives.", category: "supporting" },
    { code: "6-9.WG.3.5", description: "Identify economic connections between local, national, and global economies in regions throughout the world.", category: "supporting" },
    { code: "6-9.WG.3.6", description: "Explain how the demand for important natural resources evolved in regions throughout the world.", category: "supporting" },
    { code: "6-9.WH.3.1", description: "Explain how people historically relied on their natural resources to meet their needs.", category: "supporting" },
    { code: "6-9.WH.3.2", description: "Describe examples that show how economic opportunity and a higher standard of living are important factors in human migration.", category: "supporting" },
    { code: "6-9.WH.3.4", description: "Analyze the impact of economic growth on society.", category: "supporting" },
    { code: "6-9.WH.4.1", description: "Describe the role of government in historical human migration, such as push and pull factors.", category: "supporting" },
    { code: "6-9.WH.4.3", description: "Analyze and evaluate the global expansion of liberty and democracy through revolution and reform movements.", category: "supporting" },
    { code: "6-9.WH.6.4", description: "Support claim(s) with logical reasoning and relevant, accurate data and evidence that demonstrate an understanding of the topic, using credible sources.", category: "supporting" },
    { code: "6-9.WG.5.2", description: "Give examples of how language, literature, and the arts shape the development and transmission of culture in regions throughout the world.", category: "supporting" },
    { code: "6-9.WG.5.4", description: "Discuss present conflicts between cultural groups and nation-states in regions throughout the world.", category: "supporting" },
    { code: "6-9.WG.5.6", description: "Explain the causes and consequences of current global issues, including the expansion of global markets, the urbanization of the developing world, the consumption of natural resources, and the extinction of species.", category: "supporting" },
    { code: "6-9.WH.5.2", description: "Identify and compare major modern world conflicts and explain their global consequences and impacts including European colonialism, World War I, World War II, the Cold War, and decolonization movements.", category: "supporting" },
    { code: "6-9.WH.5.3", description: "Explain why people unite for political, economic, and humanitarian reasons.", category: "supporting" },
    { code: "6-9.WH.6.2", description: "Determine and explain the cause and effect of historical events or developments.", category: "supporting" },
    { code: "6-9.WH.6.3", description: "Explain how and why events may be interpreted differently according to the points of view of participants and observers.", category: "supporting" },
    { code: "6-9.WH.6.5", description: "Analyze the context of historical events to determine the motivations of people in those events.", category: "supporting" },

    // Additional
    { code: "6-9.WG.1.3", description: "Describe and compare various motivations of European colonization in regions throughout the world.", category: "additional" },
    { code: "6-9.WH.2.1", description: "Develop and interpret different kinds of maps, globes, graphs, charts, databases, and models.", category: "additional" },
    { code: "6-9.WG.2.2", description: "Describe the uses of technology, such as Global Positioning Systems (GPS), Geographic Information Systems (GIS), and satellite and aerial imaging.", category: "additional" },
    { code: "6-9.WG.2.8", description: "Describe major physical characteristics of regions throughout the world.", category: "additional" },
    { code: "6-9.WG.2.13", description: "Give examples of how both natural and technological hazards have impacted the physical environment and human populations in regions throughout the world.", category: "additional" },
    { code: "6-9.WH.3.5", description: "Identify influential economic thinkers and the impact of their philosophies.", category: "additional" },
  ],
};

// ────────────────────────────────────────
// Export all Idaho standards (including Careers / First Steps CTE)
// ────────────────────────────────────────
import { CAREERS_7, CAREERS_8 } from "./careers-standards-data";

export const ALL_IDAHO_STANDARDS: IdahoGradeStandards[] = [
  ELA_6,
  ELA_7,
  ELA_8,
  MATH_6,
  MATH_7,
  MATH_8,
  SS_WGH,
  CAREERS_7,
  CAREERS_8,
];

/** Flat list of all Idaho standards for search/picker usage */
export const ALL_IDAHO_STANDARDS_FLAT: { code: string; description: string; subject: string; grade: string; category: string }[] =
  ALL_IDAHO_STANDARDS.flatMap(gs =>
    gs.standards.map(s => ({
      code: s.code,
      description: s.description,
      subject: gs.subject,
      grade: gs.grade,
      category: s.category,
    }))
  );

/** Category labels for display */
export const IDAHO_CATEGORY_LABELS: Record<string, string> = {
  essential: "Essential",
  supporting: "Supporting",
  additional: "Additional",
  teacher_guidance: "Teacher Guidance",
  big_idea: "Mathematical Big Idea",
};
