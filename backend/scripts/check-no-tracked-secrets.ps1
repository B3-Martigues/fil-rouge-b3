$repoRoot = git rev-parse --show-toplevel
$trackedEnvFiles = git -C $repoRoot ls-files ".env*" "*.env*"

foreach ($path in $trackedEnvFiles) {
  if ($path -like "*.env.example" -or $path -eq ".env.example") {
    continue
  }

  Write-Error "Tracked environment file is not allowed: $path"
  Write-Error "Keep real environment files out of Git and document expected variables in .env.example."
  exit 1
}

$secretPatterns = @(
  @{ Name = "AWS access key"; Regex = "AKIA[0-9A-Z]{16}" },
  @{ Name = "Google API key"; Regex = "AIza[0-9A-Za-z\-_]{35}" },
  @{ Name = "GitHub classic token"; Regex = "ghp_[A-Za-z0-9_]{20,}" },
  @{ Name = "GitHub fine-grained token"; Regex = "github_pat_[A-Za-z0-9_]{20,}" },
  @{ Name = "OpenAI-style API key"; Regex = "sk-[A-Za-z0-9]{20,}" },
  @{ Name = "Brevo API key"; Regex = "xkeysib-[A-Za-z0-9_-]{20,}" },
  @{ Name = "Brevo SMTP key"; Regex = "xsmtpsib-[A-Za-z0-9_-]{20,}" },
  @{ Name = "private key"; Regex = "-----BEGIN (RSA|OPENSSH|EC|DSA|PRIVATE) KEY-----" },
  @{ Name = "Slack token"; Regex = "xox[baprs]-[A-Za-z0-9-]{20,}" }
)

$trackedFiles = git -C $repoRoot ls-files |
  Where-Object {
    $_ -notlike "*.sum" -and
    $_ -notlike "*.lock" -and
    $_ -notlike "backend/docs/postgres-production-bootstrap.sql.example"
  }

foreach ($file in $trackedFiles) {
  $fullPath = Join-Path $repoRoot $file
  if (-not (Test-Path -LiteralPath $fullPath -PathType Leaf)) {
    continue
  }

  $content = Get-Content -LiteralPath $fullPath -Raw -ErrorAction SilentlyContinue
  if ($null -eq $content) {
    continue
  }

  foreach ($pattern in $secretPatterns) {
    if ($content -match $pattern.Regex) {
      Write-Error "Potential tracked secret detected in $file ($($pattern.Name))."
      Write-Error "Remove the secret from Git and rotate it if it was real."
      exit 1
    }
  }
}
