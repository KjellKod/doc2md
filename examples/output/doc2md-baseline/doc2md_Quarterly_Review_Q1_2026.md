## Slide 1: doc2md Quarterly Review

- Q1 2026 | Platform Engineering

## Slide 2: Key Metrics

- Conversions processed: 2.4M (up 38% QoQ)
- Average conversion time: 340ms (down from 520ms)
- Supported formats: 10 (added PPTX and HTML)
- API uptime: 99.94%
- Active API clients: 847

## Slide 3: Architecture Changes

- Migrated PDF extraction from pdfjs-dist to a hybrid pipeline
- Added streaming conversion for files over 10MB
- Introduced worker pool with auto-scaling (2-16 workers)
- Replaced synchronous XLSX parsing with async chunked reader

## Slide 4: Reliability Improvements

- Conversion failure rate dropped from 3.2% to 0.8%
- P95 latency reduced from 2.1s to 890ms
- Zero downtime deployments via blue-green strategy
- Circuit breaker added for third-party library crashes

## Slide 5: Q2 Roadmap

- Launch @doc2md/core npm package for programmatic use
- Add OCR support for scanned PDFs (Tesseract integration)
- Implement conversion quality scoring (confidence metrics)
- Target: 5M conversions/month capacity
- Budget request: $12,400/month for GPU-accelerated OCR workers

## Slide 6: Risks and Open Questions

- OCR accuracy on handwritten documents is uncertain (target: 85% word accuracy)
- GPU worker cost may exceed budget if adoption spikes
- pdfjs-dist deprecation timeline unclear, hybrid migration must complete by Q3
- Team capacity risk: Charlie at 60% due to cross-team loan