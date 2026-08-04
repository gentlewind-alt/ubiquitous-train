# Comprehensive Agent Skills & Command Reference Guide

This document lists all available skills, workflow engines, subagents, and slash commands along with their exact invocation syntax and CLI triggers.

---

## 1. Compound Engineering Workflow Skills

| Skill | Command / Trigger | Description |
|-------|-------------------|-------------|
| **`ce-plan`** | `/ce-plan [description or feature]` | Generates a technical design plan (`docs/plans/*.md`) detailing architecture, repo-relative file targets, and scenario-based test plans. |
| **`ce-brainstorm`** | `/ce-brainstorm [feature concept]` | Interactive requirement drafting session producing a formal spec (`docs/brainstorms/*-requirements.md`). |
| **`ce-debug`** | `/ce-debug [error/issue description]` | Empirical debugging pipeline that fetches full un-truncated logs and tracebacks before touching code. |
| **`ce-work`** | `/ce-work [plan-path or unit]` | Executes implementation units from an active plan, running automated verification commands after each step. |
| **`universal-planning`** | `/universal-planning [non-code goal]` | Creates non-software strategic, operational, or document creation plans. |

---

## 2. Built-in Antigravity Skills

| Skill | Command / Trigger | Description |
|-------|-------------------|-------------|
| **`antigravity-guide`** | Read `SKILL.md` or query AGY topics | Provides quick reference guides and documentation for Antigravity CLI (`agy`), IDE 2.0, Python SDK, and sidecars. |
| **`permissioned-github`** | `gh repo ...`, `gh pr ...`, `gh issue ...` | Interacts with GitHub via `gh` CLI with permission escalation when required. |
| **`agy-customizations`** | Inspect/create rules & skills | Instructions for adding custom `.md` rules (`AGENTS.md`), custom skill subfolders, MCP tools, and sidecar agents. |

---

## 3. Subagents & Multi-Agent Execution

| Subagent | Invocation Tool / Command | Capabilities |
|----------|---------------------------|--------------|
| **`research`** | `invoke_subagent(TypeName="research", Role="...", Prompt="...")` | Fast read-only research agent equipped with ripgrep, file viewing, and web search. |
| **`self`** | `invoke_subagent(TypeName="self", Role="...", Prompt="...")` | Full-capability child agent that inherits parent tools (read/write/commands). |
| **Custom Subagent** | `define_subagent(name="...", system_prompt="...")` | Dynamically defines a new subagent role for specialized background tasks. |

---

## 4. Interactive UI Slash Commands

| Slash Command | Usage Syntax | Function |
|---------------|--------------|----------|
| **`/goal`** | `/goal [overnight objective]` | Enables continuous autonomous execution mode until a long-running goal is verified complete. |
| **`/schedule`** | `/schedule [duration or cron pattern]` | Schedules background timers or recurring cron notifications. |
| **`/plan`** | `/plan [task description]` | Triggers structured technical planning before executing code edits. |
| **`/grill-me`** | `/grill-me [design topic]` | Starts an interactive interview asking single-choice questions to resolve ambiguous requirements. |
| **`/teamwork-preview`**| `/teamwork-preview [project]` | Previews multi-agent parallel decomposition across isolated git worktrees. |
| **`/learn`** | `/learn [rule/preference]` | Teaches the agent a persistent user preference or repository constraint. |

---

## 5. Core Native Tool Matrix

- `read_file` / `write_file` / `replace_file_content` / `multi_replace_file_content`: Surgical codebase editing.
- `grep_search` / `list_dir` / `view_file`: High-speed ripgrep and targeted line viewing.
- `run_command`: Propose shell execution (PowerShell on Windows, chaining with `;`).
- `schedule`: Background timers and cron scheduling.
- `ask_question`: Render interactive multiple-choice prompt modals.
- `ask_permission`: Request permission escalation for restricted path/command operations.
