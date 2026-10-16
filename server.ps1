param(
    [int]$Port = 8080,
    [string]$Root = ""
)

$ErrorActionPreference = "Continue"

if ([string]::IsNullOrEmpty($Root)) {
    $Root = $PSScriptRoot
}

$mimeTypes = @{
    ".html" = "text/html; charset=utf-8"
    ".htm"  = "text/html; charset=utf-8"
    ".css"  = "text/css; charset=utf-8"
    ".js"   = "application/javascript; charset=utf-8"
    ".json" = "application/json; charset=utf-8"
    ".svg"  = "image/svg+xml"
    ".png"  = "image/png"
    ".jpg"  = "image/jpeg"
    ".jpeg" = "image/jpeg"
    ".gif"  = "image/gif"
    ".ico"  = "image/x-icon"
    ".webp" = "image/webp"
    ".woff" = "font/woff"
    ".woff2"= "font/woff2"
    ".ttf"  = "font/ttf"
    ".txt"  = "text/plain; charset=utf-8"
    ".xml"  = "application/xml"
    ".docx" = "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
}

$listener = New-Object System.Net.HttpListener
$listener.Prefixes.Add("http://localhost:$Port/")
$listener.Prefixes.Add("http://127.0.0.1:$Port/")

try {
    $listener.Start()
} catch {
    Write-Error "Failed to start listener on port $Port : $_"
    exit 1
}

Write-Host "===============================================" -ForegroundColor Cyan
Write-Host " VeriTract Local Server running at:" -ForegroundColor Green
Write-Host " 👉 http://localhost:$Port/" -ForegroundColor Yellow
Write-Host " 👉 http://127.0.0.1:$Port/" -ForegroundColor Yellow
Write-Host " Serving files from: $Root" -ForegroundColor Gray
Write-Host "===============================================" -ForegroundColor Cyan

while ($listener.IsListening) {
    try {
        $context = $listener.GetContext()
    } catch {
        break
    }

    try {
        $req = $context.Request
        $res = $context.Response

        # CORS & Cache headers
        $res.AddHeader("Access-Control-Allow-Origin", "*")
        $res.AddHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
        $res.AddHeader("Access-Control-Allow-Headers", "Content-Type, Authorization")
        $res.AddHeader("Cache-Control", "no-cache, no-store, must-revalidate")

        if ($req.HttpMethod -eq "OPTIONS") {
            $res.StatusCode = 204
            $res.Close()
            continue
        }

        $rawUrl = $req.Url.AbsolutePath
        $decodedUrl = [System.Uri]::UnescapeDataString($rawUrl)

        # Normalize URL: strip redundant folder prefix if present
        $cleanUrl = $decodedUrl -replace '^/veritract\.website-main', ''
        if ([string]::IsNullOrEmpty($cleanUrl) -or $cleanUrl -eq "/") {
            $cleanUrl = "/index.html"
        }

        # API Endpoints
        if ($cleanUrl -eq "/api/health") {
            $res.StatusCode = 200
            $res.ContentType = "application/json; charset=utf-8"
            $json = '{"status":"ok","timestamp":"' + (Get-Date -Format "yyyy-MM-ddTHH:mm:ssZ") + '","mailerConfigured":false}'
            $bytes = [System.Text.Encoding]::UTF8.GetBytes($json)
            $res.ContentLength64 = $bytes.Length
            $res.OutputStream.Write($bytes, 0, $bytes.Length)
            $res.Close()
            continue
        }

        if ($cleanUrl -eq "/api/contact" -and $req.HttpMethod -eq "POST") {
            $res.StatusCode = 200
            $res.ContentType = "application/json; charset=utf-8"
            $json = '{"success":true,"message":"Thank you! Your inquiry has been received."}'
            $bytes = [System.Text.Encoding]::UTF8.GetBytes($json)
            $res.ContentLength64 = $bytes.Length
            $res.OutputStream.Write($bytes, 0, $bytes.Length)
            $res.Close()
            continue
        }

        # File path resolution
        $rel = $cleanUrl.TrimStart('/')
        $candidates = @(
            (Join-Path $Root ($rel -replace '/', '\')),
            (Join-Path $Root "veritract.website-main\$($rel -replace '/', '\')"),
            (Join-Path $PSScriptRoot ($rel -replace '/', '\')),
            (Join-Path $PSScriptRoot "veritract.website-main\$($rel -replace '/', '\')")
        )

        $targetFile = $null
        foreach ($c in $candidates) {
            if (Test-Path -Path $c -PathType Leaf) {
                $targetFile = $c
                break
            }
            # Clean URL fallback (.html)
            $htmlCandidate = "$c.html"
            if (Test-Path -Path $htmlCandidate -PathType Leaf) {
                $targetFile = $htmlCandidate
                break
            }
            # Directory index
            if (Test-Path -Path $c -PathType Container) {
                $idx = Join-Path $c "index.html"
                if (Test-Path -Path $idx -PathType Leaf) {
                    $targetFile = $idx
                    break
                }
            }
        }

        if ($targetFile -and (Test-Path -Path $targetFile -PathType Leaf)) {
            $ext = [System.IO.Path]::GetExtension($targetFile).ToLowerInvariant()
            $mime = "application/octet-stream"
            if ($mimeTypes.ContainsKey($ext)) {
                $mime = $mimeTypes[$ext]
            }

            $fileBytes = [System.IO.File]::ReadAllBytes($targetFile)
            $res.StatusCode = 200
            $res.ContentType = $mime
            $res.ContentLength64 = $fileBytes.Length
            $res.OutputStream.Write($fileBytes, 0, $fileBytes.Length)
            Write-Host "[200] $rawUrl -> $([System.IO.Path]::GetFileName($targetFile)) ($mime)" -ForegroundColor Green
        } else {
            # 404
            Write-Host "[404] $rawUrl" -ForegroundColor Red
            $notFoundCandidates = @(
                (Join-Path $Root "404.html"),
                (Join-Path $Root "veritract.website-main\404.html")
            )
            $notFoundFile = $notFoundCandidates | Where-Object { Test-Path $_ -PathType Leaf } | Select-Object -First 1

            $res.StatusCode = 404
            if ($notFoundFile) {
                $fileBytes = [System.IO.File]::ReadAllBytes($notFoundFile)
                $res.ContentType = "text/html; charset=utf-8"
                $res.ContentLength64 = $fileBytes.Length
                $res.OutputStream.Write($fileBytes, 0, $fileBytes.Length)
            } else {
                $res.ContentType = "text/plain; charset=utf-8"
                $bytes = [System.Text.Encoding]::UTF8.GetBytes("404 Not Found")
                $res.ContentLength64 = $bytes.Length
                $res.OutputStream.Write($bytes, 0, $bytes.Length)
            }
        }
    } catch {
        try {
            $context.Response.StatusCode = 500
        } catch {}
    } finally {
        try {
            $context.Response.Close()
        } catch {}
    }
}
