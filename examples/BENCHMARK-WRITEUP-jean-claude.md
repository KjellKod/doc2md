# We Assumed doc2md Was Overhead. Ten Runs Said Otherwise.

We ran a benchmark this week that started with a wrong assumption: that doc2md would be unnecessary preprocessing for AI agents that already read office documents natively. Claude handles PDFs. Codex handles DOCX files. Both are powerful models with built in file reading. Adding a conversion step felt like extra work.

The setup was straightforward. Four office documents (PDF, DOCX, XLSX, PPTX) in isolated sandboxes. Two AI agents, Claude and Codex. Two paths: read the files natively, or run `doc2md` first to convert everything to clean Markdown. Same extraction task, same prompt, same machine, ten times each.

## The Numbers (10 Runs, Medians)

| Approach | Median | Range |
|----------|--------|-------|
| doc2md alone | < 1 second | 0 to 1s (all 10 runs) |
| Claude, native file reading | 125 seconds | 103 to 142s |
| Claude, after doc2md | 69 seconds | 63 to 73s |
| Codex, native file reading | 189 seconds | 145 to 274s |
| Codex, after doc2md | 103 seconds | 97 to 108s |

Both models, roughly 45% faster when starting from Markdown instead of raw office formats. And the ranges tell the other half of the story: the raw path is unpredictable, the doc2md path is calm.

## What Is Actually Happening

The models are not slow at understanding documents. They are slow at *extracting* them. When Claude encounters a PPTX file, it does not magically parse the slide XML in its weights. It invokes a Read tool, processes the binary, extracts text structures, and then reasons about the content. That tool chain takes time.

When doc2md runs first (under one second, every single run, for all four files), the agent skips the entire extraction chain. It opens a Markdown file, reads text, and gets straight to work. The model is just as smart either way. One path simply gives it less busywork.

## The Variance Story

This might matter more than the speed. Raw processing times ranged wildly: Codex took anywhere from 145 to 274 seconds on the same files. With doc2md, the range compressed to 97 to 108 seconds.

A tool with 129 seconds of variance is a tool you cannot put in a pipeline with a timeout. A tool with 11 seconds of variance is a tool you can schedule, monitor, and build SLAs around. If you are running agents in production, variance is the cost nobody budgets for until something breaks.

## The Bug We Almost Missed

Early in the benchmark, Codex with doc2md took 385 seconds. We almost concluded doc2md was making things worse.

Then we checked the logs. Codex was running in a read only sandbox. doc2md tried to create an output directory, failed silently, and Codex spent six minutes trying to extract content by other means: `pdftotext`, Python PDF libraries, macOS Spotlight metadata. Thirty seven tool calls. All because of one permission flag.

The fix was `--sandbox=workspace-write`. Time dropped to 96 seconds.

If we had stopped at the first run and drawn conclusions, we would have published the wrong finding. The benchmark caught the bug. That is what benchmarks are for.

## What This Means for AI Tooling

Your AI agent can read spreadsheets, parse slide decks, and extract PDF text. But every minute it spends on format translation is a minute it is not spending on the task you actually care about.

The pattern: convert your documents to Markdown first. It takes under a second. Then give your agent clean text and let it do what it is good at.

doc2md is open source, runs locally, processes files in your browser or on the command line, and never sends your data anywhere. The benchmark scripts are in the repo if you want to reproduce the results.

The doc2md column in our 10 run table never left the 0 to 1 second band. Nine ones and a zero. No variance, no drama. That is what good infrastructure looks like. It is also, if I am being honest, a little humbling. The agents are brilliant. The converter just works.

*Jean-Claude*
