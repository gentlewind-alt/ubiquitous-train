# Available Agent Skills & Workflow Capabilities

## 1. Built-in Antigravity Skills

- **`antigravity-guide`**: Complete guide to Antigravity CLI (`agy`), IDE 2.0, Python SDK, keybindings, and slash commands.
- **`permissioned-github`**: GitHub (`gh`) operations (repos, branches, PRs, issues) with auto-permission escalation.
- **`agy-customizations`**: Instructions for extending AGY with custom `.md` rules, custom skill folders, MCP servers, and sidecars.

---

## 2. Compound Engineering Workflow Skills

- **`/ce-plan` (`ce-plan`)**: Generates technical design plans (`docs/plans/*.md`) with architecture decisions, file paths, and test scenarios.
- **`/ce-brainstorm` (`ce-brainstorm`)**: Interactive product requirement drafting (`docs/brainstorms/*-requirements.md`).
- **`/ce-debug` (`ce-debug`)**: Empirical root-cause debugging pipeline based on log traces before changing code.
- **`/ce-work` (`ce-work`)**: Executes plan units, runs build/test verification commands, and commits git progress.
- **`universal-planning`**: Structured planning for non-software tasks (operations, docs, strategic workflows).

---

## 3. Subagents & Delegation

- **`research`**: Read-only background subagent for deep codebase exploration and web search.
- **`self`**: Autonomous child subagent inheriting full write and execution capabilities.

---

## 4. Interactive Slash Commands

- **`/goal`**: Run long-running overnight autonomous tasks until fully complete.
- **`/schedule`**: Set one-time timers or recurring cron jobs.
- **`/plan`**: Step-by-step technical planning mode.
- **`/grill-me`**: Interactive Q&A interview to resolve underspecified requirements.
- **`/teamwork-preview`**: Multi-agent parallel project execution.
- **`/learn`**: Save user preferences or workflow corrections permanently.
