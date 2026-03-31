# GitHub에 저장소를 만들고 현재 브랜치를 푸시합니다.
# 사용 전 같은 터미널에서: gh auth login
$ErrorActionPreference = 'Stop'
$root = Split-Path $PSScriptRoot -Parent
Set-Location $root

gh auth status *> $null
if ($LASTEXITCODE -ne 0) {
  Write-Host 'GitHub CLI에 로그인되어 있지 않습니다. 다음을 실행한 뒤 다시 시도하세요:' -ForegroundColor Yellow
  Write-Host '  gh auth login' -ForegroundColor Cyan
  exit 1
}

$repoName = if ($args[0]) { $args[0] } else { 'C_analysis' }
$visibility = if ($args[1] -eq 'private') { '--private' } else { '--public' }

git remote remove origin 2> $null
gh repo create $repoName $visibility --source=. --remote=origin --push
if ($LASTEXITCODE -ne 0) {
  $login = gh api user --jq .login 2> $null
  Write-Host ''
  Write-Host '저장소가 이미 있으면 원격만 맞춘 뒤 푸시하세요:' -ForegroundColor Yellow
  if ($login) {
    Write-Host "  git remote add origin https://github.com/$login/$repoName.git" -ForegroundColor Cyan
  }
  Write-Host '  git push -u origin main' -ForegroundColor Cyan
  exit $LASTEXITCODE
}

Write-Host '완료: GitHub에 푸시되었습니다.' -ForegroundColor Green
