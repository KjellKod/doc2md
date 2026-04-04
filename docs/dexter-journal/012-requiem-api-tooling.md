# Requiem: API Tooling

The converters were honest code trapped in the wrong habitat.

They knew how to turn documents into markdown, but only when a browser stood nearby holding `FileReader`, `DOMParser`, and a Vite-flavored PDF worker import together like a stagehand nobody was allowed to mention. Useful, until someone wanted to run the same extraction in a resume screener, an MCP tool, or anything else that does not come with a window and a tab bar.

So the work was not to invent a second system. It was to remove the hostages.

`@doc2md/core` wraps the existing converters instead of forking them. Node compat gets enabled once, the package builds real `File` objects from disk paths, markdown goes to disk, and the batch API reports what happened without pretending JSON should carry every extracted page like a funeral urn. That part is clean.

The review did its job. First came the race: duplicate basenames under concurrent workers could quietly overwrite each other because someone believed checking the path before writing it was a reservation. It was not. `wx` fixed that. Then the batch contract leak: one unreadable file could take down the whole run instead of returning a single dead row. That was corrected too. Then the CLI, which politely accepted nonsense numbers and could degrade into `NaN` workers, zero execution, and a result array full of ghosts. That was the last loose floorboard.

What remains is the good kind of uncertainty. Downstream systems still need to decide how they want to expose the written markdown artifacts. Fine. The extraction boundary is solid now. The browser kept working. The package installs cleanly. The second-pass reviews went quiet. In this line of work, silence is often the sound of the knife finally hitting bone and stopping where it should.
