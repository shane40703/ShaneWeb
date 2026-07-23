$subjects = [ordered]@{
    "regulations" = 80
    "construction" = 80
    "environment" = 40
    "structure" = 40
}

$questionsRoot = Join-Path $PSScriptRoot "QuestionInfo"

for ($year = 102; $year -le 114; $year++) {
    $yearPath = Join-Path $questionsRoot $year

    foreach ($subjectName in $subjects.Keys) {
        $questionCount = $subjects[$subjectName]
        $subjectPath = Join-Path $yearPath $subjectName

        for ($i = 1; $i -le $questionCount; $i++) {
            $questionNumber = $i.ToString("000")
            $questionPath = Join-Path $subjectPath $questionNumber
            $imagePath = Join-Path $questionPath "images"
            $questionFile = Join-Path $questionPath "question.txt"
            $gitkeepFile = Join-Path $imagePath ".gitkeep"

            New-Item -ItemType Directory -Path $imagePath -Force | Out-Null

            if (-not (Test-Path $questionFile)) {
                New-Item -ItemType File -Path $questionFile | Out-Null
            }

            if (-not (Test-Path $gitkeepFile)) {
                New-Item -ItemType File -Path $gitkeepFile | Out-Null
            }
        }

        Write-Host "Created year $year / $subjectName : $questionCount questions"
    }
}

Write-Host ""
Write-Host "Done. Created folders for years 102 to 114."
Write-Host "Total questions: 3120"