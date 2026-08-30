# 双方向マニュアル同期スクリプト (PowerShell 5.1 / 7+ 完全対応)
# ../SheepPress/contents/sheep-weave と ./manual/sheep-weave (または ./manuarl/sheep-weave) の内容を比較し、
# 更新日時が新しいファイルでお互いを上書き・同期します。

param (
    [string]$DirA = "..\SheepPress\contents\sheep-weave",
    [string]$DirB = ".\manual\sheep-weave"
)

$ErrorActionPreference = "Stop"

function Get-RelPath {
    param(
        [string]$BasePath,
        [string]$FullPath
    )
    $base = $BasePath.TrimEnd('\', '/') + '\'
    if ($FullPath.StartsWith($base, [System.StringComparison]::OrdinalIgnoreCase)) {
        return $FullPath.Substring($base.Length)
    }
    return $FullPath
}

# カレントディレクトリからプロジェクトルート (SheepWeave) を算出
$currentPath = (Get-Location).Path
if (-not (Test-Path (Join-Path $currentPath "package.json"))) {
    $currentPath = $PSScriptRoot
    if (Test-Path (Join-Path $currentPath "..\package.json")) {
        $currentPath = [System.IO.Path]::GetFullPath((Join-Path $currentPath ".."))
    }
}

# manuarl フォルダが存在する場合はそちらをデフォルト対象とする
if ($DirB -eq ".\manual\sheep-weave" -and (Test-Path (Join-Path $currentPath "manuarl\sheep-weave"))) {
    $DirB = ".\manuarl\sheep-weave"
}

$combinedA = [System.IO.Path]::Combine($currentPath, $DirA)
$combinedB = [System.IO.Path]::Combine($currentPath, $DirB)

$absA = [System.IO.Path]::GetFullPath($combinedA)
$absB = [System.IO.Path]::GetFullPath($combinedB)

# フォルダが存在しない場合は自動作成
if (-not (Test-Path -Path $absA)) { New-Item -ItemType Directory -Path $absA -Force | Out-Null }
if (-not (Test-Path -Path $absB)) { New-Item -ItemType Directory -Path $absB -Force | Out-Null }

Write-Host "=== SheepWeave Manual Sync ===" -ForegroundColor Cyan
Write-Host "Dir A (SheepPress) : $absA"
Write-Host "Dir B (SheepWeave) : $absB"
Write-Host "--------------------------------"

$syncedCount = 0

# 1. DirA -> DirB への同期（新規作成 or Aの方が新しい場合）
$filesA = @(Get-ChildItem -Path $absA -Recurse -File)
foreach ($fileA in $filesA) {
    $relPath = Get-RelPath -BasePath $absA -FullPath $fileA.FullName
    $targetB = Join-Path $absB $relPath

    if (-not (Test-Path -Path $targetB)) {
        $parentB = Split-Path $targetB -Parent
        if (-not (Test-Path -Path $parentB)) { New-Item -ItemType Directory -Path $parentB -Force | Out-Null }
        Copy-Item -Path $fileA.FullName -Destination $targetB -Force
        Write-Host "[New  A -> B] $relPath" -ForegroundColor Green
        $syncedCount++
    } else {
        $fileB = Get-Item -Path $targetB
        $timeB = $fileB.LastWriteTime.AddSeconds(1)
        if ($fileA.LastWriteTime -gt $timeB) {
            Copy-Item -Path $fileA.FullName -Destination $targetB -Force
            Write-Host "[Sync A -> B] $relPath (A is newer)" -ForegroundColor Yellow
            $syncedCount++
        }
    }
}

# 2. DirB -> DirA への同期（新規作成 or Bの方が新しい場合）
$filesB = @(Get-ChildItem -Path $absB -Recurse -File)
foreach ($fileB in $filesB) {
    $relPath = Get-RelPath -BasePath $absB -FullPath $fileB.FullName
    $targetA = Join-Path $absA $relPath

    if (-not (Test-Path -Path $targetA)) {
        $parentA = Split-Path $targetA -Parent
        if (-not (Test-Path -Path $parentA)) { New-Item -ItemType Directory -Path $parentA -Force | Out-Null }
        Copy-Item -Path $fileB.FullName -Destination $targetA -Force
        Write-Host "[New  B -> A] $relPath" -ForegroundColor Green
        $syncedCount++
    } else {
        $fileA = Get-Item -Path $targetA
        $timeA = $fileA.LastWriteTime.AddSeconds(1)
        if ($fileB.LastWriteTime -gt $timeA) {
            Copy-Item -Path $fileA.FullName -Destination $targetA -Force
            Write-Host "[Sync B -> A] $relPath (B is newer)" -ForegroundColor Yellow
            $syncedCount++
        }
    }
}

if ($syncedCount -eq 0) {
    Write-Host "Both directories are fully up to date." -ForegroundColor Gray
} else {
    Write-Host "Sync completed. $syncedCount file(s) updated/copied." -ForegroundColor Cyan
}
