API Rate Limiting Design Specification

Status: Draft | Owner: Platform Team | Date: 2026-03-15

# Overview

This specification defines the rate limiting strategy for the doc2md public API. The system must handle burst traffic from CI/CD pipelines while protecting backend conversion workers from overload.

# Architecture

Rate limiting is implemented as a token bucket algorithm at the API gateway layer. Each authenticated client receives a bucket with capacity of 100 tokens, refilling at 10 tokens per second. Unauthenticated requests share a global bucket of 20 tokens per IP address.

## Endpoint Limits

| Endpoint | Auth Limit | Unauth Limit | Burst |
| --- | --- | --- | --- |
| /convert | 100 req/min | 10 req/min | 150 req/min |
| /batch | 20 req/min | Blocked | 30 req/min |
| /status | 300 req/min | 60 req/min | 500 req/min |
| /health | Unlimited | Unlimited | N/A |

# Retry Behavior

When a client exceeds the rate limit, the API returns HTTP 429 with a Retry-After header. The recommended client behavior is exponential backoff starting at 1 second, with a maximum of 5 retries and a ceiling of 32 seconds between attempts.

# Monitoring

Rate limit events are published to the metrics pipeline with the following dimensions: client\_id, endpoint, bucket\_state, and rejection\_reason. An alert fires when the rejection rate exceeds 5% of total requests over a 5-minute window. The on-call dashboard is at grafana.internal/d/rate-limits.

# Edge Cases

Batch conversion requests (/batch) consume tokens proportional to the number of files in the batch, with a minimum of 5 tokens per request. A batch of 20 files consumes 20 tokens. This prevents a single batch call from draining the entire bucket.

# Migration Plan

Phase 1 (week 1): Deploy rate limiter in shadow mode, log but do not enforce. Phase 2 (week 2): Enable enforcement for unauthenticated requests only. Phase 3 (week 3): Enable enforcement for all requests with a 2x grace multiplier. Phase 4 (week 4): Remove grace multiplier, full enforcement.