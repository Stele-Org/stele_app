# Downloads the pinned project toolchain into .tools/ (ignored by git).
# No admin rights are needed and the system-wide Node.js is left untouched.
# Each archive is verified against the SHA256 published by its vendor.
$ErrorActionPreference = 'Stop'
$ProgressPreference = 'SilentlyContinue'

$root = Split-Path -Parent $PSScriptRoot
$tools = Join-Path $root '.tools'

$pins = @(
  @{
    name = 'node'; version = '24.21.0'; probe = 'node.exe'; strip = 'node-v24.21.0-win-x64'
    url = 'https://nodejs.org/dist/v24.21.0/node-v24.21.0-win-x64.zip'
    sha256 = '158f7685b44de51f6c0df1d153526cbcd3e1bc739a8dfc607721cef75de9e541'
  },
  @{
    name = 'gitleaks'; version = '8.30.1'; probe = 'gitleaks.exe'; strip = $null
    url = 'https://github.com/gitleaks/gitleaks/releases/download/v8.30.1/gitleaks_8.30.1_windows_x64.zip'
    sha256 = 'd29144deff3a68aa93ced33dddf84b7fdc26070add4aa0f4513094c8332afc4e'
  }
)

New-Item -ItemType Directory -Force $tools | Out-Null
foreach ($p in $pins) {
  $dest = Join-Path $tools $p.name
  $stamp = Join-Path $dest '.version'
  if ((Test-Path (Join-Path $dest $p.probe)) -and (Test-Path $stamp) -and ((Get-Content $stamp -Raw).Trim() -eq $p.version)) {
    Write-Host ("{0} {1}: already installed" -f $p.name, $p.version)
    continue
  }
  $zip = Join-Path $tools ("{0}-{1}.zip" -f $p.name, $p.version)
  Write-Host ("{0} {1}: downloading" -f $p.name, $p.version)
  Invoke-WebRequest -UseBasicParsing $p.url -OutFile $zip
  $actual = (Get-FileHash $zip -Algorithm SHA256).Hash.ToLower()
  if ($actual -ne $p.sha256) {
    Remove-Item $zip
    throw ("SHA256 mismatch for {0}: got {1}" -f $p.name, $actual)
  }
  $tmp = Join-Path $tools ($p.name + '.tmp')
  if (Test-Path $tmp) { Remove-Item -Recurse -Force $tmp }
  New-Item -ItemType Directory -Force $tmp | Out-Null
  tar -xf $zip -C $tmp
  if ($LASTEXITCODE -ne 0) { throw ("Failed to unpack {0}" -f $zip) }
  if (Test-Path $dest) { Remove-Item -Recurse -Force $dest }
  if ($p.strip) {
    Move-Item (Join-Path $tmp $p.strip) $dest
    Remove-Item -Recurse -Force $tmp
  } else {
    Move-Item $tmp $dest
  }
  Set-Content -Path $stamp -Value $p.version
  Remove-Item $zip
  Write-Host ("{0} {1}: installed to {2}" -f $p.name, $p.version, $dest)
}
