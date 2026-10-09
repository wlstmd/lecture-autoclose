$ErrorActionPreference = "Stop"
$root = $PSScriptRoot
$dist = Join-Path $root "dist"
$version = (Get-Content (Join-Path $root "extension\manifest.json") -Raw | ConvertFrom-Json).version
$ffVersion = (Get-Content (Join-Path $root "firefox\manifest.json") -Raw | ConvertFrom-Json).version
if ($version -ne $ffVersion) { throw "버전 불일치: extension=$version, firefox=$ffVersion" }

Remove-Item $dist -Recurse -Force -ErrorAction SilentlyContinue
New-Item -ItemType Directory -Force $dist | Out-Null

foreach ($target in "chrome", "firefox") {
  $dir = Join-Path $dist $target
  Copy-Item (Join-Path $root "extension") $dir -Recurse
  if ($target -eq "firefox") {
    Copy-Item (Join-Path $root "firefox\manifest.json") (Join-Path $dir "manifest.json") -Force
  }
  $zip = Join-Path $dist "kmu-lecture-auto-end-$target-$version.zip"
  tar -a -c -f $zip -C $dir *
  Write-Host "$target -> $zip"
}
