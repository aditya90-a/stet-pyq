import { HashRouter, Route, Routes } from "react-router-dom";
import { Layout } from "./components/Layout";
import { DataProvider } from "./data/store";
import { DsssbApp } from "./dsssb/DsssbApp";
import { About } from "./pages/About";
import { Explore } from "./pages/Explore";
import { Home } from "./pages/Home";
import { NotFound } from "./pages/NotFound";
import { PaperDetail, Papers } from "./pages/Papers";
import { Practice } from "./pages/Practice";
import { QuestionDetail } from "./pages/QuestionDetail";
import { Repeats } from "./pages/Repeats";
import { Saved } from "./pages/Saved";
import { Topics } from "./pages/Topics";

/** Bihar STET section: its own dataset, loaded only when a STET route is open. */
function StetShell() {
  return (
    <DataProvider>
      <Layout />
    </DataProvider>
  );
}

// HashRouter keeps the build servable from any static host (GitHub Pages has no SPA fallback).
export function App() {
  return (
    <HashRouter>
      <Routes>
        <Route path="dsssb/*" element={<DsssbApp />} />
        <Route element={<StetShell />}>
          <Route index element={<Home />} />
          <Route path="explore" element={<Explore />} />
          <Route path="q/:id" element={<QuestionDetail />} />
          <Route path="repeats" element={<Repeats />} />
          <Route path="topics" element={<Topics />} />
          <Route path="papers" element={<Papers />} />
          <Route path="papers/:id" element={<PaperDetail />} />
          <Route path="practice" element={<Practice />} />
          <Route path="saved" element={<Saved />} />
          <Route path="about" element={<About />} />
          <Route path="*" element={<NotFound />} />
        </Route>
      </Routes>
    </HashRouter>
  );
}
