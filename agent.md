# agent.md — Bootstrap Manifest

This repository uses **AGENTS.md** as the single authoritative engineering specification.

All AI agents must:

1. Read `AGENTS.md` completely before making any modification.
2. Treat `AGENTS.md` as the source of truth for:
   - Architecture
   - Coding standards
   - Rendering pipeline
   - Semantic engine
   - Visualization philosophy
   - Editing workflow
   - Git workflow
3. Never duplicate architectural documentation contained in AGENTS.md.
4. If AGENTS.md and any other document disagree, AGENTS.md takes precedence.
5. Before implementing any feature:
   - Understand the architecture.
   - Produce a plan.
   - Identify affected subsystems.
   - Verify existing implementation.
   - Then edit.

Do not summarize AGENTS.md.
Do not skip sections.
Do not assume missing details.

The quality of the implementation depends on understanding the complete project context.