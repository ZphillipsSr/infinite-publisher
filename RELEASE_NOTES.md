\## 🚀 Overview



This is the first public MVP of \*\*Infinite Publisher\*\* – a desktop-ready toolkit for turning raw manuscripts into KDP-ready interiors and supporting assets, with AI assistance baked in.



\## ✍️ Core Features



\- \*\*Project Library\*\*

&nbsp; - Create/open named book projects.

&nbsp; - Each project keeps its own manuscript + style/voice profile.



\- \*\*Manuscript Editor\*\*

&nbsp; - Paste or type directly into the editor.

&nbsp; - Upload or drag-and-drop `.txt` / `.md` (client-side) or `.doc/.docx/.pdf/.epub` (via backend import).

&nbsp; - Autosave to `localStorage` + manual save to the Node backend.

&nbsp; - Download current manuscript as `.txt`.



\- \*\*Formatting \& Print Planning\*\*

&nbsp; - “Format (Stats Only)” endpoint for word count + estimated pages.

&nbsp; - KDP-style print helper:

&nbsp;   - Trim size: 6"×9" or 8.5"×11".

&nbsp;   - Line spacing: 1.0 / 1.15 / 1.5.

&nbsp;   - Spine width \& full cover dimensions calculator by page count + paper type.

&nbsp;   - JSON cover template block for design tools.



\- \*\*Manuscript Insights\*\*

&nbsp; - Total words, estimated reading time.

&nbsp; - Chapter-like section detection using “CHAPTER 1”, “Chapter II”, etc.

&nbsp; - Longest/shortest section and per-section word counts.



\- \*\*Style \& Voice Profile\*\*

&nbsp; - Tone, audience, genre, POV, tense, pacing, formality.

&nbsp; - Freeform notes to guide AI behavior across tools.



\- \*\*AI-Assisted Tools\*\* (backend AI must be configured)

&nbsp; - \*\*Rewrite selection\*\*: clearer, shorter, or more vivid while preserving voice.

&nbsp; - \*\*Contextual chat\*\* about the current manuscript + style profile.

&nbsp; - \*\*AI outline\*\*: chapter/section map with summaries and themes.

&nbsp; - \*\*Back-cover blurb\*\*: KDP-style marketing copy draft.



\- \*\*Research (Beta)\*\*

&nbsp; - Web search + fact-check UI, wired to a placeholder “dummy” backend provider for now.

&nbsp; - Suggests research topics based on manuscript keyword frequency.



\- \*\*Diagnostics\*\*

&nbsp; - Model/Env status panel powered by `/api/debug/env`.



\## 🧱 Project Infrastructure



\- Apache 2.0 licensed (`LICENSE.txt` + `NOTICE.txt`).

\- `.github/` templates (issues, etc.) and basic security/code-of-conduct docs.

\- High-level `ROADMAP.md`, `CONTRIBUTING.md`, `CHANGELOG.md`, and `docs/` folder scaffolded for future expansion.



\## ⚠️ Known Limitations



\- AI and research features require backend API keys/config to be fully active.

\- DOCX export and binary import depend on the Node server being running locally.

\- No user accounts or sync yet – projects are local to your environment.



\## 🔮 Next



Planned areas for v1.x/v2:

\- Rich text editor, scenes/chapters as blocks.

\- More AI tools (line editing passes, style checks, outline-to-draft).

\- Real web search integrations (Bing/SerpAPI/custom).

\- Theming \& polished UI skins for different genres/audiences.



