// Shapes of the JSON produced by pipeline/dsssb/build.py (public/dsssb/data/*.json)

export type VStatus = "verified" | "corrected" | "disputed" | "unverified";
export type CheckResult = "pass" | "warn" | "fail" | "na";

export interface DOption {
  label: string;
  text: string;
  textHi: string | null;
  images: string[];
  imagesHi: string[];
  textOrigin: string;
}

export interface Check {
  id: string;
  label: string;
  result: CheckResult;
  detail: string;
}

export interface Correction {
  field: string;
  from: string;
  to: string;
  kind: string;
  reason: string;
  evidence: { pdf: string; page: number; image?: string | null };
}

export interface Evidence {
  type: string;
  file?: string;
  page?: number;
  pageEnd?: number;
  image?: string;
  text?: string;
  urls?: string[];
}

export interface DQuestion {
  id: string;
  paperId: string;
  qno: number;
  sectionQno: number | null;
  sourceQid: string | null;
  section: string;
  sectionRaw: string;
  part: "A" | "B" | "?";
  lang: "en" | "hi";
  text: string;
  textHi: string | null;
  passage: string | null;
  passageHi: string | null;
  passageImages: string[];
  options: DOption[];
  images: string[];
  imagesHi: string[];
  figureText?: string | null;
  figureDescription?: string;
  textOrigin: string;
  source: { pdf: string; pdfUrl: string; page: number; pageEnd: number; pageEn: number | null; pageHi: number | null };
  answer: {
    indices: number[];
    label: string | null;
    status: "keyed" | "dropped" | "missing" | "multiple";
    source: string;
    official: boolean;
    officialNote: string | null;
    crossPaper: "none" | "consistent" | "conflict";
  };
  classification: { subject: string; topic: string; subtopic: string; method: string; overrideReason?: string };
  concept: string | null;
  difficulty: "easy" | "medium" | "hard" | "not rated";
  explanation: { text: string; origin: string; annotatedFrom: string } | null;
  aiCheck: { derivedIndex: number | null; derivedLabel: string | null; confidence: string | null; assessment: string | null; note: string; reviewedAs: string } | null;
  repeat: {
    type: "exact" | "paraphrase" | "concept" | "unique";
    exactGroup: string | null;
    repeatGroup: string | null;
    conceptGroup: string | null;
    distinctPapers: number;
    conceptPapers: number;
    novelty: string;
    withinPaper: string[];
    matches: { id: string; type: string; method: string; reason: string }[];
  };
  verification: { status: VStatus; checks: Check[]; corrections: Correction[]; notes: string[]; evidence: Evidence[] };
  extractionIssues: string[];
  hindiFixes: string[];
  ocr: { engine: string; minConf: number; meanConf: number } | null;
}

export interface MetaCheck {
  field: string;
  result: "pass" | "fail";
  detail: string;
}

export interface DPaper {
  id: string;
  year: number;
  set?: number;
  postCode: string;
  advt: string;
  department: string;
  departmentShort: string;
  currentSyllabusMatch: string;
  label: string;
  labelHi: string;
  shortLabel: string;
  date: string | null;
  dateStatus: string;
  dateNote: string;
  inferredDate?: string;
  inferredDateNote?: string;
  shift: number | null;
  shiftLabel: string;
  shiftStatus: string;
  time: string | null;
  examDates: string[];
  answerKey: { label: string; detail: string; official: boolean; evidence: string[] };
  evidence: string[];
  metaChecks: MetaCheck[];
  metaConflicts: string[];
  printed: Record<string, unknown>;
  pdf: { name: string; md5: string; pages: number; url: string };
  questionCount: number;
  numbering: { count: number; duplicates: number[]; gaps: number[] };
  republishedBy?: string;
  stats: PaperStats;
}

export interface PaperStats {
  questions: number;
  bySubject: Record<string, number>;
  byTopic: Record<string, number>;
  byDifficulty: Record<string, number>;
  byStatus: Record<string, number>;
  repeated: number;
  conceptRepeated: number;
  dropped: number;
  explained: number;
}

export interface DGroup {
  id: string;
  kind: "exact" | "repeat" | "concept";
  members: string[];
  canonical: string;
  papers: string[];
  distinctPapers: number;
  years: number[];
  distinctYears: number;
  firstSeen: string;
  lastSeen: string;
  withinPaperDuplicates: string[];
  concept: string | null;
  topic: string;
  subject: string;
}

export interface TopicRow {
  subject: string;
  topic: string;
  questions: number;
  papersAsked: number;
  perPaper: number;
  perDoePaper: number | null;
  byPaper: Record<string, number>;
  byYear: Record<string, number>;
  bySubtopic: Record<string, number>;
  repeatedQuestions: number;
  conceptRepeats: number;
  difficulty: Record<string, number>;
}

export interface DStats {
  totals: Record<string, number>;
  byStatus: Record<string, number>;
  bySubject: Record<string, number>;
  byDifficulty: Record<string, number>;
  byTextOrigin: Record<string, number>;
  byYear: Record<string, { papers: string[]; questions: number; bySubject: Record<string, number>; bySubjectPerPaper: Record<string, number> }>;
  topics: TopicRow[];
  papers: Record<string, PaperStats>;
}

export interface TaxTopic {
  hi: string;
  subtopics: string[];
  units?: (number | string)[];
  outside41_26?: boolean;
}

export interface DMeta {
  generatedAt: string;
  pipelineVersion: string;
  annotationsLoaded: number;
  adjudicationsLoaded: number;
  taxonomy: Record<string, { part: "A" | "B"; hi: string; topics: Record<string, TaxTopic> }>;
}

export interface Fact {
  key: string;
  value: string;
  sourceUrl: string;
  sourceTitle?: string;
  official: boolean;
  accessed?: string;
  confidence: string;
  note?: string;
}

export interface SyllabusUnit {
  n: number;
  text: string;
  ocr: string | null;
  similarity: number;
  page: number;
  status: string;
  topics: string[];
}

export interface Exam {
  researchedOn: string;
  summary: string;
  current: Fact[];
  pattern: {
    name: string;
    appliesTo: string;
    durationMinutes: number;
    totalQuestions: number;
    totalMarks: number;
    markPerQuestion: number;
    negativeMarking: number;
    sections: { section: string; name: string; questions: number; marks: number }[];
    language: string;
    qualifyingRule2026: string;
    changesVsOlderRules: string[];
    sources: { url: string; title: string; official: boolean }[];
  };
  historyFacts: Fact[];
  postCodes: { postCode: string; advt: string; department: string; examDates: string[]; answerKeyPublished: string; sources: string[] }[];
  thirdParty: { source: string; official: boolean; note: string }[];
  openQuestions: string[];
  syllabus: {
    title: string;
    file: string | null;
    url: string;
    official: boolean;
    ocrEngine: string;
    transcriptionNote: string;
    csUnits: SyllabusUnit[];
    pedagogyUnits: SyllabusUnit[];
    sectionA: { title: string; url: string; parts: { subject: string; marks: number; text: string }[]; note: string };
  };
}

export interface OpenItem {
  id: string;
  paperId: string;
  qno: number;
  status: VStatus;
  section: string;
  text: string;
  sourceKey: string | null;
  aiAnswer: string | null;
  aiConfidence: string | null;
  failing: Check[];
  note: string;
}

export interface VReport {
  statusDefinitions: Record<VStatus, string>;
  totals: Record<string, number>;
  byPaper: Record<string, Record<string, number>>;
  checks: Record<string, Record<string, number>>;
  open: OpenItem[];
  corrections: (Correction & { id: string; paperId: string; qno: number })[];
  dropped: { id: string; paperId: string; qno: number; note: string }[];
  metadata: { paperId: string; label: string; checks: MetaCheck[]; conflicts: string[]; dateStatus: string; shiftStatus: string; numbering: { count: number; duplicates: number[]; gaps: number[] } }[];
  files: { name: string; status: string; format: string | null; pages: number | null; questionsExtracted: number | null; errors: string[]; warnings: string[] }[];
  syllabus: (SyllabusUnit & { part: string })[];
  pipelineProblems: string[];
}

export interface LibraryFile {
  name: string;
  type: string;
  sizeBytes: number;
  md5: string | null;
  pages: number | null;
  status: string;
  format: string | null;
  kind: "question-paper" | "syllabus" | "other";
  paperId: string | null;
  label: string;
  questions: number;
  pagesWithoutQuestions: number[];
  errors: string[];
  warnings: string[];
  verification: Record<string, number>;
  url: string;
}

export interface NoteIndexEntry {
  slug: string;
  subject: string;
  topic: string;
  topicHi: string;
  subtopics: string[];
  officialUnits: (number | string)[];
  outside41_26: boolean;
  pyqCount: number;
  available: boolean;
  titleHi?: string;
  summary?: string;
  sections?: number;
  flashcards?: number;
  formulas?: number;
  words?: number;
}

export interface NoteSection {
  heading: string;
  level: "basic" | "intermediate" | "advanced";
  subtopic?: string;
  body?: string;
  table?: { columns: string[]; rows: string[][] };
  code?: { lang: string; source: string; output?: string };
  diagram?: { title?: string; ascii: string };
}

export interface Note {
  slug: string;
  subject: string;
  topic: string;
  titleHi?: string;
  summary: string;
  sections: NoteSection[];
  formulas?: { name: string; formula: string; note?: string }[];
  workedExamples?: { problem: string; solution: string }[];
  pitfalls?: string[];
  quickRevision?: string[];
  flashcards?: { front: string; back: string }[];
  glossary?: { en: string; hi: string }[];
}

export interface DDataset {
  questions: DQuestion[];
  papers: DPaper[];
  groups: { exact: DGroup[]; repeat: DGroup[]; concept: DGroup[] };
  stats: DStats;
  meta: DMeta;
  exam: Exam;
  verification: VReport;
  library: LibraryFile[];
  notes: NoteIndexEntry[];
  byId: Map<string, DQuestion>;
  paperById: Map<string, DPaper>;
  groupById: Map<string, DGroup>;
  haystack: Map<string, string>;
}
