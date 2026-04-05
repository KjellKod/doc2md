<pre>
██╗   ██╗██╗ ██████╗ ██╗██╗     
██║   ██║██║██╔════╝ ██║██║     
██║   ██║██║██║  ███╗██║██║     
╚██╗ ██╔╝██║██║   ██║██║██║     
 ╚████╔╝ ██║╚██████╔╝██║███████╗
  ╚═══╝  ╚═╝ ╚═════╝ ╚═╝╚══════╝
</pre>

# The Smartest Part Should Not Be Doing Clerical Work

There is a strange habit creeping into AI workflows. People watch a model open a PDF, pull text out of a DOCX, make sense of an XLSX, and conclude that the job is solved. Fair enough, the models are genuinely brilliant. The fact that they can read those formats at all is impressive. But brilliance is not the same thing as efficiency, and it is definitely not the same thing as operational discipline. We keep handing expensive reasoning systems a pile of document formats and asking them to do clerical normalization in real time, then acting surprised when the process is slow, noisy, and a little erratic.

That is the larger story behind `doc2md`. It started as a simple browser tool, a private local place where someone could drop a file and get usable markdown back without sending anything to a server. That still matters. A lot of people do not begin with a CI pipeline or an SDK; they begin with one document and one small problem. But the useful thing about the project now is that it no longer stops there. The same idea now exists as a browser app, a CLI, an npm package, and a portable agent skill. One person can drag a file into the browser. Another can wire the package into a batch job and process a hundred documents before a model ever sees them. Same premise, different altitude.

That accessibility shift matters because AI work does not happen at one level anymore. Sometimes the right answer is a browser tab. Sometimes it is `doc2md` in a terminal. Sometimes it is `@doc2md/core` inside a Node workflow. Sometimes it is an agent skill sitting quietly in a repo, doing the dull but necessary part before the model starts spending tokens like they were printed in a basement. The tool became more useful the moment it stopped insisting on a single doorway.

The benchmark only proves what the architecture already suggests. On a mixed batch of PDF, DOCX, XLSX, and PPTX files, `doc2md` converted the set to markdown in 0 to 1 second across all 10 runs. Then the models took over. Claude on the raw files had a 121 second median. Claude with `doc2md` first dropped to 69 seconds, 43 percent faster. Codex on the raw files had a 188 second median. Codex with `doc2md` first dropped to 103 seconds, 45 percent faster. That is the speed story, but the more interesting number is the variance. Codex raw runs wandered between 145 and 274 seconds. After preprocessing, they stayed between 97 and 108. Claude tightened from a 103 to 142 second span down to 63 through 73. Faster is nice. Predictable is infrastructure.

None of this is an argument against the models. Quite the opposite. Their native document reading is remarkable. They can do it. The evidence just says they should not have to do it every time, from scratch, under deadline, inside a larger workflow. Give them clean markdown and they get to spend their energy on interpretation, synthesis, judgment, and actual reasoning. Leave them in the raw document swamp and they burn time on extraction paths, tool selection, fallback behavior, and format cleanup. Intelligence is still intelligence, even when someone has been assigned to mop the floor. It is just a poor use of the room.

That is why `doc2md` matters more now than when it was only a browser converter. It is not just a convenient utility for turning documents into markdown. It is a way to meet people and systems where they actually are, from a first time user dragging in one file, to a developer scripting a CLI, to a team baking preprocessing into packages, agents, and pipelines. The models deserve some recognition here. They are astonishing. They are also more efficient, more stable, and easier to trust when we help them a little before the serious work begins.

*Dexter*
