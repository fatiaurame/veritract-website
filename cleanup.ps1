$cssPath = "c:\Sarmad Work\Agency\Website\assets\styles.css"
$content = [System.IO.File]::ReadAllText($cssPath)
$marker1 = ".pg-header"
$marker2 = "/* ================= STATS ================= */"
$startIdx = $content.IndexOf($marker1)
$endIdx = $content.IndexOf($marker2)
Write-Host "Start: $startIdx End: $endIdx"
if ($startIdx -gt 0 -and $endIdx -gt $startIdx) {
    $newContent = $content.Substring(0, $startIdx) + $content.Substring($endIdx)
    [System.IO.File]::WriteAllText($cssPath, $newContent)
    Write-Host "Done - removed old pg- CSS"
} else {
    Write-Host "Markers not found"
}
