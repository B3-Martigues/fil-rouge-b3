param(
    [switch]$SkipSeed
)

$ErrorActionPreference = "Stop"

$RepoRoot = Split-Path -Parent $MyInvocation.MyCommand.Path
$BackendDir = Join-Path $RepoRoot "backend"
$SetupScript = Join-Path $BackendDir "scripts\setup-local-db.ps1"

Write-Host "Preparing local PostgreSQL database..."

if ($SkipSeed) {
    & $SetupScript -SkipSeed
} else {
    & $SetupScript
}

Write-Host ""
Write-Host "Starting backend API..."

Push-Location $BackendDir
try {
    go run ./cmd/api
} finally {
    Pop-Location
}
