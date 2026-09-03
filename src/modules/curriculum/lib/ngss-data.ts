/**
 * Shared NGSS data constants extracted for reuse across components.
 */

export const DOK_LEVELS = [
  { value: 1, label: "1 – Recall & Reproduction" },
  { value: 2, label: "2 – Skills & Concepts" },
  { value: 3, label: "3 – Strategic Thinking" },
  { value: 4, label: "4 – Extended Thinking" },
];

export const BLOOMS_LEVELS = [
  { value: "Remember", label: "Remember" },
  { value: "Understand", label: "Understand" },
  { value: "Apply", label: "Apply" },
  { value: "Analyze", label: "Analyze" },
  { value: "Evaluate", label: "Evaluate" },
  { value: "Create", label: "Create" },
];

export interface NGSSSubstandard {
  code: string;
  description: string;
  keyTerms: string[];
}

// Complete list of all MS NGSS performance expectations with key terms for AI matching
export const ALL_SUBSTANDARDS: Record<string, NGSSSubstandard[]> = {
  "MS-LS1": [
    { code: "MS-LS1-1", description: "Conduct an investigation to provide evidence that living things are made of cells", keyTerms: ["cells", "cell theory", "unicellular", "multicellular", "microscope", "organism", "living things", "prokaryote", "eukaryote"] },
    { code: "MS-LS1-2", description: "Develop and use a model to describe the function of a cell as a whole and ways the parts of cells contribute to the function", keyTerms: ["cell membrane", "nucleus", "mitochondria", "organelle", "cell wall", "chloroplast", "cytoplasm", "ribosome", "vacuole", "cell parts", "cell function", "endoplasmic reticulum", "Golgi"] },
    { code: "MS-LS1-3", description: "Use argument supported by evidence for how the body is a system of interacting subsystems", keyTerms: ["body system", "organ system", "circulatory", "respiratory", "digestive", "nervous system", "skeletal", "muscular", "immune", "excretory", "integumentary", "endocrine", "subsystem", "organ", "tissue"] },
    { code: "MS-LS1-4", description: "Use argument based on empirical evidence and scientific reasoning to support an explanation for how characteristic animal behaviors and specialized plant structures affect the probability of successful reproduction", keyTerms: ["reproduction", "pollination", "mating", "courtship", "seed dispersal", "flower", "pollen", "fertilization", "sexual reproduction", "asexual reproduction", "offspring", "nesting", "migration"] },
    { code: "MS-LS1-5", description: "Construct a scientific explanation based on evidence for how environmental and genetic factors influence the growth of organisms", keyTerms: ["growth", "environment", "genetics", "nature vs nurture", "sunlight", "nutrients", "soil", "temperature", "genes", "inherited traits", "phenotype", "genotype", "development"] },
    { code: "MS-LS1-6", description: "Construct a scientific explanation based on evidence for the role of photosynthesis in the cycling of matter and flow of energy into and out of organisms", keyTerms: ["photosynthesis", "chlorophyll", "sunlight", "carbon dioxide", "oxygen", "glucose", "energy", "producer", "autotroph", "light energy", "chemical energy", "CO2", "plant", "leaf"] },
    { code: "MS-LS1-7", description: "Develop a model to describe how food is rearranged through chemical reactions forming new molecules that support growth and/or release energy", keyTerms: ["cellular respiration", "chemical reaction", "ATP", "metabolism", "food energy", "glucose breakdown", "digestion", "molecules", "chemical energy", "aerobic", "anaerobic"] },
    { code: "MS-LS1-8", description: "Gather and synthesize information that sensory receptors respond to stimuli by sending messages to the brain for immediate behavior or storage as memories", keyTerms: ["sensory receptor", "stimulus", "response", "brain", "nerve", "neuron", "senses", "sight", "hearing", "touch", "taste", "smell", "memory", "reflex", "signal"] },
  ],
  "MS-LS2": [
    { code: "MS-LS2-1", description: "Analyze and interpret data to provide evidence for the effects of resource availability on organisms and populations", keyTerms: ["population", "resource", "carrying capacity", "competition", "food web", "limiting factor", "habitat", "prey", "predator", "abundance", "scarcity", "population growth", "population decline"] },
    { code: "MS-LS2-2", description: "Construct an explanation that predicts patterns of interactions among organisms across multiple ecosystems", keyTerms: ["ecosystem", "symbiosis", "mutualism", "parasitism", "commensalism", "predator-prey", "competition", "food chain", "food web", "producer", "consumer", "decomposer", "niche", "biome"] },
    { code: "MS-LS2-3", description: "Develop a model to describe the cycling of matter and flow of energy among living and nonliving parts of an ecosystem", keyTerms: ["matter cycling", "energy flow", "carbon cycle", "nitrogen cycle", "water cycle", "decomposition", "trophic level", "energy pyramid", "food web", "nutrient cycle", "biotic", "abiotic"] },
    { code: "MS-LS2-4", description: "Construct an argument supported by empirical evidence that changes to physical or biological components of an ecosystem affect populations", keyTerms: ["ecosystem change", "habitat destruction", "invasive species", "pollution", "deforestation", "population impact", "biodiversity loss", "environmental change", "extinction", "endangered"] },
    { code: "MS-LS2-5", description: "Evaluate competing design solutions for maintaining biodiversity and ecosystem services", keyTerms: ["biodiversity", "conservation", "ecosystem services", "sustainability", "protected area", "restoration", "endangered species", "habitat preservation", "wildlife management"] },
  ],
  "MS-LS3": [
    { code: "MS-LS3-1", description: "Develop and use a model to describe why structural changes to genes (mutations) located on chromosomes may affect proteins and may result in harmful, beneficial, or neutral effects", keyTerms: ["mutation", "gene", "chromosome", "DNA", "protein", "genetic disorder", "harmful mutation", "beneficial mutation", "neutral mutation", "allele", "genetic code", "amino acid"] },
    { code: "MS-LS3-2", description: "Develop and use a model to describe why asexual reproduction results in offspring with identical genetic information and sexual reproduction results in offspring with genetic variation", keyTerms: ["asexual reproduction", "sexual reproduction", "genetic variation", "clone", "mitosis", "meiosis", "budding", "offspring", "heredity", "inheritance", "Punnett square", "dominant", "recessive", "trait"] },
  ],
  "MS-LS4": [
    { code: "MS-LS4-1", description: "Analyze and interpret data for patterns in the fossil record that document the existence, diversity, extinction, and change of life forms", keyTerms: ["fossil", "fossil record", "extinction", "paleontology", "geologic time", "era", "period", "epoch", "index fossil", "relative dating", "rock layer", "strata", "ancient life", "dinosaur", "prehistoric", "evolution evidence", "sedimentary rock", "petrified", "trace fossil", "body fossil"] },
    { code: "MS-LS4-2", description: "Apply scientific ideas to construct an explanation for the anatomical similarities and differences among modern organisms and between modern and fossil organisms", keyTerms: ["homologous structure", "analogous structure", "vestigial structure", "comparative anatomy", "common ancestor", "anatomical similarity", "structural similarity", "skeletal comparison", "limb structure", "evolution"] },
    { code: "MS-LS4-3", description: "Analyze displays of pictorial data to compare patterns of similarities in the embryological development across multiple species", keyTerms: ["embryo", "embryology", "embryological development", "developmental similarity", "fetus", "gestation", "comparative embryology", "common ancestor"] },
    { code: "MS-LS4-4", description: "Construct an explanation based on evidence that describes how genetic variations of traits in a population increase some individuals' probability of surviving and reproducing", keyTerms: ["natural selection", "survival", "adaptation", "fitness", "variation", "trait", "selective advantage", "camouflage", "mimicry", "survival of the fittest"] },
    { code: "MS-LS4-5", description: "Gather and synthesize information about technologies that have changed the way humans influence the inheritance of desired traits in organisms", keyTerms: ["selective breeding", "artificial selection", "genetic engineering", "GMO", "domestication", "breeding", "agriculture", "biotechnology", "cloning", "crossbreeding"] },
    { code: "MS-LS4-6", description: "Use mathematical representations to support explanations of how natural selection may lead to increases and decreases of specific traits in populations over time", keyTerms: ["natural selection", "population change", "trait frequency", "allele frequency", "generation", "population genetics", "evolution over time", "data", "graph", "proportion"] },
  ],
  "MS-ESS1": [
    { code: "MS-ESS1-1", description: "Develop and use a model of the Earth-sun-moon system to describe the cyclic patterns of lunar phases, eclipses of the sun and moon, and seasons", keyTerms: ["lunar phases", "moon phases", "eclipse", "solar eclipse", "lunar eclipse", "seasons", "Earth-sun-moon", "orbit", "rotation", "revolution", "tilt", "axis", "equinox", "solstice", "full moon", "new moon", "crescent", "quarter moon"] },
    { code: "MS-ESS1-2", description: "Develop and use a model to describe the role of gravity in the motions within galaxies and the solar system", keyTerms: ["gravity", "solar system", "galaxy", "orbit", "planet", "star", "sun", "Milky Way", "gravitational pull", "mass", "nebula", "nebular hypothesis", "protostar", "protoplanetary disk", "accretion", "formation of solar system"] },
    { code: "MS-ESS1-3", description: "Analyze and interpret data to determine scale properties of objects in the solar system", keyTerms: ["solar system scale", "planet size", "distance", "astronomical unit", "AU", "light year", "diameter", "mass comparison", "inner planets", "outer planets", "dwarf planet"] },
    { code: "MS-ESS1-4", description: "Construct a scientific explanation based on evidence from rock strata for how the geologic time scale is used to organize Earth's 4.6-billion-year-old history", keyTerms: ["geologic time scale", "rock strata", "rock layers", "eon", "era", "period", "epoch", "Precambrian", "Paleozoic", "Mesozoic", "Cenozoic", "Phanerozoic", "Hadean", "Archean", "Proterozoic", "relative age", "superposition", "stratigraphy", "Steno", "Smith", "correlation", "fossil correlation", "age of dinosaurs", "age of mammals", "Cambrian", "Ordovician", "Silurian", "Devonian", "Carboniferous", "Permian", "Triassic", "Jurassic", "Cretaceous", "Paleogene", "Neogene", "Quaternary"] },
  ],
  "MS-ESS2": [
    { code: "MS-ESS2-1", description: "Develop a model to describe the cycling of Earth's materials and the flow of energy that drives this process", keyTerms: ["rock cycle", "igneous", "sedimentary", "metamorphic", "magma", "lava", "weathering", "erosion", "deposition", "crystallization", "compaction", "cementation", "heat", "pressure", "mantle", "convection"] },
    { code: "MS-ESS2-2", description: "Construct an explanation based on evidence for how geoscience processes have changed Earth's surface at varying time and spatial scales", keyTerms: ["weathering", "erosion", "deposition", "landslide", "earthquake", "volcano", "mountain building", "canyon", "glacier", "delta", "plate tectonics", "geologic process", "landscape", "landform"] },
    { code: "MS-ESS2-3", description: "Analyze and interpret data on the distribution of fossils and rocks, continental shapes, and seafloor structures to provide evidence of the past plate motions", keyTerms: ["plate tectonics", "continental drift", "Pangaea", "seafloor spreading", "mid-ocean ridge", "fossil distribution", "continental shapes", "tectonic plate", "subduction", "convergent", "divergent", "transform", "Wegener"] },
    { code: "MS-ESS2-4", description: "Develop a model to describe the cycling of water through Earth's systems driven by energy from the sun and the force of gravity", keyTerms: ["water cycle", "evaporation", "condensation", "precipitation", "runoff", "groundwater", "transpiration", "aquifer", "infiltration", "water vapor", "cloud formation", "humidity"] },
    { code: "MS-ESS2-5", description: "Collect data to provide evidence for how the motions and complex interactions of air masses result in changes in weather conditions", keyTerms: ["weather", "air mass", "front", "cold front", "warm front", "pressure", "high pressure", "low pressure", "humidity", "temperature", "wind", "storm", "forecast", "barometer", "atmosphere"] },
    { code: "MS-ESS2-6", description: "Develop and use a model to describe how unequal heating and rotation of the Earth cause patterns of atmospheric and oceanic circulation", keyTerms: ["ocean current", "atmospheric circulation", "Coriolis effect", "convection current", "trade winds", "jet stream", "global wind", "unequal heating", "ocean circulation", "thermohaline", "climate pattern"] },
  ],
  "MS-ESS3": [
    { code: "MS-ESS3-1", description: "Construct a scientific explanation based on evidence for how the uneven distributions of Earth's mineral, energy, and groundwater resources are the result of past and current geoscience processes", keyTerms: ["mineral resource", "energy resource", "groundwater", "fossil fuel", "ore", "mining", "natural resource", "distribution", "geoscience process", "renewable", "nonrenewable"] },
    { code: "MS-ESS3-2", description: "Analyze and interpret data on natural hazards to forecast future catastrophic events and inform the development of technologies to mitigate their effects", keyTerms: ["natural hazard", "earthquake", "volcano", "tsunami", "hurricane", "tornado", "flood", "drought", "wildfire", "disaster", "mitigation", "preparedness", "forecast", "seismograph"] },
    { code: "MS-ESS3-3", description: "Apply scientific principles to design a method for monitoring and minimizing a human impact on the environment", keyTerms: ["human impact", "pollution", "climate change", "deforestation", "recycling", "conservation", "carbon footprint", "greenhouse gas", "sustainability", "renewable energy", "environmental monitoring"] },
  ],
  "MS-PS1": [
    { code: "MS-PS1-1", description: "Develop models to describe the atomic composition of simple molecules and extended structures", keyTerms: ["atom", "molecule", "element", "compound", "periodic table", "atomic structure", "proton", "neutron", "electron", "chemical formula", "bond", "ionic", "covalent", "crystal"] },
    { code: "MS-PS1-2", description: "Analyze and interpret data on the properties of substances before and after the substances interact to determine if a chemical reaction has occurred", keyTerms: ["chemical reaction", "chemical change", "physical change", "reactant", "product", "color change", "gas production", "precipitate", "temperature change", "pH", "indicator", "evidence of reaction"] },
    { code: "MS-PS1-3", description: "Gather and make sense of information to describe that synthetic materials come from natural resources and impact society", keyTerms: ["synthetic material", "natural resource", "plastic", "polymer", "nylon", "rubber", "manufacturing", "raw material", "petroleum", "synthetic fiber"] },
    { code: "MS-PS1-4", description: "Develop a model that predicts and describes changes in particle motion, temperature, and state of a pure substance when thermal energy is added or removed", keyTerms: ["states of matter", "solid", "liquid", "gas", "melting", "freezing", "boiling", "evaporation", "condensation", "sublimation", "thermal energy", "particle motion", "temperature", "phase change", "heat"] },
    { code: "MS-PS1-5", description: "Develop and use a model to describe how the total number of atoms does not change in a chemical reaction and thus mass is conserved", keyTerms: ["conservation of mass", "balanced equation", "chemical equation", "atoms", "mass", "law of conservation", "reactant", "product", "coefficient", "subscript"] },
    { code: "MS-PS1-6", description: "Undertake a design project to construct, test, and modify a device that either releases or absorbs thermal energy by chemical processes", keyTerms: ["exothermic", "endothermic", "thermal energy", "hand warmer", "cold pack", "chemical process", "heat release", "heat absorption", "design project", "engineering"] },
  ],
  "MS-PS2": [
    { code: "MS-PS2-1", description: "Apply Newton's Third Law to design a solution to a problem involving the motion of two colliding objects", keyTerms: ["Newton's Third Law", "action-reaction", "collision", "force pair", "equal and opposite", "momentum", "impact", "recoil", "rocket", "propulsion"] },
    { code: "MS-PS2-2", description: "Plan an investigation to provide evidence that the change in an object's motion depends on the sum of the forces acting on the object and the mass of the object", keyTerms: ["Newton's Second Law", "force", "mass", "acceleration", "F=ma", "net force", "unbalanced force", "balanced force", "inertia", "motion"] },
    { code: "MS-PS2-3", description: "Ask questions about data to determine the factors that affect the strength of electric and magnetic forces", keyTerms: ["electric force", "magnetic force", "electromagnet", "magnet", "charge", "static electricity", "attract", "repel", "magnetic field", "electric field", "pole", "current"] },
    { code: "MS-PS2-4", description: "Construct and present arguments using evidence to support the claim that gravitational interactions are attractive and depend on the masses of interacting objects", keyTerms: ["gravity", "gravitational force", "mass", "weight", "attraction", "Newton's Law of Gravitation", "distance", "gravitational pull"] },
    { code: "MS-PS2-5", description: "Conduct an investigation and evaluate the experimental design to provide evidence that fields exist between objects exerting forces on each other even though the objects are not in contact", keyTerms: ["field", "magnetic field", "electric field", "gravitational field", "non-contact force", "force at a distance", "field lines", "invisible force"] },
  ],
  "MS-PS3": [
    { code: "MS-PS3-1", description: "Construct and interpret graphical displays of data to describe the relationships of kinetic energy to the mass of an object and to the speed of an object", keyTerms: ["kinetic energy", "mass", "speed", "velocity", "motion", "graph", "energy of motion", "KE", "data display"] },
    { code: "MS-PS3-2", description: "Develop a model to describe that when the arrangement of objects interacting at a distance changes, different amounts of potential energy are stored in the system", keyTerms: ["potential energy", "gravitational potential energy", "elastic potential energy", "height", "stored energy", "position", "spring", "PE", "energy storage"] },
    { code: "MS-PS3-3", description: "Apply scientific principles to design, construct, and test a device that either minimizes or maximizes thermal energy transfer", keyTerms: ["thermal energy transfer", "conduction", "convection", "radiation", "insulation", "insulator", "conductor", "heat transfer", "thermos", "design project"] },
    { code: "MS-PS3-4", description: "Plan an investigation to determine the relationships among the energy transferred, the type of matter, the mass, and the change in the average kinetic energy of the particles as measured by the temperature of the sample", keyTerms: ["heat transfer", "specific heat", "temperature change", "energy transfer", "matter type", "mass", "thermal equilibrium", "calorimetry", "heating curve"] },
    { code: "MS-PS3-5", description: "Construct, use, and present arguments to support the claim that when the kinetic energy of an object changes, energy is transferred to or from the object", keyTerms: ["energy transfer", "kinetic energy change", "work", "energy conservation", "energy transformation", "mechanical energy", "friction"] },
  ],
  "MS-PS4": [
    { code: "MS-PS4-1", description: "Use mathematical representations to describe a simple model for waves that includes how the amplitude of a wave is related to the energy in a wave", keyTerms: ["wave", "amplitude", "wavelength", "frequency", "energy", "transverse wave", "longitudinal wave", "crest", "trough", "wave model", "period", "hertz"] },
    { code: "MS-PS4-2", description: "Develop and use a model to describe that waves are reflected, absorbed, or transmitted through various materials", keyTerms: ["reflection", "absorption", "transmission", "wave behavior", "light", "sound", "mirror", "opaque", "transparent", "translucent", "refraction", "medium"] },
    { code: "MS-PS4-3", description: "Integrate qualitative scientific and technical information to support the claim that digitized signals are a more reliable way to encode and transmit information than analog signals", keyTerms: ["digital signal", "analog signal", "binary", "encoding", "transmission", "pixel", "data", "signal", "noise", "reliability", "communication", "technology"] },
  ],
};

/** Get key terms for a specific standard code */
export function getKeyTermsForCode(code: string): string[] {
  for (const group of Object.values(ALL_SUBSTANDARDS)) {
    const standard = group.find(s => s.code === code);
    if (standard) return standard.keyTerms;
  }
  return [];
}

/** Get all standards as a flat array */
export function getAllStandardsFlat(): NGSSSubstandard[] {
  return Object.values(ALL_SUBSTANDARDS).flat();
}
