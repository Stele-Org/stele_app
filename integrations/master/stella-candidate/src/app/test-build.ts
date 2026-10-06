/**
 * A build made for testers outside the stand: `VITE_STELLA_TEST_BUILD=1` at build time, published by
 * `.github/workflows/pages-test-build.yml` (see apps/stella-prototype/docs/GITHUB_PAGES.md).
 * It opens any camera, greets on the start screen and starts behind one press, so that a plain link is enough.
 * The stand build is made without the variable: there this is `false` and nothing changes.
 */
export const TEST_BUILD = import.meta.env.VITE_STELLA_TEST_BUILD === '1'
