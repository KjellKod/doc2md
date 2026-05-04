# Desktop License Boundary Refactor

This quest was about cutting a clean line, not drawing a prettier dotted one.

The old shape let desktop behavior live in shared places with caveats nearby:
`App.tsx` knew about the shell, shared hooks knew about native file metadata,
and `global.css` carried desktop chrome. That can work mechanically, but it
makes licensing depend on readers remembering which paragraphs are exceptions.
Readers do not owe us that much charity.

The useful pressure came before the build. The plan kept getting sharper until
the remaining objections were small enough to be useful instead of theatrical:
hard split over runtime guards, desktop entry over shared runtime switching,
license text that cannot pass scans by getting weaker, and `.github` included
where contributors actually paste things.

The implementation did the right kind of boring damage. Hosted code is hosted.
Desktop code is desktop. The Mac app still builds. The license now says what it
means about evaluation, purchase, self-built copies, and MIT carve-outs without
asking the reader to perform archaeology.

Two risks remain worth remembering. First, the hard boundary duplicates some UI
composition. That is acceptable debt; a blurred license boundary is worse debt.
Second, the final legal interpretation is still human work. Tests can prove what
the repository says. They cannot practice law.
