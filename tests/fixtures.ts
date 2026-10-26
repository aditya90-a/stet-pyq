import { indexDataset } from "../src/data/store";
import type { Dataset, Group, Paper, Question } from "../src/data/types";

export function mkPaper(id: string, year: number, shift: number, date: string): Paper {
  return {
    id, label: `STET ${year} · ${date} · Shift ${shift}`, shortLabel: `${date} S${shift}`, exam: "Bihar STET", board: "BSEB", session: `STET ${year}`,
    year, date, dateSource: "test", shift, shiftSource: "test", timeStart: null, timeEnd: null, paper: "Paper II", paperSource: "", subject: "Computer Science",
    subjectCode: "226", sourceFormat: "test", sourceFormatLabel: "test", answerKeySource: "test key", metaConflicts: [],
    pdf: { name: `${id}.pdf`, md5: id, pages: 10, url: `pdfs/${id}.pdf` }, questionCount: 0, sections: [],
  };
}

let n = 0;
export function mkQ(paperId: string, over: Partial<Question> & { text: string }): Question {
  n++;
  return {
    id: `${paperId}-Q${String(n).padStart(3, "0")}`, paperId, qno: n, sourceQuestionId: null, section: "Part I", sectionSubject: "Computer Science",
    textHi: null, textOrigin: "pdf-text-layer",
    options: ["Alpha", "Beta", "Gamma", "Delta"].map((t, i) => ({ label: "ABCD"[i], text: t })),
    answer: { index: 0, label: "A", source: "source-key", sourceDetail: "test", crossPaper: "none", status: "verified", notes: [] },
    source: { pdf: `${paperId}.pdf`, pdfUrl: `pdfs/${paperId}.pdf`, page: 1, pageEnd: 1 },
    figures: [], hasFigure: false, hindiFixes: [], extractionIssues: [], qtype: "direct/conceptual",
    classification: { subject: "Computer Science", topic: "Digital Logic", subtopic: "Boolean Algebra & K-Maps", method: "test" },
    concept: null, difficulty: "easy", difficultyMethod: "test", explanation: null, aiCheck: null,
    repeat: { type: "unique", exactGroup: null, repeatGroup: null, conceptGroup: null, distinctPapers: 1, conceptPapers: 1, novelty: "first-appearance", matches: [] },
    ...over,
  };
}

export function mkDataset(questions: Question[], papers: Paper[], repeat: Group[] = []): Dataset {
  return indexDataset({
    questions, papers, groups: { exact: [], repeat, concept: [] },
    stats: {} as Dataset["stats"], meta: {} as Dataset["meta"],
  });
}

export function sample() {
  const p1 = mkPaper("2023-S1", 2023, 1, "2023-09-12");
  const p2 = mkPaper("2024-S1", 2024, 1, "2024-06-11");
  const fam = (id: string) => ({ type: "exact" as const, exactGroup: "EX1", repeatGroup: "RP1", conceptGroup: null, distinctPapers: 2, conceptPapers: 2, novelty: id === "b" ? ("repeat-of-earlier" as const) : ("first-appearance" as const), matches: [] });
  const qs = [
    mkQ(p1.id, { text: "Which protocol is used for sending e-mails?", repeat: fam("a"), classification: { subject: "Computer Science", topic: "Computer Network", subtopic: "Application Layer Protocols", method: "t" } }),
    mkQ(p2.id, { text: "Which protocol is used for sending emails ?", repeat: fam("b"), classification: { subject: "Computer Science", topic: "Computer Network", subtopic: "Application Layer Protocols", method: "t" } }),
    mkQ(p1.id, { text: "Full -adder has how many inputs?", textHi: "फ़ुल एडर में कितने इनपुट होते हैं?", difficulty: "medium" }),
    mkQ(p2.id, { text: "What is a flip-flop?", difficulty: "hard", answer: { index: 1, label: "B", source: "source-key", sourceDetail: "t", crossPaper: "none", status: "disputed", notes: [] } }),
    mkQ(p2.id, { text: "Bloom's taxonomy has how many domains?", sectionSubject: "Art of Teaching", classification: { subject: "Art of Teaching", topic: "Objectives of Education & Taxonomy", subtopic: "Bloom's Taxonomy & Learning Domains", method: "t" } }),
  ];
  const group: Group = { id: "RP1", kind: "repeat", members: [qs[0].id, qs[1].id], canonical: qs[1].id, papers: [p1.id, p2.id], distinctPapers: 2, sessions: ["STET 2023", "STET 2024"], distinctSessions: 2, years: [2023, 2024], firstSeen: p1.id, lastSeen: p2.id, withinPaperDuplicates: [] };
  return { ds: mkDataset(qs, [p1, p2], [group]), qs, p1, p2 };
}
