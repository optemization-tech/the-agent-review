# The Agent Review — Knowledge Base Design

## Overview

Extract all hardcoded data from `index.html` into a single `knowledge-base.json` file that powers the agent directory, the interactive quiz, and the Claude API recommendation engine. The knowledge base is the single source of truth — editable by OpenClaw now, open to community PRs later.

## Constraints

- Single `index.html` on GitHub Pages, no build step
- Static JSON file served from the same repo
- Claude API via lightweight Cloudflare Worker proxy (Anthropic API does not support CORS for browser requests)
- Target user: non-technical ops/leadership (CoS, VP Ops, COO, CEO)
- Must handle thousands of concurrent users (static CDN handles this)

---

## Knowledge Base Schema

One file: `knowledge-base.json` in the repo root.

### `agents`

Keyed by slug (e.g., `"manus"`, `"claude_cowork"`). Each agent object:

| Field | Type | Description |
|---|---|---|
| `name` | string | Display name (e.g., "Manus (Meta)") |
| `category` | string | Category label (e.g., "Paid Ads") |
| `summary` | string | 1-2 sentence description |
| `best_for` | string | Who this agent serves best |
| `limitations` | string | Known constraints |
| `cost` | string | Pricing summary |
| `technical_level` | string | One of: `"none"`, `"low"`, `"high"`, `"developer"`, `"requires implementation partner"` |
| `persistence` | boolean | Whether it retains memory across sessions |
| `setup_url` | string | Direct link to sign up or get started |
| `starter_prompt` | string | Static fallback prompt to copy-paste into the tool |
| `getting_started_steps` | string[] | Hand-holding steps (e.g., `["Open the link above", "Sign up for a free account", "Paste the prompt below", "Answer the follow-up questions"]`) |
| `suggested_prompts` | string[] | 3-5 example prompts showing what this agent does well. Used contextually in the quiz free-text step. |

### `quiz`

Three sub-keys mapping to the three quiz steps.

#### `quiz.tasks` (Step 1)

Array of multi-select options for "What tasks do you want to get rid of?"

```json
{
  "label": "Chasing my team for status updates",
  "icon": "emoji",
  "agent_scores": {
    "notion_custom_agents": 3,
    "n8n_custom": 2,
    "openclaw": 1
  }
}
```

`agent_scores` maps agent slugs to weights. When a user selects this option, those weights get added to a running tally.

#### `quiz.tools` (Step 2)

Array of multi-select options for "What tools do you already use?"

Same structure as tasks: `label`, `icon`, `agent_scores`. Boosts agents that integrate well with the selected tools.

Example options:
```json
[
  { "label": "Notion", "icon": "📓", "agent_scores": { "notion_custom_agents": 3, "n8n_custom": 1 } },
  { "label": "Google Workspace", "icon": "📧", "agent_scores": { "claude_cowork": 2, "openclaw": 1 } },
  { "label": "Slack", "icon": "💬", "agent_scores": { "openclaw": 2, "n8n_custom": 2, "notion_custom_agents": 1 } },
  { "label": "Meta Ads Manager", "icon": "📢", "agent_scores": { "manus": 3 } },
  { "label": "Salesforce / HubSpot", "icon": "📊", "agent_scores": { "n8n_custom": 3, "perplexity_computer": 1 } },
  { "label": "Others / none of these", "icon": "🤷", "agent_scores": {} }
]
```

#### `quiz.api_config` (Step 3)

Configuration for the Claude API call:

| Field | Type | Description |
|---|---|---|
| `system_prompt_template` | string | System prompt with `{{agents_json}}` and `{{user_selections}}` placeholders |
| `model` | string | Model ID (e.g., `"claude-sonnet-4-20250514"`) |
| `max_tokens` | number | Max response tokens |
| `enabled` | boolean | Kill switch for the API call |

### `pitches`

Keyed by agent slug. Each has:

| Field | Type | Description |
|---|---|---|
| `complexity` | string | How hard it is to get started |
| `pitch` | string | Scoped Optemization value prop for this agent |

### `category_colors`

Keyed by category name. Each has `bg`, `text`, `border` (Tailwind classes). Moved out of JS so new categories added to the KB automatically get styled.

### `tech_labels`

Keyed by technical_level value. Each has `label`, `bg`, `text` (Tailwind classes).

---

## User Journey

### Landing

User sees the hero section with a brief problem statement and two CTAs: "Take the Quiz" and "Browse All Agents." The directory is visible below.

### Quiz — Fullscreen Experience

Clicking "Take the Quiz" (either from the hero CTA or the inline quiz section's start button) opens a fullscreen overlay via CSS (`position: fixed; inset: 0; z-index: 50`). Clean, focused — no directory or hero visible. Progress indicator across the top. Back button and Escape key dismiss the overlay and return to the main page. No page navigation — just show/hide.

**Step 1 — "What tasks do you want to get rid of?"**

Multi-select. 8 options from `quiz.tasks`. User taps/clicks all that apply, then hits "Next." Each selected option adds its `agent_scores` to a running tally.

**Step 2 — "What tools do you already use?"**

Multi-select. 6 options from `quiz.tools`. Same scoring mechanism. "Next" to proceed.

**Step 3 — "Tell us more" (skippable)**

Free-text field with a "Skip" option clearly visible. Above the text field: 2-3 suggested prompts pulled from the `suggested_prompts` of the top-scoring agents from Steps 1-2. User can click a suggestion to populate the field, or type their own.

If the user types something (or selects a suggestion), the Claude API is called. If they skip, results use deterministic scoring only.

### Scoring Logic

After Steps 1-2:
1. Sum all `agent_scores` weights from selected options
2. Rank agents by total score
3. Top agent = primary recommendation. Runner-up shown as "also consider" if its score is at least 60% of the top agent's score

If Step 3 is completed:
1. Build the API request: system prompt (with full agents JSON as context) + user's Step 1-2 selections + their free-text
2. Claude generates a JSON response with two keys: `recommendation` (personalized paragraph) and `starter_prompt` (personalized prompt to copy-paste)
3. These override the static fallback content in the result screen

If all agents score 0 (user selected nothing or options had no scores), show a general "Explore the directory" prompt instead of a specific recommendation.

### Loading State

While the API call is in progress, the fullscreen quiz stays up. Animated thinking phrases cycle through:
- "Analyzing your needs..."
- "Matching you with the right agent..."
- "Crafting your starter prompt..."

### Error / Timeout State

If the API call fails or exceeds 15 seconds:
1. Fall back to deterministic result (Steps 1-2 scoring + static `starter_prompt` from KB)
2. Show a subtle banner: "We're experiencing high traffic. Leave your email for a personalized deep-dive recommendation."
3. Email field + submit. For v1, a hidden Google Form `<iframe>` POST — no backend needed, emails land in a Google Sheet

### Result Screen

Fullscreen. Shows:

1. **Recommended agent** — name, category badge, personalized "why" paragraph (AI-generated if Step 3 was used, otherwise `best_for` from KB)
2. **"Also consider"** — secondary agent if scores are close, with brief summary
3. **Complexity callout** — from `pitches[agent].complexity`
4. **Getting started guide** — numbered steps from `getting_started_steps`, with `setup_url` as the first link
5. **Starter prompt** — in a prominent copy box with a big "Copy" button. AI-generated if available, `starter_prompt` from KB as fallback
6. **Optemization pitch** — from `pitches[agent].pitch`
7. **CTAs** — "Need help implementing this?" → optemization.com, "Retake Quiz" button, "Back to directory" link

---

## How the Site Loads the KB

```
fetch('./knowledge-base.json')
  .then(r => r.json())
  .then(kb => { window.KB = kb; renderDirectory(); renderQuiz(); })
```

All rendering functions read from `window.KB` instead of hardcoded constants. If the fetch fails, show a minimal error state.

---

## Cloudflare Worker Proxy

The Anthropic API does not support CORS for browser-based requests. A lightweight Cloudflare Worker sits between the site and the API:

- Receives the quiz payload from the browser (user selections + free-text)
- Injects the API key server-side (key never exposed to the client)
- Forwards the request to `api.anthropic.com` and streams the response back
- Handles rate limiting: max 5 requests per IP per hour (server-side, not bypassable)

The Worker is minimal — ~50 lines of code. Free tier handles 100K requests/day.

## Abuse Prevention

- **Server-side rate limiting:** Cloudflare Worker enforces max 5 requests per IP per hour.
- **Hard spend limit:** $2K/month on the Anthropic API key (set in Anthropic dashboard).
- **Future:** CAPTCHA before Step 3 if abuse patterns emerge.

---

## OpenClaw Editing

OpenClaw edits `knowledge-base.json` directly — it can read/write files in the repo. Typical operations:
- Add a new agent (new key in `agents`, add scores to relevant `quiz.tasks` and `quiz.tools`, add a `pitches` entry)
- Update agent info (cost changes, new limitations, updated summary)
- Add/modify quiz options
- Update pitches and suggested prompts

No build step needed. Edit the JSON, commit, push — live on GitHub Pages.

---

## Future Directions (Backlog)

These are not in scope for v1 but should be designed in future iterations:

### KB Transparency
Expose the knowledge base data and scoring logic to users so they can see why they got a recommendation. Builds trust in the tool. Could be a "How we decide" section, a visible scoring breakdown on the result screen, or an explorable view of the KB itself.

### Agent Comparison Tool
Pick any two agents and get an interactive side-by-side table comparing them across all dimensions (cost, technical level, best for, limitations, etc.). Could be a standalone page or a modal within the directory.

### Tool-Driven Recommendation
A less chat-driven, more interactive exploration mode. Instead of a linear quiz, users manipulate filters, sliders, or cards to narrow down agents. More hands-on, less form-filling. Needs further exploration.

---

## File Changes Summary

| File | Change |
|---|---|
| `knowledge-base.json` | **New.** Single source of truth for all agent data, quiz config, and pitches |
| `index.html` | **Modified.** Remove hardcoded data. Fetch KB on load. Rewrite quiz to new 3-step flow. Add fullscreen overlay, scoring engine, proxy API integration, loading/error states, result screen with copy-paste prompt. Update hero copy to reflect new 3-step flow |
| Cloudflare Worker | **New.** Lightweight proxy for Claude API calls. ~50 lines. Handles API key, rate limiting, request forwarding |
