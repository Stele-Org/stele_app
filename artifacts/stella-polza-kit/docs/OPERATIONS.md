# Operations

Defaults: generation disabled. The kit does not read a secrets directory, start a server, access a camera or run a worker. The integrator injects the API key from the master environment through the library constructor.

The credentials must stay outside this directory. Do not put request payloads, base64 inputs, photos, HTTP Authorization headers or signed CDN URLs into standard logs. Log packageId/itemId/jobId/attemptId, recipe/catalog version, input hashes, provider ID, status, sanitized error class, elapsed time and reported cost.

A correlation ID in the Polza user field is a lookup aid, NOT a guaranteed idempotency key. Persist a master-owned submit reservation before the POST. Any unknown outcome must be reconciled; never re-run submit merely because the workflow recovered. If the provider ID exists, resume get_status for that same ID.

Poll cadence/deadline belong to the master; suggested cadence5seconds. completed only means the provider finished. Download, decode, validate, save to the master's persistent media storage and commit its assetRef before reporting ready. Provider CDN URLs must not be the permanent visitor link.

Production storage, access control, retention, deletion and result-page routing belong to F. Keep immutable input hashes and recipe version with the job. A newer photo/session invalidates an older result at the master boundary; it does not undo a completed paid request.

The library is synchronous. Call it in an appropriate master worker/thread, not directly on an ASGI event loop. Do not install a second durable scheduler or the BFM retry worker.

Accepted baseline: one male action cover, Basic,16:9,73.36seconds,4RUB,2848×1600. This is a single measured result, not a deadline or a fixed tariff. Other19 variants have complete backgrounds/prompts but were not paid-provider tested. The user accepted this pilot result.

Runtime outputs must use a separate master-owned writable directory. Code/assets in this kit can remain read-only. A future asset/prompt change must get a new version and SHA manifest; do not change an in-flight job's recipe.

Downloads require HTTPS with a public resolved address; redirects are rejected. DNS validation is not connection-level IP pinning: the master must apply its trusted provider/CDN allowlist or egress policy. Do not accept arbitrary visitor-provided URLs. Injected HTTPX clients must preserve the no-retry/no-secret-download contract.

Atomic output requires hard-link support on the destination filesystem (tested on Windows NTFS). The destination directory must exist, belong to the master, and have no untrusted symlink changes. Existing outputs are never overwritten. If temp cleanup fails after a successful atomic commit, the result remains valid; an orphan `.polza-*.tmp` can be removed by the master's retention process after confirming no active download owns it. A crash after the file commit but before business-state commit must be reconciled by file SHA, not trigger another generation.

Configuration example is descriptive; the adapter does not automatically load it. Constructor `enabled=True` is required for paid submit. API status/download are separate explicit operations. The kit does not implement a service-wide AI kill switch; that remains the master's policy.

