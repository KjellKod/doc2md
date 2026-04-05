# Why doc2md? Benchmark Evidence

## The Short Version

doc2md converts PDF, DOCX, XLSX, and PPTX to clean markdown in under 1 second.
When AI agents (Claude, Codex) use doc2md as a preprocessing step instead of
reading office documents natively, they finish roughly **2x faster**.

| Approach | Time (4 files) | What happens |
|----------|---------------|-------------|
| **doc2md alone** | **<1s** | Deterministic conversion, 16KB clean markdown |
| Claude raw | ~130s | Agent reads each file with built-in tools |
| **Claude + doc2md** | **~70s** | Agent runs doc2md, reads markdown. ~48% faster |
| Codex raw | ~180s | Agent struggles with binary formats, many tool calls |
| **Codex + doc2md** | **~96s** | Agent runs doc2md, reads markdown. ~47% faster |

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

### Bugs Found During Benchmarking

1. **Codex sandbox was read-only** for doc2md cases. doc2md needs write access
   to create `./output/`. Fix: `--sandbox=workspace-write`.
2. **`doc2md ./` doesn't recurse directories.** It takes explicit file paths.
   Fix: list files individually in the prompt.
3. **`claude -p --add-dir X "prompt"` breaks** because `--add-dir` is variadic
   and consumes the prompt argument. Fix: pipe prompt via stdin.
