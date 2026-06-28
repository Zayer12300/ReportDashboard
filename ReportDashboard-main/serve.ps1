param([int]$Port = 8080)

$root = [IO.Path]::GetFullPath($PSScriptRoot)
$mimeTypes = @{
  '.html' = 'text/html; charset=utf-8'
  '.css'  = 'text/css; charset=utf-8'
  '.js'   = 'text/javascript; charset=utf-8'
  '.json' = 'application/json; charset=utf-8'
  '.svg'  = 'image/svg+xml'
  '.png'  = 'image/png'
  '.ico'  = 'image/x-icon'
}

$listener = [Net.Sockets.TcpListener]::new([Net.IPAddress]::Loopback, $Port)
$listener.Start()
Write-Host "ASMO Procurement Dashboard: http://localhost:$Port"
Write-Host 'Press Ctrl+C to stop.'

try {
  while ($true) {
    $client = $listener.AcceptTcpClient()
    try {
      $stream = $client.GetStream()
      $reader = [IO.StreamReader]::new($stream, [Text.Encoding]::ASCII, $false, 1024, $true)
      $request = $reader.ReadLine()
      while ($reader.ReadLine()) { }

      $parts = $request -split ' '
      $urlPath = if ($parts.Length -ge 2) { ($parts[1] -split '\?')[0] } else { '/' }
      $urlPath = [Uri]::UnescapeDataString($urlPath)
      if ($urlPath -eq '/') { $urlPath = '/index.html' }

      $relative = $urlPath.TrimStart('/').Replace('/', [IO.Path]::DirectorySeparatorChar)
      $candidate = [IO.Path]::GetFullPath((Join-Path $root $relative))
      $allowed = $candidate.StartsWith($root, [StringComparison]::OrdinalIgnoreCase)

      if ($allowed -and (Test-Path -LiteralPath $candidate -PathType Leaf)) {
        $body = [IO.File]::ReadAllBytes($candidate)
        $extension = [IO.Path]::GetExtension($candidate).ToLowerInvariant()
        $contentType = if ($mimeTypes.ContainsKey($extension)) { $mimeTypes[$extension] } else { 'application/octet-stream' }
        $status = '200 OK'
      } else {
        $body = [Text.Encoding]::UTF8.GetBytes('404 Not Found')
        $contentType = 'text/plain; charset=utf-8'
        $status = '404 Not Found'
      }

      $headers = "HTTP/1.1 $status`r`nContent-Type: $contentType`r`nContent-Length: $($body.Length)`r`nConnection: close`r`nCache-Control: no-store`r`n`r`n"
      $headerBytes = [Text.Encoding]::ASCII.GetBytes($headers)
      $stream.Write($headerBytes, 0, $headerBytes.Length)
      $stream.Write($body, 0, $body.Length)
      $stream.Flush()
    } finally {
      $client.Close()
    }
  }
} finally {
  $listener.Stop()
}
