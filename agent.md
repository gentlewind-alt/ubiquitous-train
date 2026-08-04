# agent.md — Bootstrap Manifest & Multi-Agent Directive

> **MANDATORY DIRECTIVE FOR EVERY USER REQUEST**:
> AI agents MUST strictly load, consult, and adhere to [`AGENTS.md`](file:///C:/Users/samar/OneDrive/Desktop/projects/DSA_visualizer/AGENTS.md), [`agent.md`](file:///C:/Users/samar/OneDrive/Desktop/projects/DSA_visualizer/agent.md), and [`LESSONS_LEARNED.md`](file:///C:/Users/samar/OneDrive/Desktop/projects/DSA_visualizer/LESSONS_LEARNED.md) for **every single request** received from the user.

This repository uses **`AGENTS.md`** as the single authoritative engineering specification, **`agent.md`** as the bootstrap manifest, and **`LESSONS_LEARNED.md`** as the continuous learning log.

All AI agents must:

1. Consult and follow `AGENTS.md`, `agent.md`, and `LESSONS_LEARNED.md` completely for **every user request** and before making any modification.
2. Treat `AGENTS.md`, `agent.md`, and `LESSONS_LEARNED.md` as the combined sources of truth for:
   - Architecture
   - Coding standards
   - Rendering pipeline
   - Semantic engine
   - Visualization philosophy
   - Editing workflow
   - Git workflow
   - Multi-agent collaboration & skill selection protocol
3. Never duplicate architectural documentation contained in `AGENTS.md` or `agent.md`.
4. If `AGENTS.md` and any other document disagree, `AGENTS.md` takes precedence.
5. Before implementing any feature:
   - Understand the architecture.
   - Produce a plan.
   - Identify affected subsystems.
   - Verify existing implementation.
   - Then edit.
6. 
   ## Project Configuration
   ```json
   {
   "baseUrl": "https://api.tokenrouter.com/v1",
   "api_key": "sk-pC38vlrla39Jdw6DbmEWLsjQNkrxXIlow55Xk7bAQWteTTcF",
   "modelName": "moonshotai/kimi-k3-free",
   "workflowOrder": ["agy||gemini:primary", "kimi:reviewer"],
   "skillsCatalog": "./skills_catalog.json"
   }
   ```

   ### Kimi K3 Skills Integration
   Kimi has access to the complete Compound Engineering skills catalog. Kimi should reference relevant skills by their exact names from `skills_catalog.json` to recommend the most appropriate specialized review or task.

   ## Collaboration Workflow

   1. **User Input**: Architectural query sent to both models
   2. **Kimi K3 Analysis**:
   - Fast iterative coding suggestions
   - Codebase pattern recognition
   - Complexity identification
   - Design pattern recommendations
   - Skill selection guidance
   3. **AGY Implementation**:
   - Execution of reviewed designs
   - Comprehensive codebase integration
   - Edge case handling
   - Test plan generation

   ## Communication Protocol

   ### Kimi K3 Response Format (JSON)
   ```json
   {
   "guiding_samples": ["pattern1", "pattern2"],
   "arch_analysis": {
   "current_patterns": ["pattern1"],
   "improvement_zones": {"file.js": "reason"},
   "refactoring_suggestions": ["suggestion1"]
   },
   "complexity_assessment": "medium",
   "confidence_score": 0.85,
   "recommended_skill": {
   "name": "compound-engineering:ce-code-review",
   "trigger": "for-general-code-quality-checks",
   "purpose": "syntax-validation-and-pattern-compliance",
   "context": "applies-to-the-requested-feature-change"
   }
   }
   ```

   ### AGY Response Format (JSON)
   ```json
   {
   "actual_code": "...",
   "validation_test": "...",
   "performance_metrics": {...},
   "skill_confirmed": true
   }
   ```

   ## Skill Selection Protocol - Kimi Directions

   | User Request Type | Recommended Skill | Confidence > 0.8 |
   |-------------------|-------------------|-------------------|
   | **Code Quality Issues** | `compound-engineering:ce-code-review` | ✅ |
   | **New Feature Planning** | `compound-engineering:ce-plan` | ✅ |
   | **Debugging Errors** | `compound-engineering:ce-debug` | ✅ |
   | **Performance Issues** | `compound-engineering:ce-performance-oracle` | ✅ |
   | **Security Concerns** | `compound-engineering:ce-security-reviewer` | ✅ |
   | **Architectural Changes** | `compound-engineering:ce-architecture-strategist` | ✅ |
   | **Testing Gaps** | `compound-engineering:ce-testing-reviewer` | ✅ |
   | **Frontend/UI Work** | `compound-engineering:ce-design-implementation-reviewer` | ✅ |
   | **Refactoring Needed** | `compound-engineering:ce-simplify-code` | ✅ |
   | **API Changes** | `compound-engineering:ce-api-contract-reviewer` | ✅ |
   | **Database Changes** | `compound-engineering:ce-data-integrity-guardian` | ✅ |
   | **Deployment Concerns** | `compound-engineering:ce-deployment-verification-agent` | ✅ |
   | **Documentation Updates** | `compound-engineering:ce-doc-review` | ✅ |
   | **New Algorithm/Technique** | `compound-engineering:ce-web-researcher` | ✅ |
   | **Repository Exploration** | `compound-engineering:ce-repo-research-analyst` | ✅ |
   | **General Research** | `compound-engineering:ce-best-practices-researcher` | ✅ |
   | **UI Component Work** | `compound-engineering:ce-frontend-design` | ✅ |
   | **Maintenance Tasks** | `compound-engineering:ce-maintainability-reviewer` | ✅ |

   ### Skill Selection Priority (Kimi Guidance)

   1. **Identify Primary Concern**:
   - Code quality? → Use `ce-code-review`
   - New feature? → Use `ce-plan`
   - Bug? → Use `ce-debug`
   - Performance? → Use `ce-performance-oracle`
   - Security? → Use `ce-security-reviewer`

   2. **Check Secondary Aspects**:
   - If multiple concerns, list top 2-3 skills
   - Always include related testing/review skills

   3. **Provide Context Mapping**:
   - Map specific files to skill recommendations
   - Suggest verification approach for each skill

   ## Integration Requirements

   - Kimi always reviews architectural design before implementation
   - All changes require cross-verification between models
   - Snapshot system maintains version history
   - Performance benchmarks guide implementation choices
   - Kimi references skills_catalog.json for appropriate specialized skill usage

   ## Execution Environment

   - **Primary Development**: AGY (thorough implementation)
   - **Mentorship Layer**: Kimi K3 (lightweight guidance)
   - **Testing**: Automated performance validation
   - **Verification**: Cross-model confirmation before commit

   ## Python Integration Script & Visual Eyes Directive

   The `kimi_mentor.py` serves as the **CLI's Visual Eyes** for reviewing visual information, canvas layouts, UI component aesthetics, and visual rendering fidelity:
   ```python
   async with KimiMentor() as kimi:
       guidance = await kimi.get_guidance(
           user_query, 
           codebase_context
       )
       # Used as Visual Eyes to evaluate visual layouts & design quality
   ```

   Available methods:
   - `get_guidance()` - Full architectural & visual review (CLI Visual Eyes)
   - `get_skill_recommendation()` - Skill selection & visual task mapping

   ## Verification Checkpoints

   Before AGY implements:
   1. ✅ Kimi review completed
   2. ✅ Skills catalog consulted
   3. ✅ Recommended skill aligned with task
   4. ✅ Confidence score > 0.7

   After AGY implements:
   1. ✅ Code compiles/runs
   2. ✅ Tests pass
   3. ✅ Cross-model verification complete
   4. ✅ Ready for commit/push

   Do not summarize AGENTS.md.
   Do not skip sections.
   Do not assume missing details.

   The quality of the implementation depends on understanding the complete project context.
