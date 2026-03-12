# Knowledge Base Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Extract all hardcoded data from index.html into an editable knowledge-base.json, rewrite the quiz as a 3-step fullscreen experience with weighted scoring and Claude API integration via a Cloudflare Worker proxy.

**Architecture:** Single index.html fetches knowledge-base.json on load. All rendering reads from `window.KB`. The quiz is a fullscreen overlay with 3 steps: multi-select tasks, multi-select tools, optional free-text. Steps 1-2 use weighted scoring. Step 3 calls Claude API via a Cloudflare Worker proxy for personalized recommendations. Static fallbacks handle skipped Step 3 or API failures.

**Tech Stack:** Vanilla JS, Tailwind CSS (CDN), GitHub Pages, Cloudflare Workers

**Spec:** `docs/superpowers/specs/2026-03-12-knowledge-base-design.md`

---

## File Structure

| File | Responsibility |
|---|---|
| `knowledge-base.json` | **New.** All agent data, quiz config (tasks, tools, api_config), pitches, category_colors, tech_labels |
| `index.html` | **Modified.** Fetch KB on load. Directory renders from KB. Quiz rewritten as fullscreen 3-step overlay with scoring engine, API integration, loading/error states, result screen with copy-paste prompt |
| `worker/index.js` | **New.** Cloudflare Worker proxy. Receives quiz payload, injects API key, forwards to Anthropic, rate limits by IP |
| `worker/wrangler.toml` | **New.** Worker config (name, compatibility date, environment variables) |

---

## Important Notes for Implementers

**Script assembly:** Tasks 2-6 progressively build the `<script>` block in index.html. Task 2 replaces the entire existing script with a KB loader + directory + placeholder quiz. Tasks 3-6 replace the placeholder quiz section with the full quiz engine. Each commit should produce a working (if incomplete) page.

**CSS:** The `.quiz-option` utility class already exists in the current `<style type="text/tailwindcss">` block (lines 37-43 of index.html). It provides padding, border, rounded corners, and hover states. Do not remove this block.

**Email capture:** The Google Form POST integration is deferred. For launch, email capture logs to console with a confirmation message. Wire up the real Google Form POST as a follow-up task.

**Security model:** The client only sends user selections (task labels, tool labels, free-text, top agent slug) to the Cloudflare Worker. The Worker fetches the KB server-side and has the system prompt template embedded. No sensitive data flows from client to API.

---

## Chunk 1: Knowledge Base JSON + Directory Migration

### Task 1: Create knowledge-base.json with all existing data + new fields

**Files:**
- Create: `knowledge-base.json`

- [ ] **Step 1: Create the knowledge base file**

Extract all data from index.html's `AGENTS`, `CATEGORY_COLORS`, `TECH_LABELS`, and `RESULT_PITCHES` into `knowledge-base.json`. Add the new fields (`setup_url`, `starter_prompt`, `getting_started_steps`, `suggested_prompts`) to each agent. Add the `quiz` section with tasks, tools, and api_config. Restructure pitches to be keyed by individual agent slug.

```json
{
  "agents": {
    "manus": {
      "name": "Manus (Meta)",
      "category": "Paid Ads",
      "summary": "Embedded inside Meta Ads Manager since Feb 2026. Handles report building, audience research, competitor analysis. Already in your ad account — no setup.",
      "best_for": "Meta advertisers who want automated reporting and competitive intel",
      "limitations": "Meta-only, currently prone to hallucination, opaque data layer",
      "cost": "Included with Meta Ads Manager",
      "technical_level": "none",
      "persistence": false,
      "setup_url": "https://adsmanager.facebook.com",
      "starter_prompt": "Show me a performance breakdown of my top 5 ad sets this month, including cost per result and ROAS. Flag any that are underperforming compared to last month.",
      "getting_started_steps": [
        "Open Meta Ads Manager (link above)",
        "Look for the AI assistant icon in the top navigation",
        "Click it and paste the prompt below",
        "Review the generated report and ask follow-up questions"
      ],
      "suggested_prompts": [
        "Analyze my ad spend this month and flag underperforming campaigns",
        "Research my top 3 competitors' ad strategies",
        "Build a weekly performance report I can share with my team",
        "Suggest audience segments I should test based on my best-performing ads"
      ]
    },
    "claude_cowork": {
      "name": "Claude Cowork",
      "category": "Desktop / File Workflows",
      "summary": "Sandboxed desktop agent for document and file automation. You define a folder, describe an outcome, it executes multi-step tasks. Built by Anthropic.",
      "best_for": "Knowledge workers automating document-heavy workflows without touching a terminal",
      "limitations": "No persistent memory between sessions, no messaging app integration, requires Pro/Max plan",
      "cost": "$20–100/mo (Claude Pro or Max)",
      "technical_level": "low",
      "persistence": false,
      "setup_url": "https://claude.ai/download",
      "starter_prompt": "Go through the files in this folder and create a summary document that lists each file's purpose, key findings, and any action items mentioned. Output as a single markdown file.",
      "getting_started_steps": [
        "Download Claude Desktop (link above)",
        "Sign up for Claude Pro or Max",
        "Open Claude Desktop and select a folder to work with",
        "Paste the prompt below and describe your task",
        "Review the output and iterate"
      ],
      "suggested_prompts": [
        "Summarize all the documents in this folder into a one-page brief",
        "Extract action items from these meeting notes and organize by owner",
        "Reformat these reports into a consistent template",
        "Compare these two contracts and highlight the differences"
      ]
    },
    "openclaw": {
      "name": "OpenClaw",
      "category": "Always-On Automation",
      "summary": "Open-source 24/7 agent running on your machine or a VPS. Communicates via WhatsApp, Telegram, Slack, iMessage. Persistent memory across weeks. Model-agnostic.",
      "best_for": "Always-on personal or business automation, cross-app life OS, technical users",
      "limitations": "Real security risks (prompt injection, malicious community skills), requires Docker/VPS setup",
      "cost": "Free software + API costs ($5–150/mo)",
      "technical_level": "high",
      "persistence": true,
      "setup_url": "https://github.com/ArcadeAI/OpenClaw",
      "starter_prompt": "Every morning at 8am, check my calendar for today's meetings, summarize any prep materials, and send me a briefing via Slack with agenda items and key context for each meeting.",
      "getting_started_steps": [
        "Visit the GitHub repo (link above)",
        "Follow the Docker setup guide in the README",
        "Connect your messaging platform (Slack, Telegram, etc.)",
        "Configure your API keys for your preferred AI model",
        "Send it the prompt below via your connected messenger"
      ],
      "suggested_prompts": [
        "Monitor my email for meeting invites and auto-add prep notes to my calendar",
        "Every Friday, compile a weekly summary of my Slack channels and send it to me",
        "When I message you a contact name, pull their latest interactions from my CRM",
        "Track my team's standup messages and flag any blockers to me immediately"
      ]
    },
    "notion_custom_agents": {
      "name": "Notion Custom Agents",
      "category": "Knowledge Management",
      "summary": "Agent layer inside Notion that pulls workspace context and runs multi-step tasks across connected integrations.",
      "best_for": "Teams already living in Notion who want agentic workflows without leaving the ecosystem",
      "limitations": "Notion Business plan required, degrades at 10k+ rows, limited to Notion ecosystem",
      "cost": "Included in Notion Business plan",
      "technical_level": "low",
      "persistence": false,
      "setup_url": "https://www.notion.so/product/agents",
      "starter_prompt": "Review my project tracker database and identify any tasks that are overdue or at risk. For each one, draft a follow-up message to the assignee asking for a status update.",
      "getting_started_steps": [
        "Make sure you're on a Notion Business plan",
        "Go to Settings > Agents in your Notion workspace",
        "Create a new custom agent",
        "Give it access to your relevant databases",
        "Paste the prompt below as the agent's first instruction"
      ],
      "suggested_prompts": [
        "Scan my project tracker for overdue tasks and draft follow-up messages",
        "Create a weekly status report from my team's task updates",
        "When a new item is added to the inbox database, triage and assign it",
        "Summarize all meeting notes from this week and extract action items"
      ]
    },
    "claude_code": {
      "name": "Claude Code",
      "category": "Software Development",
      "summary": "Terminal-native coding agent by Anthropic. Deep code reasoning, best-in-class for multi-file refactors. Lives in your terminal or IDE.",
      "best_for": "Developers doing complex code work, refactoring, or building agentic applications",
      "limitations": "Developer-only, no persistent memory between sessions",
      "cost": "Included with Claude Max ($100/mo) or API",
      "technical_level": "developer",
      "persistence": false,
      "setup_url": "https://docs.anthropic.com/en/docs/claude-code/overview",
      "starter_prompt": "Explore this codebase and give me a high-level architecture overview. Then identify the top 3 areas where code quality could be improved, with specific suggestions.",
      "getting_started_steps": [
        "Install Claude Code: npm install -g @anthropic-ai/claude-code",
        "Subscribe to Claude Max ($100/mo) or set up API billing",
        "Open your terminal in your project directory",
        "Run 'claude' to start a session",
        "Paste the prompt below"
      ],
      "suggested_prompts": [
        "Explore this repo and explain the architecture",
        "Refactor this module to use dependency injection",
        "Write tests for all untested functions in src/",
        "Find and fix all security vulnerabilities in this codebase"
      ]
    },
    "codex": {
      "name": "Codex (OpenAI)",
      "category": "Software Development",
      "summary": "Cloud-first coding agent by OpenAI. Strong on long-horizon planning and parallel subtasks.",
      "best_for": "Developers in the OpenAI ecosystem, complex multi-file architectures",
      "limitations": "Cloud-only, local CLI lags Claude Code on latency",
      "cost": "ChatGPT Pro or API",
      "technical_level": "developer",
      "persistence": false,
      "setup_url": "https://chatgpt.com/codex",
      "starter_prompt": "Analyze this repository structure and create a detailed plan to add a REST API layer. Include routing, middleware, error handling, and tests.",
      "getting_started_steps": [
        "Subscribe to ChatGPT Pro",
        "Go to chatgpt.com/codex (link above)",
        "Connect your GitHub repository",
        "Paste the prompt below to start a task",
        "Review the generated PR when complete"
      ],
      "suggested_prompts": [
        "Add comprehensive test coverage to this project",
        "Refactor the database layer to use connection pooling",
        "Create a CI/CD pipeline for this project",
        "Migrate this codebase from JavaScript to TypeScript"
      ]
    },
    "perplexity_computer": {
      "name": "Perplexity Computer",
      "category": "Research / Cross-Platform",
      "summary": "General-purpose digital worker that routes tasks across 19 AI models. Designed for long-running research and cross-app work.",
      "best_for": "Deep research, competitive intelligence, cross-platform tasks where you want the best model per subtask",
      "limitations": "Plans start at $200+/mo with additional AI credits",
      "cost": "$200+/mo",
      "technical_level": "low",
      "persistence": true,
      "setup_url": "https://www.perplexity.ai/hub/computer",
      "starter_prompt": "Research the top 10 competitors in [your industry]. For each, compile: pricing model, key features, recent product launches, and estimated market share. Output as a comparison table.",
      "getting_started_steps": [
        "Sign up at perplexity.ai (link above)",
        "Subscribe to a plan with Computer access ($200+/mo)",
        "Open a new Computer session",
        "Paste the prompt below (replace [your industry] with yours)",
        "Let it run — this can take 10-30 minutes for deep research"
      ],
      "suggested_prompts": [
        "Research our top 10 competitors and build a comparison matrix",
        "Find all recent funding announcements in [industry] from the last 30 days",
        "Compile a market landscape report with pricing, features, and positioning",
        "Monitor these 5 company blogs and summarize any product updates weekly"
      ]
    },
    "n8n_custom": {
      "name": "Custom Agent (n8n + Claude API)",
      "category": "Custom / Enterprise",
      "summary": "Build your own agent orchestration layer using n8n workflows + Claude API. Full control over logic, memory, integrations, and triggers.",
      "best_for": "Businesses with specific workflows that no off-the-shelf tool handles well",
      "limitations": "Requires design and build time — this is a project, not a product",
      "cost": "n8n license + API costs (varies)",
      "technical_level": "requires implementation partner",
      "persistence": true,
      "setup_url": "https://optemization.com",
      "starter_prompt": "This agent is custom-built for your specific workflow. Contact Optemization to design the right system for your needs.",
      "getting_started_steps": [
        "Visit optemization.com (link above)",
        "Book a discovery call to discuss your workflow needs",
        "We'll design the agent architecture together",
        "We build and deploy the system on n8n + Claude API",
        "You get a custom agent that compounds over time"
      ],
      "suggested_prompts": [
        "When a new lead comes in via Typeform, enrich it with Clearbit data, score it, and route to the right sales rep in Slack",
        "Every Monday, pull data from 3 tools, generate a board report, and draft an email to investors",
        "Monitor customer support tickets for escalation patterns and alert the team lead",
        "Automatically process inbound contracts: extract key terms, flag risks, and route for approval"
      ]
    }
  },
  "quiz": {
    "tasks": [
      {
        "label": "Chasing my team for status updates",
        "icon": "📋",
        "agent_scores": { "notion_custom_agents": 3, "n8n_custom": 2, "openclaw": 1 }
      },
      {
        "label": "Researching stuff and summarizing it",
        "icon": "🔍",
        "agent_scores": { "perplexity_computer": 3, "claude_cowork": 2, "notion_custom_agents": 1 }
      },
      {
        "label": "Managing Meta ad campaigns",
        "icon": "📢",
        "agent_scores": { "manus": 3 }
      },
      {
        "label": "Sending outbound and following up",
        "icon": "📧",
        "agent_scores": { "n8n_custom": 3, "openclaw": 2 }
      },
      {
        "label": "Prepping for meetings and following up after",
        "icon": "🤝",
        "agent_scores": { "notion_custom_agents": 2, "claude_cowork": 2, "openclaw": 2, "n8n_custom": 1 }
      },
      {
        "label": "Actually reaching inbox zero",
        "icon": "📬",
        "agent_scores": { "openclaw": 3, "n8n_custom": 2 }
      },
      {
        "label": "Building reports from scattered data",
        "icon": "📊",
        "agent_scores": { "n8n_custom": 3, "perplexity_computer": 2, "notion_custom_agents": 1 }
      },
      {
        "label": "Drowning in Slack messages",
        "icon": "💬",
        "agent_scores": { "openclaw": 3, "n8n_custom": 2, "notion_custom_agents": 1 }
      }
    ],
    "tools": [
      { "label": "Notion", "icon": "📓", "agent_scores": { "notion_custom_agents": 3, "n8n_custom": 1 } },
      { "label": "Google Workspace", "icon": "📧", "agent_scores": { "claude_cowork": 2, "openclaw": 1 } },
      { "label": "Slack", "icon": "💬", "agent_scores": { "openclaw": 2, "n8n_custom": 2, "notion_custom_agents": 1 } },
      { "label": "Meta Ads Manager", "icon": "📢", "agent_scores": { "manus": 3 } },
      { "label": "Salesforce / HubSpot", "icon": "📊", "agent_scores": { "n8n_custom": 3, "perplexity_computer": 1 } },
      { "label": "Others / none of these", "icon": "🤷", "agent_scores": {} }
    ],
    "api_config": {
      "system_prompt_template": "You are an AI agent recommendation engine for The Agent Review. You help business users (non-technical: Chiefs of Staff, VP Ops, COOs, CEOs) find the right AI agent tool.\n\nHere is the complete knowledge base of agents:\n{{agents_json}}\n\nThe user selected these tasks they want to automate:\n{{selected_tasks}}\n\nThe user already uses these tools:\n{{selected_tools}}\n\nThe user's description of what they want:\n{{user_text}}\n\nBased on our scoring, the top recommended agent is: {{top_agent}}\n\nGenerate a JSON response with exactly two keys:\n- \"recommendation\": A 2-3 sentence personalized paragraph explaining why this specific agent is the best fit for THEIR described needs. Be specific to what they wrote, not generic. Write in second person (\"you\").\n- \"starter_prompt\": A ready-to-paste prompt they can copy directly into the recommended tool to start working on their described task immediately. Make it specific to their input.\n\nRespond ONLY with valid JSON. No markdown, no code fences.",
      "model": "claude-sonnet-4-20250514",
      "max_tokens": 500,
      "enabled": true
    }
  },
  "pitches": {
    "manus": {
      "complexity": "Manus is already in your Meta Ads Manager — zero setup.",
      "pitch": "We help teams integrate AI agents into their existing marketing stack so nothing falls through the cracks."
    },
    "claude_cowork": {
      "complexity": "Sign up for Claude Pro or Max and you're running in minutes.",
      "pitch": "We can define the workflows, build the skills, and set up the guardrails so this runs reliably."
    },
    "openclaw": {
      "complexity": "Requires Docker or a VPS, API keys, and comfort with config files. Plan for an afternoon of setup.",
      "pitch": "We can define the workflows, build the skills, and set up the guardrails so this runs reliably."
    },
    "notion_custom_agents": {
      "complexity": "Available now on Notion Business. Turn it on in settings and start building agents.",
      "pitch": "We've designed agent-ready Notion workspaces for 80+ clients. We know where the edges are."
    },
    "claude_code": {
      "complexity": "Install the CLI, connect your API key, and start coding. Developer setup takes 10 minutes.",
      "pitch": "We use Claude Code daily to build agentic systems for clients. We can help you get the most out of it."
    },
    "codex": {
      "complexity": "Available through ChatGPT Pro or the OpenAI API. Cloud-first — no local install needed.",
      "pitch": "We're model-agnostic. If your team is in the OpenAI ecosystem, we'll build on top of it."
    },
    "perplexity_computer": {
      "complexity": "Sign up for Perplexity's Computer plan. Cloud-based — no local install needed.",
      "pitch": "We help teams pick the right combination of tools and integrate them into a single workflow."
    },
    "n8n_custom": {
      "complexity": "This requires custom architecture — it's a project, not a product. Plan for weeks, not hours.",
      "pitch": "This is exactly what we build. We design the architecture so your agent actually compounds over time."
    }
  },
  "category_colors": {
    "Paid Ads": { "bg": "bg-rose-500/10", "text": "text-rose-400", "border": "border-rose-500/20" },
    "Desktop / File Workflows": { "bg": "bg-blue-500/10", "text": "text-blue-400", "border": "border-blue-500/20" },
    "Always-On Automation": { "bg": "bg-amber-500/10", "text": "text-amber-400", "border": "border-amber-500/20" },
    "Knowledge Management": { "bg": "bg-emerald-500/10", "text": "text-emerald-400", "border": "border-emerald-500/20" },
    "Software Development": { "bg": "bg-violet-500/10", "text": "text-violet-400", "border": "border-violet-500/20" },
    "Research / Cross-Platform": { "bg": "bg-cyan-500/10", "text": "text-cyan-400", "border": "border-cyan-500/20" },
    "Custom / Enterprise": { "bg": "bg-orange-500/10", "text": "text-orange-400", "border": "border-orange-500/20" }
  },
  "tech_labels": {
    "none": { "label": "No setup required", "bg": "bg-emerald-500/10", "text": "text-emerald-400" },
    "low": { "label": "Low technical", "bg": "bg-blue-500/10", "text": "text-blue-400" },
    "high": { "label": "Technical setup", "bg": "bg-amber-500/10", "text": "text-amber-400" },
    "developer": { "label": "Developer tool", "bg": "bg-violet-500/10", "text": "text-violet-400" },
    "requires implementation partner": { "label": "Needs implementation partner", "bg": "bg-orange-500/10", "text": "text-orange-400" }
  }
}
```

Note: The full JSON above is the complete file content. Copy it exactly.

- [ ] **Step 2: Validate the JSON**

Run: `cd /Users/Temirlan/Documents/Claude/which-ai-agent && python3 -c "import json; json.load(open('knowledge-base.json')); print('Valid JSON')"`
Expected: `Valid JSON`

- [ ] **Step 3: Commit**

```bash
git add knowledge-base.json
git commit -m "feat: add knowledge-base.json with all agent data, quiz config, and pitches"
```

---

### Task 2: Migrate directory rendering to use KB

**Files:**
- Modify: `index.html` (lines 84-304 — remove hardcoded data constants, update renderDirectory to use window.KB)

- [ ] **Step 1: Add KB loading and remove hardcoded data**

In index.html, replace the entire `<script>` block. Start with the KB loader and directory rendering. Remove the hardcoded `AGENTS`, `CATEGORY_COLORS`, `TECH_LABELS`, `QUIZ_TREE`, and `RESULT_PITCHES` constants.

Replace lines 84-503 (the entire `<script>...</script>`) with:

```javascript
<script>
// ─── KB LOADER ──────────────────────────────────────────────────────────────

let KB = null;

async function loadKB() {
  try {
    const response = await fetch('./knowledge-base.json');
    if (!response.ok) throw new Error('Failed to load knowledge base');
    KB = await response.json();
    renderDirectory();
    renderQuizStart();
  } catch (err) {
    console.error('KB load failed:', err);
    document.getElementById('agent-grid').innerHTML =
      '<p class="text-gray-400 col-span-full text-center py-12">Unable to load agent data. Please refresh the page.</p>';
  }
}

// ─── DIRECTORY ──────────────────────────────────────────────────────────────

let openCard = null;

function renderDirectory() {
  const grid = document.getElementById('agent-grid');
  let html = '';

  for (const [key, agent] of Object.entries(KB.agents)) {
    const cat = KB.category_colors[agent.category] || { bg: 'bg-gray-500/10', text: 'text-gray-400', border: 'border-gray-500/20' };
    const tech = KB.tech_labels[agent.technical_level] || { label: agent.technical_level, bg: 'bg-gray-500/10', text: 'text-gray-400' };

    html += `
      <div class="bg-card border border-border rounded-xl p-6 cursor-pointer transition-all hover:border-accent-light hover:bg-card-hover group" data-card-key="${key}">
        <div class="flex items-start justify-between mb-3">
          <h3 class="text-lg font-semibold text-white group-hover:text-accent-light transition-colors">${agent.name}</h3>
          <svg class="w-5 h-5 text-gray-500 transition-transform" id="chevron-${key}" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7"/>
          </svg>
        </div>
        <div class="flex flex-wrap gap-2 mb-3">
          <span class="text-xs px-2.5 py-1 rounded-full ${cat.bg} ${cat.text} border ${cat.border}">${agent.category}</span>
          <span class="text-xs px-2.5 py-1 rounded-full ${tech.bg} ${tech.text}">${tech.label}</span>
          ${agent.persistence ? '<span class="text-xs px-2.5 py-1 rounded-full bg-purple-500/10 text-purple-400">Persistent memory</span>' : ''}
        </div>
        <p class="text-sm text-gray-400 leading-relaxed">${agent.summary}</p>
        <div class="hidden mt-5 pt-5 border-t border-border" id="details-${key}">
          <div class="space-y-3 text-sm">
            <div><span class="text-gray-500 font-medium">Best for:</span> <span class="text-gray-300">${agent.best_for}</span></div>
            <div><span class="text-gray-500 font-medium">Limitations:</span> <span class="text-gray-300">${agent.limitations}</span></div>
            <div><span class="text-gray-500 font-medium">Cost:</span> <span class="text-gray-300">${agent.cost}</span></div>
            ${agent.persistence ? '<div><span class="text-gray-500 font-medium">Memory:</span> <span class="text-gray-300">Retains context across sessions</span></div>' : ''}
          </div>
        </div>
      </div>`;
  }

  grid.innerHTML = html;
}

function toggleCard(key) {
  const details = document.getElementById(`details-${key}`);
  const chevron = document.getElementById(`chevron-${key}`);
  if (!details) return;

  if (openCard && openCard !== key) {
    const prevDetails = document.getElementById(`details-${openCard}`);
    const prevChevron = document.getElementById(`chevron-${openCard}`);
    if (prevDetails) prevDetails.classList.add('hidden');
    if (prevChevron) prevChevron.style.transform = '';
  }

  const isHidden = details.classList.contains('hidden');
  details.classList.toggle('hidden');
  chevron.style.transform = isHidden ? 'rotate(180deg)' : '';
  openCard = isHidden ? key : null;
}
```

Note: This is a partial replacement — the quiz and event wiring code will be added in subsequent tasks. For now, add a temporary `renderQuizStart` placeholder and event wiring at the end:

```javascript
// ─── QUIZ START (inline section — opens fullscreen overlay) ─────────────────

function renderQuizStart() {
  const container = document.getElementById('quiz-container');
  if (!container) return;
  container.innerHTML = `
    <div class="text-center py-12">
      <p class="text-gray-400 mb-6 text-lg">3 quick steps. Get a personalized recommendation.</p>
      <button class="quiz-start-btn bg-accent hover:bg-accent-light text-white font-semibold px-8 py-4 rounded-xl transition-colors text-lg cursor-pointer">Start the Quiz</button>
    </div>`;
}

// Note: This function remains after Task 3 — it renders the inline teaser section.
// The .quiz-start-btn click is handled globally to open the fullscreen overlay.

// ─── EVENT WIRING ────────────────────────────────────────────────────────────

document.addEventListener('DOMContentLoaded', () => {
  loadKB();

  document.getElementById('agent-grid').addEventListener('click', (e) => {
    const card = e.target.closest('[data-card-key]');
    if (card) toggleCard(card.dataset.cardKey);
  });
});
</script>
```

- [ ] **Step 2: Update hero copy**

Change the quiz section subtitle from "Answer 1-2 questions. Get a recommendation in under 30 seconds." to "3 quick steps. Get a personalized recommendation."

- [ ] **Step 3: Test in browser**

Run: `cd /Users/Temirlan/Documents/Claude/which-ai-agent && python3 -m http.server 8000 &`
Open: `http://localhost:8000`
Verify: Directory renders with all 8 agents. Cards expand/collapse. No console errors. Quiz section shows placeholder start button.

- [ ] **Step 4: Commit**

```bash
git add index.html
git commit -m "feat: migrate directory rendering to use knowledge-base.json"
```

---

## Chunk 2: Fullscreen Quiz — Steps 1-2 (Multi-Select + Scoring)

### Task 3: Build fullscreen quiz overlay with Steps 1-2

**Files:**
- Modify: `index.html` (add fullscreen overlay HTML, quiz state management, multi-select rendering, scoring engine)

- [ ] **Step 1: Add the fullscreen overlay container to the HTML body**

Add this right before the closing `</body>` tag (before the `<script>`):

```html
<!-- Quiz Fullscreen Overlay -->
<div id="quiz-overlay" class="fixed inset-0 z-50 bg-surface overflow-y-auto hidden">
  <div class="min-h-screen flex flex-col">
    <!-- Top bar -->
    <div class="flex items-center justify-between px-6 py-4 border-b border-border">
      <button id="quiz-close-btn" class="text-gray-500 hover:text-gray-300 transition-colors cursor-pointer text-sm">← Back to site</button>
      <div id="quiz-progress" class="flex gap-1.5"></div>
      <div class="w-20"></div>
    </div>
    <!-- Quiz content -->
    <div class="flex-1 flex items-center justify-center px-6 py-12">
      <div id="quiz-content" class="w-full max-w-2xl"></div>
    </div>
  </div>
</div>
```

- [ ] **Step 2: Replace the quiz placeholder with full quiz engine**

Replace the `// ─── QUIZ (placeholder` section with the complete quiz state machine:

```javascript
// ─── QUIZ ENGINE ────────────────────────────────────────────────────────────

const quiz = {
  step: 0,            // 0 = not started, 1 = tasks, 2 = tools, 3 = freetext, 4 = loading, 5 = result
  selectedTasks: [],  // indices into KB.quiz.tasks
  selectedTools: [],  // indices into KB.quiz.tools
  freeText: '',
  scores: {},         // agent_slug -> total score
  topAgent: null,
  runnerUp: null,
  aiResult: null      // { recommendation, starter_prompt } from API
};

function openQuiz() {
  quiz.step = 1;
  quiz.selectedTasks = [];
  quiz.selectedTools = [];
  quiz.freeText = '';
  quiz.scores = {};
  quiz.topAgent = null;
  quiz.runnerUp = null;
  quiz.aiResult = null;
  document.getElementById('quiz-overlay').classList.remove('hidden');
  document.body.style.overflow = 'hidden';
  renderQuizStep();
}

function closeQuiz() {
  document.getElementById('quiz-overlay').classList.add('hidden');
  document.body.style.overflow = '';
}

function renderProgress() {
  const bar = document.getElementById('quiz-progress');
  const totalSteps = 3;
  let dots = '';
  for (let i = 1; i <= totalSteps; i++) {
    const active = i <= quiz.step;
    dots += `<div class="w-8 h-1.5 rounded-full ${active ? 'bg-accent' : 'bg-border'}"></div>`;
  }
  bar.innerHTML = dots;
}

function renderQuizStep() {
  renderProgress();
  const content = document.getElementById('quiz-content');

  if (quiz.step === 1) {
    renderMultiSelect(content, {
      question: "What tasks do you want to get rid of?",
      subtitle: "Select all that apply",
      options: KB.quiz.tasks,
      selected: quiz.selectedTasks,
      onToggle: (i) => {
        const idx = quiz.selectedTasks.indexOf(i);
        if (idx === -1) quiz.selectedTasks.push(i);
        else quiz.selectedTasks.splice(idx, 1);
        renderQuizStep();
      },
      onNext: () => { quiz.step = 2; renderQuizStep(); },
      onBack: null,
      canProceed: quiz.selectedTasks.length > 0
    });
  } else if (quiz.step === 2) {
    renderMultiSelect(content, {
      question: "What tools do you already use?",
      subtitle: "Select all that apply",
      options: KB.quiz.tools,
      selected: quiz.selectedTools,
      onToggle: (i) => {
        const idx = quiz.selectedTools.indexOf(i);
        if (idx === -1) quiz.selectedTools.push(i);
        else quiz.selectedTools.splice(idx, 1);
        renderQuizStep();
      },
      onNext: () => { calculateScores(); quiz.step = 3; renderQuizStep(); },
      onBack: () => { quiz.step = 1; renderQuizStep(); },
      canProceed: true  // tools step is always skippable
    });
  } else if (quiz.step === 3) {
    renderFreeText(content);
  } else if (quiz.step === 4) {
    renderLoading(content);
  } else if (quiz.step === 5) {
    renderResultScreen(content);
  }
}

function renderMultiSelect(container, { question, subtitle, options, selected, onToggle, onNext, onBack, canProceed }) {
  let optionsHtml = '';
  options.forEach((opt, i) => {
    const isSelected = selected.includes(i);
    const selectedClass = isSelected ? 'border-accent bg-accent/10' : 'border-border';
    optionsHtml += `
      <button class="quiz-option ${selectedClass} flex items-center gap-4" data-ms-index="${i}">
        <span class="text-2xl">${opt.icon}</span>
        <span class="text-base font-medium text-gray-200 flex-1 text-left">${opt.label}</span>
        ${isSelected ? '<svg class="w-5 h-5 text-accent-light" fill="currentColor" viewBox="0 0 20 20"><path fill-rule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clip-rule="evenodd"/></svg>' : '<div class="w-5 h-5 rounded border border-border"></div>'}
      </button>`;
  });

  container.innerHTML = `
    <div>
      ${onBack ? '<button class="quiz-back-btn text-sm text-gray-500 hover:text-gray-300 transition-colors cursor-pointer mb-6">← Back</button>' : ''}
      <h3 class="text-2xl md:text-3xl font-bold mb-2">${question}</h3>
      <p class="text-gray-500 mb-8">${subtitle}</p>
      <div class="grid gap-3 mb-8">${optionsHtml}</div>
      <button class="quiz-next-btn bg-accent hover:bg-accent-light text-white font-semibold px-8 py-4 rounded-xl transition-colors text-lg cursor-pointer w-full sm:w-auto ${canProceed ? '' : 'opacity-40 cursor-not-allowed'}" ${canProceed ? '' : 'disabled'}>Next</button>
    </div>`;

  // Wire events for this step
  container.querySelectorAll('[data-ms-index]').forEach(btn => {
    btn.addEventListener('click', () => onToggle(parseInt(btn.dataset.msIndex)));
  });
  container.querySelector('.quiz-next-btn')?.addEventListener('click', () => { if (canProceed) onNext(); });
  container.querySelector('.quiz-back-btn')?.addEventListener('click', () => onBack?.());
}

function calculateScores() {
  quiz.scores = {};

  // Sum task scores
  quiz.selectedTasks.forEach(i => {
    const task = KB.quiz.tasks[i];
    if (task?.agent_scores) {
      for (const [agent, weight] of Object.entries(task.agent_scores)) {
        quiz.scores[agent] = (quiz.scores[agent] || 0) + weight;
      }
    }
  });

  // Sum tool scores
  quiz.selectedTools.forEach(i => {
    const tool = KB.quiz.tools[i];
    if (tool?.agent_scores) {
      for (const [agent, weight] of Object.entries(tool.agent_scores)) {
        quiz.scores[agent] = (quiz.scores[agent] || 0) + weight;
      }
    }
  });

  // Rank
  const sorted = Object.entries(quiz.scores).sort((a, b) => b[1] - a[1]);
  quiz.topAgent = sorted[0]?.[0] || null;
  quiz.runnerUp = null;

  if (sorted.length >= 2 && sorted[0][1] > 0) {
    const topScore = sorted[0][1];
    if (sorted[1][1] >= topScore * 0.6) {
      quiz.runnerUp = sorted[1][0];
    }
  }
}
```

- [ ] **Step 3: Update event wiring**

Replace the event wiring section to handle quiz overlay interactions:

```javascript
// ─── EVENT WIRING ────────────────────────────────────────────────────────────

document.addEventListener('DOMContentLoaded', () => {
  loadKB();

  // Directory card clicks
  document.getElementById('agent-grid').addEventListener('click', (e) => {
    const card = e.target.closest('[data-card-key]');
    if (card) toggleCard(card.dataset.cardKey);
  });

  // Open quiz from hero CTA or inline section
  document.addEventListener('click', (e) => {
    if (e.target.closest('.quiz-start-btn') || (e.target.closest('a[href="#quiz"]') && KB)) {
      e.preventDefault();
      openQuiz();
    }
  });

  // Close quiz overlay
  document.getElementById('quiz-close-btn').addEventListener('click', closeQuiz);
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') closeQuiz();
  });
});
```

Also update the hero CTA in the HTML to trigger the overlay instead of scrolling:

Replace:
```html
<a href="#quiz" class="inline-block bg-accent hover:bg-accent-light text-white font-semibold px-8 py-4 rounded-xl transition-colors text-lg">Take the Quiz</a>
```
With:
```html
<button class="quiz-start-btn bg-accent hover:bg-accent-light text-white font-semibold px-8 py-4 rounded-xl transition-colors text-lg cursor-pointer">Take the Quiz</button>
```

- [ ] **Step 4: Test in browser**

Open: `http://localhost:8000`
Verify:
- Clicking "Take the Quiz" opens fullscreen overlay
- Step 1 shows 8 task options, can multi-select, Next enables when >=1 selected
- Step 2 shows 6 tool options, can multi-select, Next always enabled
- Back button on Step 2 returns to Step 1 with selections preserved
- Escape key and "Back to site" close the overlay
- Progress bar updates across steps
- No console errors

- [ ] **Step 5: Commit**

```bash
git add index.html
git commit -m "feat: fullscreen quiz overlay with multi-select Steps 1-2 and scoring engine"
```

---

## Chunk 3: Step 3 (Free-Text) + Loading + Result Screen

### Task 4: Add Step 3 free-text with suggested prompts

**Files:**
- Modify: `index.html` (add renderFreeText function)

- [ ] **Step 1: Add renderFreeText function**

Add this after the `calculateScores` function:

```javascript
function renderFreeText(container) {
  // Get suggested prompts from top-scoring agents
  const suggestions = [];
  if (quiz.topAgent && KB.agents[quiz.topAgent]?.suggested_prompts) {
    suggestions.push(...KB.agents[quiz.topAgent].suggested_prompts.slice(0, 2));
  }
  if (quiz.runnerUp && KB.agents[quiz.runnerUp]?.suggested_prompts) {
    suggestions.push(KB.agents[quiz.runnerUp].suggested_prompts[0]);
  }

  let suggestionsHtml = '';
  if (suggestions.length > 0) {
    suggestionsHtml = `
      <p class="text-sm text-gray-500 mb-3">Try something like:</p>
      <div class="flex flex-wrap gap-2 mb-4">
        ${suggestions.map(s => `<button class="suggestion-btn text-xs bg-card border border-border rounded-full px-4 py-2 text-gray-400 hover:text-white hover:border-accent-light transition-colors cursor-pointer">${s}</button>`).join('')}
      </div>`;
  }

  container.innerHTML = `
    <div>
      <button class="quiz-back-btn text-sm text-gray-500 hover:text-gray-300 transition-colors cursor-pointer mb-6">← Back</button>
      <h3 class="text-2xl md:text-3xl font-bold mb-2">Tell us more</h3>
      <p class="text-gray-500 mb-6">Describe what you'd want an AI agent to do for you. The more specific, the better your recommendation.</p>
      ${suggestionsHtml}
      <textarea id="quiz-freetext" class="w-full bg-card border border-border rounded-xl p-4 text-gray-200 placeholder-gray-600 focus:border-accent-light focus:outline-none transition-colors resize-none" rows="4" placeholder="e.g., I want to automate my weekly team status reports by pulling updates from Slack and Notion...">${quiz.freeText}</textarea>
      <div class="flex flex-col sm:flex-row gap-3 mt-6">
        <button class="quiz-submit-btn bg-accent hover:bg-accent-light text-white font-semibold px-8 py-4 rounded-xl transition-colors text-lg cursor-pointer flex-1 sm:flex-initial">Get My Recommendation</button>
        <button class="quiz-skip-btn border border-border hover:border-accent-light text-gray-400 hover:text-white font-semibold px-8 py-4 rounded-xl transition-colors cursor-pointer">Skip</button>
      </div>
    </div>`;

  // Wire events
  container.querySelector('.quiz-back-btn').addEventListener('click', () => {
    quiz.freeText = document.getElementById('quiz-freetext')?.value || '';
    quiz.step = 2;
    renderQuizStep();
  });

  container.querySelectorAll('.suggestion-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.getElementById('quiz-freetext').value = btn.textContent;
    });
  });

  container.querySelector('.quiz-submit-btn').addEventListener('click', () => {
    quiz.freeText = document.getElementById('quiz-freetext')?.value || '';
    if (quiz.freeText.trim()) {
      quiz.step = 4;
      renderQuizStep();
      callRecommendationAPI();
    } else {
      quiz.step = 5;
      renderQuizStep();
    }
  });

  container.querySelector('.quiz-skip-btn').addEventListener('click', () => {
    quiz.freeText = '';
    quiz.step = 5;
    renderQuizStep();
  });
}
```

- [ ] **Step 2: Commit**

```bash
git add index.html
git commit -m "feat: add Step 3 free-text with contextual suggested prompts"
```

---

### Task 5: Add loading state and API call placeholder

**Files:**
- Modify: `index.html` (add renderLoading and callRecommendationAPI stub)

- [ ] **Step 1: Add renderLoading function**

```javascript
const THINKING_PHRASES = [
  "Analyzing your needs...",
  "Matching you with the right agent...",
  "Crafting your starter prompt..."
];

function renderLoading(container) {
  container.innerHTML = `
    <div class="text-center py-20">
      <div class="inline-block w-8 h-8 border-2 border-accent border-t-transparent rounded-full animate-spin mb-6"></div>
      <p id="thinking-phrase" class="text-lg text-gray-400"></p>
    </div>`;

  let phraseIdx = 0;
  const phraseEl = document.getElementById('thinking-phrase');
  phraseEl.textContent = THINKING_PHRASES[0];

  const interval = setInterval(() => {
    phraseIdx = (phraseIdx + 1) % THINKING_PHRASES.length;
    phraseEl.textContent = THINKING_PHRASES[phraseIdx];
  }, 3000);

  // Store interval so we can clean it up
  container._loadingInterval = interval;
}

function stopLoading() {
  const container = document.getElementById('quiz-content');
  if (container._loadingInterval) {
    clearInterval(container._loadingInterval);
    delete container._loadingInterval;
  }
}
```

- [ ] **Step 2: Add callRecommendationAPI stub (proxy integration comes in Chunk 4)**

```javascript
const PROXY_URL = ''; // Set to Cloudflare Worker URL after deployment

async function callRecommendationAPI() {
  // If proxy not configured, skip to deterministic result
  if (!PROXY_URL || !KB.quiz.api_config.enabled) {
    stopLoading();
    quiz.step = 5;
    renderQuizStep();
    return;
  }

  const selectedTaskLabels = quiz.selectedTasks.map(i => KB.quiz.tasks[i].label);
  const selectedToolLabels = quiz.selectedTools.map(i => KB.quiz.tools[i].label);

  // Only send user selections — Worker fetches KB and builds system prompt server-side
  const payload = {
    selected_tasks: selectedTaskLabels,
    selected_tools: selectedToolLabels,
    user_text: quiz.freeText,
    top_agent: quiz.topAgent
  };

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 15000);

  try {
    const res = await fetch(PROXY_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
      signal: controller.signal
    });
    clearTimeout(timeout);

    if (!res.ok) throw new Error('API request failed');

    const data = await res.json();
    quiz.aiResult = {
      recommendation: data.recommendation || null,
      starter_prompt: data.starter_prompt || null
    };
  } catch (err) {
    console.warn('API call failed, using deterministic result:', err);
    quiz.aiResult = null;
  }

  stopLoading();
  quiz.step = 5;
  renderQuizStep();
}
```

- [ ] **Step 3: Commit**

```bash
git add index.html
git commit -m "feat: add loading state with thinking phrases and API call stub"
```

---

### Task 6: Build the result screen

**Files:**
- Modify: `index.html` (add renderResultScreen function)

- [ ] **Step 1: Add renderResultScreen function**

```javascript
function renderResultScreen(container) {
  // Zero-score fallback
  if (!quiz.topAgent) {
    container.innerHTML = `
      <div class="text-center py-12">
        <h3 class="text-2xl font-bold mb-4">Explore the Directory</h3>
        <p class="text-gray-400 mb-8">We couldn't narrow it down based on your selections. Browse all 8 agents to find the right fit.</p>
        <button class="quiz-close-action bg-accent hover:bg-accent-light text-white font-semibold px-8 py-4 rounded-xl transition-colors text-lg cursor-pointer" onclick="closeQuiz(); document.getElementById('directory').scrollIntoView({behavior:'smooth'})">Browse All Agents</button>
      </div>`;
    return;
  }

  const agent = KB.agents[quiz.topAgent];
  const pitch = KB.pitches[quiz.topAgent] || { complexity: '', pitch: '' };
  const cat = KB.category_colors[agent.category] || { bg: 'bg-gray-500/10', text: 'text-gray-400', border: 'border-gray-500/20' };

  // Recommendation text: AI-generated or fallback
  const recText = quiz.aiResult?.recommendation || agent.best_for;
  // Starter prompt: AI-generated or static fallback
  const starterPrompt = quiz.aiResult?.starter_prompt || agent.starter_prompt;
  // Getting started steps
  const steps = agent.getting_started_steps || [];

  let html = `
    <div class="max-w-2xl mx-auto">
      <h3 class="text-2xl md:text-3xl font-bold mb-8">Your Recommendation</h3>

      <!-- Primary agent -->
      <div class="border-2 border-accent rounded-xl p-6 mb-5">
        <div class="flex flex-wrap items-center gap-3 mb-3">
          <h4 class="text-xl font-semibold text-white">${agent.name}</h4>
          <span class="text-xs px-2.5 py-1 rounded-full ${cat.bg} ${cat.text} border ${cat.border}">${agent.category}</span>
        </div>
        <p class="text-gray-300 leading-relaxed">${recText}</p>
      </div>`;

  // Runner-up
  if (quiz.runnerUp) {
    const sec = KB.agents[quiz.runnerUp];
    const secCat = KB.category_colors[sec.category] || { bg: 'bg-gray-500/10', text: 'text-gray-400', border: 'border-gray-500/20' };
    html += `
      <div class="border border-border rounded-xl p-5 mb-5">
        <p class="text-xs text-gray-500 uppercase tracking-wider font-medium mb-2">Also Consider</p>
        <div class="flex flex-wrap items-center gap-3 mb-2">
          <h4 class="text-lg font-semibold text-white">${sec.name}</h4>
          <span class="text-xs px-2.5 py-1 rounded-full ${secCat.bg} ${secCat.text} border ${secCat.border}">${sec.category}</span>
        </div>
        <p class="text-gray-400 text-sm">${sec.summary}</p>
      </div>`;
  }

  // Complexity
  if (pitch.complexity) {
    html += `
      <div class="bg-amber-500/5 border border-amber-500/20 rounded-xl p-5 mb-5">
        <p class="text-sm text-amber-300"><span class="font-medium">Getting started:</span> ${pitch.complexity}</p>
      </div>`;
  }

  // Getting started steps
  if (steps.length > 0) {
    html += `
      <div class="bg-card border border-border rounded-xl p-5 mb-5">
        <h5 class="text-sm font-semibold text-white mb-3">How to start</h5>
        <ol class="space-y-2 text-sm text-gray-300">
          ${steps.map((s, i) => {
            // First step: wrap with setup_url link
            if (i === 0 && agent.setup_url) {
              return `<li class="flex gap-3"><span class="text-accent-light font-medium">${i+1}.</span><span><a href="${agent.setup_url}" target="_blank" rel="noopener" class="text-accent-light hover:text-white underline">${s}</a></span></li>`;
            }
            return `<li class="flex gap-3"><span class="text-accent-light font-medium">${i+1}.</span><span>${s}</span></li>`;
          }).join('')}
        </ol>
      </div>`;
  }

  // Starter prompt copy box
  if (starterPrompt && !starterPrompt.startsWith('This agent is custom-built')) {
    html += `
      <div class="bg-card border border-border rounded-xl p-5 mb-5">
        <div class="flex items-center justify-between mb-3">
          <h5 class="text-sm font-semibold text-white">Your starter prompt</h5>
          <button class="copy-prompt-btn text-xs bg-accent/20 hover:bg-accent/40 text-accent-light px-3 py-1.5 rounded-lg transition-colors cursor-pointer">Copy</button>
        </div>
        <pre class="text-sm text-gray-300 bg-surface rounded-lg p-4 whitespace-pre-wrap font-sans leading-relaxed">${starterPrompt}</pre>
      </div>`;
  }

  // Optemization pitch
  if (pitch.pitch) {
    html += `
      <div class="bg-accent/5 border border-accent/20 rounded-xl p-5 mb-6">
        <p class="text-sm text-accent-light">${pitch.pitch}</p>
      </div>`;
  }

  // API failure email capture banner
  if (quiz.freeText && !quiz.aiResult) {
    html += `
      <div class="bg-card border border-amber-500/20 rounded-xl p-5 mb-5">
        <p class="text-sm text-amber-300 mb-3">We're experiencing high traffic. Leave your email for a personalized deep-dive recommendation.</p>
        <div class="flex gap-2">
          <input id="email-capture" type="email" placeholder="you@company.com" class="flex-1 bg-surface border border-border rounded-lg px-4 py-2 text-sm text-gray-200 placeholder-gray-600 focus:border-accent-light focus:outline-none" />
          <button class="email-submit-btn bg-accent hover:bg-accent-light text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors cursor-pointer">Send</button>
        </div>
        <p id="email-confirm" class="text-xs text-emerald-400 mt-2 hidden">Thanks! We'll follow up within 24 hours.</p>
      </div>`;
  }

  // CTAs
  html += `
      <div class="flex flex-col sm:flex-row gap-3">
        <a href="https://optemization.com" target="_blank" rel="noopener" class="inline-block bg-accent hover:bg-accent-light text-white font-semibold px-6 py-3 rounded-xl transition-colors text-center">Need help implementing this?</a>
        <button class="quiz-retake-btn border border-border hover:border-accent-light text-gray-400 hover:text-white font-semibold px-6 py-3 rounded-xl transition-colors cursor-pointer">Retake Quiz</button>
        <button class="quiz-close-action border border-border hover:border-accent-light text-gray-400 hover:text-white font-semibold px-6 py-3 rounded-xl transition-colors cursor-pointer">Back to Directory</button>
      </div>
    </div>`;

  container.innerHTML = html;

  // Wire result screen events
  container.querySelector('.copy-prompt-btn')?.addEventListener('click', (e) => {
    navigator.clipboard.writeText(starterPrompt).then(() => {
      e.target.textContent = 'Copied!';
      setTimeout(() => { e.target.textContent = 'Copy'; }, 2000);
    });
  });

  container.querySelector('.quiz-retake-btn')?.addEventListener('click', openQuiz);

  container.querySelector('.quiz-close-action')?.addEventListener('click', () => {
    closeQuiz();
    document.getElementById('directory').scrollIntoView({ behavior: 'smooth' });
  });

  container.querySelector('.email-submit-btn')?.addEventListener('click', () => {
    const email = document.getElementById('email-capture')?.value;
    if (email && email.includes('@')) {
      // TODO: Replace with Google Form POST (create a form, get the POST URL, submit via fetch)
      // For now, log and show confirmation
      console.log('Email captured:', email);
      document.getElementById('email-confirm').classList.remove('hidden');
    }
  });
}
```

- [ ] **Step 2: Test the full flow in browser**

Verify:
- Take the Quiz → Step 1 multi-select → Step 2 multi-select → Step 3 free-text
- Click "Skip" on Step 3 → result screen shows with deterministic recommendation
- Result screen shows: agent name + badge, complexity, getting started steps, starter prompt with Copy button, Optemization pitch, CTAs
- Copy button copies starter prompt to clipboard
- "Retake Quiz" restarts the flow
- "Back to Directory" closes overlay and scrolls to directory
- Back button at each step works correctly

- [ ] **Step 3: Commit**

```bash
git add index.html
git commit -m "feat: add result screen with getting-started guide and copy-paste starter prompt"
```

---

## Chunk 4: Cloudflare Worker Proxy

### Task 7: Create the Cloudflare Worker

**Files:**
- Create: `worker/index.js`
- Create: `worker/wrangler.toml`

- [ ] **Step 1: Create worker directory and wrangler config**

```bash
mkdir -p worker
```

Create `worker/wrangler.toml`:
```toml
name = "agent-review-proxy"
main = "index.js"
compatibility_date = "2024-09-23"

[vars]
ALLOWED_ORIGIN = "https://whichaiagent.com"
```

Note: The `ANTHROPIC_API_KEY` must be set as a secret via `wrangler secret put ANTHROPIC_API_KEY`, not in the toml file.

- [ ] **Step 2: Create the worker script**

Create `worker/index.js`:

```javascript
// The KB URL — Worker fetches this server-side so the client never sends sensitive data
const KB_URL = 'https://optemization.github.io/the-agent-review/knowledge-base.json';

// System prompt template — lives server-side, not sent from client
const SYSTEM_PROMPT_TEMPLATE = `You are an AI agent recommendation engine for The Agent Review. You help business users (non-technical: Chiefs of Staff, VP Ops, COOs, CEOs) find the right AI agent tool.

Here is the complete knowledge base of agents:
{{agents_json}}

The user selected these tasks they want to automate:
{{selected_tasks}}

The user already uses these tools:
{{selected_tools}}

The user's description of what they want:
{{user_text}}

Based on our scoring, the top recommended agent is: {{top_agent}}

Generate a JSON response with exactly two keys:
- "recommendation": A 2-3 sentence personalized paragraph explaining why this specific agent is the best fit for THEIR described needs. Be specific to what they wrote, not generic. Write in second person ("you").
- "starter_prompt": A ready-to-paste prompt they can copy directly into the recommended tool to start working on their described task immediately. Make it specific to their input.

Respond ONLY with valid JSON. No markdown, no code fences.`;

export default {
  async fetch(request, env) {
    // CORS preflight
    if (request.method === 'OPTIONS') {
      return new Response(null, { headers: corsHeaders(env.ALLOWED_ORIGIN) });
    }

    if (request.method !== 'POST') {
      return new Response('Method not allowed', { status: 405 });
    }

    // Rate limiting: use Cloudflare's built-in Rate Limiting rules (configured in dashboard)
    // or KV-based counting. For v1, configure a Rate Limiting Rule in the CF dashboard:
    // - Match: POST requests to this worker's URL
    // - Threshold: 5 requests per hour per IP
    // - Action: Block with 429

    try {
      const body = await request.json();
      const { selected_tasks, selected_tools, user_text, top_agent } = body;

      // Fetch KB server-side
      const kbResponse = await fetch(KB_URL);
      if (!kbResponse.ok) throw new Error('Failed to fetch knowledge base');
      const kb = await kbResponse.json();

      // Build system prompt
      const systemPrompt = SYSTEM_PROMPT_TEMPLATE
        .replace('{{agents_json}}', JSON.stringify(kb.agents))
        .replace('{{selected_tasks}}', (selected_tasks || []).join(', '))
        .replace('{{selected_tools}}', (selected_tools || []).join(', '))
        .replace('{{user_text}}', user_text || '')
        .replace('{{top_agent}}', top_agent || '');

      const anthropicResponse = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': env.ANTHROPIC_API_KEY,
          'anthropic-version': '2023-06-01',
        },
        body: JSON.stringify({
          model: kb.quiz?.api_config?.model || 'claude-sonnet-4-20250514',
          max_tokens: kb.quiz?.api_config?.max_tokens || 500,
          messages: [
            { role: 'user', content: 'Based on my selections and description, what agent do you recommend and what starter prompt should I use?' }
          ],
          system: systemPrompt,
        }),
      });

      if (!anthropicResponse.ok) {
        const err = await anthropicResponse.text();
        console.error('Anthropic API error:', err);
        return new Response(JSON.stringify({ error: 'API error' }), {
          status: 502,
          headers: { ...corsHeaders(env.ALLOWED_ORIGIN), 'Content-Type': 'application/json' },
        });
      }

      const result = await anthropicResponse.json();
      const content = result.content?.[0]?.text || '';

      // Parse the JSON response from Claude
      let parsed;
      try {
        parsed = JSON.parse(content);
      } catch {
        parsed = { recommendation: content, starter_prompt: null };
      }

      return new Response(JSON.stringify(parsed), {
        headers: { ...corsHeaders(env.ALLOWED_ORIGIN), 'Content-Type': 'application/json' },
      });
    } catch (err) {
      console.error('Worker error:', err);
      return new Response(JSON.stringify({ error: 'Internal error' }), {
        status: 500,
        headers: { ...corsHeaders(env.ALLOWED_ORIGIN), 'Content-Type': 'application/json' },
      });
    }
  },
};

function corsHeaders(origin) {
  return {
    'Access-Control-Allow-Origin': origin || '*',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
  };
}
```

**Rate Limiting Setup:** After deploying the Worker, configure a Rate Limiting Rule in the Cloudflare dashboard (Security > WAF > Rate limiting rules): match POST requests to the worker URL, threshold 5 per hour per IP, action: block with 429.

- [ ] **Step 3: Commit**

```bash
git add worker/
git commit -m "feat: add Cloudflare Worker proxy for Claude API with rate limiting"
```

---

### Task 8: Wire up the proxy URL in index.html

**Files:**
- Modify: `index.html` (set PROXY_URL constant)

- [ ] **Step 1: Update PROXY_URL**

Once the worker is deployed (via `cd worker && wrangler deploy`), update the `PROXY_URL` constant in index.html:

```javascript
const PROXY_URL = 'https://agent-review-proxy.<your-subdomain>.workers.dev';
```

Note: Leave empty string during local development to use deterministic-only results. Set the real URL after deploying the worker.

- [ ] **Step 2: Test full flow with proxy**

Deploy worker: `cd worker && wrangler secret put ANTHROPIC_API_KEY` (paste key), then `wrangler deploy`.

Test: Complete quiz with Step 3 filled in. Verify:
- Loading state shows with cycling phrases
- AI-generated recommendation appears in result
- AI-generated starter prompt is in the copy box
- If proxy is down, falls back to deterministic result with email capture banner

- [ ] **Step 3: Commit**

```bash
git add index.html
git commit -m "feat: connect quiz to Cloudflare Worker proxy for AI recommendations"
```

---

## Chunk 5: Final Polish + Deploy

### Task 9: Update meta tags and hero copy

**Files:**
- Modify: `index.html` (update title, OG tags, hero section)

- [ ] **Step 1: Update the title and meta description**

Change `<title>` from "Which AI Agent?" to "The Agent Review — Find the right AI agent for your business"

Update `<meta name="description">` to: "Take a 30-second quiz to get a personalized AI agent recommendation. Browse 8 curated agents with setup guides and starter prompts."

Update all OG and Twitter meta tags to match.

- [ ] **Step 2: Update hero copy**

The hero h1 should stay "Which AI Agent?" (or update to "The Agent Review" if that's the new name). Update the subtitle and quiz section copy to reflect the 3-step flow.

- [ ] **Step 3: Commit**

```bash
git add index.html
git commit -m "chore: update meta tags and hero copy for The Agent Review"
```

---

### Task 10: Deploy to GitHub Pages

- [ ] **Step 1: Create GitHub repo and push**

```bash
cd /Users/Temirlan/Documents/Claude/which-ai-agent
gh repo create optemization/the-agent-review --public --source=. --push
```

- [ ] **Step 2: Enable GitHub Pages**

Go to repo Settings > Pages > set source to main branch, root directory.

- [ ] **Step 3: Verify live site**

Open: `https://optemization.github.io/the-agent-review/`
Verify: Full flow works — directory, quiz, results, copy prompt.

- [ ] **Step 4: Commit any final fixes**

---

### Task 11: Set up custom domain (if ready)

- [ ] **Step 1: Configure DNS**

Add a CNAME record pointing your custom domain to `optemization.github.io`.

- [ ] **Step 2: Update GitHub Pages settings**

In repo Settings > Pages > Custom domain, enter the domain.

- [ ] **Step 3: Update ALLOWED_ORIGIN in worker**

Update `worker/wrangler.toml` to use the custom domain, then redeploy.

- [ ] **Step 4: Update OG meta tags with final URL**
