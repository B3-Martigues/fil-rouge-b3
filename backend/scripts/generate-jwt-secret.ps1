param(
    [int]$Bytes = 32
)

if ($Bytes -lt 32) {
    throw "Bytes must be at least 32."
}

$buffer = New-Object byte[] $Bytes
$rng = [System.Security.Cryptography.RandomNumberGenerator]::Create()
try {
    $rng.GetBytes($buffer)
} finally {
    if ($null -ne $rng) {
        $rng.Dispose()
    }
}

$hex = [System.BitConverter]::ToString($buffer).Replace("-", "").ToLowerInvariant()
Write-Output $hex
