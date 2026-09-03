/**
 * NGSS three-dimensional sub-components for Middle School performance expectations.
 *
 * Every NGSS PE is built from three dimensions:
 *   - SEP — Science & Engineering Practice (the doing)
 *   - DCI — Disciplinary Core Idea (the knowing)
 *   - CCC — Crosscutting Concept (the connecting lens)
 *
 * Teachers can use these to focus AI lesson generation on a specific dimension
 * (e.g. "lean into the modeling practice" or "emphasize cause-and-effect").
 */

export type NgssDimensionType = "SEP" | "DCI" | "CCC";

export interface NgssDimension {
  /** Stable code, e.g. "MS-LS1-1.SEP" or "MS-LS1-1.DCI.LS1.A" */
  code: string;
  type: NgssDimensionType;
  /** Short title — what teachers see in the picker, e.g. "Planning & Carrying Out Investigations" */
  title: string;
  /** Full grade-band description from the NGSS framework */
  description: string;
}

/**
 * Map of PE code -> array of its three (or more) dimensions.
 * Each PE has at least one SEP, one DCI, and one CCC.
 */
export const NGSS_DIMENSIONS: Record<string, NgssDimension[]> = {
  // ===== Life Science =====
  "MS-LS1-1": [
    { code: "MS-LS1-1.SEP", type: "SEP", title: "Planning & Carrying Out Investigations", description: "Conduct an investigation to produce data to serve as the basis for evidence that meet the goals of an investigation." },
    { code: "MS-LS1-1.DCI", type: "DCI", title: "LS1.A — Structure & Function", description: "All living things are made up of cells, which is the smallest unit that can be said to be alive." },
    { code: "MS-LS1-1.CCC", type: "CCC", title: "Scale, Proportion & Quantity", description: "Phenomena that can be observed at one scale may not be observable at another scale." },
  ],
  "MS-LS1-2": [
    { code: "MS-LS1-2.SEP", type: "SEP", title: "Developing & Using Models", description: "Develop and use a model to describe phenomena." },
    { code: "MS-LS1-2.DCI", type: "DCI", title: "LS1.A — Structure & Function", description: "Within cells, special structures are responsible for particular functions, and the cell membrane forms the boundary that controls what enters and leaves the cell." },
    { code: "MS-LS1-2.CCC", type: "CCC", title: "Structure & Function", description: "Complex and microscopic structures and systems can be visualized, modeled, and used to describe how their function depends on the shapes, composition, and relationships among their parts." },
  ],
  "MS-LS1-3": [
    { code: "MS-LS1-3.SEP", type: "SEP", title: "Engaging in Argument from Evidence", description: "Use an oral and written argument supported by evidence to support or refute an explanation." },
    { code: "MS-LS1-3.DCI", type: "DCI", title: "LS1.A — Structure & Function", description: "In multicellular organisms, the body is a system of multiple interacting subsystems formed by groups of cells." },
    { code: "MS-LS1-3.CCC", type: "CCC", title: "Systems & System Models", description: "Systems may interact with other systems; they may have sub-systems and be a part of larger complex systems." },
  ],
  "MS-LS1-4": [
    { code: "MS-LS1-4.SEP", type: "SEP", title: "Engaging in Argument from Evidence", description: "Use argument based on empirical evidence and scientific reasoning to support an explanation." },
    { code: "MS-LS1-4.DCI", type: "DCI", title: "LS1.B — Growth & Development of Organisms", description: "Animals engage in characteristic behaviors that increase the odds of reproduction. Plants reproduce in a variety of ways." },
    { code: "MS-LS1-4.CCC", type: "CCC", title: "Cause & Effect", description: "Phenomena may have more than one cause, and some cause-and-effect relationships can only be described using probability." },
  ],
  "MS-LS1-5": [
    { code: "MS-LS1-5.SEP", type: "SEP", title: "Constructing Explanations", description: "Construct a scientific explanation based on valid and reliable evidence." },
    { code: "MS-LS1-5.DCI", type: "DCI", title: "LS1.B — Growth & Development of Organisms", description: "Genetic factors as well as local conditions affect the growth of the adult plant." },
    { code: "MS-LS1-5.CCC", type: "CCC", title: "Cause & Effect", description: "Phenomena may have more than one cause." },
  ],
  "MS-LS1-6": [
    { code: "MS-LS1-6.SEP", type: "SEP", title: "Constructing Explanations", description: "Construct a scientific explanation based on evidence for the role of a process." },
    { code: "MS-LS1-6.DCI", type: "DCI", title: "LS1.C — Organization for Matter & Energy Flow", description: "Plants, algae, and many microorganisms use energy from light to make sugars from carbon dioxide and water." },
    { code: "MS-LS1-6.CCC", type: "CCC", title: "Energy & Matter", description: "Within a natural system, the transfer of energy drives the motion and/or cycling of matter." },
  ],
  "MS-LS1-7": [
    { code: "MS-LS1-7.SEP", type: "SEP", title: "Developing & Using Models", description: "Develop a model to describe unobservable mechanisms." },
    { code: "MS-LS1-7.DCI", type: "DCI", title: "LS1.C — Organization for Matter & Energy Flow", description: "Within individual organisms, food moves through a series of chemical reactions in which it is broken down and rearranged to form new molecules." },
    { code: "MS-LS1-7.CCC", type: "CCC", title: "Energy & Matter", description: "Matter is conserved because atoms are conserved in physical and chemical processes." },
  ],
  "MS-LS1-8": [
    { code: "MS-LS1-8.SEP", type: "SEP", title: "Obtaining, Evaluating & Communicating Information", description: "Gather, read, and synthesize information from multiple appropriate sources." },
    { code: "MS-LS1-8.DCI", type: "DCI", title: "LS1.D — Information Processing", description: "Each sense receptor responds to different inputs, transmitting them as signals that travel along nerve cells to the brain." },
    { code: "MS-LS1-8.CCC", type: "CCC", title: "Cause & Effect", description: "Cause-and-effect relationships may be used to predict phenomena in natural systems." },
  ],

  "MS-LS2-1": [
    { code: "MS-LS2-1.SEP", type: "SEP", title: "Analyzing & Interpreting Data", description: "Analyze and interpret data to provide evidence for phenomena." },
    { code: "MS-LS2-1.DCI", type: "DCI", title: "LS2.A — Interdependent Relationships in Ecosystems", description: "Organisms, and populations of organisms, are dependent on their environmental interactions both with other living things and with nonliving factors." },
    { code: "MS-LS2-1.CCC", type: "CCC", title: "Cause & Effect", description: "Cause-and-effect relationships may be used to predict phenomena in natural or designed systems." },
  ],
  "MS-LS2-2": [
    { code: "MS-LS2-2.SEP", type: "SEP", title: "Constructing Explanations", description: "Construct an explanation that includes qualitative or quantitative relationships between variables." },
    { code: "MS-LS2-2.DCI", type: "DCI", title: "LS2.A — Interdependent Relationships in Ecosystems", description: "Similarly, predatory interactions may reduce the number of organisms or eliminate whole populations of organisms. Mutually beneficial interactions, in contrast, may become so interdependent that each organism requires the other for survival." },
    { code: "MS-LS2-2.CCC", type: "CCC", title: "Patterns", description: "Patterns can be used to identify cause-and-effect relationships." },
  ],
  "MS-LS2-3": [
    { code: "MS-LS2-3.SEP", type: "SEP", title: "Developing & Using Models", description: "Develop a model to describe phenomena." },
    { code: "MS-LS2-3.DCI", type: "DCI", title: "LS2.B — Cycles of Matter & Energy Transfer", description: "Food webs are models that demonstrate how matter and energy is transferred between producers, consumers, and decomposers as the three groups interact within an ecosystem." },
    { code: "MS-LS2-3.CCC", type: "CCC", title: "Energy & Matter", description: "The transfer of energy can be tracked as energy flows through a natural system." },
  ],
  "MS-LS2-4": [
    { code: "MS-LS2-4.SEP", type: "SEP", title: "Engaging in Argument from Evidence", description: "Construct an oral and written argument supported by empirical evidence and scientific reasoning." },
    { code: "MS-LS2-4.DCI", type: "DCI", title: "LS2.C — Ecosystem Dynamics, Functioning & Resilience", description: "Ecosystems are dynamic in nature; their characteristics can vary over time. Disruptions to any physical or biological component of an ecosystem can lead to shifts in all its populations." },
    { code: "MS-LS2-4.CCC", type: "CCC", title: "Stability & Change", description: "Small changes in one part of a system might cause large changes in another part." },
  ],
  "MS-LS2-5": [
    { code: "MS-LS2-5.SEP", type: "SEP", title: "Engaging in Argument from Evidence", description: "Evaluate competing design solutions based on jointly developed and agreed-upon design criteria." },
    { code: "MS-LS2-5.DCI", type: "DCI", title: "LS4.D — Biodiversity & Humans", description: "Changes in biodiversity can influence humans' resources, such as food, energy, and medicines, as well as ecosystem services that humans rely on." },
    { code: "MS-LS2-5.CCC", type: "CCC", title: "Stability & Change", description: "Small changes in one part of a system might cause large changes in another part." },
  ],

  "MS-LS3-1": [
    { code: "MS-LS3-1.SEP", type: "SEP", title: "Developing & Using Models", description: "Develop and use a model to describe phenomena." },
    { code: "MS-LS3-1.DCI", type: "DCI", title: "LS3.A — Inheritance of Traits", description: "Genes are located in the chromosomes of cells, with each chromosome pair containing two variants of each of many distinct genes." },
    { code: "MS-LS3-1.CCC", type: "CCC", title: "Cause & Effect", description: "Cause-and-effect relationships may be used to predict phenomena in natural systems." },
  ],
  "MS-LS3-2": [
    { code: "MS-LS3-2.SEP", type: "SEP", title: "Developing & Using Models", description: "Develop and use a model to describe phenomena." },
    { code: "MS-LS3-2.DCI", type: "DCI", title: "LS3.B — Variation of Traits", description: "In sexually reproducing organisms, each parent contributes half of the genes acquired (at random) by the offspring. Individuals have two of each chromosome and hence two alleles of each gene, one acquired from each parent." },
    { code: "MS-LS3-2.CCC", type: "CCC", title: "Cause & Effect", description: "Cause-and-effect relationships may be used to predict phenomena in natural systems." },
  ],

  "MS-LS4-1": [
    { code: "MS-LS4-1.SEP", type: "SEP", title: "Analyzing & Interpreting Data", description: "Analyze and interpret data to determine similarities and differences in findings." },
    { code: "MS-LS4-1.DCI", type: "DCI", title: "LS4.A — Evidence of Common Ancestry & Diversity", description: "The collection of fossils and their placement in chronological order is known as the fossil record. It documents the existence, diversity, extinction, and change of many life forms throughout the history of life on Earth." },
    { code: "MS-LS4-1.CCC", type: "CCC", title: "Patterns", description: "Graphs, charts, and images can be used to identify patterns in data." },
  ],
  "MS-LS4-2": [
    { code: "MS-LS4-2.SEP", type: "SEP", title: "Constructing Explanations", description: "Apply scientific ideas to construct an explanation for real-world phenomena." },
    { code: "MS-LS4-2.DCI", type: "DCI", title: "LS4.A — Evidence of Common Ancestry & Diversity", description: "Anatomical similarities and differences between various organisms living today and between them and organisms in the fossil record, enable the reconstruction of evolutionary history." },
    { code: "MS-LS4-2.CCC", type: "CCC", title: "Patterns", description: "Patterns can be used to identify cause-and-effect relationships." },
  ],
  "MS-LS4-3": [
    { code: "MS-LS4-3.SEP", type: "SEP", title: "Analyzing & Interpreting Data", description: "Analyze displays of pictorial data to compare patterns." },
    { code: "MS-LS4-3.DCI", type: "DCI", title: "LS4.A — Evidence of Common Ancestry & Diversity", description: "Comparison of the embryological development of different species also reveals similarities that show relationships not evident in the fully-formed anatomy." },
    { code: "MS-LS4-3.CCC", type: "CCC", title: "Patterns", description: "Patterns can be used to identify cause-and-effect relationships." },
  ],
  "MS-LS4-4": [
    { code: "MS-LS4-4.SEP", type: "SEP", title: "Constructing Explanations", description: "Construct an explanation that includes qualitative or quantitative relationships between variables." },
    { code: "MS-LS4-4.DCI", type: "DCI", title: "LS4.B — Natural Selection", description: "Natural selection leads to the predominance of certain traits in a population, and the suppression of others." },
    { code: "MS-LS4-4.CCC", type: "CCC", title: "Cause & Effect", description: "Phenomena may have more than one cause." },
  ],
  "MS-LS4-5": [
    { code: "MS-LS4-5.SEP", type: "SEP", title: "Obtaining, Evaluating & Communicating Information", description: "Gather, read, and synthesize information from multiple appropriate sources." },
    { code: "MS-LS4-5.DCI", type: "DCI", title: "LS4.B — Natural Selection", description: "In artificial selection, humans have the capacity to influence certain characteristics of organisms by selective breeding." },
    { code: "MS-LS4-5.CCC", type: "CCC", title: "Cause & Effect", description: "Phenomena may have more than one cause." },
  ],
  "MS-LS4-6": [
    { code: "MS-LS4-6.SEP", type: "SEP", title: "Using Mathematics & Computational Thinking", description: "Use mathematical representations to support scientific conclusions." },
    { code: "MS-LS4-6.DCI", type: "DCI", title: "LS4.C — Adaptation", description: "Adaptation by natural selection acting over generations is one important process by which species change over time in response to changes in environmental conditions." },
    { code: "MS-LS4-6.CCC", type: "CCC", title: "Cause & Effect", description: "Cause-and-effect relationships may be used to predict phenomena in natural systems." },
  ],

  // ===== Earth & Space Science =====
  "MS-ESS1-1": [
    { code: "MS-ESS1-1.SEP", type: "SEP", title: "Developing & Using Models", description: "Develop and use a model to describe phenomena." },
    { code: "MS-ESS1-1.DCI", type: "DCI", title: "ESS1.A — The Universe & Its Stars / ESS1.B — Earth & the Solar System", description: "Patterns of the apparent motion of the sun, the moon, and stars in the sky can be observed, described, predicted, and explained with models. This model of the solar system can explain eclipses of the sun and the moon." },
    { code: "MS-ESS1-1.CCC", type: "CCC", title: "Patterns", description: "Patterns can be used to identify cause-and-effect relationships." },
  ],
  "MS-ESS1-2": [
    { code: "MS-ESS1-2.SEP", type: "SEP", title: "Developing & Using Models", description: "Develop and use a model to describe unobservable mechanisms." },
    { code: "MS-ESS1-2.DCI", type: "DCI", title: "ESS1.A — The Universe & Its Stars / ESS1.B — Earth & the Solar System", description: "The solar system consists of the sun and a collection of objects, including planets, their moons, and asteroids, held in orbit by the sun's gravitational pull on them." },
    { code: "MS-ESS1-2.CCC", type: "CCC", title: "Systems & System Models", description: "Models can be used to represent systems and their interactions." },
  ],
  "MS-ESS1-3": [
    { code: "MS-ESS1-3.SEP", type: "SEP", title: "Analyzing & Interpreting Data", description: "Analyze and interpret data to determine similarities and differences in findings." },
    { code: "MS-ESS1-3.DCI", type: "DCI", title: "ESS1.B — Earth & the Solar System", description: "The solar system contains many varied objects held together by gravity. Solar system models explain and predict eclipses, lunar phases, and seasons." },
    { code: "MS-ESS1-3.CCC", type: "CCC", title: "Scale, Proportion & Quantity", description: "Time, space, and energy phenomena can be observed at various scales using models to study systems that are too large or too small." },
  ],
  "MS-ESS1-4": [
    { code: "MS-ESS1-4.SEP", type: "SEP", title: "Constructing Explanations", description: "Construct a scientific explanation based on valid and reliable evidence." },
    { code: "MS-ESS1-4.DCI", type: "DCI", title: "ESS1.C — The History of Planet Earth", description: "The geologic time scale interpreted from rock strata provides a way to organize Earth's history. Major historical events include the formation of mountain chains and ocean basins, the evolution and extinction of particular living organisms, volcanic eruptions, periods of massive glaciation, and development of watersheds and rivers through glaciation and water erosion." },
    { code: "MS-ESS1-4.CCC", type: "CCC", title: "Scale, Proportion & Quantity", description: "Time, space, and energy phenomena can be observed at various scales using models to study systems that are too large or too small." },
  ],

  "MS-ESS2-1": [
    { code: "MS-ESS2-1.SEP", type: "SEP", title: "Developing & Using Models", description: "Develop a model to describe unobservable mechanisms." },
    { code: "MS-ESS2-1.DCI", type: "DCI", title: "ESS2.A — Earth's Materials & Systems", description: "All Earth processes are the result of energy flowing and matter cycling within and among the planet's systems." },
    { code: "MS-ESS2-1.CCC", type: "CCC", title: "Stability & Change", description: "Explanations of stability and change in natural or designed systems can be constructed by examining the changes over time and forces at different scales." },
  ],
  "MS-ESS2-2": [
    { code: "MS-ESS2-2.SEP", type: "SEP", title: "Constructing Explanations", description: "Construct a scientific explanation based on valid and reliable evidence." },
    { code: "MS-ESS2-2.DCI", type: "DCI", title: "ESS2.A — Earth's Materials & Systems / ESS2.C — The Roles of Water in Earth's Surface Processes", description: "The planet's systems interact over scales that range from microscopic to global in size, and they operate over fractions of a second to billions of years." },
    { code: "MS-ESS2-2.CCC", type: "CCC", title: "Scale, Proportion & Quantity", description: "Time, space, and energy phenomena can be observed at various scales using models to study systems that are too large or too small." },
  ],
  "MS-ESS2-3": [
    { code: "MS-ESS2-3.SEP", type: "SEP", title: "Analyzing & Interpreting Data", description: "Analyze and interpret data to provide evidence for phenomena." },
    { code: "MS-ESS2-3.DCI", type: "DCI", title: "ESS2.B — Plate Tectonics & Large-Scale System Interactions", description: "Maps of ancient land and water patterns, based on investigations of rocks and fossils, make clear how Earth's plates have moved great distances, collided, and spread apart." },
    { code: "MS-ESS2-3.CCC", type: "CCC", title: "Patterns", description: "Patterns in rates of change and other numerical relationships can provide information about natural systems." },
  ],
  "MS-ESS2-4": [
    { code: "MS-ESS2-4.SEP", type: "SEP", title: "Developing & Using Models", description: "Develop a model to describe unobservable mechanisms." },
    { code: "MS-ESS2-4.DCI", type: "DCI", title: "ESS2.C — The Roles of Water in Earth's Surface Processes", description: "Water continually cycles among land, ocean, and atmosphere via transpiration, evaporation, condensation and crystallization, and precipitation, as well as downhill flows on land." },
    { code: "MS-ESS2-4.CCC", type: "CCC", title: "Energy & Matter", description: "Within a natural or designed system, the transfer of energy drives the motion and/or cycling of matter." },
  ],
  "MS-ESS2-5": [
    { code: "MS-ESS2-5.SEP", type: "SEP", title: "Planning & Carrying Out Investigations", description: "Collect data to produce data to serve as the basis for evidence." },
    { code: "MS-ESS2-5.DCI", type: "DCI", title: "ESS2.C — The Roles of Water / ESS2.D — Weather & Climate", description: "The complex patterns of the changes and the movement of water in the atmosphere, determined by winds, landforms, and ocean temperatures and currents, are major determinants of local weather patterns." },
    { code: "MS-ESS2-5.CCC", type: "CCC", title: "Cause & Effect", description: "Cause-and-effect relationships may be used to predict phenomena in natural systems." },
  ],
  "MS-ESS2-6": [
    { code: "MS-ESS2-6.SEP", type: "SEP", title: "Developing & Using Models", description: "Develop and use a model to describe phenomena." },
    { code: "MS-ESS2-6.DCI", type: "DCI", title: "ESS2.C — The Roles of Water / ESS2.D — Weather & Climate", description: "Variations in density due to variations in temperature and salinity drive a global pattern of interconnected ocean currents. Weather and climate are influenced by interactions involving sunlight, the ocean, the atmosphere, ice, landforms, and living things." },
    { code: "MS-ESS2-6.CCC", type: "CCC", title: "Systems & System Models", description: "Models can be used to represent systems and their interactions." },
  ],

  "MS-ESS3-1": [
    { code: "MS-ESS3-1.SEP", type: "SEP", title: "Constructing Explanations", description: "Construct a scientific explanation based on valid and reliable evidence." },
    { code: "MS-ESS3-1.DCI", type: "DCI", title: "ESS3.A — Natural Resources", description: "Humans depend on Earth's land, ocean, atmosphere, and biosphere for many different resources. Minerals, fresh water, and biosphere resources are limited." },
    { code: "MS-ESS3-1.CCC", type: "CCC", title: "Cause & Effect", description: "Cause-and-effect relationships may be used to predict phenomena in natural systems." },
  ],
  "MS-ESS3-2": [
    { code: "MS-ESS3-2.SEP", type: "SEP", title: "Analyzing & Interpreting Data", description: "Analyze and interpret data to determine similarities and differences in findings." },
    { code: "MS-ESS3-2.DCI", type: "DCI", title: "ESS3.B — Natural Hazards", description: "Mapping the history of natural hazards in a region, combined with an understanding of related geologic forces, can help forecast the likelihood and severity of future events." },
    { code: "MS-ESS3-2.CCC", type: "CCC", title: "Patterns", description: "Graphs, charts, and images can be used to identify patterns in data." },
  ],
  "MS-ESS3-3": [
    { code: "MS-ESS3-3.SEP", type: "SEP", title: "Constructing Explanations & Designing Solutions", description: "Apply scientific principles to design an object, tool, process or system." },
    { code: "MS-ESS3-3.DCI", type: "DCI", title: "ESS3.C — Human Impacts on Earth Systems", description: "Human activities have significantly altered the biosphere, sometimes damaging or destroying natural habitats and causing the extinction of other species. But changes to Earth's environments can have different impacts." },
    { code: "MS-ESS3-3.CCC", type: "CCC", title: "Cause & Effect", description: "Relationships can be classified as causal or correlational, and correlation does not necessarily imply causation." },
  ],

  // ===== Physical Science =====
  "MS-PS1-1": [
    { code: "MS-PS1-1.SEP", type: "SEP", title: "Developing & Using Models", description: "Develop a model to predict and/or describe phenomena." },
    { code: "MS-PS1-1.DCI", type: "DCI", title: "PS1.A — Structure & Properties of Matter", description: "Substances are made from different types of atoms, which combine with one another in various ways. Atoms form molecules that range in size from two to thousands of atoms." },
    { code: "MS-PS1-1.CCC", type: "CCC", title: "Scale, Proportion & Quantity", description: "Time, space, and energy phenomena can be observed at various scales using models to study systems that are too large or too small." },
  ],
  "MS-PS1-2": [
    { code: "MS-PS1-2.SEP", type: "SEP", title: "Analyzing & Interpreting Data", description: "Analyze and interpret data to determine similarities and differences in findings." },
    { code: "MS-PS1-2.DCI", type: "DCI", title: "PS1.A — Structure & Properties of Matter / PS1.B — Chemical Reactions", description: "Each pure substance has characteristic physical and chemical properties that can be used to identify it. Substances react chemically in characteristic ways." },
    { code: "MS-PS1-2.CCC", type: "CCC", title: "Patterns", description: "Macroscopic patterns are related to the nature of microscopic and atomic-level structure." },
  ],
  "MS-PS1-3": [
    { code: "MS-PS1-3.SEP", type: "SEP", title: "Obtaining, Evaluating & Communicating Information", description: "Gather, read, and synthesize information from multiple appropriate sources." },
    { code: "MS-PS1-3.DCI", type: "DCI", title: "PS1.A — Structure & Properties of Matter / PS1.B — Chemical Reactions", description: "Each pure substance has characteristic physical and chemical properties that can be used to identify it. Synthetic materials come from natural resources and impact society." },
    { code: "MS-PS1-3.CCC", type: "CCC", title: "Structure & Function", description: "Structures can be designed to serve particular functions by taking into account properties of different materials." },
  ],
  "MS-PS1-4": [
    { code: "MS-PS1-4.SEP", type: "SEP", title: "Developing & Using Models", description: "Develop a model that predicts and describes changes in particle motion, temperature, and state of a pure substance when thermal energy is added or removed." },
    { code: "MS-PS1-4.DCI", type: "DCI", title: "PS1.A — Structure & Properties of Matter / PS3.A — Definitions of Energy", description: "Gases and liquids are made of molecules or inert atoms that are moving about relative to each other. The changes of state that occur with variations in temperature or pressure can be described and predicted using models of matter." },
    { code: "MS-PS1-4.CCC", type: "CCC", title: "Cause & Effect", description: "Cause-and-effect relationships may be used to predict phenomena in natural or designed systems." },
  ],
  "MS-PS1-5": [
    { code: "MS-PS1-5.SEP", type: "SEP", title: "Developing & Using Models", description: "Develop and use a model to describe unobservable mechanisms." },
    { code: "MS-PS1-5.DCI", type: "DCI", title: "PS1.B — Chemical Reactions", description: "Substances react chemically in characteristic ways. In a chemical process, the atoms that make up the original substances are regrouped into different molecules, and these new substances have different properties from those of the reactants." },
    { code: "MS-PS1-5.CCC", type: "CCC", title: "Energy & Matter", description: "Matter is conserved because atoms are conserved in physical and chemical processes." },
  ],
  "MS-PS1-6": [
    { code: "MS-PS1-6.SEP", type: "SEP", title: "Constructing Explanations & Designing Solutions", description: "Undertake a design project, engaging in the design cycle, to construct and/or implement a solution that meets specific design criteria and constraints." },
    { code: "MS-PS1-6.DCI", type: "DCI", title: "PS1.B — Chemical Reactions / ETS1.B — Developing Possible Solutions", description: "Some chemical reactions release energy, others store energy. A solution needs to be tested, and then modified on the basis of the test results, in order to improve it." },
    { code: "MS-PS1-6.CCC", type: "CCC", title: "Energy & Matter", description: "The transfer of energy can be tracked as energy flows through a designed or natural system." },
  ],

  "MS-PS2-1": [
    { code: "MS-PS2-1.SEP", type: "SEP", title: "Constructing Explanations & Designing Solutions", description: "Apply scientific ideas or principles to design, construct, and test a design of an object, tool, process, or system." },
    { code: "MS-PS2-1.DCI", type: "DCI", title: "PS2.A — Forces & Motion", description: "For any pair of interacting objects, the force exerted by the first object on the second object is equal in strength to the force that the second object exerts on the first, but in the opposite direction (Newton's third law)." },
    { code: "MS-PS2-1.CCC", type: "CCC", title: "Systems & System Models", description: "Models can be used to represent systems and their interactions—such as inputs, processes, and outputs." },
  ],
  "MS-PS2-2": [
    { code: "MS-PS2-2.SEP", type: "SEP", title: "Planning & Carrying Out Investigations", description: "Plan an investigation individually and collaboratively." },
    { code: "MS-PS2-2.DCI", type: "DCI", title: "PS2.A — Forces & Motion", description: "The motion of an object is determined by the sum of the forces acting on it; if the total force on the object is not zero, its motion will change. The greater the mass of the object, the greater the force needed to achieve the same change in motion." },
    { code: "MS-PS2-2.CCC", type: "CCC", title: "Stability & Change", description: "Explanations of stability and change in natural or designed systems can be constructed by examining the changes over time and forces at different scales." },
  ],
  "MS-PS2-3": [
    { code: "MS-PS2-3.SEP", type: "SEP", title: "Asking Questions & Defining Problems", description: "Ask questions that can be investigated within the scope of the classroom, outdoor environment, and museums." },
    { code: "MS-PS2-3.DCI", type: "DCI", title: "PS2.B — Types of Interactions", description: "Electric and magnetic (electromagnetic) forces can be attractive or repulsive, and their sizes depend on the magnitudes of the charges, currents, or magnetic strengths involved and on the distances between the interacting objects." },
    { code: "MS-PS2-3.CCC", type: "CCC", title: "Cause & Effect", description: "Cause-and-effect relationships may be used to predict phenomena in natural or designed systems." },
  ],
  "MS-PS2-4": [
    { code: "MS-PS2-4.SEP", type: "SEP", title: "Engaging in Argument from Evidence", description: "Construct and present oral and written arguments supported by empirical evidence and scientific reasoning." },
    { code: "MS-PS2-4.DCI", type: "DCI", title: "PS2.B — Types of Interactions", description: "Gravitational forces are always attractive. There is a gravitational force between any two masses, but it is very small except when one or both of the objects have large mass." },
    { code: "MS-PS2-4.CCC", type: "CCC", title: "Systems & System Models", description: "Models can be used to represent systems and their interactions." },
  ],
  "MS-PS2-5": [
    { code: "MS-PS2-5.SEP", type: "SEP", title: "Planning & Carrying Out Investigations", description: "Conduct an investigation and evaluate the experimental design to produce data to serve as the basis for evidence that meet the goals of the investigation." },
    { code: "MS-PS2-5.DCI", type: "DCI", title: "PS2.B — Types of Interactions", description: "Forces that act at a distance (electric, magnetic, and gravitational) can be explained by fields that extend through space and can be mapped by their effect on a test object." },
    { code: "MS-PS2-5.CCC", type: "CCC", title: "Cause & Effect", description: "Cause-and-effect relationships may be used to predict phenomena in natural or designed systems." },
  ],

  "MS-PS3-1": [
    { code: "MS-PS3-1.SEP", type: "SEP", title: "Analyzing & Interpreting Data", description: "Construct and interpret graphical displays of data to identify linear and nonlinear relationships." },
    { code: "MS-PS3-1.DCI", type: "DCI", title: "PS3.A — Definitions of Energy", description: "Motion energy is properly called kinetic energy; it is proportional to the mass of the moving object and grows with the square of its speed." },
    { code: "MS-PS3-1.CCC", type: "CCC", title: "Scale, Proportion & Quantity", description: "Proportional relationships among different types of quantities provide information about the magnitude of properties and processes." },
  ],
  "MS-PS3-2": [
    { code: "MS-PS3-2.SEP", type: "SEP", title: "Developing & Using Models", description: "Develop a model to describe unobservable mechanisms." },
    { code: "MS-PS3-2.DCI", type: "DCI", title: "PS3.A — Definitions of Energy / PS3.C — Relationship Between Energy & Forces", description: "A system of objects may also contain stored (potential) energy, depending on their relative positions. When two objects interacting through a field change relative position, the energy stored in the field is changed." },
    { code: "MS-PS3-2.CCC", type: "CCC", title: "Systems & System Models", description: "Models can be used to represent systems and their interactions—such as inputs, processes, and outputs." },
  ],
  "MS-PS3-3": [
    { code: "MS-PS3-3.SEP", type: "SEP", title: "Constructing Explanations & Designing Solutions", description: "Apply scientific ideas or principles to design, construct, and test a design of an object, tool, process or system." },
    { code: "MS-PS3-3.DCI", type: "DCI", title: "PS3.A — Definitions of Energy / PS3.B — Conservation of Energy & Energy Transfer", description: "Temperature is a measure of the average kinetic energy of particles of matter. The relationship between the temperature and the total energy of a system depends on the types, states, and amounts of matter present." },
    { code: "MS-PS3-3.CCC", type: "CCC", title: "Energy & Matter", description: "The transfer of energy can be tracked as energy flows through a designed or natural system." },
  ],
  "MS-PS3-4": [
    { code: "MS-PS3-4.SEP", type: "SEP", title: "Planning & Carrying Out Investigations", description: "Plan an investigation individually and collaboratively, and in the design identify independent and dependent variables and controls." },
    { code: "MS-PS3-4.DCI", type: "DCI", title: "PS3.A — Definitions of Energy / PS3.B — Conservation of Energy & Energy Transfer", description: "The amount of energy transfer needed to change the temperature of a matter sample by a given amount depends on the nature of the matter, the size of the sample, and the environment." },
    { code: "MS-PS3-4.CCC", type: "CCC", title: "Scale, Proportion & Quantity", description: "Proportional relationships among different types of quantities provide information about the magnitude of properties and processes." },
  ],
  "MS-PS3-5": [
    { code: "MS-PS3-5.SEP", type: "SEP", title: "Engaging in Argument from Evidence", description: "Construct, use, and present oral and written arguments supported by empirical evidence and scientific reasoning." },
    { code: "MS-PS3-5.DCI", type: "DCI", title: "PS3.B — Conservation of Energy & Energy Transfer", description: "When the motion energy of an object changes, there is inevitably some other change in energy at the same time." },
    { code: "MS-PS3-5.CCC", type: "CCC", title: "Energy & Matter", description: "Energy may take different forms (e.g. energy in fields, thermal energy, energy of motion)." },
  ],

  "MS-PS4-1": [
    { code: "MS-PS4-1.SEP", type: "SEP", title: "Using Mathematics & Computational Thinking", description: "Use mathematical representations to describe and/or support scientific conclusions and design solutions." },
    { code: "MS-PS4-1.DCI", type: "DCI", title: "PS4.A — Wave Properties", description: "A simple wave has a repeating pattern with a specific wavelength, frequency, and amplitude." },
    { code: "MS-PS4-1.CCC", type: "CCC", title: "Patterns", description: "Graphs and charts can be used to identify patterns in data." },
  ],
  "MS-PS4-2": [
    { code: "MS-PS4-2.SEP", type: "SEP", title: "Developing & Using Models", description: "Develop and use a model to describe phenomena." },
    { code: "MS-PS4-2.DCI", type: "DCI", title: "PS4.A — Wave Properties / PS4.B — Electromagnetic Radiation", description: "When light shines on an object, it is reflected, absorbed, or transmitted through the object, depending on the object's material and the frequency (color) of the light." },
    { code: "MS-PS4-2.CCC", type: "CCC", title: "Structure & Function", description: "Structures can be designed to serve particular functions by taking into account properties of different materials." },
  ],
  "MS-PS4-3": [
    { code: "MS-PS4-3.SEP", type: "SEP", title: "Obtaining, Evaluating & Communicating Information", description: "Integrate qualitative scientific and technical information in written text with that contained in media and visual displays to clarify claims and findings." },
    { code: "MS-PS4-3.DCI", type: "DCI", title: "PS4.C — Information Technologies & Instrumentation", description: "Digitized signals (sent as wave pulses) are a more reliable way to encode and transmit information." },
    { code: "MS-PS4-3.CCC", type: "CCC", title: "Structure & Function", description: "Structures can be designed to serve particular functions." },
  ],
};

/** Get all dimensions for a given PE code. Returns empty array if PE not found. */
export function getDimensionsForPE(code: string): NgssDimension[] {
  return NGSS_DIMENSIONS[code] || [];
}

/** Get a single dimension by its full code (e.g. "MS-LS1-1.SEP"). */
export function getDimensionByCode(code: string): NgssDimension | undefined {
  for (const dims of Object.values(NGSS_DIMENSIONS)) {
    const found = dims.find(d => d.code === code);
    if (found) return found;
  }
  return undefined;
}

/** Format dimensions as a teacher-readable bullet list for AI prompts. */
export function formatDimensionsForPrompt(dimensions: NgssDimension[]): string {
  if (dimensions.length === 0) return "";
  const byType: Record<NgssDimensionType, NgssDimension[]> = { SEP: [], DCI: [], CCC: [] };
  dimensions.forEach(d => byType[d.type].push(d));
  const sections: string[] = [];
  if (byType.SEP.length) {
    sections.push(`SCIENCE & ENGINEERING PRACTICES (the doing):\n${byType.SEP.map(d => `  • ${d.title} — ${d.description}`).join("\n")}`);
  }
  if (byType.DCI.length) {
    sections.push(`DISCIPLINARY CORE IDEAS (the knowing):\n${byType.DCI.map(d => `  • ${d.title} — ${d.description}`).join("\n")}`);
  }
  if (byType.CCC.length) {
    sections.push(`CROSSCUTTING CONCEPTS (the connecting lens):\n${byType.CCC.map(d => `  • ${d.title} — ${d.description}`).join("\n")}`);
  }
  return sections.join("\n\n");
}
