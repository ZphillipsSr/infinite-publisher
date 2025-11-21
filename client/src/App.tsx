import React, { useEffect, useState, useRef } from "react";
import "./App.css";
import ModelStatusPanel from "./components/ModelStatusPanel";

const API_BASE =
  import.meta.env.VITE_API_BASE_URL || "http://localhost:4000";
// ---------- Types ----------

type StyleProfile = {
  tone: string;
  audience: string;
  genre: string;
  pov: string;
  tense: string;
  pacing: string;
  formality: string;
  notes: string;
};

const emptyStyleProfile: StyleProfile = {
  tone: "",
  audience: "",
  genre: "",
  pov: "",
  tense: "",
  pacing: "",
  formality: "",
  notes: ""
};

type Project = {
  id: string;
  title: string;
  manuscript: string;
  createdAt: string;
  updatedAt: string;
  styleProfile?: StyleProfile;
};

type FormatResult = {
  wordCount: number;
  estimatedPages: number;
  trimSize: string;
  lineSpacing: number;
};

type ChatMessage = {
  role: "user" | "assistant";
  content: string;
};

function App() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(
    null
  );

  const [projectsLoading, setProjectsLoading] = useState<boolean>(false);
  const [projectsError, setProjectsError] = useState<string | null>(null);

  const [newTitle, setNewTitle] = useState("");
  const [manuscript, setManuscript] = useState("");
 const [importLoading, setImportLoading] = useState(false);
  const [importError, setImportError] = useState<string | null>(null);
  const [styleProfile, setStyleProfile] =
    useState<StyleProfile>(emptyStyleProfile);
  const [formatResult, setFormatResult] = useState<FormatResult | null>(null);

  const [trimSize, setTrimSize] = useState<"6x9" | "8.5x11">("6x9");
  const [lineSpacing, setLineSpacing] = useState<number>(1.15);

  const [showSettings, setShowSettings] = useState(false);
 

  const [envDebug, setEnvDebug] = useState<any | null>(null);
  const [envDebugLoading, setEnvDebugLoading] = useState(false);
  const [envDebugError, setEnvDebugError] = useState<string | null>(null);

  const [pageCountOverride, setPageCountOverride] = useState<string>("");
  const [paperType, setPaperType] = useState<string>("white");
  const [printSpecs, setPrintSpecs] = useState<any | null>(null);

  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [chatInput, setChatInput] = useState("");
  const [chatLoading, setChatLoading] = useState(false);

  const [rewriteLoading, setRewriteLoading] = useState(false);
  const [backCoverBlurb, setBackCoverBlurb] = useState("");
  const [backCoverLoading, setBackCoverLoading] = useState(false);

  const [chapterOutline, setChapterOutline] = useState("");
  const [outlineLoading, setOutlineLoading] = useState(false);

  const [researchQuery, setResearchQuery] = useState("");
  const [factClaim, setFactClaim] = useState("");
  const [researchResult, setResearchResult] = useState<any | null>(null);
  const [researchLoading, setResearchLoading] = useState(false);
  const [researchSuggestions, setResearchSuggestions] = useState<string[]>([]);

  const [manuscriptInsights, setManuscriptInsights] = useState<any | null>(
    null
  );

  // Autosave + status
  const [lastLocalSave, setLastLocalSave] = useState<string | null>(null);
  const [lastServerSave, setLastServerSave] = useState<string | null>(null);
  const [isDirty, setIsDirty] = useState<boolean>(false);

  const editorRef = useRef<HTMLTextAreaElement | null>(null);

  // ---- Load projects on mount ----
  const loadProjects = async () => {
    setProjectsLoading(true);
    setProjectsError(null);

    try {
      const res = await fetch(`${API_BASE}/api/projects`);
      if (!res.ok) {
        throw new Error(`HTTP ${res.status} ${res.statusText}`);
      }
      const data = await res.json();
      setProjects(data);
    } catch (err) {
      console.error("Failed to load projects", err);
      setProjectsError(
        "Could not load projects. Make sure the server is running on http://localhost:4000."
      );
    } finally {
      setProjectsLoading(false);
    }
  };

  const handleRetryLoadProjects = () => {
    loadProjects();
  };

  useEffect(() => {
    loadProjects();
  }, []);

  // ---- Autosave to localStorage when manuscript or styleProfile changes ----
  useEffect(() => {
    if (!selectedProjectId) return;

    try {
      const draft = {
        manuscript,
        styleProfile,
        savedAt: new Date().toISOString()
      };

      localStorage.setItem(
        `ipublisher-draft-${selectedProjectId}`,
        JSON.stringify(draft)
      );
      setLastLocalSave(draft.savedAt);
    } catch (e) {
      console.error("Failed to autosave draft to localStorage:", e);
    }
  }, [manuscript, styleProfile, selectedProjectId]);

  // ---- Warn before leaving page if there are unsaved changes ----
  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (!isDirty) return;
      e.preventDefault();
      e.returnValue = "";
    };

    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => window.removeEventListener("beforeunload", handleBeforeUnload);
  }, [isDirty]);

  const selectedProject =
    projects.find((p) => p.id === selectedProjectId) || null;

  // ---- Save Status Label (computed display string) ----
  const saveStatusLabel = (() => {
    if (!selectedProject) return "";

    if (isDirty) {
      return "Unsaved changes";
    }

    if (lastLocalSave) {
      return `Locally saved at ${new Date(
        lastLocalSave
      ).toLocaleTimeString()}`;
    }

    if (lastServerSave) {
      return `Saved to server at ${new Date(
        lastServerSave
      ).toLocaleTimeString()}`;
    }

    return "No saves yet";
  })();

  const handleSelectProject = (id: string) => {
    const proj = projects.find((p) => p.id === id);

    setSelectedProjectId(id);
    setFormatResult(null);
    setPrintSpecs(null);
    setManuscriptInsights(null);
    setChatMessages([]);
    setBackCoverBlurb("");
    setResearchResult(null);
    setResearchSuggestions([]);
    setChapterOutline("");

    // Defaults if nothing is found
    let loadedManuscript = "";
    let loadedProfile: StyleProfile = emptyStyleProfile;

    if (proj) {
      loadedManuscript = proj.manuscript || "";
      loadedProfile = proj.styleProfile || emptyStyleProfile;
      setLastServerSave(proj.updatedAt || null);
    } else {
      setLastServerSave(null);
    }

    // Try to load local draft (if any) — using SAME key as autosave
    if (proj) {
      const key = `ipublisher-draft-${proj.id}`;
      try {
        const raw = localStorage.getItem(key);
        if (raw) {
          const draft = JSON.parse(raw) as {
            manuscript?: string;
            styleProfile?: StyleProfile;
            savedAt?: string;
          };

          if (draft.manuscript && draft.manuscript.trim().length > 0) {
            loadedManuscript = draft.manuscript;
          }
          if (draft.styleProfile) {
            loadedProfile = draft.styleProfile;
          }
          if (draft.savedAt) {
            setLastLocalSave(draft.savedAt);
          } else {
            setLastLocalSave(null);
          }
        } else {
          setLastLocalSave(null);
        }
      } catch (e) {
        console.error("Failed to load local draft:", e);
        setLastLocalSave(null);
      }
    } else {
      setLastLocalSave(null);
    }

    // Finally hydrate editor + style profile and clear dirty flag
    setManuscript(loadedManuscript);
    setStyleProfile(loadedProfile);
    setIsDirty(false);
  };

  const handleCreateProject = async () => {
    if (!newTitle.trim()) {
      alert("Please enter a project title.");
      return;
    }
    try {
      const res = await fetch(`${API_BASE}/api/projects`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: newTitle.trim(),
          styleProfile: emptyStyleProfile
        })
      });
      const proj: Project = await res.json();
      setProjects((prev) => [proj, ...prev]);
      setNewTitle("");
      setSelectedProjectId(proj.id);
      setManuscript("");
      setStyleProfile(proj.styleProfile || emptyStyleProfile);
      setFormatResult(null);
      setPrintSpecs(null);
      setManuscriptInsights(null);
      setChatMessages([]);
      setBackCoverBlurb("");
      setResearchResult(null);
      setResearchSuggestions([]);
      setChapterOutline("");
      setLastServerSave(null);
      setLastLocalSave(null);
      setIsDirty(false);
    } catch (err) {
      console.error("Failed to create project", err);
    }
  };

  const handleSaveManuscript = async () => {
    if (!selectedProject) return;
    try {
      const res = await fetch(`${API_BASE}/api/projects/${selectedProject.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ manuscript, styleProfile })
      });
      const updated: Project = await res.json();
      setProjects((prev) =>
        prev.map((p) => (p.id === updated.id ? updated : p))
      );
      setStyleProfile(updated.styleProfile || emptyStyleProfile);

      setLastServerSave(updated.updatedAt);
      setIsDirty(false);

      alert("Manuscript and style profile saved.");
    } catch (err) {
      console.error("Failed to save manuscript", err);
    }
  };

  const handleDownloadManuscript = () => {
    if (!manuscript.trim()) {
      alert("There is no manuscript content to download.");
      return;
    }

    const blob = new Blob([manuscript], {
      type: "text/plain;charset=utf-8"
    });

    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");

    const safeTitle = (selectedProject?.title || "manuscript").replace(
      /[<>:"/\\|?*]+/g,
      "_"
    );

    a.href = url;
    a.download = `${safeTitle}.txt`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const handleDownloadDocx = async () => {
    if (!manuscript.trim()) {
      alert("Add some manuscript content first.");
      return;
    }

    if (!selectedProject) {
      alert("Open a project first.");
      return;
    }

    try {
      const res = await fetch(`${API_BASE}/api/manuscripts/export-docx`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          content: manuscript,
          trimSize,
          lineSpacing,
          title: selectedProject.title
        })
      });

      if (!res.ok) {
        const text = await res.text();
        console.error("DOCX download error:", res.status, text);
        alert("Failed to generate DOCX interior.");
        return;
      }

      const blob = await res.blob();
      const url = URL.createObjectURL(blob);

      const safeTitle =
        selectedProject.title.replace(/[<>:"/\\|?*]+/g, "_") || "manuscript";

      const a = document.createElement("a");
      a.href = url;
      a.download = `${safeTitle}-interior.docx`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error("DOCX download failed:", err);
      alert("Error contacting server for DOCX export.");
    }
  };

  const handleFormat = async () => {
    if (!manuscript.trim()) {
      alert("Add some manuscript content first.");
      return;
    }

    try {
      const res = await fetch(`${API_BASE}/api/manuscripts/format`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          content: manuscript,
          trimSize,
          lineSpacing
        })
      });

      const data = await res.json();
      setFormatResult(data);
      setPrintSpecs(null);
      setManuscriptInsights(null);
    } catch (err) {
      console.error("Failed to format manuscript", err);
    }
  };

  const handleCalculatePrintSpecs = () => {
    const override = pageCountOverride.trim();
    const basePageCount =
      override !== ""
        ? parseInt(override, 10)
        : formatResult?.estimatedPages;

    if (!basePageCount || isNaN(basePageCount) || basePageCount <= 0) {
      alert(
        "Enter a valid page count or run formatting first to get an estimate."
      );
      return;
    }

    const pageCount = basePageCount;
    const trim = trimSize;

    const [widthIn, heightIn] = trim === "6x9" ? [6, 9] : [8.5, 11];

    let perPage = 0.002252;
    if (paperType === "cream") perPage = 0.0025;
    if (paperType === "color") perPage = 0.002347;

    const spineWidthIn = pageCount * perPage;
    const spineWidthMm = spineWidthIn * 25.4;

    const fullCoverWidthIn = widthIn * 2 + spineWidthIn + 0.25;
    const fullCoverHeightIn = heightIn + 0.25;

    setPrintSpecs({
      pageCount,
      trim,
      paperType,
      widthIn,
      heightIn,
      spineWidthIn,
      spineWidthMm,
      fullCoverWidthIn,
      fullCoverHeightIn
    });
  };

  const handleAnalyzeManuscript = () => {
    const text = manuscript.trim();
    if (!text) {
      alert("Add some manuscript content first.");
      return;
    }

    const words = text
      .split(/\s+/)
      .map((w) => w.trim())
      .filter((w) => w.length > 0);
    const totalWords = words.length;
    const totalChars = text.length;

    const readingMinutes = totalWords / 250;
    const readingMinutesRounded = Math.max(1, Math.round(readingMinutes));

    const lines = text.split(/\r?\n/);
    const chapterIndices: number[] = [];

    const chapterHeadingRegex =
      /^(chapter\s+\d+|chapter\s+[ivxlcdm]+|CHAPTER\s+\d+|CHAPTER\s+[IVXLCDM]+)/;

    lines.forEach((line, index) => {
      if (chapterHeadingRegex.test(line.trim())) {
        chapterIndices.push(index);
      }
    });

    let chapterSummaries: {
      index: number;
      title: string;
      wordCount: number;
    }[] = [];

    if (chapterIndices.length === 0) {
      chapterSummaries = [
        {
          index: 0,
          title: "Whole manuscript",
          wordCount: totalWords
        }
      ];
    } else {
      for (let i = 0; i < chapterIndices.length; i++) {
        const start = chapterIndices[i];
        const end = chapterIndices[i + 1] ?? lines.length;

        const chapterLines = lines.slice(start, end);
        const chapterText = chapterLines.join("\n");

        const chapterWords = chapterText
          .split(/\s+/)
          .map((w) => w.trim())
          .filter((w) => w.length > 0);

        const titleLine = lines[start].trim();
        chapterSummaries.push({
          index: i + 1,
          title: titleLine || `Chapter ${i + 1}`,
          wordCount: chapterWords.length
        });
      }
    }

    const chapterCount = chapterSummaries.length;

    let longest = chapterSummaries[0];
    let shortest = chapterSummaries[0];

    for (const ch of chapterSummaries) {
      if (ch.wordCount > longest.wordCount) longest = ch;
      if (ch.wordCount < shortest.wordCount) shortest = ch;
    }

    const avgWordsPerChapter =
      chapterCount > 0
        ? Math.round(totalWords / chapterCount)
        : totalWords;

    setManuscriptInsights({
      totalWords,
      totalChars,
      readingMinutesRounded,
      chapterCount,
      avgWordsPerChapter,
      longest,
      shortest,
      chapterSummaries
    });
  };

   // Shared helper: import a file (text locally, others via server)
  const importManuscriptFile = async (file: File) => {
    setImportError(null);

    const lower = file.name.toLowerCase();

    // Simple text types handled fully on the client
    if (lower.endsWith(".txt") || lower.endsWith(".md")) {
      return new Promise<void>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = (e) => {
          const text = (e.target?.result as string) || "";
          setManuscript(text);
          setFormatResult(null);
          setPrintSpecs(null);
          setManuscriptInsights(null);
          setIsDirty(true);
          resolve();
        };
        reader.onerror = () => {
          alert("Failed to read file.");
          reject(new Error("FileReader failed"));
        };
        reader.readAsText(file);
      });
    }

    // Everything else goes through the server /api/manuscripts/import-binary
    const formData = new FormData();
    formData.append("file", file);

    setImportLoading(true);
    try {
      const res = await fetch(`${API_BASE}/api/manuscripts/import-binary`, {
        method: "POST",
        body: formData
      });

      if (!res.ok) {
        const text = await res.text();
        console.error("Import error:", res.status, text);
        setImportError(
          `Import failed (HTTP ${res.status}). See console for details.`
        );
        return;
      }

      const data = await res.json();
      if (!data.text || !data.text.trim()) {
        setImportError("The file was imported, but no text content was found.");
        return;
      }

      setManuscript(data.text);
      setFormatResult(null);
      setPrintSpecs(null);
      setManuscriptInsights(null);
      setIsDirty(true);
    } catch (err) {
      console.error("Import request failed:", err);
      setImportError("Error contacting server while importing file.");
    } finally {
      setImportLoading(false);
    }
  };

  // File input handler – reuses importManuscriptFile
  const handleFileUpload = async (
    event: React.ChangeEvent<HTMLInputElement>
  ) => {
    const file = event.target.files?.[0];
    if (!file) return;

    await importManuscriptFile(file);

    // Allow choosing the same file again later
    event.target.value = "";
  };
const handleDropOnEditor = async (
    event: React.DragEvent<HTMLDivElement>
  ) => {
    event.preventDefault();
    if (!event.dataTransfer.files || event.dataTransfer.files.length === 0) {
      return;
    }

    const file = event.dataTransfer.files[0];
    await importManuscriptFile(file);
  };

  const handleDragOverEditor = (event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    event.dataTransfer.dropEffect = "copy";
  };
  const handleRewriteSelection = async (instruction: string) => {
    if (!editorRef.current) {
      alert("Editor not ready.");
      return;
    }

    const textarea = editorRef.current;
    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;

    if (start === end) {
      alert("Select some text in the manuscript first.");
      return;
    }

    const selectedText = manuscript.slice(start, end);
    if (!selectedText.trim()) {
      alert("Selected text is empty.");
      return;
    }

    setRewriteLoading(true);

    try {
      const res = await fetch(`${API_BASE}/api/ai/rewrite`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          instruction,
          selectedText,
          manuscript,
          styleProfile
        })
      });

      const data = await res.json();

      if (data.error) {
        console.error("Rewrite error:", data.error);
        alert("Rewrite failed: " + data.error);
        return;
      }

      const rewritten: string = data.rewritten || selectedText;

      const newText =
        manuscript.slice(0, start) + rewritten + manuscript.slice(end);

      setManuscript(newText);
      setIsDirty(true);

      requestAnimationFrame(() => {
        if (!editorRef.current) return;
        const newEnd = start + rewritten.length;
        editorRef.current.focus();
        editorRef.current.setSelectionRange(start, newEnd);
      });
    } catch (err) {
      console.error("Rewrite request failed:", err);
      alert("Error contacting AI rewrite service.");
    } finally {
      setRewriteLoading(false);
    }
  };

  const handleSendChat = async () => {
    if (!chatInput.trim()) return;

    const userMessage: ChatMessage = {
      role: "user",
      content: chatInput.trim()
    };

    setChatMessages((prev) => [...prev, userMessage]);
    setChatInput("");
    setChatLoading(true);

    try {
      const res = await fetch(`${API_BASE}/api/ai/context`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: userMessage.content,
          manuscript,
          styleProfile
        })
      });

      const data = await res.json();

      const reply: ChatMessage = {
        role: "assistant",
        content: data.reply || "(no reply)"
      };

      setChatMessages((prev) => [...prev, reply]);
    } catch (err) {
      console.error("Chat failed", err);
      setChatMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          content: "Error contacting AI service in context mode."
        }
      ]);
    } finally {
      setChatLoading(false);
    }
  };

  const handleGenerateOutline = async () => {
    if (!manuscript.trim()) {
      alert("Add some manuscript content first.");
      return;
    }

    setOutlineLoading(true);

    try {
      const res = await fetch(`${API_BASE}/api/ai/context`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message:
            "From this manuscript, generate a structured chapter-by-chapter outline. " +
            "For each chapter or natural section, give: a short title, 2–4 sentence summary, and key themes. " +
            "If the manuscript is not clearly divided into chapters, infer logical sections. " +
            "Honor the author’s style profile (tone, audience, genre, etc.) when wording the summaries.",
          manuscript,
          styleProfile
        })
      });

      const data = await res.json();
      const reply: string =
        data.reply || "No outline could be generated from the manuscript.";

      setChapterOutline(reply);
    } catch (err) {
      console.error("Outline generation failed", err);
      alert("Error contacting AI for chapter outline.");
    } finally {
      setOutlineLoading(false);
    }
  };

  const handleGenerateBackCover = async () => {
    if (!manuscript.trim()) {
      alert("Add some manuscript content first.");
      return;
    }

    setBackCoverLoading(true);

    try {
      const res = await fetch(`${API_BASE}/api/ai/context`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message:
            "Using this manuscript and the author's style profile, write a compelling 2–3 paragraph back-cover book description suitable for Amazon KDP. " +
            "Focus on emotional resonance, clear stakes, and intrigue, without spoiling the entire arc. " +
            "Write in third-person, present tense, and aim for 150–250 words.",
          manuscript,
          styleProfile
        })
      });

      const data = await res.json();
      const reply: string =
        data.reply || "No back-cover description could be generated.";

      setBackCoverBlurb(reply);
    } catch (err) {
      console.error("Back-cover generation failed", err);
      alert("Error contacting AI for back-cover description.");
    } finally {
      setBackCoverLoading(false);
    }
  };

  const handleRunResearch = async () => {
    if (!researchQuery.trim()) {
      alert("Enter a search query.");
      return;
    }
    setResearchLoading(true);
    try {
      const res = await fetch(`${API_BASE}/api/research/search`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          query: researchQuery.trim()
                 })
      });
      const data = await res.json();
      setResearchResult({ mode: "search", data });
    } catch (err) {
      console.error("Research search failed", err);
      setResearchResult({
        mode: "error",
        data: { message: "Research search failed." }
      });
    } finally {
      setResearchLoading(false);
    }
  };

  const handleSuggestResearchTopics = () => {
    const text = manuscript;
    if (!text.trim()) {
      alert("Add some manuscript content first.");
      return;
    }

    const rawWords = text
      .split(/[^A-Za-z0-9]+/)
      .map((w) => w.trim())
      .filter((w) => w.length > 3);

    if (rawWords.length === 0) {
      alert("Not enough content to suggest topics.");
      return;
    }

    const stopWords = new Set([
      "this",
      "that",
      "with",
      "from",
      "have",
      "will",
      "they",
      "them",
      "then",
      "there",
      "here",
      "into",
      "about",
      "your",
      "their",
      "been",
      "what",
      "when",
      "where",
      "which",
      "would",
      "could",
      "should",
      "because",
      "while",
      "chapter",
      "section",
      "intro",
      "introduction",
      "conclusion",
      "the",
      "and",
      "for",
      "are",
      "was",
      "were",
      "you",
      "him",
      "her",
      "his",
      "she",
      "who",
      "why",
      "how",
      "these",
      "those"
    ]);

    const freq: Record<string, number> = {};
    for (const w of rawWords) {
      const key = w.toLowerCase();
      if (stopWords.has(key)) continue;
      freq[key] = (freq[key] || 0) + 1;
    }

    const candidates = Object.entries(freq)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 8)
      .map(([word]) => word);

    setResearchSuggestions(candidates);
  };

  const handleFactCheck = async () => {
    const targetClaim = factClaim.trim();
    if (!targetClaim) {
      alert("Enter a claim to fact-check.");
      return;
    }
    setResearchLoading(true);
    try {
      const res = await fetch(`${API_BASE}/api/research/fact-check`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          claim: targetClaim,
          context: manuscript.slice(0, 2000),
                  })
      });
      const data = await res.json();
      setResearchResult({ mode: "fact-check", data });
    } catch (err) {
      console.error("Fact-check failed", err);
      setResearchResult({
        mode: "error",
        data: { message: "Fact-check failed." }
      });
    } finally {
      setResearchLoading(false);
    }
  };

  const handleDownloadKdpSheet = () => {
    if (!selectedProject) {
      alert("Open a project first.");
      return;
    }

    const safeTitle =
      selectedProject.title.replace(/[<>:"/\\|?*]+/g, "_") || "project";

    const lines: string[] = [];

    // Basic info
    lines.push("=== KDP PROJECT SHEET ===");
    lines.push(`Title: ${selectedProject.title}`);
    lines.push("");
    lines.push("=== STYLE & VOICE PROFILE ===");
    lines.push(`Tone / Mood: ${styleProfile.tone || "(not set)"}`);
    lines.push(`Audience: ${styleProfile.audience || "(not set)"}`);
    lines.push(`Genre: ${styleProfile.genre || "(not set)"}`);
    lines.push(`POV: ${styleProfile.pov || "(not set)"}`);
    lines.push(`Tense: ${styleProfile.tense || "(not set)"}`);
    lines.push(`Pacing: ${styleProfile.pacing || "(not set)"}`);
    lines.push(`Formality: ${styleProfile.formality || "(not set)"}`);
    lines.push(`Notes to AI: ${styleProfile.notes || "(none)"}`);
    lines.push("");

    // Formatting stats
    lines.push("=== FORMATTING SUMMARY ===");
    if (formatResult) {
      lines.push(`Word count: ${formatResult.wordCount}`);
      lines.push(`Estimated pages: ${formatResult.estimatedPages}`);
      lines.push(`Trim size: ${formatResult.trimSize}`);
      lines.push(`Line spacing: ${formatResult.lineSpacing}`);
    } else {
      lines.push("Run 'Format (Stats Only)' to populate these values.");
    }
    lines.push("");

    // Print specs
    lines.push("=== PRINT / COVER SPECS (APPROX.) ===");
    if (printSpecs) {
      lines.push(
        `Page count: ${printSpecs.pageCount} | Trim: ${printSpecs.trim} | Paper: ${printSpecs.paperType}`
      );
      lines.push(
        `Spine width: ${printSpecs.spineWidthIn.toFixed(
          3
        )} in (${printSpecs.spineWidthMm.toFixed(2)} mm)`
      );
      lines.push(
        `Full cover (approx): ${printSpecs.fullCoverWidthIn.toFixed(
          3
        )} in wide × ${printSpecs.fullCoverHeightIn.toFixed(3)} in tall`
      );
    } else {
      lines.push("Use 'Calculate Print Specs' to generate these values.");
    }
    lines.push("");

    // Manuscript insights
    lines.push("=== MANUSCRIPT INSIGHTS ===");
    if (manuscriptInsights) {
      lines.push(`Total words: ${manuscriptInsights.totalWords}`);
      lines.push(
        `Approx. reading time: ${manuscriptInsights.readingMinutesRounded} minutes`
      );
      lines.push(
        `Chapter-like sections: ${manuscriptInsights.chapterCount} (avg ${manuscriptInsights.avgWordsPerChapter} words)`
      );
      lines.push(
        `Longest: ${manuscriptInsights.longest.title} (${manuscriptInsights.longest.wordCount} words)`
      );
      lines.push(
        `Shortest: ${manuscriptInsights.shortest.title} (${manuscriptInsights.shortest.wordCount} words)`
      );
    } else {
      lines.push("Run 'Analyze Manuscript' to populate these values.");
    }
    lines.push("");

    // Outline
    lines.push("=== CHAPTER OUTLINE / MAP ===");
    if (chapterOutline.trim()) {
      lines.push(chapterOutline.trim());
    } else {
      lines.push("Use 'Generate Outline' to create an AI chapter map.");
    }
    lines.push("");

    // Back-cover blurb
    lines.push("=== BACK-COVER / MARKETING BLURB ===");
    if (backCoverBlurb.trim()) {
      lines.push(backCoverBlurb.trim());
    } else {
      lines.push(
        "Use 'Generate Back-cover Blurb' to create a draft description."
      );
    }
    lines.push("");

    const content = lines.join("\n");

    const blob = new Blob([content], {
      type: "text/plain;charset=utf-8"
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${safeTitle}-kdp-sheet.txt`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const handleBackToLibrary = () => {
    setSelectedProjectId(null);
    setManuscript("");
    setStyleProfile(emptyStyleProfile);
    setFormatResult(null);
    setPrintSpecs(null);
    setManuscriptInsights(null);
    setChatMessages([]);
    setBackCoverBlurb("");
    setResearchSuggestions([]);
    setResearchResult(null);
    setChapterOutline("");
    setIsDirty(false);
  };

  const toggleSettings = () => {
    setShowSettings((prev) => !prev);
  };

  const handleCheckEnvDebug = async () => {
    setEnvDebugLoading(true);
    setEnvDebugError(null);

    try {
      const res = await fetch(`${API_BASE}/api/debug/env`);
      if (!res.ok) {
        throw new Error(`HTTP ${res.status} ${res.statusText}`);
      }
      const data = await res.json();
      setEnvDebug(data);
    } catch (err) {
      console.error("Debug env check failed:", err);
      setEnvDebugError(
        "Could not reach /api/debug/env. Make sure the server is running."
      );
      setEnvDebug(null);
    } finally {
      setEnvDebugLoading(false);
    }
  };

  // ---------- Cover Helper JSON (for design tools) ----------
  const coverTemplateJSON =
    printSpecs && formatResult
      ? JSON.stringify(
          {
            trimSize: trimSize,
            paperType: printSpecs.paperType,
            pageCount:
              pageCountOverride.trim() !== ""
                ? parseInt(pageCountOverride.trim(), 10)
                : formatResult.estimatedPages,
            spineWidthIn: Number(printSpecs.spineWidthIn.toFixed(3)),
            spineWidthMm: Number(printSpecs.spineWidthMm.toFixed(2)),
            fullCoverWidthIn: Number(printSpecs.fullCoverWidthIn.toFixed(3)),
            fullCoverHeightIn: Number(printSpecs.fullCoverHeightIn.toFixed(3))
          },
          null,
          2
        )
      : "";

  return (
    <div className="app-root">
      <header className="app-header">
        <h1>Infinite Publisher – MVP</h1>
        <div className="header-right">
          {selectedProject ? (
            <>
              <div className="project-meta">
                <span>Project: {selectedProject.title}</span>
                <span
                  className={
                    isDirty
                      ? "save-status save-status-dirty"
                      : "save-status"
                  }
                >
                  {saveStatusLabel}
                </span>
              </div>
              <button onClick={handleBackToLibrary}>Back to Library</button>
            </>
          ) : (
            <p className="subtitle">
              Create or open a project to start working with a manuscript.
            </p>
          )}
          <button onClick={toggleSettings}>
            {showSettings ? "Hide Settings" : "Settings"}
          </button>
        </div>
      </header>

      <main className="app-main">
        {showSettings && (
          <section className="settings-panel">
            <h2>Settings</h2>

      

            <div className="settings-group">
              <h3>Server &amp; AI Status</h3>
              <p className="settings-hint">
                This checks the backend <code>/api/debug/env</code> endpoint and
                shows whether AI and search integrations are wired correctly.
              </p>

              <button
                type="button"
                onClick={handleCheckEnvDebug}
                disabled={envDebugLoading}
              >
                {envDebugLoading ? "Checking…" : "Check status"}
              </button>

              {envDebugError && <p className="error">{envDebugError}</p>}

              {envDebug && (
                <pre className="debug-output">
                  {JSON.stringify(envDebug, null, 2)}
                </pre>
              )}
            </div>
          </section>
        )}

        {!selectedProject && (
          <div className="library">
            <section className="new-project">
              <h2>Create New Project</h2>
              <input
                value={newTitle}
                onChange={(e) => setNewTitle(e.target.value)}
                placeholder="Book title"
              />
              <button onClick={handleCreateProject}>Create</button>
            </section>

            <section className="project-list">
              <h2>Your Projects</h2>

              {projectsLoading && <p>Loading projects…</p>}

              {projectsError && (
                <div className="error">
                  <p>{projectsError}</p>
                  <button onClick={handleRetryLoadProjects}>Retry</button>
                </div>
              )}

              {!projectsLoading && !projectsError && projects.length === 0 && (
                <p>No projects yet. Create one above.</p>
              )}

              <ul>
                {projects.map((p) => (
                  <li key={p.id} className="project-card">
                    <div>
                      <strong>{p.title}</strong>
                      <p className="meta">
                        Updated {new Date(p.updatedAt).toLocaleString()}
                      </p>
                    </div>
                    <button onClick={() => handleSelectProject(p.id)}>
                      Open
                    </button>
                  </li>
                ))}
              </ul>
            </section>
          </div>
        )}

        {selectedProject && (
          <div className="workspace">
            {/* ---------- Next Steps Strip (Guided Flow) ---------- */}
            <section className="workflow-steps">
              <h2>Next steps for this book</h2>
              <ol>
                <li>
                  <strong>Step 1 – Load your manuscript</strong>
                  <span> • Paste or upload, then click “Save Manuscript”.</span>
                </li>
                <li>
                  <strong>Step 2 – Format &amp; print specs</strong>
                  <span>
                    {" "}
                    • Click “Format (Stats Only)”, then “Calculate Print Specs”.
                  </span>
                </li>
                <li>
                  <strong>Step 3 – AI helpers</strong>
                  <span>
                    {" "}
                    • Use “Generate Outline” and “Generate Back-cover Blurb”.
                  </span>
                </li>
                <li>
                  <strong>Step 4 – Export for KDP</strong>
                  <span>
                    {" "}
                    • Download “Interior (.docx)” and “KDP Sheet (.txt)”.
                  </span>
                </li>
              </ol>
            </section>

            <section className="editor-section">
              <h2>Manuscript Editor</h2>

               <div
                className="upload-row drop-enabled"
                onDragOver={handleDragOverEditor}
                onDrop={handleDropOnEditor}
              >
                <label>
                  Upload or drop manuscript file:
                  <input
                    type="file"
                    accept=".txt,.md,.doc,.docx,.pdf,.epub"
                    onChange={handleFileUpload}
                  />
                </label>
                <p className="upload-hint">
                  • Click to choose a file, or drag &amp; drop it anywhere in this box.{" "}
                  Supported types: .txt, .md, .doc, .docx, .pdf, .epub.
                  <br />
                  • The imported text will replace the current manuscript in the editor.
                  Remember to click "Save Manuscript" after reviewing.
                </p>

                {importLoading && (
                  <p className="import-status">
                    Importing file and extracting text…
                  </p>
                )}
                {importError && <p className="error">{importError}</p>}
              </div>

              <div className="format-options">
                <div>
                  <label>
                    Trim size:
                    <select
                      value={trimSize}
                      onChange={(e) =>
                        setTrimSize(e.target.value as "6x9" | "8.5x11")
                      }
                    >
                      <option value="6x9">
                        6&quot; x 9&quot; (paperback standard)
                      </option>
                      <option value="8.5x11">
                        8.5&quot; x 11&quot; (workbook / large)
                      </option>
                    </select>
                  </label>
                </div>
                <div>
                  <label>
                    Line spacing:
                    <select
                      value={lineSpacing}
                      onChange={(e) =>
                        setLineSpacing(parseFloat(e.target.value))
                      }
                    >
                      <option value={1}>1.0</option>
                      <option value={1.15}>1.15</option>
                      <option value={1.5}>1.5</option>
                    </select>
                  </label>
                </div>
              </div>

              <textarea
                ref={editorRef}
                value={manuscript}
                onChange={(e) => {
                  setManuscript(e.target.value);
                  setIsDirty(true);
                }}
                rows={20}
                placeholder="Write or paste your manuscript here..."
              />

              <div className="editor-actions">
                <button onClick={handleSaveManuscript}>Save Manuscript</button>
                <button onClick={handleFormat}>Format (Stats Only)</button>
                <button onClick={handleDownloadManuscript}>
                  Download Manuscript (.txt)
                </button>
                <button onClick={handleDownloadDocx}>
                  Download Interior (.docx)
                </button>
              </div>

              {rewriteLoading && (
                <p className="rewrite-status">Rewriting selection…</p>
              )}

              <div className="rewrite-actions">
                <p className="rewrite-label">AI rewrite selected text:</p>
                <div className="rewrite-buttons">
                  <button
                    type="button"
                    onClick={() =>
                      handleRewriteSelection(
                        "Rewrite this to be clearer and more concise, while preserving the author's tone."
                      )
                    }
                    disabled={rewriteLoading}
                  >
                    Clearer
                  </button>
                  <button
                    type="button"
                    onClick={() =>
                      handleRewriteSelection(
                        "Rewrite this to be shorter and more compact, keeping the same meaning."
                      )
                    }
                    disabled={rewriteLoading}
                  >
                    Shorter
                  </button>
                  <button
                    type="button"
                    onClick={() =>
                      handleRewriteSelection(
                        "Rewrite this to feel more vivid and emotionally resonant, without becoming purple prose."
                      )
                    }
                    disabled={rewriteLoading}
                  >
                    More vivid
                  </button>
                </div>
              </div>

              {formatResult && (
                <div className="format-result">
                  <h3>Formatting Summary</h3>
                  <p>Word count: {formatResult.wordCount}</p>
                  <p>Estimated pages: {formatResult.estimatedPages}</p>
                  <p>Trim size: {formatResult.trimSize}</p>
                  <p>Line spacing: {formatResult.lineSpacing}</p>
                </div>
              )}

              <div className="print-specs">
                <h3>Print / Cover Specs (Approx.)</h3>
                <p className="print-hint">
                  Use the estimated pages or override with your final KDP page
                  count. Values are approximate—always confirm with KDP’s cover
                  calculator before final upload.
                </p>
                <div className="print-controls">
                  <label>
                    Page count (optional override):
                    <input
                      type="number"
                      min={1}
                      value={pageCountOverride}
                      onChange={(e) => setPageCountOverride(e.target.value)}
                    />
                  </label>
                  <label>
                    Paper type:
                    <select
                      value={paperType}
                      onChange={(e) => setPaperType(e.target.value)}
                    >
                      <option value="white">White (B&amp;W)</option>
                      <option value="cream">Cream (B&amp;W)</option>
                      <option value="color">Color</option>
                    </select>
                  </label>
                </div>
                <button onClick={handleCalculatePrintSpecs}>
                  Calculate Print Specs
                </button>

                {printSpecs && (
                  <div className="print-specs-output">
                    <p>
                      Using <strong>{printSpecs.pageCount}</strong> pages at{" "}
                      <strong>{printSpecs.trim}</strong> on{" "}
                      <strong>{printSpecs.paperType}</strong> paper.
                    </p>
                    <p>
                      Spine width:{" "}
                      <strong>
                        {printSpecs.spineWidthIn.toFixed(3)} in (
                        {printSpecs.spineWidthMm.toFixed(2)} mm)
                      </strong>
                    </p>
                    <p>
                      Full cover size (incl. bleed, approx.):{" "}
                      <strong>
                        {printSpecs.fullCoverWidthIn.toFixed(3)} in wide ×{" "}
                        {printSpecs.fullCoverHeightIn.toFixed(3)} in tall
                      </strong>
                    </p>
                    <p className="print-hint">
                      Use these as planning values and cross-check with your
                      actual KDP project.
                    </p>

                    {coverTemplateJSON && (
                      <div className="cover-helper">
                        <h4>Cover Template (JSON)</h4>
                        <p className="print-hint">
                          Copy this into your design notes, Figma, or other
                          tools as a quick reference.
                        </p>
                        <textarea
                          className="cover-json-textarea"
                          readOnly
                          rows={8}
                          value={coverTemplateJSON}
                        />
                      </div>
                    )}
                  </div>
                )}
              </div>

              <div className="insights-section">
                <h3>Manuscript Insights</h3>
                <p className="print-hint">
                  Quick stats based on your current manuscript. Chapter
                  detection is approximate and looks for lines like
                  &quot;Chapter 1&quot; or &quot;CHAPTER II&quot;.
                </p>
                <button onClick={handleAnalyzeManuscript}>
                  Analyze Manuscript
                </button>

                {manuscriptInsights && (
                  <div className="insights-output">
                    <p>
                      Total words:{" "}
                      <strong>{manuscriptInsights.totalWords}</strong>
                    </p>
                    <p>
                      Approx. reading time:{" "}
                      <strong>
                        {manuscriptInsights.readingMinutesRounded} minutes
                      </strong>
                    </p>
                    <p>
                      Chapter-like sections detected:{" "}
                      <strong>{manuscriptInsights.chapterCount}</strong>
                    </p>
                    <p>
                      Avg. words per chapter:{" "}
                      <strong>
                        {manuscriptInsights.avgWordsPerChapter}
                      </strong>
                    </p>
                    <p>
                      Longest section:{" "}
                      <strong>
                        {manuscriptInsights.longest.title} (
                        {manuscriptInsights.longest.wordCount} words)
                      </strong>
                    </p>
                    <p>
                      Shortest section:{" "}
                      <strong>
                        {manuscriptInsights.shortest.title} (
                        {manuscriptInsights.shortest.wordCount} words)
                      </strong>
                    </p>

                    <details>
                      <summary>Show all chapter-like sections</summary>
                      <ul>
                        {manuscriptInsights.chapterSummaries.map(
                          (ch: any, idx: number) => (
                            <li key={idx}>
                              <strong>{ch.title}</strong> – {ch.wordCount} words
                            </li>
                          )
                        )}
                      </ul>
                    </details>
                  </div>
                )}
              </div>

              <div className="outline-section">
                <h3>AI Outline &amp; Chapter Map</h3>
                <p className="print-hint">
                  Generate a structured overview of your book based on the
                  manuscript and your style profile. Helpful for revision, KDP
                  copy, or series planning.
                </p>
                <button
                  type="button"
                  onClick={handleGenerateOutline}
                  disabled={outlineLoading || !manuscript.trim()}
                >
                  {outlineLoading ? "Generating outline..." : "Generate Outline"}
                </button>

                <textarea
                  className="outline-textarea"
                  value={chapterOutline}
                  onChange={(e) => setChapterOutline(e.target.value)}
                  rows={10}
                  placeholder="The AI-generated outline will appear here. You can edit, annotate, or copy it into your notes."
                />
              </div>

              <div className="style-section">
                <h3>Style &amp; Voice Profile</h3>
                <p className="print-hint">
                  This profile travels with the project and guides rewrites,
                  chat, and back-cover copy.
                </p>

                <div className="style-grid">
                  <label>
                    Tone / Mood
                    <input
                      type="text"
                      value={styleProfile.tone}
                      onChange={(e) => {
                        setStyleProfile((prev) => ({
                          ...prev,
                          tone: e.target.value
                        }));
                        setIsDirty(true);
                      }}
                      placeholder="introspective, mystical, grounded…"
                    />
                  </label>

                  <label>
                    Audience
                    <input
                      type="text"
                      value={styleProfile.audience}
                      onChange={(e) => {
                        setStyleProfile((prev) => ({
                          ...prev,
                          audience: e.target.value
                        }));
                        setIsDirty(true);
                      }}
                      placeholder="spiritually curious adults…"
                    />
                  </label>

                  <label>
                    Genre
                    <input
                      type="text"
                      value={styleProfile.genre}
                      onChange={(e) => {
                        setStyleProfile((prev) => ({
                          ...prev,
                          genre: e.target.value
                        }));
                        setIsDirty(true);
                      }}
                      placeholder="metaphysical non-fiction, sci-fi, memoir…"
                    />
                  </label>

                  <label>
                    POV
                    <input
                      type="text"
                      value={styleProfile.pov}
                      onChange={(e) => {
                        setStyleProfile((prev) => ({
                          ...prev,
                          pov: e.target.value
                        }));
                        setIsDirty(true);
                      }}
                      placeholder="first person, third person limited…"
                    />
                  </label>

                  <label>
                    Tense
                    <input
                      type="text"
                      value={styleProfile.tense}
                      onChange={(e) => {
                        setStyleProfile((prev) => ({
                          ...prev,
                          tense: e.target.value
                        }));
                        setIsDirty(true);
                      }}
                      placeholder="present, past…"
                    />
                  </label>

                  <label>
                    Pacing
                    <input
                      type="text"
                      value={styleProfile.pacing}
                      onChange={(e) => {
                        setStyleProfile((prev) => ({
                          ...prev,
                          pacing: e.target.value
                        }));
                        setIsDirty(true);
                      }}
                      placeholder="slow and reflective, fast and intense…"
                    />
                  </label>

                  <label>
                    Formality
                    <input
                      type="text"
                      value={styleProfile.formality}
                      onChange={(e) => {
                        setStyleProfile((prev) => ({
                          ...prev,
                          formality: e.target.value
                        }));
                        setIsDirty(true);
                      }}
                      placeholder="casual, medium-formal, poetic…"
                    />
                  </label>
                </div>

                <label className="style-notes-label">
                  Additional notes to the AI
                  <textarea
                    rows={3}
                    value={styleProfile.notes}
                    onChange={(e) => {
                      setStyleProfile((prev) => ({
                        ...prev,
                        notes: e.target.value
                      }));
                      setIsDirty(true);
                    }}
                    placeholder="Anything else about your voice, rhythm, or what to avoid..."
                  />
                </label>
              </div>

              <div className="marketing-section">
                <h3>Back-cover / Marketing Copy</h3>
                <p className="print-hint">
                  Generate a draft back-cover description using your current
                  manuscript and style profile as context. You can refine or
                  edit the result manually after generation.
                </p>
                <div className="marketing-buttons-row">
                  <button
                    type="button"
                    onClick={handleGenerateBackCover}
                    disabled={backCoverLoading || !manuscript.trim()}
                  >
                    {backCoverLoading
                      ? "Generating back-cover description..."
                      : "Generate Back-cover Blurb"}
                  </button>

                  <button
                    type="button"
                    onClick={handleDownloadKdpSheet}
                    disabled={!selectedProject}
                    style={{ marginLeft: "0.75rem" }}
                  >
                    Download KDP Sheet (.txt)
                  </button>
                </div>

                <textarea
                  className="marketing-textarea"
                  value={backCoverBlurb}
                  onChange={(e) => setBackCoverBlurb(e.target.value)}
                  rows={6}
                  placeholder="Generated back-cover description will appear here. You can edit it freely."
                />
              </div>
            </section>

           <section className="chat-section">
  <h2>AI Chat</h2>
  <div className="chat-log">
    {chatMessages.length === 0 && (
      <p className="chat-placeholder">
        Ask the AI about your manuscript, structure, tone, or ideas.
        It will use the current manuscript text and style profile as
        context.
      </p>
    )}
    {chatMessages.map((m, idx) => (
      <div
        key={idx}
        className={
          m.role === "user" ? "chat-msg user" : "chat-msg assistant"
        }
      >
        <strong>{m.role === "user" ? "You" : "AI"}</strong>
        <p>{m.content}</p>
      </div>
    ))}
  </div>

  <div className="chat-input-row">
    <textarea
      value={chatInput}
      onChange={(e) => setChatInput(e.target.value)}
      rows={3}
      placeholder="Ask something..."
    />
    <button onClick={handleSendChat} disabled={chatLoading}>
      {chatLoading ? "Sending..." : "Send"}
    </button>
  </div>

  {/* ----- Research Tools ----- */}
  <section className="research-section">
    <h2>Research &amp; Fact-check (Beta)</h2>

    <div className="research-block">
      <h3>Web Search</h3>
      <input
        type="text"
        value={researchQuery}
        onChange={(e) => setResearchQuery(e.target.value)}
        placeholder="Search topic, concept, or reference…"
      />
      <div className="research-buttons-row">
        <button onClick={handleRunResearch} disabled={researchLoading}>
          {researchLoading ? "Searching..." : "Run Search"}
        </button>
        <button
          type="button"
          onClick={handleSuggestResearchTopics}
          disabled={!manuscript.trim()}
        >
          Suggest from Manuscript
        </button>
      </div>

      {researchSuggestions.length > 0 && (
        <div className="research-suggestions">
          <p className="settings-hint">
            Click a suggestion to use it as your query:
          </p>
          <div className="suggestion-chips">
            {researchSuggestions.map((s, idx) => (
              <button
                key={idx}
                type="button"
                onClick={() => setResearchQuery(s)}
              >
                {s}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>

    <div className="research-block">
      <h3>Fact-check Claim</h3>
      <textarea
        value={factClaim}
        onChange={(e) => setFactClaim(e.target.value)}
        rows={3}
        placeholder="Type a statement you want to verify…"
      />
      <button onClick={handleFactCheck} disabled={researchLoading}>
        {researchLoading ? "Checking..." : "Fact-check"}
      </button>
    </div>

    {researchResult && researchResult.mode === "search" && (
      <div className="research-results">
        <h3>Search Results for “{researchResult.data.query}”</h3>
        <p>{researchResult.data.summary}</p>
        <ul>
          {researchResult.data.sources.map((s: any, idx: number) => (
            <li key={idx}>
              <a href={s.url} target="_blank" rel="noreferrer">
                {s.title}
              </a>
              <p>{s.snippet}</p>
            </li>
          ))}
        </ul>
      </div>
    )}

    {researchResult && researchResult.mode === "fact-check" && (
      <div className="research-results">
        <h3>Fact-check Result</h3>
        <p>
          <strong>Claim:</strong> {researchResult.data.claim}
        </p>
        <p>
          <strong>Result:</strong>{" "}
          {researchResult.data.result.toUpperCase()}
        </p>
        <p>{researchResult.data.explanation}</p>
        <h4>Sources</h4>
        <ul>
          {researchResult.data.sources.map((s: any, idx: number) => (
            <li key={idx}>
              <a href={s.url} target="_blank" rel="noreferrer">
                {s.title}
              </a>
              <p>{s.snippet}</p>
            </li>
          ))}
        </ul>
      </div>
    )}

    {researchResult && researchResult.mode === "error" && (
      <div className="research-results">
        <p>{researchResult.data.message}</p>
      </div>
    )}
  </section>

  {/* ---------- AI Model Status Panel ---------- */}
  <ModelStatusPanel apiBase={API_BASE} />
</section>
          </div>
        )}
      </main>
    </div>
  );
}

export default App;
