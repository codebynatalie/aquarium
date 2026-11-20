# Builds DoodleAquarium.exe with the C# compiler that ships with Windows.
# Usage:  powershell -ExecutionPolicy Bypass -File build.ps1 [-Shortcuts]
param([switch]$Shortcuts)

$ErrorActionPreference = 'Stop'
$root = $PSScriptRoot
Add-Type -AssemblyName System.Drawing

# ---------- icon (a little doodle fish) ----------
function New-FishBitmap([int]$size) {
    $bmp = New-Object System.Drawing.Bitmap $size, $size
    $g = [System.Drawing.Graphics]::FromImage($bmp)
    $g.SmoothingMode = 'AntiAlias'
    $s = $size / 256.0
    $bg = New-Object System.Drawing.Drawing2D.LinearGradientBrush (New-Object System.Drawing.Point 0, 0), (New-Object System.Drawing.Point 0, $size), ([System.Drawing.Color]::FromArgb(255, 64, 196, 230)), ([System.Drawing.Color]::FromArgb(255, 14, 70, 140))
    $path = New-Object System.Drawing.Drawing2D.GraphicsPath
    $r = 56 * $s
    $path.AddArc(0, 0, $r, $r, 180, 90); $path.AddArc($size - $r - 1, 0, $r, $r, 270, 90)
    $path.AddArc($size - $r - 1, $size - $r - 1, $r, $r, 0, 90); $path.AddArc(0, $size - $r - 1, $r, $r, 90, 90)
    $path.CloseFigure()
    $g.FillPath($bg, $path)
    $orange = New-Object System.Drawing.SolidBrush ([System.Drawing.Color]::FromArgb(255, 255, 140, 40))
    $outline = New-Object System.Drawing.Pen ([System.Drawing.Color]::FromArgb(255, 60, 30, 20)), ([single](9 * $s))
    $outline.LineJoin = 'Round'
    # tail
    $tail = [System.Drawing.PointF[]]@(
        (New-Object System.Drawing.PointF ([single](70 * $s)), ([single](128 * $s))),
        (New-Object System.Drawing.PointF ([single](26 * $s)), ([single](78 * $s))),
        (New-Object System.Drawing.PointF ([single](34 * $s)), ([single](178 * $s))))
    $g.FillPolygon($orange, $tail); $g.DrawPolygon($outline, $tail)
    # body
    $g.FillEllipse($orange, [single](58 * $s), [single](70 * $s), [single](160 * $s), [single](116 * $s))
    $g.DrawEllipse($outline, [single](58 * $s), [single](70 * $s), [single](160 * $s), [single](116 * $s))
    # stripe
    $white = New-Object System.Drawing.SolidBrush ([System.Drawing.Color]::White)
    $g.FillEllipse($white, [single](118 * $s), [single](76 * $s), [single](26 * $s), [single](104 * $s))
    # eye
    $g.FillEllipse($white, [single](166 * $s), [single](100 * $s), [single](34 * $s), [single](34 * $s))
    $g.FillEllipse((New-Object System.Drawing.SolidBrush ([System.Drawing.Color]::FromArgb(255, 30, 20, 30))), [single](178 * $s), [single](108 * $s), [single](18 * $s), [single](20 * $s))
    # bubbles
    $bubblePen = New-Object System.Drawing.Pen ([System.Drawing.Color]::FromArgb(220, 255, 255, 255)), ([single](7 * $s))
    $g.DrawEllipse($bubblePen, [single](206 * $s), [single](52 * $s), [single](24 * $s), [single](24 * $s))
    $g.DrawEllipse($bubblePen, [single](190 * $s), [single](22 * $s), [single](16 * $s), [single](16 * $s))
    $g.Dispose()
    return $bmp
}

$assets = Join-Path $root 'assets'
New-Item -ItemType Directory -Force $assets | Out-Null
$sizes = 256, 48, 32, 16
$pngs = @()
foreach ($sz in $sizes) {
    $bmp = New-FishBitmap $sz
    $ms = New-Object System.IO.MemoryStream
    $bmp.Save($ms, [System.Drawing.Imaging.ImageFormat]::Png)
    $pngs += , $ms.ToArray()
    if ($sz -eq 256) { $bmp.Save((Join-Path $root 'web\img\icon.png'), [System.Drawing.Imaging.ImageFormat]::Png) }
    $bmp.Dispose()
}
$ico = New-Object System.IO.MemoryStream
$w = New-Object System.IO.BinaryWriter $ico
$w.Write([uint16]0); $w.Write([uint16]1); $w.Write([uint16]$sizes.Count)
$offset = 6 + 16 * $sizes.Count
for ($i = 0; $i -lt $sizes.Count; $i++) {
    $sz = $sizes[$i]; $b = if ($sz -ge 256) { 0 } else { $sz }
    $w.Write([byte]$b); $w.Write([byte]$b); $w.Write([byte]0); $w.Write([byte]0)
    $w.Write([uint16]1); $w.Write([uint16]32)
    $w.Write([uint32]$pngs[$i].Length); $w.Write([uint32]$offset)
    $offset += $pngs[$i].Length
}
foreach ($p in $pngs) { $w.Write($p) }
$w.Flush()
$icoPath = Join-Path $assets 'icon.ico'
[System.IO.File]::WriteAllBytes($icoPath, $ico.ToArray())

# ---------- compile ----------
$csc = Join-Path $env:WINDIR 'Microsoft.NET\Framework64\v4.0.30319\csc.exe'
if (-not (Test-Path $csc)) { $csc = Join-Path $env:WINDIR 'Microsoft.NET\Framework\v4.0.30319\csc.exe' }
$out = Join-Path $root 'DoodleAquarium.exe'
& $csc /nologo /target:winexe /optimize+ /platform:anycpu "/out:$out" "/win32icon:$icoPath" `
    /r:System.dll /r:System.Drawing.dll /r:System.Windows.Forms.dll /r:System.Core.dll `
    (Join-Path $root 'src\DoodleAquarium.cs')
if ($LASTEXITCODE -ne 0) { throw "Compile failed" }
Write-Host "Built $out"

# ---------- shortcuts ----------
if ($Shortcuts) {
    $shell = New-Object -ComObject WScript.Shell
    $targets = @(
        (Join-Path ([Environment]::GetFolderPath('Desktop')) 'Doodle Aquarium.lnk'),
        (Join-Path ([Environment]::GetFolderPath('Programs')) 'Doodle Aquarium.lnk'))
    foreach ($t in $targets) {
        $lnk = $shell.CreateShortcut($t)
        $lnk.TargetPath = $out
        $lnk.WorkingDirectory = $root
        $lnk.IconLocation = "$out,0"
        $lnk.Description = 'Build your own aquarium and bring your drawings to life'
        $lnk.Save()
        Write-Host "Shortcut: $t"
    }
}
