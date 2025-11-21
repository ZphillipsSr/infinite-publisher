\# Infinite Publisher – MVP



Infinite Publisher is a desktop-friendly web app that helps authors go from raw manuscript to KDP-ready files with AI-assisted tools.



This MVP is focused on:

\- Managing multiple book projects

\- Editing and autosaving manuscripts

\- Getting quick formatting stats and print specs

\- Generating AI-assisted outlines, back-cover blurbs, and rewrites

\- Research and fact-check scaffolding (for future web integrations)



---



\## 🔧 Tech Stack



\- \*\*Frontend:\*\* React + TypeScript + Vite

\- \*\*Backend:\*\* Node.js + TypeScript (Express-style API)

\- \*\*Build:\*\* `npm` / `tsc`

\- \*\*Target:\*\* Authors publishing on Amazon KDP (paperback / color / workbooks)



---



\## 📁 Project Structure (High Level)



```text

infinite-publisher/

&nbsp; client/           # React + Vite frontend (MVP UI)

&nbsp;   src/

&nbsp;     App.tsx      # Main app: projects, editor, AI tools, research tools

&nbsp;     App.css      # Styling for layout and components

&nbsp;     ...

&nbsp; server/           # Node + TypeScript backend (API)

&nbsp;   src/

&nbsp;     index.ts     # Main server entry, routes, AI + manuscript endpoints

&nbsp;     ...

&nbsp; ROADMAP.md        # Feature roadmap, ideas, and upgrade paths

&nbsp; .gitignore        # Git / GitHub ignore rules

