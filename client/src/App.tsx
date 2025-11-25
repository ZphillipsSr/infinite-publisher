import ProjectSearchPanel from "./components/ProjectSearchPanel";import React, { useEffect, useState, useRef } from "react";
import "./App.css";
import ModelStatusPanel from "./components/ModelStatusPanel";
import ResearchPanel from "./components/ResearchPanel";
import {
  loadUserPreferences,
  saveUserPreferences,
  defaultUserPreferences,
  type UserPreferences,
  loadUserOpenAIKey,
  saveUserOpenAIKey
} from "./preferences";

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

type ConsoleTab = "book" | "dev" | "research";

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

  const [userPrefs, setUserPrefs] =
    useState<UserPreferences>(defaultUserPreferences);

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
  const [useKbForBookChat, setUseKbForBookChat] = useState(true);

  // Top-level view: main workspace vs full-screen assistant
  const [activeView, setActiveView] = useState<"workspace" | "assistant">(
    "workspace"
  );

  // Co-author / console tabs
  const [consoleTab, setConsoleTab] = useState<ConsoleTab>("book");

  // Dev / coding console chat (general AI, not manuscript-contextual)
  const [devChatMessages, setDevChatMessages] = useState<ChatMessage[]>([]);
  const [devChatInput, setDevChatInput] = useState("");
  const [devChatLoading, setDevChatLoading] = useState(false);

  const [rewriteLoading, setRewriteLoading] = useState(false);
  const [backCoverBlurb, setBackCoverBlurb] = useState("");
  const [backCoverLoading, setBackCoverLoading] = useState(false);

  const [chapterOutline, setChapterOutline] = useState("");
  const [outlineLoading, setOutlineLoading] = useState(false);

  const [manuscriptInsights, setManuscriptInsights] = useState<any | null>(
    null
  );

  // User-provided OpenAI API key (optional, stored locally)
  const [userOpenAiKey, setUserOpenAiKey] = useState<string>("");

  // Autosave + status
  const [lastLocalSave, setLastLocalSave] = useState<string | null>(null);
  const [lastServerSave, setLastServerSave] = useState<string | null>(null);
  const [isDirty, setIsDirty] = useState<boolean>(false);

  const editorRef = useRef<HTMLTextAreaElement | null>(null);

  // Derived flag: do we have a personal key at all?
  const hasUserKey = userOpenAiKey.trim().length > 0;

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

  // ---- Load user preferences + OpenAI key from localStorage on mount ----
  useEffect(() => {
    try {
      const prefs = loadUserPreferences();
      setUserPrefs(prefs);
      setTrimSize(prefs.defaultTrimSize);
      setLineSpacing(prefs.defaultLineSpacing);

      const storedKey = loadUserOpenAIKey();
      if (storedKey) {
        setUserOpenAiKey(storedKey);
      }
    } catch (e) {
      console.error("Failed to load user preferences or OpenAI key:", e);
    }
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
    return () =>
      window.removeEventListener("beforeunload", handleBeforeUnload);
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

  // ---- Helper to build JSON headers with optional user key ----
  const buildJsonHeaders = () => {
    const headers: Record<string, string> = {
      "Content-Type": "application/json"
    };
    const trimmed = userOpenAiKey.trim();

    // Only send the personal key if:
    //  - it exists, AND
    //  - the user has "Use my personal key" enabled
    if (trimmed && userPrefs.usePersonalOpenAIKey) {
      headers["X-User-OpenAI-Key"] = trimmed;
    }
    return headers;
  };

  // Guard: is AI allowed to run under current prefs / keys?
  const ensureAIEnabled = (): boolean => {
    // If we have a personal key and are allowed to use it, we're good.
    if (hasUserKey && userPrefs.usePersonalOpenAIKey) return true;

    // If we don't have / aren't using a key, but server AI is allowed,
    // let the backend decide what to do with its own config.
    if (userPrefs.allowServerAI) return true;

    // Otherwise, block and explain.
    alert(
      "AI is currently disabled: you have no usable personal OpenAI key, " +
        "and 'Allow server AI' is turned off in Settings."
    );
    return false;
  };

  const handleClearUserOpenAiKey = () => {
    setUserOpenAiKey("");
    try {
      saveUserOpenAIKey(null);
    } catch (e) {
      console.error("Failed to clear user OpenAI key:", e);
    }
  };

  const handleSelectProject = (id: string) => {
    const proj = projects.find((p) => p.id === id);

    setSelectedProjectId(id);
    setFormatResult(null);
    setPrintSpecs(null);
    setManuscriptInsights(null);
    setChatMessages([]);
    setBackCoverBlurb("");
    setChapterOutline("");

    let loadedManuscript = "";
    let loadedProfile: StyleProfile = emptyStyleProfile;

    if (proj) {
      loadedManuscript = proj.manuscript || "";
      loadedProfile = proj.styleProfile || emptyStyleProfile;
      setLastServerSave(proj.updatedAt || null);
    } else {
      setLastServerSave(null);
    }

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

  const handleFileUpload = async (
    event: React.ChangeEvent<HTMLInputElement>
  ) => {
    const file = event.target.files?.[0];
    if (!file) return;

    await importManuscriptFile(file);
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

    if (!ensureAIEnabled()) return;

    setRewriteLoading(true);

    try {
      const res = await fetch(`${API_BASE}/api/ai/rewrite`, {
        method: "POST",
        headers: buildJsonHeaders(),
        body: JSON.stringify({
          text: selectedText,
          instructions: instruction
        })
      });

      if (!res.ok) {
        const text = await res.text();
        console.error("Rewrite HTTP error:", res.status, text);
        alert(`Rewrite failed: HTTP ${res.status}`);
        return;
      }

      const data = await res.json();

      if (data.ok === false && data.error) {
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
    if (!ensureAIEnabled()) return;

    const userMessage: ChatMessage = {
      role: "user",
      content: chatInput.trim()
    };

    setChatMessages((prev) => [...prev, userMessage]);
    setChatInput("");
    setChatLoading(true);

    try {
      const systemContext = `You are a book co-authoring assistant for the Infinite Publisher app.
Work with the user's manuscript and style profile to give suggestions on structure, tone, pacing, and revisions.
Style profile (JSON): ${JSON.stringify(styleProfile ?? {}, null, 2)}`;

      const messagesForApi = [
        {
          role: "system" as const,
          content: systemContext
        },
        {
          role: "user" as const,
          content:
            `User request:\n${userMessage.content}\n\n` +
            (manuscript.trim()
              ? `Current manuscript:\n${manuscript}`
              : "No manuscript text is currently loaded.")
        }
      ];

      const res = await fetch(`${API_BASE}/api/ai/chat`, {
        method: "POST",
        headers: buildJsonHeaders(),
        body: JSON.stringify({
          messages: messagesForApi,
          temperature: 0.7,
          maxTokens: 800,
          purpose: "manuscript_context",
          useKb: useKbForBookChat
        })
      });

      if (!res.ok) {
        const text = await res.text();
        console.error("Context chat HTTP error:", res.status, text);
        setChatMessages((prev) => [
          ...prev,
          {
            role: "assistant",
            content: `Error: AI request failed with HTTP ${res.status}.`
          }
        ]);
        return;
      }

      const data = await res.json();

      const replyText: string =
        data.reply || data.message || "(no reply from unified AI engine)";

      const reply: ChatMessage = {
        role: "assistant",
        content: replyText
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

  const handleSendDevChat = async () => {
    if (!devChatInput.trim()) return;
    if (!ensureAIEnabled()) return;

    const userMessage: ChatMessage = {
      role: "user",
      content: devChatInput.trim()
    };

    setDevChatMessages((prev) => [...prev, userMessage]);
    setDevChatInput("");
    setDevChatLoading(true);

    try {
      const res = await fetch(`${API_BASE}/api/ai/dev-console`, {
        method: "POST",
        headers: buildJsonHeaders(),
        body: JSON.stringify({
          prompt: userMessage.content
        })
      });

      if (!res.ok) {
        const text = await res.text();
        console.error("Dev console HTTP error:", res.status, text);
        setDevChatMessages((prev) => [
          ...prev,
          {
            role: "assistant",
            content: `Error: dev console AI failed with HTTP ${res.status}.`
          }
        ]);
        return;
      }

      const data = await res.json();

      const replyText: string =
        data.reply || data.message || "(no reply from dev console AI)";

      const reply: ChatMessage = {
        role: "assistant",
        content: replyText
      };

      setDevChatMessages((prev) => [...prev, reply]);
    } catch (err) {
      console.error("Dev chat failed", err);
      setDevChatMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          content: "Error contacting AI coding console."
        }
      ]);
    } finally {
      setDevChatLoading(false);
    }
  };

  const handleGenerateOutline = async () => {
    if (!manuscript.trim()) {
      alert("Add some manuscript content first.");
      return;
    }

    if (!ensureAIEnabled()) return;

    setOutlineLoading(true);

    try {
      const instructions =
        "From this manuscript, generate a structured chapter-by-chapter outline. " +
        "For each chapter or natural section, give: a short title, 2–4 sentence summary, and key themes. " +
        "If the manuscript is not clearly divided into chapters, infer logical sections. " +
        "Honor the author's style profile (tone, audience, genre, etc.) when wording the summaries.";

      const res = await fetch(`${API_BASE}/api/ai/analyze-manuscript`, {
        method: "POST",
        headers: buildJsonHeaders(),
        body: JSON.stringify({
          manuscript,
          instructions
        })
      });

      if (!res.ok) {
        const text = await res.text();
        console.error("Outline generation HTTP error:", res.status, text);
        alert(
          `Outline failed: HTTP ${res.status}. Check /api/ai/analyze-manuscript on the server.`
        );
        return;
      }

      const data = await res.json();
      const reply: string =
        data.reply ||
        data.message ||
        "No outline could be generated from the manuscript.";

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

    if (!ensureAIEnabled()) return;

    setBackCoverLoading(true);

    try {
      const instructions =
        "Using this manuscript and the author's style profile, write a compelling 2–3 paragraph back-cover book description suitable for Amazon KDP. " +
        "Focus on emotional resonance, clear stakes, and intrigue, without spoiling the entire arc. " +
        "Write in third-person, present tense, and aim for 150–250 words.";

      const res = await fetch(`${API_BASE}/api/ai/analyze-manuscript`, {
        method: "POST",
        headers: buildJsonHeaders(),
        body: JSON.stringify({
          manuscript,
          instructions
        })
      });

      if (!res.ok) {
        const text = await res.text();
        console.error("Back-cover HTTP error:", res.status, text);
        alert(
          `Back-cover generation failed: HTTP ${res.status}. Check /api/ai/analyze-manuscript on the server.`
        );
        return;
      }

      const data = await res.json();
      const reply: string =
        data.reply ||
        data.message ||
        "No back-cover description could be generated.";

      setBackCoverBlurb(reply);
    } catch (err) {
      console.error("Back-cover generation failed", err);
      alert("Error contacting AI for back-cover description.");
    } finally {
      setBackCoverLoading(false);
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

    lines.push("=== CHAPTER OUTLINE / MAP ===");
    if (chapterOutline.trim()) {
      lines.push(chapterOutline.trim());
    } else {
      lines.push("Use 'Generate Outline' to create an AI chapter map.");
    }
    lines.push("");

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
    setChapterOutline("");
    setIsDirty(false);
    setActiveView("workspace");
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

  // ---------- KB → Assistant wiring ----------
  const handleUseKbResultInAssistant = (payload: {
    query: string;
    result: KbResult;
    composedContext: string;
  }) => {
    // Jump into Assistant view + Book co-author tab
    setActiveView("assistant");
    setConsoleTab("book");
    setUseKbForBookChat(true);

    // Pre-fill the book chat input with the KB context plus a prompt stub
    setChatInput((prev) => {
      const base = `KB context from ${payload.result.relPath || payload.result.filePath} (lines ${
        payload.result.startLine
      }–${payload.result.endLine}):\n${payload.result.content}\n\nQuestion: `;
      if (!prev.trim()) return base;
      return `${base}\n\n${prev}`;
    });
  };

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

          {/* View toggle */}
          <div className="view-toggle">
            <button
              type="button"
              className={
                activeView === "workspace"
                  ? "view-tab view-tab-active"
                  : "view-tab"
              }
              onClick={() => setActiveView("workspace")}
            >
              Workspace
            </button>
            <button
              type="button"
              className={
                activeView === "assistant"
                  ? "view-tab view-tab-active"
                  : "view-tab"
              }
              onClick={() => setActiveView("assistant")}
              disabled={!selectedProject}
              title={
                !selectedProject
                  ? "Open a project to use the Assistant view"
                  : ""
              }
            >
              Assistant
            </button>
          </div>

          <button onClick={toggleSettings}>
            {showSettings ? "Hide Settings" : "Settings"}
          </button>
        </div>
      </header>

      <main className="app-main">
        {/* SETTINGS PANEL */}
        {showSettings && (
          <section className="settings-panel">
            <h2>Settings</h2>

            <div className="settings-group">
              <h3>Server &amp; AI Status</h3>
              <p className="settings-hint">
                This checks the backend <code>/api/debug/env</code> endpoint.
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

            <div className="settings-group">
              <h3>Your OpenAI API key</h3>
              <p className="settings-hint">
                Add your OpenAI API key if you want private usage.
              </p>
              <label>
                OpenAI API key
                <input
                  type="password"
                  value={userOpenAiKey}
                  onChange={(e) => {
                    const value = e.target.value;
                    setUserOpenAiKey(value);
                    try {
                      if (value.trim()) saveUserOpenAIKey(value);
                      else saveUserOpenAIKey(null);
                    } catch (err) {
                      console.error("Failed to save custom key:", err);
                    }
                  }}
                  placeholder="sk-..."
                />
              </label>

              <div className="settings-inline-actions">
                <button
                  type="button"
                  onClick={handleClearUserOpenAiKey}
                  disabled={!hasUserKey}
                >
                  Clear key
                </button>
                <span
                  className={
                    hasUserKey
                      ? "settings-status-ok"
                      : "settings-status-warn"
                  }
                >
                  {hasUserKey
                    ? "Custom key stored locally."
                    : "No custom key stored."}
                </span>
              </div>

              <div className="settings-group-small">
                <label className="settings-checkbox">
                  <input
                    type="checkbox"
                    checked={userPrefs.usePersonalOpenAIKey}
                    onChange={(e) => {
                      const next = {
                        ...userPrefs,
                        usePersonalOpenAIKey: e.target.checked
                      };
                      setUserPrefs(next);
                      saveUserPreferences(next);
                    }}
                  />
                  <span>
                    Use my personal OpenAI key for AI calls from this browser
                  </span>
                </label>

                <label className="settings-checkbox">
                  <input
                    type="checkbox"
                    checked={userPrefs.allowServerAI}
                    onChange={(e) => {
                      const next = {
                        ...userPrefs,
                        allowServerAI: e.target.checked
                      };
                      setUserPrefs(next);
                      saveUserPreferences(next);
                    }}
                  />
                  <span>Allow server-side AI when no key is used</span>
                </label>
              </div>
            </div>
          </section>
        )}

        {/* WORKSPACE VIEW */}
        {activeView === "workspace" && (
          <>
            {/* ===== LIBRARY (no project selected) ===== */}
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

                  {projectsLoading && <p>Loading…</p>}

                  {projectsError && (
                    <div className="error">
                      <p>{projectsError}</p>
                      <button onClick={handleRetryLoadProjects}>Retry</button>
                    </div>
                  )}

                  {!projectsLoading &&
                    !projectsError &&
                    projects.length === 0 && <p>No projects yet.</p>}

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

                {/* Infinity shooting star hero in the empty space below */}
                <div className="infinite-hero">
                  <svg
                    className="infinite-hero-svg"
                    viewBox="0 0 400 200"
                    xmlns="http://www.w3.org/2000/svg"
                  >
                    <defs>
                      <linearGradient
                        id="infiniteGradient"
                        x1="0%"
                        y1="0%"
                        x2="100%"
                        y2="0%"
                      >
                        <stop offset="0%" stopColor="#facc15" />
                        <stop offset="40%" stopColor="#f97316" />
                        <stop offset="70%" stopColor="#fde047" />
                        <stop offset="100%" stopColor="#facc15" />
                      </linearGradient>

                      <filter
                        id="infiniteGlow"
                        x="-50%"
                        y="-50%"
                        width="200%"
                        height="200%"
                      >
                        <feGaussianBlur stdDeviation="4" result="blur" />
                        <feColorMatrix
                          in="blur"
                          type="matrix"
                          values="1 0 0 0 0
                                  0.8 0.6 0 0 0
                                  0 0 0 0 0
                                  0 0 0 0.9 0"
                        />
                        <feMerge>
                          <feMergeNode />
                          <feMergeNode in="SourceGraphic" />
                        </feMerge>
                      </filter>
                    </defs>

                    {/* Infinity path */}
                    <path
                      id="infinityPath"
                      d="
                        M 60 100
                        C 60 50 140 50 200 100
                        C 260 150 340 150 340 100
                        C 340 50 260 50 200 100
                        C 140 150 60 150 60 100
                      "
                      fill="none"
                      stroke="url(#infiniteGradient)"
                      strokeWidth={2.5}
                      className="infinite-hero-path"
                      filter="url(#infiniteGlow)"
                    />

                    {/* Shooting star */}
                    <circle
                      r={4}
                      fill="#fef9c3"
                      stroke="#fbbf24"
                      strokeWidth={1}
                      filter="url(#infiniteGlow)"
                    >
                      <animateMotion
                        dur="7s"
                        repeatCount="indefinite"
                        rotate="auto"
                        keySplines="0.4 0 0.2 1"
                        keyTimes="0;1"
                        calcMode="spline"
                      >
                        <mpath xlinkHref="#infinityPath" />
                      </animateMotion>
                    </circle>
                  </svg>
                </div>
              </div>
            )}

            {/* ===== WORKSPACE (project selected) ===== */}
            {selectedProject && (
              <div className="workspace">
                <section className="workflow-steps">
                  <h2>Next steps</h2>
                  <ol>
                    <li>
                      <strong>Step 1 – Load manuscript</strong>
                    </li>
                    <li>
                      <strong>Step 2 – Format &amp; Specs</strong>
                    </li>
                    <li>
                      <strong>Step 3 – AI Assist</strong>
                    </li>
                    <li>
                      <strong>Step 4 – Export KDP</strong>
                    </li>
                  </ol>
                </section>

                {/* MANUSCRIPT EDITOR */}
                <section className="editor-section ai-frame">
                  <h2>Manuscript Editor</h2>

                  <div
                    className="upload-row drop-enabled"
                    onDragOver={handleDragOverEditor}
                    onDrop={handleDropOnEditor}
                  >
                    <label>
                      Upload manuscript file:
                      <input
                        type="file"
                        accept=".txt,.md,.doc,.docx,.pdf,.epub"
                        onChange={handleFileUpload}
                      />
                    </label>

                    {importLoading && <p>Importing…</p>}
                    {importError && <p className="error">{importError}</p>}
                  </div>

                  {/* Format Options */}
                  <div className="format-options">
                    <label>
                      Trim size:
                      <select
                        value={trimSize}
                        onChange={(e) => {
                          const value = e.target
                            .value as "6x9" | "8.5x11";
                          setTrimSize(value);
                          setUserPrefs((prev) => {
                            const next = {
                              ...prev,
                              defaultTrimSize: value
                            };
                            saveUserPreferences(next);
                            return next;
                          });
                        }}
                      >
                        <option value="6x9">6x9</option>
                        <option value="8.5x11">8.5x11</option>
                      </select>
                    </label>

                    <label>
                      Line spacing:
                      <select
                        value={lineSpacing}
                        onChange={(e) => {
                          const newSpacing = parseFloat(
                            e.target.value
                          ) as 1 | 1.15 | 1.5;
                          setLineSpacing(newSpacing);
                          setUserPrefs((prev) => {
                            const next: UserPreferences = {
                              ...prev,
                              defaultLineSpacing: newSpacing
                            };
                            saveUserPreferences(next);
                            return next;
                          });
                        }}
                      >
                        <option value={1}>1.0</option>
                        <option value={1.15}>1.15</option>
                        <option value={1.5}>1.5</option>
                      </select>
                    </label>
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
                    <button onClick={handleSaveManuscript}>
                      Save Manuscript
                    </button>
                    <button onClick={handleFormat}>Format (Stats Only)</button>
                    <button onClick={handleDownloadManuscript}>
                      Download (.txt)
                    </button>
                    <button onClick={handleDownloadDocx}>
                      Download Interior (.docx)
                    </button>
                  </div>

                  {/* REWRITE BUTTONS */}
                  {rewriteLoading && (
                    <p className="rewrite-status">Rewriting…</p>
                  )}

                  <div className="rewrite-actions">
                    <p className="rewrite-label">AI rewrite selected text:</p>
                    <div className="rewrite-buttons">
                      <button
                        onClick={() =>
                          handleRewriteSelection(
                            "Rewrite this to be clearer and more concise."
                          )
                        }
                        disabled={rewriteLoading}
                      >
                        Clearer
                      </button>
                      <button
                        onClick={() =>
                          handleRewriteSelection(
                            "Rewrite this to be shorter while keeping the meaning."
                          )
                        }
                        disabled={rewriteLoading}
                      >
                        Shorter
                      </button>
                      <button
                        onClick={() =>
                          handleRewriteSelection(
                            "Rewrite this to be more vivid and emotionally resonant."
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

                  {/* PRINT SPECS */}
                  <div className="print-specs">
                    <h3>Print / Cover Specs</h3>
                    <div className="print-controls">
                      <label>
                        Page count override:
                        <input
                          type="number"
                          value={pageCountOverride}
                          onChange={(e) =>
                            setPageCountOverride(e.target.value)
                          }
                        />
                      </label>

                      <label>
                        Paper type:
                        <select
                          value={paperType}
                          onChange={(e) => setPaperType(e.target.value)}
                        >
                          <option value="white">White</option>
                          <option value="cream">Cream</option>
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
                          <strong>{printSpecs.paperType}</strong>.
                        </p>
                        <p>
                          Spine:{" "}
                          <strong>
                            {printSpecs.spineWidthIn.toFixed(3)} in (
                            {printSpecs.spineWidthMm.toFixed(2)} mm)
                          </strong>
                        </p>
                        <p>
                          Full cover:{" "}
                          <strong>
                            {printSpecs.fullCoverWidthIn.toFixed(3)} in ×{" "}
                            {printSpecs.fullCoverHeightIn.toFixed(3)} in
                          </strong>
                        </p>

                        {coverTemplateJSON && (
                          <div className="cover-helper">
                            <h4>Cover Template (JSON)</h4>
                            <textarea
                              readOnly
                              rows={8}
                              value={coverTemplateJSON}
                            />
                          </div>
                        )}
                      </div>
                    )}
                  </div>

                  {/* INSIGHTS */}
                  <div className="insights-section">
                    <h3>Manuscript Insights</h3>
                    <button onClick={handleAnalyzeManuscript}>
                      Analyze Manuscript
                    </button>

                    {manuscriptInsights && (
                      <div className="insights-output">
                        <p>
                          Words:{" "}
                          <strong>{manuscriptInsights.totalWords}</strong>
                        </p>
                        <p>
                          Reading time:{" "}
                          <strong>
                            {manuscriptInsights.readingMinutesRounded} minutes
                          </strong>
                        </p>
                        <p>
                          Sections detected:{" "}
                          <strong>{manuscriptInsights.chapterCount}</strong>
                        </p>

                        <details>
                          <summary>Show sections</summary>
                          <ul>
                            {manuscriptInsights.chapterSummaries.map(
                              (ch: any, idx: number) => (
                                <li key={idx}>
                                  <strong>{ch.title}</strong> –{" "}
                                  {ch.wordCount} words
                                </li>
                              )
                            )}
                          </ul>
                        </details>
                      </div>
                    )}
                  </div>

                  {/* OUTLINE */}
                  <div className="outline-section">
                    <h3>AI Outline</h3>
                    <button
                      onClick={handleGenerateOutline}
                      disabled={outlineLoading}
                    >
                      {outlineLoading ? "Generating…" : "Generate Outline"}
                    </button>

                    <textarea
                      className="outline-textarea"
                      value={chapterOutline}
                      onChange={(e) => setChapterOutline(e.target.value)}
                      rows={10}
                      placeholder="Outline will appear here..."
                    />
                  </div>

                  {/* STYLE PROFILE */}
                  <div className="style-section">
                    <h3>Style &amp; Voice</h3>
                    <div className="style-grid">
                      <label>
                        Tone
                        <input
                          value={styleProfile.tone}
                          onChange={(e) =>
                            setStyleProfile({
                              ...styleProfile,
                              tone: e.target.value
                            })
                          }
                        />
                      </label>
                      <label>
                        Audience
                        <input
                          value={styleProfile.audience}
                          onChange={(e) =>
                            setStyleProfile({
                              ...styleProfile,
                              audience: e.target.value
                            })
                          }
                        />
                      </label>
                      <label>
                        Genre
                        <input
                          value={styleProfile.genre}
                          onChange={(e) =>
                            setStyleProfile({
                              ...styleProfile,
                              genre: e.target.value
                            })
                          }
                        />
                      </label>
                      <label>
                        POV
                        <input
                          value={styleProfile.pov}
                          onChange={(e) =>
                            setStyleProfile({
                              ...styleProfile,
                              pov: e.target.value
                            })
                          }
                        />
                      </label>
                      <label>
                        Tense
                        <input
                          value={styleProfile.tense}
                          onChange={(e) =>
                            setStyleProfile({
                              ...styleProfile,
                              tense: e.target.value
                            })
                          }
                        />
                      </label>
                      <label>
                        Pacing
                        <input
                          value={styleProfile.pacing}
                          onChange={(e) =>
                            setStyleProfile({
                              ...styleProfile,
                              pacing: e.target.value
                            })
                          }
                        />
                      </label>
                      <label>
                        Formality
                        <input
                          value={styleProfile.formality}
                          onChange={(e) =>
                            setStyleProfile({
                              ...styleProfile,
                              formality: e.target.value
                            })
                          }
                        />
                      </label>
                    </div>

                    <label className="style-notes-label">
                      Notes
                      <textarea
                        rows={3}
                        value={styleProfile.notes}
                        onChange={(e) =>
                          setStyleProfile({
                            ...styleProfile,
                            notes: e.target.value
                          })
                        }
                      />
                    </label>
                  </div>

                  {/* BACK COVER */}
                  <div className="marketing-section">
                    <h3>Back-cover Description</h3>

                    <button
                      onClick={handleGenerateBackCover}
                      disabled={backCoverLoading}
                    >
                      {backCoverLoading ? "Generating…" : "Generate Blurb"}
                    </button>

                    <button
                      type="button"
                      onClick={handleDownloadKdpSheet}
                      disabled={!selectedProject}
                      style={{ marginLeft: "0.75rem" }}
                    >
                      Download KDP Sheet (.txt)
                    </button>

                    <textarea
                      className="marketing-textarea"
                      value={backCoverBlurb}
                      onChange={(e) => setBackCoverBlurb(e.target.value)}
                      rows={6}
                      placeholder="Back-cover description..."
                    />
                  </div>
                </section>
              </div>
            )}
          </>
        )}

        {/* ASSISTANT VIEW */}
        {activeView === "assistant" && selectedProject && (
          <div className="assistant-page ai-frame">
            <header className="assistant-header">
              <h2>AI Assistant for: {selectedProject.title}</h2>
            </header>

            <div className="assistant-layout">
              {/* Left: AI Consoles */}
              <section className="chat-section chat-section-full ai-frame">
                <h3>AI Consoles</h3>

                <div className="console-tabs">
                  <button
                    className={
                      consoleTab === "book"
                        ? "console-tab console-tab-active"
                        : "console-tab"
                    }
                    onClick={() => setConsoleTab("book")}
                  >
                    📖 Book Co-Author
                  </button>
                  <button
                    className={
                      consoleTab === "dev"
                        ? "console-tab console-tab-active"
                        : "console-tab"
                    }
                    onClick={() => setConsoleTab("dev")}
                  >
                    💻 Dev Console
                  </button>
                  <button
                    className={
                      consoleTab === "research"
                        ? "console-tab console-tab-active"
                        : "console-tab"
                    }
                    onClick={() => setConsoleTab("research")}
                  >
                    🔍 Research
                  </button>
                </div>

                {/* BOOK CHAT */}
                {consoleTab === "book" && (
                  <div className="console-pane console-pane-animated">
                    <p className="console-hint">
                      This console uses your manuscript &amp; style profile as
                      context.
                    </p>

                    <div className="kb-toggle-row">
                      <label style={{ fontSize: "0.8rem" }}>
                        <input
                          type="checkbox"
                          checked={useKbForBookChat}
                          onChange={(e) =>
                            setUseKbForBookChat(e.target.checked)
                          }
                        />{" "}
                        Use project KB (codebase context)
                      </label>
                    </div>

                    <div className="chat-log chat-log-large">
                      {chatMessages.length === 0 && (
                        <p className="chat-placeholder">
                          Ask anything about structure, tone, pacing, etc.
                        </p>
                      )}
                      {chatMessages.map((m, idx) => (
                        <div
                          key={idx}
                          className={
                            m.role === "user"
                              ? "chat-msg user"
                              : "chat-msg assistant"
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
                        rows={4}
                        placeholder="Ask for ideas, structure, tone…"
                      />
                      <button onClick={handleSendChat} disabled={chatLoading}>
                        {chatLoading ? "Sending…" : "Send"}
                      </button>
                    </div>
                  </div>
                )}

                {/* DEV CHAT */}
                {consoleTab === "dev" && (
                  <div className="console-pane console-pane-animated">
                    <p className="console-hint">
                      General-purpose dev assistant. Paste errors or code.
                    </p>

                    <div className="chat-log chat-log-large">
                      {devChatMessages.length === 0 && (
                        <p className="chat-placeholder">
                          Paste an error message or ask about features.
                        </p>
                      )}
                      {devChatMessages.map((m, idx) => (
                        <div
                          key={idx}
                          className={
                            m.role === "user"
                              ? "chat-msg user"
                              : "chat-msg assistant"
                          }
                        >
                          <strong>{m.role === "user" ? "You" : "AI"}</strong>
                          <p>{m.content}</p>
                        </div>
                      ))}
                    </div>

                    <div className="chat-input-row">
                      <textarea
                        value={devChatInput}
                        onChange={(e) => setDevChatInput(e.target.value)}
                        rows={4}
                        placeholder="Ask about Electron, APIs, packaging…"
                      />
                      <button
                        onClick={handleSendDevChat}
                        disabled={devChatLoading}
                      >
                        {devChatLoading ? "Sending…" : "Send"}
                      </button>
                    </div>
                  </div>
                )}

                {/* RESEARCH PANEL */}
                {consoleTab === "research" && (
                  <div className="console-pane console-pane-animated">
                    <p className="console-hint">
                      Search &amp; fact-check using external APIs.
                    </p>
                    <ResearchPanel apiBase={API_BASE} manuscript={manuscript} />
                  </div>
                )}
              </section>

              {/* Right side — model status + project KB search */}
              <aside className="assistant-sidebar ai-frame">
                <ModelStatusPanel apiBase={API_BASE} />

                <div className="assistant-sidebar-section">
                  <h3>Project KB Search</h3>
                  <ProjectSearchPanel onUseInAssistant={handleUseKbResultInAssistant} />
                </div>
              </aside>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}

export default App;