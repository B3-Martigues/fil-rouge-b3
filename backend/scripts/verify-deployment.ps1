param(
    [Parameter(Mandatory = $true)]
    [string]$BaseUrl
)

$ErrorActionPreference = "Stop"

function Assert-True {
    param(
        [bool]$Condition,
        [string]$Message
    )

    if (-not $Condition) {
        throw $Message
    }
}

function Assert-HeaderPresent {
    param(
        $Headers,
        [string]$Name
    )

    $value = $Headers[$Name]
    Assert-True (-not [string]::IsNullOrWhiteSpace($value)) "Missing header: $Name"
}

$parsedBaseUrl = [Uri]$BaseUrl
Assert-True ($parsedBaseUrl.Scheme -eq "https") "BaseUrl must use https."

Write-Host "Checking API health on $BaseUrl ..."
$healthResponse = Invoke-WebRequest -Uri ($BaseUrl.TrimEnd("/") + "/api/health") -UseBasicParsing
Assert-True ($healthResponse.StatusCode -eq 200) "Healthcheck did not return HTTP 200."

Write-Host "Checking frontend shell ..."
$frontendResponse = Invoke-WebRequest -Uri ($BaseUrl.TrimEnd("/") + "/") -UseBasicParsing
Assert-True ($frontendResponse.StatusCode -eq 200) "Frontend did not return HTTP 200."
Assert-True ($frontendResponse.Content -like "*manifest.webmanifest*") "Frontend does not reference the PWA manifest."

Write-Host "Checking PWA manifest ..."
$manifestResponse = Invoke-WebRequest -Uri ($BaseUrl.TrimEnd("/") + "/manifest.webmanifest") -UseBasicParsing
Assert-True ($manifestResponse.StatusCode -eq 200) "PWA manifest did not return HTTP 200."

Write-Host "Checking service worker cache policy ..."
$serviceWorkerResponse = Invoke-WebRequest -Uri ($BaseUrl.TrimEnd("/") + "/sw.js") -UseBasicParsing
Assert-True ($serviceWorkerResponse.StatusCode -eq 200) "Service worker did not return HTTP 200."
Assert-True ($serviceWorkerResponse.Headers["Cache-Control"] -like "*no-cache*") "Service worker must be served with Cache-Control containing no-cache."

Write-Host "Checking security headers ..."
Assert-HeaderPresent $healthResponse.Headers "Content-Security-Policy"
Assert-HeaderPresent $healthResponse.Headers "X-Content-Type-Options"
Assert-HeaderPresent $healthResponse.Headers "X-Frame-Options"
Assert-HeaderPresent $healthResponse.Headers "Referrer-Policy"
Assert-HeaderPresent $healthResponse.Headers "Permissions-Policy"
Assert-HeaderPresent $healthResponse.Headers "Strict-Transport-Security"

$httpUrl = "http://" + $parsedBaseUrl.Authority + "/api/health"
Write-Host "Checking HTTP to HTTPS redirect on $httpUrl ..."

$redirectOk = $false
try {
    Invoke-WebRequest -Uri $httpUrl -MaximumRedirection 0 -UseBasicParsing | Out-Null
} catch {
    $response = $_.Exception.Response
    if ($null -ne $response) {
        $statusCode = [int]$response.StatusCode
        $location = $response.Headers["Location"]
        if (($statusCode -eq 301 -or $statusCode -eq 302 -or $statusCode -eq 308) -and ($location -like "https://*")) {
            $redirectOk = $true
        }
    }
}

Assert-True $redirectOk "HTTP endpoint does not redirect cleanly to HTTPS."

Write-Host "Deployment checks passed."
