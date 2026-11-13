[CmdletBinding()]
param(
    [string]$OutputDirectory = (Join-Path $env:USERPROFILE "LIFTELY-Backups")
)

$ErrorActionPreference = "Stop"

if ([string]::IsNullOrWhiteSpace($env:LIFTELY_DATABASE_URL)) {
    throw "LIFTELY_DATABASE_URL is missing. Set it in this PowerShell process without pasting it into a ticket or chat."
}

$pgDump = Get-Command pg_dump -ErrorAction Stop
$pgRestore = Get-Command pg_restore -ErrorAction Stop
$sevenZip = Get-Command 7z -ErrorAction Stop

$versionText = (& $pgDump.Source --version | Out-String).Trim()
if ($versionText -notmatch "([0-9]+)\.") {
    throw "Cannot determine pg_dump version: $versionText"
}
if ([int]$Matches[1] -lt 17) {
    throw "pg_dump 17 or newer is required for the PostgreSQL 17 production database. Found: $versionText"
}

$repoRoot = [System.IO.Path]::GetFullPath((Join-Path $PSScriptRoot "..")).TrimEnd("\", "/")
$target = [System.IO.Path]::GetFullPath($OutputDirectory)
if ($target.Equals($repoRoot, [System.StringComparison]::OrdinalIgnoreCase) -or
    $target.StartsWith($repoRoot + [System.IO.Path]::DirectorySeparatorChar, [System.StringComparison]::OrdinalIgnoreCase)) {
    throw "Backup output must be outside the Git repository. Choose a private folder under your user profile."
}

$uri = [System.Uri]::new($env:LIFTELY_DATABASE_URL)
if ($uri.Scheme -notin @("postgres", "postgresql")) {
    throw "LIFTELY_DATABASE_URL must be a PostgreSQL URI."
}
$userParts = $uri.UserInfo.Split(":", 2)
if ($userParts.Count -ne 2) {
    throw "The PostgreSQL URI must contain a username and password."
}

New-Item -ItemType Directory -Force -Path $target | Out-Null
$stamp = Get-Date -Format "yyyyMMdd-HHmmss"
$tempDir = Join-Path ([System.IO.Path]::GetTempPath()) ("liftely-backup-" + [guid]::NewGuid().ToString("N"))
$dumpPath = Join-Path $tempDir "liftely.dump"
$archivePath = Join-Path $target "liftely-$stamp.7z"

New-Item -ItemType Directory -Path $tempDir | Out-Null

try {
    # Pass the password to child processes through libpq's environment, not command-line arguments.
    $env:PGHOST = $uri.Host
    $env:PGPORT = if ($uri.IsDefaultPort) { "5432" } else { [string]$uri.Port }
    $env:PGUSER = [System.Uri]::UnescapeDataString($userParts[0])
    $env:PGPASSWORD = [System.Uri]::UnescapeDataString($userParts[1])
    $env:PGDATABASE = [System.Uri]::UnescapeDataString($uri.AbsolutePath.TrimStart("/"))
    $env:PGSSLMODE = "require"

    Write-Host "Creating PostgreSQL custom-format dump..."
    & $pgDump.Source --format=custom --no-owner --no-acl --no-password --file $dumpPath
    if ($LASTEXITCODE -ne 0 -or -not (Test-Path $dumpPath)) {
        throw "pg_dump failed (exit code $LASTEXITCODE)."
    }

    Write-Host "Checking dump readability..."
    & $pgRestore.Source --list $dumpPath | Out-Null
    if ($LASTEXITCODE -ne 0) {
        throw "pg_restore could not read the dump."
    }

    Write-Host "7-Zip will prompt for a strong archive password. Keep it separately from the archive."
    & $sevenZip.Source a -t7z -mhe=on -p $archivePath $dumpPath
    if ($LASTEXITCODE -ne 0 -or -not (Test-Path $archivePath)) {
        throw "Encrypted archive creation failed (exit code $LASTEXITCODE)."
    }

    Write-Host "Verifying encrypted archive. 7-Zip will prompt for the password again."
    & $sevenZip.Source t -p $archivePath
    if ($LASTEXITCODE -ne 0) {
        throw "Encrypted archive verification failed."
    }

    Remove-Item -LiteralPath $dumpPath -Force
    Write-Host "Backup created and verified: $archivePath"
    Write-Host "Copy this encrypted archive to private off-site storage. Do not commit it to Git."
}
finally {
    Remove-Item Env:PGPASSWORD -ErrorAction SilentlyContinue
    Remove-Item Env:PGHOST -ErrorAction SilentlyContinue
    Remove-Item Env:PGPORT -ErrorAction SilentlyContinue
    Remove-Item Env:PGUSER -ErrorAction SilentlyContinue
    Remove-Item Env:PGDATABASE -ErrorAction SilentlyContinue
    Remove-Item Env:PGSSLMODE -ErrorAction SilentlyContinue
    if (Test-Path $tempDir) {
        Remove-Item -LiteralPath $tempDir -Recurse -Force
    }
}
