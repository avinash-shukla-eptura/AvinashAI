# AID Protocol Bootstrap

<!-- FIRST-RUN FILE — This file triggers a one-time conversational onboarding. -->
<!-- When an AI tool encounters this file, it should walk the developer through -->
<!-- setting up the project's aid. Delete this file when onboarding is complete. -->

## Instructions for AI

You are encountering this project for the first time. The `.aid/` directory contains
template files that need to be filled in with real project information.

**Do not guess. Ask the developer.**

Walk through the following conversation to gather the information needed to populate
the .aid/ files. Be direct and efficient — this should take under 15 minutes.

### Step 1: Project Identity

Ask the developer:

1. "What is this project called and what does it do in one sentence?"
2. "What is the tech stack? (language, framework, database, infrastructure)"
3. "Who uses this — internal team, external customers, other services?"
4. "Are there 3-5 domain terms I should understand correctly?"

Use the answers to fill in `.aid/PROJECT.md`.

### Step 2: Architecture

Ask the developer:

1. "Can you describe the high-level architecture in 2-3 sentences?"
2. "What are the main components or services?"
3. "What are the 1-2 most important data flows?"
4. "Are there any architecture decisions you'd want a new engineer to know about?"

Use the answers to fill in `.aid/ARCHITECTURE.md`.

### Step 3: Conventions

Ask the developer:

1. "What are the non-negotiable coding rules on this project?"
2. "How do you handle git workflow? (branching, PRs, commit messages)"
3. "What does the test strategy look like?"
4. "Any deployment rules or rituals?"

Use the answers to fill in `.aid/CONVENTIONS.md`.

### Step 4: Current State

Ask the developer:

1. "What's the current state of the project? What's actively being worked on?"
2. "Are there any known issues, tech debt, or landmines I should know about?"
3. "Any recent investigations or decisions that haven't been documented?"

Use the answers to seed `.aid/MEMORY.md`.

### Step 5: Tool Configuration

Ask the developer:

1. "Which AI tools does the team use? (Claude Code, Cursor, Copilot, etc.)"
2. "Should I generate an AGENTS.md file for cross-tool compatibility?"

Use the answers to update `.aid/aid.json`.

### Step 6: Generate and Clean Up

After gathering all information:

1. Fill in all `.aid/` template files with real content
2. Remove all HTML comments from the filled-in files (they were guidance, not content)
3. Generate `AGENTS.md` from the .aid/ files
4. Generate `CLAUDE.md` if Claude Code is being used
5. **Delete this BOOTSTRAP.md file** — it is a one-time experience
6. Commit all changes with message: "Initialize project AID"

Tell the developer:
"Your project AID is set up. I'll remember this context every session now.
Run `aid generate` after making changes to .aid/ files to regenerate
tool-specific files."
