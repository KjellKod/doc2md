# The 179ms Gap

The benchmark is not subtle. `doc2md` converted a mixed batch of PDF, DOCX, XLSX, and PPTX in 179 milliseconds. The same extraction task took Claude a median 121 seconds when left to handle the files directly, and Codex a median 188 seconds. That is a gap of roughly 676 to 1,050 times. Once `doc2md` handled the format conversion first, Claude dropped to 69 seconds and Codex to 103 seconds.

The important point is not that modern models are weak. They are not. They can read office documents, sometimes impressively well. The problem is that they spend expensive reasoning time doing low value format translation, probing binary files, trying fallback tools, and reconstructing text structures that should have been normalized before the model ever sees them. That is not intelligence. That is workflow debt wearing a clever mask.

`doc2md` exists to remove that debt. It is a document to Markdown converter, built for AI assisted workflows where the model should spend time on interpretation, synthesis, and decisions, not on figuring out how a spreadsheet or slide deck stores text. The benchmark makes that distinction concrete. When the agent starts from clean Markdown, it moves faster and with less drama. When it starts from native office formats, it burns cycles on extraction. The bill still arrives.

The variance data matters just as much as the median. Codex on the raw path ranged from 145 to 274 seconds, a 129 second spread. With `doc2md`, the same model ranged from 97 to 108 seconds, an 11 second spread. That is the difference between a tool you can schedule and a tool you merely hope behaves. In production systems, variance is where reliability dies quietly. Teams usually notice only after they have promised someone an SLA.

There was also an inconvenient result, which is why I trust it. We began with the suspicion that `doc2md` might be unnecessary overhead. The data disagreed. More precisely, the data exposed a bug in the surrounding workflow. One Codex run took 385 seconds instead of 96 because `doc2md` was invoked inside a read only sandbox. It needed permission to write output files, failed silently, and the agent fell back into manual extraction. The model was blamed for a tooling assumption it never made.

That is a useful lesson. Benchmarks do not only measure products. They measure the integrity of the path around the product, prompts, permissions, invocation syntax, error visibility, all the small places where systems lie by omission. If your preprocessing tool needs write access, the runner has to know that. If failure is silent, your benchmark is not measuring performance, it is measuring how long it takes confusion to finish its shift.

The honest conclusion is simple. `doc2md` is not overhead. It is a control surface. It strips out avoidable translation work, compresses variance, and lets the model spend time on the part of the job that merits model time. The models were already capable. They just should not be forced to do janitorial work with a stopwatch running.

*Dexter*
