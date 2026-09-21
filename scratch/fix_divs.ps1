$content = Get-Content -Path "src\pages\PublicBooking.tsx" -Raw
$find = '(?s)                        </div>\r?\n\s*                            </div>\r?\n\s*                        </div>\r?\n\r?\n\s*<div className="pt-4 flex items-center justify-between gap-4">'
$replace = '                        </div>

                        <div className="pt-4 flex items-center justify-between gap-4">'
$content = $content -replace $find, $replace
$content | Set-Content -Path "src\pages\PublicBooking.tsx"
