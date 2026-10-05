# Single entry point for everyday project commands. Run from any folder:
#   .\scripts\stella.ps1 <task>
# It always uses the pinned Node.js from .tools/ (or a system Node.js 24+), never an older system Node.
param(
  [Parameter(Position = 0)][string]$Task = 'help',
  [Parameter(ValueFromRemainingArguments = $true)][string[]]$Rest
)
$ErrorActionPreference = 'Stop'

$root = Split-Path -Parent $PSScriptRoot
$candidate = Join-Path $root 'integrations\master\stella-candidate'
$localNode = Join-Path $root '.tools\node'
$gitleaks = Join-Path $root '.tools\gitleaks\gitleaks.exe'

function Use-Node {
  if (Test-Path (Join-Path $localNode 'node.exe')) {
    $env:PATH = $localNode + ';' + $env:PATH
    return
  }
  $system = Get-Command node -ErrorAction SilentlyContinue
  if ($system -and ([int]((& node --version) -replace '^v(\d+).*', '$1') -ge 24)) { return }
  throw 'Node.js 24+ not found. Run: .\scripts\stella.ps1 setup'
}

function Invoke-Step([string]$Name, [scriptblock]$Body) {
  Write-Host ("`n=== {0} ===" -f $Name) -ForegroundColor Cyan
  & $Body
  if ($LASTEXITCODE -ne 0) { throw ("{0} failed with exit code {1}" -f $Name, $LASTEXITCODE) }
}

# npm.cmd on purpose: npm.ps1 re-parses the calling line and loses splatted arguments.
function Invoke-Npm { npm.cmd --prefix $candidate @args }

function Invoke-BuildCheck {
  # Type-checks and bundles into .cache/build-check, so the accepted dist/ and its SHA pin stay untouched.
  Push-Location $candidate
  try {
    node node_modules\typescript\bin\tsc -b
    if ($LASTEXITCODE -eq 0) { node node_modules\vite\bin\vite.js build --outDir .cache/build-check --emptyOutDir --logLevel warn }
  } finally { Pop-Location }
}

function Invoke-Secrets {
  if (-not (Test-Path $gitleaks)) { throw 'Gitleaks not found. Run: .\scripts\stella.ps1 setup' }
  Push-Location $root
  try {
    & $gitleaks dir . --config .gitleaks.workdir.toml --no-banner --redact
    if ($LASTEXITCODE -eq 0) { & $gitleaks git . --config .gitleaks.toml --no-banner --redact }
  } finally { Pop-Location }
}

switch ($Task) {
  'setup' {
    Invoke-Step 'toolchain' { & (Join-Path $PSScriptRoot 'setup-tools.ps1'); $global:LASTEXITCODE = 0 }
    Use-Node
    Invoke-Step 'npm ci' { Invoke-Npm ci --ignore-scripts }
    Invoke-Step 'git hooks' { git -C $root config core.hooksPath .githooks }
  }
  'dev' { Use-Node; Invoke-Npm run dev }
  'typecheck' { Use-Node; Invoke-Step 'typecheck' { Invoke-Npm run typecheck } }
  'test' { Use-Node; Invoke-Step 'test' { Invoke-Npm test -- @Rest } }
  'lint' { Use-Node; Invoke-Step 'lint' { Invoke-Npm run lint } }
  'build-check' { Use-Node; Invoke-Step 'build-check' { Invoke-BuildCheck } }
  'build' {
    Write-Warning 'This overwrites dist/: the accepted build manifest and the stand pin stop matching it.'
    Use-Node; Invoke-Step 'build' { Invoke-Npm run build }
  }
  'verify-dist' { Use-Node; Invoke-Step 'verify-dist' { node (Join-Path $root 'integrations\master\verify-build.mjs') } }
  'verify-package' { Use-Node; Invoke-Step 'verify-package' { node (Join-Path $PSScriptRoot 'verify-package.mjs') @Rest } }
  'smoke' {
    Use-Node
    Invoke-Step 'typecheck' { Invoke-Npm run typecheck }
    Invoke-Step 'build-check' { Invoke-BuildCheck }
    Invoke-Step 'smoke' { node (Join-Path $PSScriptRoot 'smoke.mjs') }
  }
  'design' { Use-Node; node (Join-Path $PSScriptRoot 'serve-design.mjs') @Rest }
  'secrets' { Invoke-Step 'gitleaks' { Invoke-Secrets } }
  default {
    Write-Host @'
Usage: .\scripts\stella.ps1 <task>

  setup           download pinned Node.js 24 + Gitleaks into .tools/, npm ci, enable git hooks
  dev             Vite dev server: http://127.0.0.1:5218/stella/
  typecheck       tsc -b
  test [filter]   Vitest (optionally a file or name filter)
  lint            ESLint
  build-check     type-check and bundle into .cache/build-check (dist/ stays untouched)
  smoke           typecheck + build-check + browserless HTTP smoke test + design prototype checks
  design [port]   serve the original Claude Design reference pages: http://127.0.0.1:5219/
                  (the scenes themselves run inside the app: dev, then ?reveal=series or ?discovery=generation)
  verify-dist     compare dist/ with the accepted build manifest
  verify-package  compare the working tree with PACKAGE-MANIFEST.json (add --extra to list new files)
  secrets         Gitleaks over working files and git history (required before push)
  build           production build into dist/ (invalidates the accepted pin)
'@
  }
}
