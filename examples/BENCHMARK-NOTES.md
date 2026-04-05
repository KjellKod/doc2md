# Why doc2md? Benchmark Evidence

## The Short Version

doc2md converts PDF, DOCX, XLSX, and PPTX to clean markdown in under 1 second.
When AI agents (Claude, Codex) use doc2md as a preprocessing step instead of
reading office documents natively, they finish roughly **2x faster**.

| Approach | Median (10 runs) | What happens |
|----------|-----------------|-------------|
| **doc2md alone** | **<1s** | Deterministic conversion, 16KB clean markdown |
| Claude raw | 121s | Agent reads each file with built-in tools |
| **Claude + doc2md** | **69s** | Agent runs doc2md, reads markdown. **43% faster** |
| Codex raw | 188s | Agent struggles with binary formats, many tool calls |
| **Codex + doc2md** | **103s** | Agent runs doc2md, reads markdown. **45% faster** |

## Why This Matters

1. **Speed**: Reading clean markdown is faster than parsing binary office formats,
   even for models with native file readers.

2. **Determinism**: doc2md produces the same markdown every time. Agent file
   reading is non-deterministic, different tool call chains, different output
   verbosity, different levels of content extraction.

3. **Cost**: Faster agent runs mean fewer tokens consumed. The agent spends time
   on extraction instead of reasoning about content. Markdown input means less
   token churn from retries, format confusion, and verbose tool call logs.

4. **Reliability**: Without doc2md, agents must figure out how to read each
   format. Codex tried pdftotext, Python PDF libraries, and macOS spotlight
   before giving up on a PDF. doc2md just works.

5. **Pipeline-friendly**: Convert once at the start of a pipeline, then query
   the markdown from any model, any API, any tool, as many times as needed.

## Measure, Don't Assume

These results came from systematic benchmarking, not assumptions. Early runs
told a different story (doc2md seemed to add overhead) until we discovered:

- **Broken sandbox permissions**: Codex couldn't write doc2md output (read-only
  sandbox), so it silently fell back to manual extraction, taking 385s instead
  of 96s. The benchmark caught this.
- **Wrong invocation syntax**: `doc2md ./` doesn't work (it's not a directory
  scanner). The correct syntax is `doc2md file1.pdf file2.docx -o ./output/`.
  Agents need correct instructions.
- **Summarization masks extraction cost**: When we asked agents to "summarize,"
  reasoning time dominated. Switching to "extract full text" revealed the real
  extraction speed difference.

The lesson: always benchmark end to end, print the exact commands being run,
and verify that tools actually succeeded.

## Benchmark Details

### Test Files

| File | Format | Size | doc2md output |
|------|--------|------|--------------|
| Repo_Quality_Cleanup__Refactoring_and_Test_Quality_Spec.pdf | PDF | 137KB | 11KB md |
| API_Rate_Limiting_Design.docx | DOCX | 38KB | 3KB md |
| Sprint_Metrics_Q1_2026.xlsx | XLSX | 7KB | 1KB md |
| doc2md_Quarterly_Review_Q1_2026.pptx | PPTX | 33KB | 1KB md |

Total: 215KB of office documents converted to 16KB of markdown in <1 second.

### How It Works

Each test case runs in an isolated temp directory sandbox with only the test
files copied in. No repo context, no shared state between cases.

- **Raw path**: Agent is told "read these files and extract content"
- **doc2md path**: Agent is told "run `doc2md` on these files, then read the markdown"
- **Same prompt** for both paths (except the doc2md conversion instruction)
- Both Claude and Codex use fresh sessions with no memory of prior runs

### Run History

**Batch extraction, 4 file types (corrected sandbox, 2026-04-04)**

| Run | Claude raw | Claude+doc2md | Codex raw | Codex+doc2md |
|-----|-----------|---------------|-----------|-------------|
| 1   | 136s      | 64s           | 160s      | 100s        |
| 2   | 133s      | 69s           | 205s      | 96s         |
| 3   | 136s      | 71s           | 172s      | 96s         |

(10-run statistical results will be appended below when available)

### Known Limitations

- Single-machine benchmark (macOS, local CLI), not cloud API
- `claude -p` does not fully isolate from repo context (`--add-dir` expands
  access but doesn't change working directory or disable project discovery)
- Codex uses `-C` to change working directory, so sandbox isolation is stricter
- Timing resolution is 1 second (`date +%s`), fine for 60-200s runs
- Single runs have high variance; multiple runs needed for reliable conclusions

### Reproducing

```bash
# Run once (batch mode, 4 default files):
./examples/compare-pdf-pipeline.sh

# Run 10x with statistics:
./examples/run-benchmark-suite.sh 10

# Run doc2md directly (no AI):
cd examples/
doc2md \
  Repo_Quality_Cleanup__Refactoring_and_Test_Quality_Spec.pdf \
  API_Rate_Limiting_Design.docx \
  Sprint_Metrics_Q1_2026.xlsx \
  doc2md_Quarterly_Review_Q1_2026.pptx \
  -o ./output/
```

## 10-Run Results (2026-04-04)

Batch mode, 4 files (PDF + DOCX + XLSX + PPTX), extraction task. All times in seconds.

| run | doc2md_only | claude_raw | claude_doc2md | codex_raw | codex_doc2md |
| --- | --- | --- | --- | --- | --- |
| 1 | 1 | 136 | 64 | 160 | 100 |
| 2 | 1 | 142 | 71 | 174 | 106 |
| 3 | 1 | 103 | 70 | 274 | 108 |
| 4 | 1 | 104 | 73 | 224 | 97 |
| 5 | 0 | 121 | 63 | 158 | 107 |
| 6 | 1 | 108 | 69 | 198 | 102 |
| 7 | 1 | 129 | 68 | 188 | 103 |
| 8 | 1 | 107 | 70 | 145 | 104 |
| 9 | 1 | 131 | 66 | 207 | 100 |
| 10 | 1 | 133 | 69 | 190 | 106 |

### Statistics

| Case | Min | Max | Avg | Median | n |
|------|-----|-----|-----|--------|---|
| doc2md only | 0s | 1s | 0s | 1s | 10 |
| Claude raw | 103s | 142s | 121s | 121s | 10 |
| Claude+doc2md | 63s | 73s | 68s | 69s | 10 |
| Codex raw | 145s | 274s | 191s | 188s | 10 |
| Codex+doc2md | 97s | 108s | 103s | 103s | 10 |

### Key Findings

**doc2md preprocessing cuts agent processing time roughly in half:**
- Claude: 121s median raw, 69s median with doc2md. **43% faster.**
- Codex: 188s median raw, 103s median with doc2md. **45% faster.**

**doc2md dramatically reduces variance:**
- Claude raw range: 39s spread (103-142). Claude+doc2md range: 10s spread (63-73).
- Codex raw range: 129s spread (145-274). Codex+doc2md range: 11s spread (97-108).

The reduced variance is arguably as valuable as the speed improvement.
Predictable processing time matters for pipelines, SLAs, and cost estimation.

**doc2md itself is negligible:** 0-1s for all 4 files, every run. The
conversion cost is effectively zero compared to agent processing time.

### Bugs Found During Benchmarking

1. **Codex sandbox was read-only** for doc2md cases. doc2md needs write access
   to create `./output/`. Fix: `--sandbox=workspace-write`.
2. **`doc2md ./` doesn't recurse directories.** It takes explicit file paths.
   Fix: list files individually in the prompt.
3. **`claude -p --add-dir X "prompt"` breaks** because `--add-dir` is variadic
   and consumes the prompt argument. Fix: pipe prompt via stdin.
