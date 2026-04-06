# 016 — Celebration: PDF Benchmark
<!-- quest-id: pdf-benchmark_2026-04-04__2007 -->
<!-- pr: #50 -->
<!-- style: celebration -->
<!-- quality-tier: gold -->
<!-- date: 2026-04-05 -->

```
██████╗ ██████╗ ███████╗
██╔══██╗██╔══██╗██╔════╝
██████╔╝██║  ██║█████╗
██╔═══╝ ██║  ██║██╔══╝
██║     ██████╔╝██║
╚═╝     ╚═════╝ ╚═╝

██████╗ ███████╗███╗   ██╗ ██████╗██╗  ██╗
██╔══██╗██╔════╝████╗  ██║██╔════╝██║  ██║
██████╔╝█████╗  ██╔██╗ ██║██║     ███████║
██╔══██╗██╔══╝  ██║╚██╗██║██║     ██╔══██║
██████╔╝███████╗██║ ╚████║╚██████╗██║  ██║
╚═════╝ ╚══════╝╚═╝  ╚═══╝ ╚═════╝╚═╝  ╚═╝
```

 🎉 🎉 🎉 📊 🔥 📊 🎉 🎉 🎉

## Quest: PDF Benchmark | `pdf-benchmark_2026-04-04__2007` | PR #50

---

### 🎬 Starring Cast

| Role | Model | Description |
|------|-------|-------------|
| Planner | Claude Opus 4.6 | The architect who designed a 2x2 matrix and watched it grow to 4x2 |
| Plan Reviewer A | Claude Opus 4.6 | Caught the prerequisite exit behavior contradiction in one pass |
| Builder | GPT-5.4 (Codex) | Built the first script, then watched it get rewritten three times |
| Code Reviewer A | Claude Opus 4.6 | "Must Fix: executable bit." The kind of note that saves 20 minutes of debugging |
| Fixer | GPT-5.4 (Codex) | chmod +x and a cleanup note. Clean work. |
| Codex Reviewer | GPT-5.4 (Codex) | Identified the sandbox parity gap that was hiding the real numbers |

---

## 🏆 Achievements Unlocked

⭐️ **Sandbox Detective** — Discovered Codex doc2md was silently failing (read-only sandbox), dropping from 385s to 96s with one flag fix

⭐️ **Variance Crusher** — Proved doc2md reduces timing spread from 129s to 11s across 10 runs

⭐️ **The Honest Benchmark** — Started with results that challenged the product's value, dug deeper, found the real story

⭐️ **179ms Hero** — doc2md converts PDF + DOCX + XLSX + PPTX in 179 milliseconds. The agents take 68,000ms.

⭐️ **Four-Format Pioneer** — First benchmark covering PDF, DOCX, XLSX, and PPTX in isolated sandboxes with both Claude and Codex

⭐️ **10-Run Statistician** — Ten runs with min/max/avg/median. Because "it felt faster" is not evidence.

---

## 🎯 Impact Metrics

📊 **43% faster** — Claude median with doc2md: 69s vs 121s raw (n=10)
📊 **45% faster** — Codex median with doc2md: 103s vs 188s raw (n=10)
⚡️ **<1s** — doc2md conversion time for all 4 files, every single run
🔧 **3 bugs found** — Sandbox permissions, directory recursion, variadic args
🧪 **10 statistical runs** — Real data, not vibes
📚 **BENCHMARK-NOTES.md** — Full methodology, reproduction steps, honest limitations

---

## ⚙️ Handoff & Reliability

| Phase | Agent | Handoff |
|-------|-------|---------|
| Plan | Planner (Claude) | ✅ handoff.json found |
| Plan Review | Reviewer A (Claude) | ✅ handoff.json found |
| Build | Builder (Codex) | ✅ handoff.json found |
| Code Review | Reviewer A (Claude) | ✅ handoff.json found |
| Fix | Fixer (Codex) | ✅ handoff.json found |

5/5 handoffs clean. Solo mode, no arbiter needed.

---

## 💎 Quest Quality: GOLD 🥇

This quest started simple ("make a benchmark script") and evolved through five significant rewrites as we discovered the real questions. The sandbox bug, the invocation syntax error, and the prompt-vs-extraction insight each changed the trajectory. One plan iteration, one fix iteration, but the post-quest iteration with the human was where the real quality emerged.

Gold, not Platinum, because the early runs had bugs that produced misleading data. But the process caught every one of them, and the final 10-run dataset is solid.

> "Approve with one Must Fix: executable bit not set on compare-pdf-pipeline.sh."
>
> — Code Reviewer A, keeping it real

---

## 🎮 Victory Narrative

This quest proved something counterintuitive: the value of a document converter isn't that AI models *can't* read office files (they can). It's that giving them clean markdown makes them **faster, more predictable, and cheaper**.

The journey from "Claude reads PDFs natively, why bother?" to "43% faster across 10 runs" is the kind of insight that only comes from measuring. Not assuming. Not vibing. Measuring.

— Jean-Claude, who is not often impressed but respects anyone who runs the benchmark ten times before drawing conclusions
