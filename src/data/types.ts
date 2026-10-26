// Shapes of the JSON produced by pipeline/stet/build.py (public/data/*.json)

export interface Option {
  label: string;
  text: string;
  textHi?: string | null;
  textInSource?: string;
}

export type AnswerStatus = "verified" | "disputed" | "ambiguous" | "source-key-unchecked" | "unavailable" | "ai-derived-only";

export interface Answer {
  index: number | null;
  label: string | null;
  source: "source-key" | "none";
  sourceDetail: string;
  textInSource?: string | null;
  crossPaper: "none" | "consistent" | "conflict";
  status: AnswerStatus;
  notes: string[];
}

export interface Match {
  id: string;
  type: "exact" | "paraphrase" | "concept";
  method: string;
  scores: { stem: number; stemTokenSet: number; cosine: number; options: number; answer: number | null };
  reason: string;
}

export type RepeatType = "exact" | "paraphrase" | "concept" | "unique";
export type Novelty = "repeat-of-earlier" | "new-variation-of-known-concept" | "first-appearance";

export interface Question {
  id: string;
  paperId: string;
  qno: number;
  sourceQuestionId: string | null;
  section: string;
  sectionSubject: string;
  text: string;
  textHi: string | null;
  textOrigin: string;
  options: Option[];
  answer: Answer;
  source: { pdf: string; pdfUrl: string; page: number; pageEnd: number };
  figures: { file: string; page: number }[];
  hasFigure: boolean;
  hindiFixes: string[];
  extractionIssues: string[];
  qtype: string;
  classification: { subject: string; topic: string; subtopic: string; method: string };
  concept: string | null;
  difficulty: "easy" | "medium" | "hard" | "not rated";
  difficultyMethod: string;
  explanation: { text: string; origin: string; annotatedFrom: string } | null;
  aiCheck: { derivedIndex: number | null; derivedLabel: string | null; confidence: string | null; assessment?: string | null; note: string } | null;
  repeat: {
    type: RepeatType;
    exactGroup: string | null;
    repeatGroup: string | null;
    conceptGroup: string | null;
    distinctPapers: number;
    conceptPapers: number;
    novelty: Novelty;
    matches: Match[];
  };
}

export interface Paper {
  id: string;
  label: string;
  shortLabel: string;
  exam: string;
  board: string;
  session: string;
  year: number;
  date: string;
  dateSource: string;
  shift: number;
  shiftSource: string;
  timeStart: string | null;
  timeEnd: string | null;
  paper: string;
  paperSource: string;
  subject: string;
  subjectCode: string;
  sourceFormat: string;
  sourceFormatLabel: string;
  answerKeySource: string;
  metaConflicts: string[];
  pdf: { name: string; md5: string; pages: number; url: string };
  questionCount: number;
  sections: { name: string; count: number }[];
}

export interface Group {
  id: string;
  kind: "exact" | "repeat" | "concept";
  members: string[];
  canonical: string;
  papers: string[];
  distinctPapers: number;
  sessions: string[];
  distinctSessions: number;
  years: number[];
  firstSeen: string;
  lastSeen: string;
  withinPaperDuplicates: string[];
}

export interface Groups {
  exact: Group[];
  repeat: Group[];
  concept: Group[];
}

export interface PaperStats {
  questions: number;
  bySubject: Record<string, number>;
  byTopic: Record<string, number>;
  byDifficulty: Record<string, number>;
  byType: Record<string, number>;
  repeated: number;
  repeatedPct: number;
  exactRepeats: number;
  paraphrasedRepeats: number;
  conceptRepeats: number;
  novelty: Record<string, number>;
  answerStatus: Record<string, number>;
  keyCoverage: number;
  issues: number;
}

export interface Stats {
  totals: Record<string, number | Record<string, number>> & {
    filesDiscovered: number;
    pdfsDiscovered: number;
    pdfsProcessed: number;
    pdfsFailed: number;
    questions: number;
    uniqueQuestions: number;
    uniqueAfterExactOnly: number;
    papers: number;
    years: number;
    sessions: number;
    examDays: number;
    shifts: number;
    repeatGroups: number;
    exactGroups: number;
    conceptGroups: number;
    questionsInRepeatGroups: number;
    crossSessionGroups: number;
    keyConflicts: number;
    reviewPairsPending: number;
    pagesTotal: number;
  };
  bySubject: Record<string, number>;
  byTopic: Record<string, number>;
  byDifficulty: Record<string, number>;
  byType: Record<string, number>;
  answerStatus: Record<string, number>;
  classificationMethod: Record<string, number>;
  explanations: number;
  papers: Record<string, PaperStats>;
}

export interface ManifestEntry {
  name: string;
  relativePath: string;
  sizeBytes: number;
  type: string;
  md5?: string;
  pages?: number;
  status: string;
  format?: string | null;
  questionsExtracted?: number;
  errors?: string[];
  warnings?: string[];
  emptyTextPages?: number[];
  pagesWithoutQuestions?: number[];
  paperId?: string;
  note?: string;
  duplicateOf?: string;
}

export interface Meta {
  generatedAt: string;
  pipelineVersion: string;
  sourceDir: string;
  annotationsLoaded: number;
  adjudicationsLoaded: number;
  syllabus: {
    file: string;
    description: string;
    examPattern: { subject: string; questions: number; marks: number }[];
    notes: string[];
  };
  taxonomy: Record<string, Record<string, string[]>>;
}

export interface Issue {
  severity: "error" | "warning" | "info";
  code: string;
  message: string;
  questionId: string | null;
  paperId: string | null;
}

export interface KeyConflict {
  id: string;
  status: string;
  key: string | null;
  ai: string | null;
  aiConfidence: string | null;
  crossPaper: string;
  notes: string[];
  aiNote: string;
}

export interface Quality {
  issues: Issue[];
  keyConflicts: KeyConflict[];
  reviewPairs: { a: string; b: string; scores: Match["scores"]; reason: string }[];
}

export interface Dataset {
  questions: Question[];
  papers: Paper[];
  groups: Groups;
  stats: Stats;
  meta: Meta;
  // derived indexes
  byId: Map<string, Question>;
  paperById: Map<string, Paper>;
  groupById: Map<string, Group>;
  haystack: Map<string, string>;
}
