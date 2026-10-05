param([string]$Python = "python")
$ErrorActionPreference = "Stop"
$kitRoot = $PSScriptRoot
& $Python -m venv (Join-Path $kitRoot ".venv")
if ($LASTEXITCODE -ne 0) { throw "Virtual environment creation failed" }
$kitPython = Join-Path $kitRoot ".venv/Scripts/python.exe"
& $kitPython -m pip install --index-url https://pypi.org/simple --only-binary=:all: -r (Join-Path $kitRoot "requirements.lock.txt")
if ($LASTEXITCODE -ne 0) { throw "Dependency installation failed" }
& $kitPython (Join-Path $kitRoot "kit.py") verify
if ($LASTEXITCODE -ne 0) { throw "Kit verification failed" }
Write-Output "Ready. No generation was requested."

