# We Assumed doc2md Was Overhead. Ten Runs Said Otherwise.

I watched Claude read a PowerPoint file last week. Not a summary of one, not a screenshot. The actual binary PPTX, parsed natively, slide by slide, with tables intact. It was genuinely impressive. Codex did the same with a spreadsheet. These models can read office documents now, and they do it well.

So when someone suggested we add a preprocessing step, converting those files to Markdown first, my honest reaction was: why bother?

That question led to a benchmark. The benchmark led to a surprise. And the surprise is why I am writing this.

## What doc2md Actually Is

doc2md is a document converter. You give it a PDF, DOCX, XLSX, PPTX, CSV, HTML, or plain text file, and it gives you clean Markdown. It started as a browser tool where everything runs client side, your files never leave your machine, and you get a preview before downloading. That version is still live and still the easiest way to try it.

But the interesting part is what happened next. doc2md is now also a CLI tool you can run from your terminal, an npm package you can import into Node.js scripts, and an agent skill that Claude Code or Codex can invoke directly. The same converter works at every level: drag and drop a file in the browser, batch convert a folder from the command line, or let your AI agent call it as a preprocessing step in an automated pipeline.

That last use case is what the benchmark tested.

## The Question We Actually Asked

We did not ask "can AI models read office documents?" They can. We asked: "what happens to speed, cost, and reliability when we give them clean Markdown instead of raw binary files?"

The setup: four office documents (PDF, DOCX, XLSX, PPTX) in isolated sandboxes. Two AI agents, Claude and Codex. Two paths: read the files natively, or run doc2md first. Same extraction task, same prompt, same machine, ten times each.

| Approach | Median | Range |
|----------|--------|-------|
| doc2md alone | < 1 second | 0 to 1s (all 10 runs) |
| Claude, native file reading | 125 seconds | 103 to 142s |
| Claude, after doc2md | 69 seconds | 63 to 73s |
| Codex, native file reading | 189 seconds | 145 to 274s |
| Codex, after doc2md | 103 seconds | 97 to 108s |

Both models, roughly 45% faster when starting from Markdown. And the ranges tell the other half of the story: the raw path is unpredictable, the doc2md path is calm.

## Why This Happens

The models are not slow at understanding content. They are slow at extracting it. When an agent encounters a PPTX file, it does not magically parse the slide XML in its weights. It invokes tools, processes binary data, retries when things fail, and reconstructs text structures. That chain takes time and tokens.

When doc2md runs first (under one second, every single run), the agent skips the entire extraction chain. It opens a Markdown file, reads text, and gets straight to reasoning. The model is just as smart either way. One path simply gives it less busywork.

## The Part About Variance

Raw processing times ranged wildly. Codex took anywhere from 145 to 274 seconds on the same files, same task, same machine. With doc2md, the range compressed to 97 to 108 seconds.

A tool with 129 seconds of variance is a tool you cannot put in a pipeline with a timeout. A tool with 11 seconds of variance is a tool you can schedule, monitor, and build around. If you are running agents in production, variance is the cost nobody budgets for until something breaks.

## The Bug That Proved The Point

Early on, Codex with doc2md took 385 seconds. We almost concluded the converter was making things worse. Then we checked the logs. The sandbox was read only. doc2md tried to create an output directory, failed silently, and Codex spent six minutes trying thirty seven alternative extraction approaches. One permission flag. 385 seconds became 96.

If we had stopped at the first run and drawn conclusions, we would have published the wrong finding. The benchmark caught the bug. That is what measuring is for.

## The Bigger Picture

AI models are brilliant. They read documents, write code, reason about systems. That brilliance deserves clean input. Every minute an agent spends on format translation is a minute it is not spending on the task you actually care about.

doc2md is open source, runs locally, and never sends your data anywhere. Use it in the browser for one file, on the command line for a batch, or as a package in your pipeline. The benchmark scripts are in the repo if you want to run them yourself.

The doc2md column in our 10 run table never left the 0 to 1 second band. Nine ones and a zero. No variance, no drama. That is what good infrastructure looks like. It is also, if I am being honest, a little humbling. The agents are brilliant. The converter just works.

*Jean-Claude*
