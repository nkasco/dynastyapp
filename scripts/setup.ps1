$ErrorActionPreference = "Stop"
Set-StrictMode -Version Latest

$MinNodeMajor = 20
$MinNodeMinor = 9

function Write-Info {
  param([string]$Message)
  Write-Host $Message -ForegroundColor Blue
}

function Write-Warn {
  param([string]$Message)
  Write-Host $Message -ForegroundColor Yellow
}

function Stop-Setup {
  param([string]$Message)
  Write-Host $Message -ForegroundColor Red
  exit 1
}

function Test-CommandExists {
  param([string]$Name)
  return $null -ne (Get-Command $Name -ErrorAction SilentlyContinue)
}

function Test-VersionAtLeast {
  param(
    [int]$CurrentMajor,
    [int]$CurrentMinor
  )

  if ($CurrentMajor -gt $MinNodeMajor) {
    return $true
  }

  if (($CurrentMajor -eq $MinNodeMajor) -and ($CurrentMinor -ge $MinNodeMinor)) {
    return $true
  }

  return $false
}

$RepoRoot = Resolve-Path (Join-Path $PSScriptRoot "..")
Set-Location $RepoRoot

Write-Info "Setting up Dynasty Command Center..."

if (-not (Test-CommandExists "node")) {
  Stop-Setup "Node.js is required. Install Node.js $MinNodeMajor.$MinNodeMinor.0 or newer."
}

$NodeVersion = node -p "process.versions.node"
$NodeParts = $NodeVersion.Split(".")
$NodeMajor = [int]$NodeParts[0]
$NodeMinor = [int]$NodeParts[1]

if (-not (Test-VersionAtLeast -CurrentMajor $NodeMajor -CurrentMinor $NodeMinor)) {
  Stop-Setup "Node.js $NodeVersion is too old. Install Node.js $MinNodeMajor.$MinNodeMinor.0 or newer."
}

Write-Info "Node.js $NodeVersion detected."

if (-not (Test-CommandExists "corepack")) {
  Stop-Setup "Corepack is required. It ships with modern Node.js; make sure your Node install includes it."
}

Write-Info "Enabling Corepack..."
corepack enable

if ((-not (Test-Path ".env")) -and (Test-Path ".env.example")) {
  Write-Info "Creating .env from .env.example..."
  Copy-Item ".env.example" ".env"
} elseif (Test-Path ".env") {
  Write-Info ".env already exists; leaving it unchanged."
} else {
  Write-Warn ".env.example is missing, so no .env file was created."
}

Write-Info "Ensuring local data directory exists..."
New-Item -ItemType Directory -Force -Path "data" | Out-Null

Write-Info "Installing dependencies with pnpm..."
corepack pnpm install

Write-Info "Setup complete. Start the app with: corepack pnpm dev"
