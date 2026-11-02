# Обновление версии и подготовка релиза.
#
#   .\scripts\release.ps1 -Version 3.7            # поднять версию и собрать
#   .\scripts\release.ps1 -Version 3.7 -Tag       # + создать локальный тег
#   .\scripts\release.ps1 -Version 3.7 -Tag -Push # + отправить (делает релиз на GitHub)
#
# Ветка с тегом v3.7 запускает .github/workflows/release.yml: сборка на
# windows-latest и публикация WCS-3.7.exe в GitHub Releases.

param(
    [Parameter(Mandatory = $true)]
    [string]$Version,

    [switch]$Tag,
    [switch]$Push
)

$ErrorActionPreference = 'Stop'
$root = Split-Path -Parent $PSScriptRoot

if ($Version -notmatch '^\d+\.\d+$') {
    throw "Версия должна быть в формате MAJOR.MINOR, например 3.7"
}

$parts = $Version.Split('.')
$major = [int]$parts[0]
$minor = [int]$parts[1]

# 1. app_version.h
$verPath = Join-Path $root 'src\app_version.h'
$verText = Get-Content $verPath -Raw
$verText = $verText -replace '#define WCS_VERSION_MAJOR \d+', "#define WCS_VERSION_MAJOR $major"
$verText = $verText -replace '#define WCS_VERSION_MINOR \d+', "#define WCS_VERSION_MINOR $minor"
Set-Content -Path $verPath -Value $verText -NoNewline -Encoding UTF8
Write-Host "app_version.h -> $Version"

# 2. CMakeLists.txt (project VERSION)
$cmakePath = Join-Path $root 'CMakeLists.txt'
$cmakeText = Get-Content $cmakePath -Raw
$cmakeText = $cmakeText -replace 'project\(WindowsConfigStudio VERSION [\d.]+', "project(WindowsConfigStudio VERSION $Version"
Set-Content -Path $cmakePath -Value $cmakeText -NoNewline -Encoding UTF8
Write-Host "CMakeLists.txt -> $Version"

# 3. Сборка
Push-Location $root
try {
    & (Join-Path $root 'build_project.bat')
    if ($LASTEXITCODE -ne 0) { throw "Сборка завершилась с кодом $LASTEXITCODE" }
}
finally {
    Pop-Location
}

if (-not $Tag) {
    Write-Host "Версия $Version собрана. Тег не создан (запустите с -Tag)."
    return
}

Push-Location $root
try {
    git add -A
    git commit -m "Release $Version"
    git tag "v$Version"

    if ($Push) {
        git push origin HEAD
        git push origin "v$Version"
        Write-Host "Тег v$Version отправлен. GitHub Actions соберёт релиз."
    }
    else {
        Write-Host "Тег v$Version создан локально. Отправка: git push origin HEAD --tags"
    }
}
finally {
    Pop-Location
}