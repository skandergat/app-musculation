while ($true) {

    $changes = git status --porcelain

    if ($changes) {

        git add -A

        $date = Get-Date -Format "yyyy-MM-dd HH:mm:ss"

        git commit -m "Auto-save $date"

        git push
    }

    Start-Sleep -Seconds 30
}