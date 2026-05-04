# doc2md Mac App Notices

This file identifies notice sources for public `doc2md.app` distributions.

The Mac desktop app is source-visible shareware, but it bundles code that remains under MIT or third-party dependency licenses. Required notices must travel with the app distribution where applicable.

Public app releases must bundle this notice inventory, or a generated equivalent for the exact released artifact, inside the `.app` and any DMG or other installer distribution.

## Internal doc2md MIT Components

The Mac app bundles a desktop web build generated from MIT-licensed portions of the root `src/` tree and `packages/core/`, plus desktop-license-covered bridge and UI code where applicable.

When distributing the Mac app, preserve the MIT notice for bundled MIT doc2md code. See:

- `../../LICENSES/MIT.txt`
- `../../packages/core/LICENSE`

## Direct Runtime Dependencies

The current app build can include these direct runtime dependencies from the root `package.json` and `package-lock.json`:

<!-- BEGIN GENERATED npm -->

| Dependency | Version | License | Source |
| --- | ---: | --- | --- |
| `@asamuzakjp/css-color` | 3.2.0 | MIT | git+https://github.com/asamuzaK/cssColor.git |
| `@csstools/color-helpers` | 5.1.0 | MIT-0 | git+https://github.com/csstools/postcss-plugins.git |
| `@csstools/css-calc` | 2.1.4 | MIT | git+https://github.com/csstools/postcss-plugins.git |
| `@csstools/css-color-parser` | 3.1.0 | MIT | git+https://github.com/csstools/postcss-plugins.git |
| `@csstools/css-parser-algorithms` | 3.0.5 | MIT | git+https://github.com/csstools/postcss-plugins.git |
| `@csstools/css-tokenizer` | 3.0.4 | MIT | git+https://github.com/csstools/postcss-plugins.git |
| `@doc2md/core` | 1.0.1 | MIT | git+https://github.com/KjellKod/doc2md.git |
| `@mixmark-io/domino` | 2.2.0 | BSD-2-Clause | https://github.com/mixmark-io/domino.git |
| `@types/debug` | 4.1.13 | MIT | https://github.com/DefinitelyTyped/DefinitelyTyped.git |
| `@types/estree` | 1.0.8 | MIT | https://github.com/DefinitelyTyped/DefinitelyTyped.git |
| `@types/estree-jsx` | 1.0.5 | MIT | https://github.com/DefinitelyTyped/DefinitelyTyped.git |
| `@types/hast` | 3.0.4 | MIT | https://github.com/DefinitelyTyped/DefinitelyTyped.git |
| `@types/mdast` | 4.0.4 | MIT | https://github.com/DefinitelyTyped/DefinitelyTyped.git |
| `@types/ms` | 2.1.0 | MIT | https://github.com/DefinitelyTyped/DefinitelyTyped.git |
| `@types/unist` | 3.0.3 | MIT | https://github.com/DefinitelyTyped/DefinitelyTyped.git |
| `@ungap/structured-clone` | 1.3.0 | ISC | git+https://github.com/ungap/structured-clone.git |
| `@xmldom/xmldom` | 0.8.13 | MIT | git://github.com/xmldom/xmldom.git |
| `agent-base` | 7.1.4 | MIT | https://github.com/TooTallNate/proxy-agents.git |
| `argparse` | 1.0.10 | MIT | nodeca/argparse |
| `bail` | 2.0.2 | MIT | wooorm/bail |
| `base64-js` | 1.5.1 | MIT | git://github.com/beatgammit/base64-js.git |
| `bluebird` | 3.4.7 | MIT | git://github.com/petkaantonov/bluebird.git |
| `ccount` | 2.0.1 | MIT | wooorm/ccount |
| `character-entities` | 2.0.2 | MIT | wooorm/character-entities |
| `character-entities-html4` | 2.1.0 | MIT | wooorm/character-entities-html4 |
| `character-entities-legacy` | 3.0.0 | MIT | wooorm/character-entities-legacy |
| `character-reference-invalid` | 2.0.1 | MIT | wooorm/character-reference-invalid |
| `comma-separated-tokens` | 2.0.3 | MIT | wooorm/comma-separated-tokens |
| `core-util-is` | 1.0.3 | MIT | git://github.com/isaacs/core-util-is |
| `cssstyle` | 4.6.0 | MIT | jsdom/cssstyle |
| `data-urls` | 5.0.0 | MIT | jsdom/data-urls |
| `debug` | 4.4.3 | MIT | git://github.com/debug-js/debug.git |
| `decimal.js` | 10.6.0 | MIT | https://github.com/MikeMcl/decimal.js.git |
| `decode-named-character-reference` | 1.3.0 | MIT | wooorm/decode-named-character-reference |
| `dequal` | 2.0.3 | MIT | lukeed/dequal |
| `devlop` | 1.1.0 | MIT | wooorm/devlop |
| `dingbat-to-unicode` | 1.0.1 | BSD-2-Clause | git+https://github.com/mwilliamson/dingbat-to-unicode.git |
| `duck` | 0.1.12 | BSD | https://github.com/mwilliamson/duck.js.git |
| `duplexer2` | 0.1.4 | BSD-3-Clause | deoxxa/duplexer2 |
| `entities` | 6.0.1 | BSD-2-Clause | git://github.com/fb55/entities.git |
| `escape-string-regexp` | 5.0.0 | MIT | sindresorhus/escape-string-regexp |
| `estree-util-is-identifier-name` | 3.0.0 | MIT | syntax-tree/estree-util-is-identifier-name |
| `extend` | 3.0.2 | MIT | https://github.com/justmoon/node-extend.git |
| `fflate` | 0.8.2 | MIT | https://github.com/101arrowz/fflate |
| `fs-extra` | 11.3.4 | MIT | git+https://github.com/jprichardson/node-fs-extra.git |
| `graceful-fs` | 4.2.11 | ISC | https://github.com/isaacs/node-graceful-fs |
| `hast-util-to-jsx-runtime` | 2.3.6 | MIT | syntax-tree/hast-util-to-jsx-runtime |
| `hast-util-whitespace` | 3.0.0 | MIT | syntax-tree/hast-util-whitespace |
| `html-encoding-sniffer` | 4.0.0 | MIT | jsdom/html-encoding-sniffer |
| `html-url-attributes` | 3.0.1 | MIT | https://github.com/rehypejs/rehype-minify/tree/main/packages/html-url-attributes |
| `http-proxy-agent` | 7.0.2 | MIT | https://github.com/TooTallNate/proxy-agents.git |
| `https-proxy-agent` | 7.0.6 | MIT | https://github.com/TooTallNate/proxy-agents.git |
| `iconv-lite` | 0.6.3 | MIT | git://github.com/ashtuchkin/iconv-lite.git |
| `immediate` | 3.0.6 | MIT | git://github.com/calvinmetcalf/immediate.git |
| `inherits` | 2.0.4 | ISC | git://github.com/isaacs/inherits |
| `inline-style-parser` | 0.2.7 | MIT | git+https://github.com/remarkablemark/inline-style-parser.git |
| `is-alphabetical` | 2.0.1 | MIT | wooorm/is-alphabetical |
| `is-alphanumerical` | 2.0.1 | MIT | wooorm/is-alphanumerical |
| `is-decimal` | 2.0.1 | MIT | wooorm/is-decimal |
| `is-hexadecimal` | 2.0.1 | MIT | wooorm/is-hexadecimal |
| `is-plain-obj` | 4.1.0 | MIT | sindresorhus/is-plain-obj |
| `is-potential-custom-element-name` | 1.0.1 | MIT | https://github.com/mathiasbynens/is-potential-custom-element-name.git |
| `isarray` | 1.0.0 | MIT | git://github.com/juliangruber/isarray.git |
| `js-tokens` | 4.0.0 | MIT | lydell/js-tokens |
| `jsdom` | 26.1.0 | MIT | git+https://github.com/jsdom/jsdom.git |
| `jsonfile` | 6.2.0 | MIT | git@github.com:jprichardson/node-jsonfile.git |
| `jszip` | 3.10.1 | (MIT OR GPL-3.0-or-later) | https://github.com/Stuk/jszip.git |
| `lie` | 3.3.0 | MIT | https://github.com/calvinmetcalf/lie.git |
| `longest-streak` | 3.1.0 | MIT | wooorm/longest-streak |
| `loose-envify` | 1.4.0 | MIT | git://github.com/zertosh/loose-envify.git |
| `lop` | 0.4.2 | BSD-2-Clause | https://github.com/mwilliamson/lop.git |
| `lru-cache` | 10.4.3 | ISC | git://github.com/isaacs/node-lru-cache.git |
| `lucide-react` | 1.7.0 | ISC | https://github.com/lucide-icons/lucide.git |
| `mammoth` | 1.12.0 | BSD-2-Clause | https://github.com/mwilliamson/mammoth.js.git |
| `markdown-table` | 3.0.4 | MIT | wooorm/markdown-table |
| `mdast-util-find-and-replace` | 3.0.2 | MIT | syntax-tree/mdast-util-find-and-replace |
| `mdast-util-from-markdown` | 2.0.3 | MIT | syntax-tree/mdast-util-from-markdown |
| `mdast-util-gfm` | 3.1.0 | MIT | syntax-tree/mdast-util-gfm |
| `mdast-util-gfm-autolink-literal` | 2.0.1 | MIT | syntax-tree/mdast-util-gfm-autolink-literal |
| `mdast-util-gfm-footnote` | 2.1.0 | MIT | syntax-tree/mdast-util-gfm-footnote |
| `mdast-util-gfm-strikethrough` | 2.0.0 | MIT | syntax-tree/mdast-util-gfm-strikethrough |
| `mdast-util-gfm-table` | 2.0.0 | MIT | syntax-tree/mdast-util-gfm-table |
| `mdast-util-gfm-task-list-item` | 2.0.0 | MIT | syntax-tree/mdast-util-gfm-task-list-item |
| `mdast-util-mdx-expression` | 2.0.1 | MIT | syntax-tree/mdast-util-mdx-expression |
| `mdast-util-mdx-jsx` | 3.2.0 | MIT | syntax-tree/mdast-util-mdx-jsx |
| `mdast-util-mdxjs-esm` | 2.0.1 | MIT | syntax-tree/mdast-util-mdxjs-esm |
| `mdast-util-phrasing` | 4.1.0 | MIT | syntax-tree/mdast-util-phrasing |
| `mdast-util-to-hast` | 13.2.1 | MIT | syntax-tree/mdast-util-to-hast |
| `mdast-util-to-markdown` | 2.1.2 | MIT | syntax-tree/mdast-util-to-markdown |
| `mdast-util-to-string` | 4.0.0 | MIT | syntax-tree/mdast-util-to-string |
| `micromark` | 4.0.2 | MIT | https://github.com/micromark/micromark/tree/main/packages/micromark |
| `micromark-core-commonmark` | 2.0.3 | MIT | https://github.com/micromark/micromark/tree/main/packages/micromark-core-commonmark |
| `micromark-extension-gfm` | 3.0.0 | MIT | micromark/micromark-extension-gfm |
| `micromark-extension-gfm-autolink-literal` | 2.1.0 | MIT | micromark/micromark-extension-gfm-autolink-literal |
| `micromark-extension-gfm-footnote` | 2.1.0 | MIT | micromark/micromark-extension-gfm-footnote |
| `micromark-extension-gfm-strikethrough` | 2.1.0 | MIT | micromark/micromark-extension-gfm-strikethrough |
| `micromark-extension-gfm-table` | 2.1.1 | MIT | micromark/micromark-extension-gfm-table |
| `micromark-extension-gfm-tagfilter` | 2.0.0 | MIT | micromark/micromark-extension-gfm-tagfilter |
| `micromark-extension-gfm-task-list-item` | 2.1.0 | MIT | micromark/micromark-extension-gfm-task-list-item |
| `micromark-factory-destination` | 2.0.1 | MIT | https://github.com/micromark/micromark/tree/main/packages/micromark-factory-destination |
| `micromark-factory-label` | 2.0.1 | MIT | https://github.com/micromark/micromark/tree/main/packages/micromark-factory-label |
| `micromark-factory-space` | 2.0.1 | MIT | https://github.com/micromark/micromark/tree/main/packages/micromark-factory-space |
| `micromark-factory-title` | 2.0.1 | MIT | https://github.com/micromark/micromark/tree/main/packages/micromark-factory-title |
| `micromark-factory-whitespace` | 2.0.1 | MIT | https://github.com/micromark/micromark/tree/main/packages/micromark-factory-whitespace |
| `micromark-util-character` | 2.1.1 | MIT | https://github.com/micromark/micromark/tree/main/packages/micromark-util-character |
| `micromark-util-chunked` | 2.0.1 | MIT | https://github.com/micromark/micromark/tree/main/packages/micromark-util-chunked |
| `micromark-util-classify-character` | 2.0.1 | MIT | https://github.com/micromark/micromark/tree/main/packages/micromark-util-classify-character |
| `micromark-util-combine-extensions` | 2.0.1 | MIT | https://github.com/micromark/micromark/tree/main/packages/micromark-util-combine-extensions |
| `micromark-util-decode-numeric-character-reference` | 2.0.2 | MIT | https://github.com/micromark/micromark/tree/main/packages/micromark-util-decode-numeric-character-reference |
| `micromark-util-decode-string` | 2.0.1 | MIT | https://github.com/micromark/micromark/tree/main/packages/micromark-util-decode-string |
| `micromark-util-encode` | 2.0.1 | MIT | https://github.com/micromark/micromark/tree/main/packages/micromark-util-encode |
| `micromark-util-html-tag-name` | 2.0.1 | MIT | https://github.com/micromark/micromark/tree/main/packages/micromark-util-html-tag-name |
| `micromark-util-normalize-identifier` | 2.0.1 | MIT | https://github.com/micromark/micromark/tree/main/packages/micromark-util-normalize-identifier |
| `micromark-util-resolve-all` | 2.0.1 | MIT | https://github.com/micromark/micromark/tree/main/packages/micromark-util-resolve-all |
| `micromark-util-sanitize-uri` | 2.0.1 | MIT | https://github.com/micromark/micromark/tree/main/packages/micromark-util-sanitize-uri |
| `micromark-util-subtokenize` | 2.1.0 | MIT | https://github.com/micromark/micromark/tree/main/packages/micromark-util-subtokenize |
| `micromark-util-symbol` | 2.0.1 | MIT | https://github.com/micromark/micromark/tree/main/packages/micromark-util-symbol |
| `micromark-util-types` | 2.0.2 | MIT | https://github.com/micromark/micromark/tree/main/packages/micromark-util-types |
| `ms` | 2.1.3 | MIT | vercel/ms |
| `node-int64` | 0.4.0 | MIT | https://github.com/broofa/node-int64 |
| `nwsapi` | 2.2.23 | MIT | git://github.com/dperini/nwsapi.git |
| `option` | 0.2.4 | BSD-2-Clause | https://github.com/mwilliamson/node-options.git |
| `pako` | 1.0.11 | (MIT AND Zlib) | nodeca/pako |
| `parse-entities` | 4.0.2 | MIT | wooorm/parse-entities |
| `parse5` | 7.3.0 | MIT | git://github.com/inikulin/parse5.git |
| `path-is-absolute` | 1.0.1 | MIT | sindresorhus/path-is-absolute |
| `pdfjs-dist` | 4.10.38 | Apache-2.0 | git+https://github.com/mozilla/pdf.js.git |
| `process-nextick-args` | 2.0.1 | MIT | https://github.com/calvinmetcalf/process-nextick-args.git |
| `property-information` | 7.1.0 | MIT | wooorm/property-information |
| `punycode` | 2.3.1 | MIT | https://github.com/mathiasbynens/punycode.js.git |
| `react` | 18.3.1 | MIT | https://github.com/facebook/react.git |
| `react-dom` | 18.3.1 | MIT | https://github.com/facebook/react.git |
| `react-markdown` | 9.1.0 | MIT | remarkjs/react-markdown |
| `read-excel-file` | 7.0.3 | MIT | https://gitlab.com/catamphetamine/read-excel-file |
| `readable-stream` | 2.3.8 | MIT | git://github.com/nodejs/readable-stream |
| `remark-gfm` | 4.0.1 | MIT | remarkjs/remark-gfm |
| `remark-parse` | 11.0.0 | MIT | https://github.com/remarkjs/remark/tree/main/packages/remark-parse |
| `remark-rehype` | 11.1.2 | MIT | remarkjs/remark-rehype |
| `remark-stringify` | 11.0.0 | MIT | https://github.com/remarkjs/remark/tree/main/packages/remark-stringify |
| `rrweb-cssom` | 0.8.0 | MIT | rrweb-io/CSSOM |
| `safe-buffer` | 5.1.2 | MIT | git://github.com/feross/safe-buffer.git |
| `safer-buffer` | 2.1.2 | MIT | git+https://github.com/ChALkeR/safer-buffer.git |
| `saxes` | 6.0.0 | ISC | https://github.com/lddubeau/saxes.git |
| `scheduler` | 0.23.2 | MIT | https://github.com/facebook/react.git |
| `setimmediate` | 1.0.5 | MIT | YuzuJS/setImmediate |
| `space-separated-tokens` | 2.0.2 | MIT | wooorm/space-separated-tokens |
| `sprintf-js` | 1.0.3 | BSD-3-Clause | https://github.com/alexei/sprintf.js.git |
| `string_decoder` | 1.1.1 | MIT | git://github.com/nodejs/string_decoder.git |
| `stringify-entities` | 4.0.4 | MIT | wooorm/stringify-entities |
| `style-to-js` | 1.1.21 | MIT | git+https://github.com/remarkablemark/style-to-js.git |
| `style-to-object` | 1.0.14 | MIT | git+https://github.com/remarkablemark/style-to-object.git |
| `symbol-tree` | 3.2.4 | MIT | https://github.com/jsdom/js-symbol-tree.git |
| `tldts` | 6.1.86 | MIT | git+ssh://git@github.com/remusao/tldts.git |
| `tldts-core` | 6.1.86 | MIT | git+ssh://git@github.com/remusao/tldts.git |
| `tough-cookie` | 5.1.2 | BSD-3-Clause | git://github.com/salesforce/tough-cookie.git |
| `tr46` | 5.1.1 | MIT | https://github.com/jsdom/tr46 |
| `trim-lines` | 3.0.1 | MIT | wooorm/trim-lines |
| `trough` | 2.2.0 | MIT | wooorm/trough |
| `turndown` | 7.2.2 | MIT | https://github.com/mixmark-io/turndown.git |
| `underscore` | 1.13.8 | MIT | git://github.com/jashkenas/underscore.git |
| `unified` | 11.0.5 | MIT | unifiedjs/unified |
| `unist-util-is` | 6.0.1 | MIT | syntax-tree/unist-util-is |
| `unist-util-position` | 5.0.0 | MIT | syntax-tree/unist-util-position |
| `unist-util-stringify-position` | 4.0.0 | MIT | syntax-tree/unist-util-stringify-position |
| `unist-util-visit` | 5.1.0 | MIT | syntax-tree/unist-util-visit |
| `unist-util-visit-parents` | 6.0.2 | MIT | syntax-tree/unist-util-visit-parents |
| `universalify` | 2.0.1 | MIT | git+https://github.com/RyanZim/universalify.git |
| `unzipper` | 0.12.3 | MIT | https://github.com/ZJONSSON/node-unzipper.git |
| `util-deprecate` | 1.0.2 | MIT | git://github.com/TooTallNate/util-deprecate.git |
| `vfile` | 6.0.3 | MIT | vfile/vfile |
| `vfile-message` | 4.0.3 | MIT | vfile/vfile-message |
| `w3c-xmlserializer` | 5.0.0 | MIT | jsdom/w3c-xmlserializer |
| `webidl-conversions` | 7.0.0 | BSD-2-Clause | jsdom/webidl-conversions |
| `whatwg-encoding` | 3.1.1 | MIT | jsdom/whatwg-encoding |
| `whatwg-mimetype` | 4.0.0 | MIT | jsdom/whatwg-mimetype |
| `whatwg-url` | 14.2.0 | MIT | jsdom/whatwg-url |
| `ws` | 8.20.0 | MIT | git+https://github.com/websockets/ws.git |
| `xml-name-validator` | 5.0.0 | Apache-2.0 | jsdom/xml-name-validator |
| `xmlbuilder` | 10.1.1 | MIT | git://github.com/oozcitak/xmlbuilder-js.git |
| `xmlchars` | 2.2.0 | MIT | https://github.com/lddubeau/xmlchars.git |
| `zwitch` | 2.0.4 | MIT | wooorm/zwitch |

<!-- END GENERATED npm -->

## Native Mac Dependencies

The Mac app also links native SwiftPM/Xcode dependencies. Current native package metadata lives in:

- `doc2md.xcodeproj/project.xcworkspace/xcshareddata/swiftpm/Package.resolved`
- `doc2md.xcodeproj/project.pbxproj`

The current native app build links Sparkle 2 through Swift Package Manager. Public app release notices should include required notices for Sparkle and any other native packages included in the exact released artifact.

<!-- BEGIN GENERATED swiftpm -->

| Dependency | Version | License | Source |
| --- | ---: | --- | --- |
| `sparkle` | 2.9.1 | MIT | https://github.com/sparkle-project/Sparkle/blob/main/LICENSE |

<!-- END GENERATED swiftpm -->

## Transitive Dependencies

Public app distributions should include notices for the exact JavaScript and native transitive dependency set bundled in the released artifact, not a hand-maintained guess. Generate or verify that notice inventory from the npm lockfile, SwiftPM/Xcode package metadata, and bundled app contents before release.

Relevant dependency metadata lives in:

- `../../package-lock.json`
- `../../package.json`
- `../../packages/core/package.json`
- `doc2md.xcodeproj/project.xcworkspace/xcshareddata/swiftpm/Package.resolved`
- `doc2md.xcodeproj/project.pbxproj`

The release notice inventory should preserve license text required by bundled MIT, Apache-2.0, BSD, ISC, and other third-party packages.

## Mac App Assets And Branding

The doc2md app name, icons, screenshots, trade dress, domain names, and product branding are not MIT-licensed. They are reserved except where explicitly stated in `../../LICENSE` and `../../LICENSES/LicenseRef-doc2md-Desktop.txt`.
