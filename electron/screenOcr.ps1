# FloatGPT Local Windows Native Screen OCR Engine
# Uses Windows.Media.Ocr (built into Windows 10 & 11)
# 0 Python dependencies, 0 cloud keys required, 100% offline & fast.
param([string]$ImagePath)

if (-not $ImagePath -or -not (Test-Path $ImagePath)) {
    Write-Output ""
    exit 0
}

try {
    Add-Type -AssemblyName System.Drawing -ErrorAction SilentlyContinue
    Add-Type -AssemblyName System.Runtime.WindowsRuntime -ErrorAction SilentlyContinue

    [Windows.Media.Ocr.OcrEngine, Windows.Foundation, ContentType = WindowsRuntime] | Out-Null
    [Windows.Graphics.Imaging.BitmapDecoder, Windows.Foundation, ContentType = WindowsRuntime] | Out-Null
    [Windows.Storage.StorageFile, Windows.Foundation, ContentType = WindowsRuntime] | Out-Null

    $asTaskGeneric = [System.WindowsRuntimeSystemExtensions].GetMethods() | Where-Object { 
        $_.Name -eq 'AsTask' -and $_.GetParameters().Count -eq 1 -and $_.IsGenericMethod 
    } | Select-Object -First 1

    function Await-WinRT($asyncOp, $type) {
        $method = $asTaskGeneric.MakeGenericMethod($type)
        $task = $method.Invoke($null, @($asyncOp))
        $task.Wait()
        return $task.Result
    }

    $absPath = [System.IO.Path]::GetFullPath($ImagePath)
    $file = Await-WinRT ([Windows.Storage.StorageFile]::GetFileFromPathAsync($absPath)) ([Windows.Storage.StorageFile])
    $stream = Await-WinRT ($file.OpenAsync([Windows.Storage.FileAccessMode]::Read)) ([Windows.Storage.Streams.IRandomAccessStream])
    $decoder = Await-WinRT ([Windows.Graphics.Imaging.BitmapDecoder]::CreateAsync($stream)) ([Windows.Graphics.Imaging.BitmapDecoder])
    $bitmap = Await-WinRT ($decoder.GetSoftwareBitmapAsync()) ([Windows.Graphics.Imaging.SoftwareBitmap])

    $ocr = [Windows.Media.Ocr.OcrEngine]::TryCreateFromUserProfileLanguages()
    if (-not $ocr) {
        $ocr = [Windows.Media.Ocr.OcrEngine]::TryCreateFromLanguage([Windows.Globalization.Language]::new("en-US"))
    }

    if ($ocr) {
        $result = Await-WinRT ($ocr.RecognizeAsync($bitmap)) ([Windows.Media.Ocr.OcrResult])
        if ($result -and $result.Text) {
            Write-Output $result.Text
            exit 0
        }
    }
    Write-Output ""
} catch {
    Write-Output ""
}
