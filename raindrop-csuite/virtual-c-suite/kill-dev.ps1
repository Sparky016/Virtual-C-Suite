$ports = 3000, 3001, 3002, 3003

foreach ($port in $ports) {
    $processes = Get-NetTCPConnection -LocalPort $port -ErrorAction SilentlyContinue
    if ($processes) {
        foreach ($proc in $processes) {
            try {
                $id = $proc.OwningProcess
                $processDetails = Get-Process -Id $id -ErrorAction SilentlyContinue
                if ($processDetails) {
                    Write-Host "Killing process $($processDetails.ProcessName) (PID: $id) on port $port"
                    Stop-Process -Id $id -Force -ErrorAction SilentlyContinue
                }
            }
            catch {
                Write-Host "Could not kill process on port $port"
            }
        }
    } else {
        Write-Host "No process found on port $port"
    }
}

Write-Host "Done."
