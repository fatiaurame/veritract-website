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
$prefix = "http://localhost:$Port/"
$listener.Prefixes.Add($prefix)

try {
    $listener.Start()
} catch {
    Write-Error "Failed to start listener on $prefix : $_"
    exit 1
}

Write-Host "==============================================="
Write-Host " VeriTract Local Server running at:"
Write-Host " http://localhost:$Port/"
Write-Host " Serving files from: $Root"
Write-Host "==============================================="

while ($listener.IsListening) {
    try {
        $context = $listener.GetContext()
    } catch {
        break
    }

    try {
        $req = $context.Request
        $res = $context.Response

        # CORS headers
        $res.AddHeader("Access-Control-Allow-Origin", "*")
        $res.AddHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
        $res.AddHeader("Access-Control-Allow-Headers", "Content-Type, Authorization")

        if ($req.HttpMethod -eq "OPTIONS") {
            $res.StatusCode = 204
            $res.Close()
            continue
        }

        $rawUrl = $req.Url.AbsolutePath
        $decodedUrl = [System.Uri]::UnescapeDataString($rawUrl)

        # Handle API endpoints
        if ($decodedUrl -eq "/api/health") {
            $res.StatusCode = 200
            $res.ContentType = "application/json; charset=utf-8"
            $json = '{"status":"ok","timestamp":"' + (Get-Date -Format "yyyy-MM-ddTHH:mm:ssZ") + '","mailerConfigured":false}'
            $bytes = [System.Text.Encoding]::UTF8.GetBytes($json)
            $res.ContentLength64 = $bytes.Length
            $res.OutputStream.Write($bytes, 0, $bytes.Length)
            $res.Close()
            continue
        }

        if ($decodedUrl -eq "/api/contact" -and $req.HttpMethod -eq "POST") {
            $res.StatusCode = 200
            $res.ContentType = "application/json; charset=utf-8"
            $json = '{"success":true,"message":"Thank you! Your inquiry has been received."}'
            $bytes = [System.Text.Encoding]::UTF8.GetBytes($json)
            $res.ContentLength64 = $bytes.Length
            $res.OutputStream.Write($bytes, 0, $bytes.Length)
            $res.Close()
            continue
        }

        # Resolve local file path
        $relPath = $decodedUrl.TrimStart('/')
        if ([string]::IsNullOrEmpty($relPath) -or $relPath -eq "/") {
            $relPath = "index.html"
        }

        $targetFile = Join-Path $Root ($relPath -replace '/', '\')

        # Clean URL fallback: e.g. /about -> about.html
        if (-not (Test-Path -Path $targetFile -PathType Leaf)) {
            $htmlCandidate = "$targetFile.html"
            if (Test-Path -Path $htmlCandidate -PathType Leaf) {
                $targetFile = $htmlCandidate
            }
        }

        # If it's a directory, look for index.html
        if (Test-Path -Path $targetFile -PathType Container) {
            $dirIndex = Join-Path $targetFile "index.html"
            if (Test-Path -Path $dirIndex -PathType Leaf) {
                $targetFile = $dirIndex
            }
        }

        if (Test-Path -Path $targetFile -PathType Leaf) {
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
        } else {
            # 404 Handler
            $notFoundFile = Join-Path $Root "404.html"
            $res.StatusCode = 404
            if (Test-Path -Path $notFoundFile -PathType Leaf) {
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
