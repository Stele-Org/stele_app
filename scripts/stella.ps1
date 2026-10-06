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
  'record' {
    # A separate Chrome for screen recording. Switches are read only when a browser process starts, so it runs on its
    # own profile next to the everyday Chrome; a window of that profile left open would swallow the launch unchanged.
    $chrome = "$env:ProgramFiles\Google\Chrome\Application\chrome.exe", "${env:ProgramFiles(x86)}\Google\Chrome\Application\chrome.exe",
      "$env:LOCALAPPDATA\Google\Chrome\Application\chrome.exe" | Where-Object { Test-Path $_ } | Select-Object -First 1
    if (-not $chrome) { throw 'Google Chrome not found.' }
    $recordProfile = Join-Path $env:TEMP 'chrome-stella-rec'
    $open = Get-CimInstance Win32_Process -Filter "Name='chrome.exe'" | Where-Object { $_.CommandLine -like "*$recordProfile*" }
    if ($open) { throw 'The recording Chrome is already open: close all of its windows and run the task again.' }
    $query = if ($Rest) { $Rest[0].TrimStart('?') } else { 'camera=any&greeting=1&mic=1' }
    # One program holds the webcam at a time: with the app left open in the everyday Chrome the page here gets
    # "Device in use" and shows no camera. Windows records who holds it; a stop time of 0 means "right now".
    $webcam = 'HKCU:\Software\Microsoft\Windows\CurrentVersion\CapabilityAccessManager\ConsentStore\webcam'
    $holders = @(Get-ChildItem $webcam, "$webcam\NonPackaged" -ErrorAction SilentlyContinue | Where-Object {
      $use = Get-ItemProperty $_.PSPath -ErrorAction SilentlyContinue
      $use.LastUsedTimeStart -gt 0 -and $use.LastUsedTimeStop -eq 0
    } | ForEach-Object { ($_.PSChildName -split '#')[-1] })
    if ($holders -and $query -match 'camera=any') {
      throw "The camera is in use by $($holders -join ', '): close the tab or program that shows it and run the task again."
    }
    # The page is served by the dev server: without it the recording Chrome opens an error page. Start it in a
    # window of its own, which stays open after the recording and is closed by hand.
    $serving = { try { $probe = [Net.Sockets.TcpClient]::new(); $probe.Connect('127.0.0.1', 5218); $probe.Close(); $true } catch { $false } }
    if (-not (& $serving)) {
      Write-Host 'The dev server is not running: starting it in a new window...'
      Start-Process -FilePath (Get-Process -Id $PID).Path -WorkingDirectory $root -ArgumentList '-NoExit', '-File', "`"$PSCommandPath`"", 'dev'
      $deadline = (Get-Date).AddSeconds(40)
      while (-not (& $serving) -and (Get-Date) -lt $deadline) { Start-Sleep -Milliseconds 500 }
      if (-not (& $serving)) { throw 'The dev server did not start in 40 s: look at its window, then run the task again.' }
    }
    New-Item -ItemType Directory -Force $recordProfile | Out-Null
    $switches = @(
      "--user-data-dir=`"$recordProfile`"", '--no-first-run', '--no-default-browser-check',
      # CalculateNativeWinOcclusion and the three switches after it: the page keeps drawing while another window
      # covers it (the recorder's panel, its frame, a preview). MediaFoundationD3D11VideoCapture: camera frames
      # reach the page through memory, not as textures of the video card.
      '--disable-features=CalculateNativeWinOcclusion,MediaFoundationD3D11VideoCapture',
      '--disable-backgrounding-occluded-windows', '--disable-renderer-backgrounding', '--disable-background-timer-throttling',
      # Live camera video is composed with the page instead of going to a hardware overlay past the capture.
      '--disable-direct-composition-video-overlays',
      # Browser and video-card messages go to chrome_debug.log in the profile folder, to look into a frozen picture.
      '--enable-logging',
      "`"http://127.0.0.1:5218/stella/?$query`""
    )
    # Chrome also prints its log to the console it was started from: keep the terminal clean, the file has it all.
    Start-Process -FilePath $chrome -ArgumentList $switches -RedirectStandardError (Join-Path $recordProfile 'chrome_stderr.log')
    Write-Host "Recording Chrome opened: http://127.0.0.1:5218/stella/?$query"
  }
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
  record [query]  open the app in a separate Chrome set up for screen recording (window occlusion tracking off);
                  query in quotes, default "camera=any&greeting=1&mic=1"; the dev server must be running
  verify-dist     compare dist/ with the accepted build manifest
  verify-package  compare the working tree with PACKAGE-MANIFEST.json (add --extra to list new files)
  secrets         Gitleaks over working files and git history (required before push)
  build           production build into dist/ (invalidates the accepted pin)
'@
  }
}
