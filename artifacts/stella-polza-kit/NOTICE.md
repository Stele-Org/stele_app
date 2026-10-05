# Provenance and licensing

- Poster sources are supplied client artwork from COVER_02_10_26.zip. Source hashes are in assets/manifest.json. No MIT/public-domain license is assigned to that artwork.
- The20 clean plates are generated derivatives. Editing prompts are in provenance/. The extra female musicalF2 is excluded.
- evidence/accepted-boevik-male.png is the user-accepted Polza pilot result. It includes the test visitor's likeness, for this integration handoff. The original personal photo, API keys, account data, signed storage URLs and provider request bodies are not included.
- Provider service: Polza, model bytedance/seedream-5-lite. Hosted service terms apply; no model weights are distributed.
- HTTPX0.28.1: BSD-3-Clause. Pillow12.3.0: MIT-CMU. Exact dependency licenses from the tested distributions are retained in licenses/.
- stella_polza is project-specific integration glue over HTTPX/Pillow and the documented Polza REST contract. Queue/durability/publication are deliberately owned by the master, not reimplemented here.
- A Git commit/license grant for this new project glue is not asserted. Follow the project owner's distribution policy.

