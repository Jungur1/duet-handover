# PowerShell UTF-8 Security Build & Verification Script
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8
$ErrorActionPreference = "Stop"

$rootDir = Split-Path -Parent $PSScriptRoot
$publicDir = Join-Path $rootDir "public"
$backupDir = Join-Path $rootDir "backup_local"

Write-Host "============================================================" -ForegroundColor Cyan
Write-Host " [1/2] Building clean static bundle in public/ ..." -ForegroundColor Yellow
Write-Host "============================================================" -ForegroundColor Cyan

if (-not (Test-Path $backupDir)) {
    New-Item -ItemType Directory -Path $backupDir -Force | Out-Null
}

foreach ($f in @("data.js", "sections_data.js", "config.local.js")) {
    $src = Join-Path $rootDir "js\$f"
    if (Test-Path $src) {
        Copy-Item $src (Join-Path $backupDir $f) -Force
    }
}

if (Test-Path $publicDir) {
    Remove-Item $publicDir -Recurse -Force
}
New-Item -ItemType Directory -Path (Join-Path $publicDir "js") -Force | Out-Null
New-Item -ItemType Directory -Path (Join-Path $publicDir "css") -Force | Out-Null

Copy-Item (Join-Path $rootDir "index.html") (Join-Path $publicDir "index.html") -Force
Copy-Item (Join-Path $rootDir "robots.txt") (Join-Path $publicDir "robots.txt") -Force
Copy-Item (Join-Path $rootDir ".nojekyll") (Join-Path $publicDir ".nojekyll") -Force
Copy-Item (Join-Path $rootDir "css\style.css") (Join-Path $publicDir "css\style.css") -Force
Copy-Item (Join-Path $rootDir "js\app.js") (Join-Path $publicDir "js\app.js") -Force
Copy-Item (Join-Path $rootDir "js\firebase-config.js") (Join-Path $publicDir "js\firebase-config.js") -Force
Copy-Item (Join-Path $rootDir "assets") (Join-Path $publicDir "assets") -Recurse -Force

Write-Host "[OK] Built public/ directory (sensitive data files excluded)." -ForegroundColor Green

Write-Host "`n============================================================" -ForegroundColor Cyan
Write-Host " [2/2] Running Security Integrity Verification ..." -ForegroundColor Yellow
Write-Host "============================================================" -ForegroundColor Cyan

$failed = $false

# 1. Check forbidden files in public/
$forbiddenFiles = @("js\data.js", "js\sections_data.js", "js\config.local.js", ".env")
foreach ($rel in $forbiddenFiles) {
    $target = Join-Path $publicDir $rel
    if (Test-Path $target) {
        Write-Host "[FAIL] Forbidden file present in public/: $rel" -ForegroundColor Red
        $failed = $true
    } else {
        Write-Host "[PASS] Excluded from public/: $rel" -ForegroundColor Green
    }
}

# 2. Scan public/ HTML & JS files for leaked secrets / phone numbers / drive URLs / password comments
$forbiddenPatterns = @(
    @{ Name = "Hardcoded RBAC_SALT"; Pattern = "duet_rbac_salt_2026_" },
    @{ Name = "Plaintext password comment (duet18pres!)"; Pattern = "duet18pres!" },
    @{ Name = "Plaintext password comment (duet18head!)"; Pattern = "duet18head!" },
    @{ Name = "Plaintext password comment (duet19pres!)"; Pattern = "duet19pres!" },
    @{ Name = "Plaintext password comment (duet19head!)"; Pattern = "duet19head!" },
    @{ Name = "Confidential Drive Folder ID (fullArchive)"; Pattern = "1dVID6Wpjr1SBMLi9YLT8YweFGgUIOjdw" },
    @{ Name = "Confidential Drive Folder ID (googleForms)"; Pattern = "1f28UMiGSBPcXvv-VkQqwTwWB2OZMLxQa" },
    @{ Name = "Plaintext Phone Number Exposure"; Pattern = "010-3516-3561|010-2015-3344" },
    @{ Name = "Insecure sessionStorage Role Bypass"; Pattern = "sessionStorage\.getItem\(SESSION_ROLE_KEY\)" }
)

$scanTargets = Get-ChildItem -Path $publicDir -Include *.html, *.js, *.mjs, *.json -Recurse
foreach ($file in $scanTargets) {
    $text = [System.IO.File]::ReadAllText($file.FullName, [System.Text.Encoding]::UTF8)
    foreach ($pat in $forbiddenPatterns) {
        if ($text -match $pat.Pattern) {
            Write-Host "[FAIL] Found $($pat.Name) in $($file.FullName)" -ForegroundColor Red
            $failed = $true
        }
    }
}

if (-not $failed) {
    Write-Host "[PASS] Zero sensitive strings (passwords, hashes, phone numbers, drive IDs, sessionStorage bypass) in public/ bundle." -ForegroundColor Green
}

# 3. Verify netlify.toml & firestore.rules
$tomlPath = Join-Path $rootDir "netlify.toml"
$rulesPath = Join-Path $rootDir "firestore.rules"

if ((Test-Path $tomlPath) -and ([System.IO.File]::ReadAllText($tomlPath) -match "Content-Security-Policy")) {
    Write-Host "[PASS] netlify.toml security headers verified." -ForegroundColor Green
} else {
    Write-Host "[FAIL] netlify.toml missing or incomplete." -ForegroundColor Red
    $failed = $true
}

if ((Test-Path $rulesPath) -and ([System.IO.File]::ReadAllText($rulesPath) -match "request\.auth\.token\.role")) {
    Write-Host "[PASS] firestore.rules RBAC Custom Claims rules verified." -ForegroundColor Green
} else {
    Write-Host "[FAIL] firestore.rules missing or incomplete." -ForegroundColor Red
    $failed = $true
}

if ($failed) {
    exit 1
} else {
    Write-Host "`nAll security checks passed!" -ForegroundColor Cyan
}
