param(
    [switch]$SkipSeed
)

$ErrorActionPreference = "Stop"

$RepoRoot = Resolve-Path (Join-Path $PSScriptRoot "..\..")
$BackendDir = Join-Path $RepoRoot "backend"
$EnvExample = Join-Path $BackendDir ".env.example"
$EnvLocal = Join-Path $BackendDir ".env.local"
$SeedFile = Join-Path $BackendDir "scripts\seed-local-admin.sql"

function Assert-CommandAvailable {
    param(
        [string]$CommandName,
        [string]$InstallHint
    )

    if (-not (Get-Command $CommandName -ErrorAction SilentlyContinue)) {
        throw "$CommandName is required. $InstallHint"
    }
}

function Assert-LastExitCode {
    param(
        [string]$StepName
    )

    if ($LASTEXITCODE -ne 0) {
        throw "$StepName failed with exit code $LASTEXITCODE"
    }
}

Assert-CommandAvailable "docker" "Install Docker Desktop, then reopen this terminal."
Assert-CommandAvailable "go" "Install Go 1.25, then reopen this terminal."

if (-not (Test-Path $EnvLocal)) {
    Copy-Item $EnvExample $EnvLocal
    Write-Host "Created backend\.env.local from backend\.env.example"
} else {
    Write-Host "backend\.env.local already exists"
}

Push-Location $RepoRoot
try {
    docker compose up -d postgres
    Assert-LastExitCode "docker compose up"
} finally {
    Pop-Location
}

Write-Host "Waiting for PostgreSQL to be healthy..."
$Deadline = (Get-Date).AddSeconds(60)
do {
    $Status = docker inspect --format "{{.State.Health.Status}}" mappening-postgres 2>$null
    if ($Status -eq "healthy") {
        break
    }

    if ((Get-Date) -gt $Deadline) {
        throw "PostgreSQL did not become healthy within 60 seconds. Current status: $Status"
    }

    Start-Sleep -Seconds 2
} while ($true)

Push-Location $BackendDir
try {
    go run ./cmd/migrate
    Assert-LastExitCode "go run ./cmd/migrate"
} finally {
    Pop-Location
}

if (-not $SkipSeed) {
    Get-Content -Raw $SeedFile | docker exec -i mappening-postgres psql "postgres://mappening_migrator:mappening_migrator_password@localhost:5432/mappening?sslmode=disable"
    Assert-LastExitCode "seed local admin"
}

Write-Host ""
Write-Host "Local database is ready."
Write-Host "pgAdmin app connection: localhost:55432 / mappening / mappening_user / mappening_app_password"
Write-Host "pgAdmin admin connection: localhost:55432 / postgres / postgres / postgres"
