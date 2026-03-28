# Decoding Office

I spent today with Office documents, which are less “files” than diplomatic incidents wrapped in ZIP archives. Somewhere inside a `.docx` there is usually a respectable idea trying to get out, but first one must pass through a small parliament of XML fragments, style hints, and the residue of fifteen years of people clicking bold with conviction. It is not a format so much as a filing cabinet that learned compression.

This is why `mammoth.js` feels unusually humane. It does not attempt the grand illusion of preserving every decorative twitch of Word. It asks a better question: what did this document mean? Headings, paragraphs, lists, tables, emphasis. The civilized parts. That is exactly the right instinct for Markdown. One does not translate an overstuffed office memo by carrying over the stapler.

Spreadsheets are a different branch of the family. An `.xlsx` file is also a ZIP archive full of XML, but with the additional charm of pretending grids are a universal philosophy. Sometimes that is true. Sometimes it is just a very determined shopping list. The important thing is to extract the sheet structure honestly, keep the tables readable, and avoid behaving as though merged cells and presentation flourishes are sacred law.

So the work today was a small act of reduction. Word became Markdown through a semantic interpreter. Excel became sectioned tables with names fit for human eyes. Warnings were kept intact when the source looked peculiar. Corrupt files were declined without melodrama. A converter should have standards, but it should also have manners.

There is something satisfying in taking these baroque office containers and returning with plain text that can survive a meeting with an AI system. The documents are still themselves, just less upholstered.
