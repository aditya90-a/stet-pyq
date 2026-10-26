import { Route, Routes } from "react-router-dom";
import "./dsssb.css";
import { DLayout } from "./Layout";
import { DAnalysis, DRepeats } from "./pages/Analysis";
import { DAnalytics } from "./pages/Analytics";
import { DBank, DQuestionPage } from "./pages/Bank";
import { DExam } from "./pages/Exam";
import { DHome } from "./pages/Home";
import { DLibrary } from "./pages/Library";
import { DMock, DMockResult, DMockRun } from "./pages/Mock";
import { DNoteDetail, DNotesIndex } from "./pages/Notes";
import { DPlanner } from "./pages/Planner";
import { DRevise } from "./pages/Revise";
import { DSyllabus } from "./pages/Syllabus";
import { DVerification } from "./pages/Verification";
import { DsssbProvider } from "./store";

/** DSSSB TGT Computer Science section, mounted at /dsssb. */
export function DsssbApp() {
  return (
    <DsssbProvider>
      <Routes>
        <Route element={<DLayout />}>
          <Route index element={<DHome />} />
          <Route path="exam" element={<DExam />} />
          <Route path="syllabus" element={<DSyllabus />} />
          <Route path="notes" element={<DNotesIndex />} />
          <Route path="notes/:slug" element={<DNoteDetail />} />
          <Route path="analysis" element={<DAnalysis />} />
          <Route path="repeats" element={<DRepeats />} />
          <Route path="verification" element={<DVerification />} />
          <Route path="bank" element={<DBank />} />
          <Route path="q/:id" element={<DQuestionPage />} />
          <Route path="mock" element={<DMock />} />
          <Route path="mock/run" element={<DMockRun />} />
          <Route path="mock/result/:id" element={<DMockResult />} />
          <Route path="revise" element={<DRevise />} />
          <Route path="analytics" element={<DAnalytics />} />
          <Route path="planner" element={<DPlanner />} />
          <Route path="library" element={<DLibrary />} />
          <Route path="*" element={<DHome />} />
        </Route>
      </Routes>
    </DsssbProvider>
  );
}
