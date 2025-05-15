$iconImport = @"
import { 
  ArrowLeft, 
  Smartphone, 
  Monitor, 
  Filter, 
  RefreshCw,
  Star,
  X,
  Binoculars,
  Gift,
  ArrowLeftRight
} from "lucide-react";
"@

$viewCaseStatement = @"
      case "VIEW":
        return <Binoculars className="mr-2 text-gray-600" size={18} />;
"@

$filePath = "app/dashboard/activity-logs/page.tsx"
$content = Get-Content -Path $filePath -Raw

# Fix the import line
$oldImport = $content -match '(?<=import \{)[^}]+(?=\} from "lucide-react";)' | ForEach-Object { $matches[0] }
$content = $content -replace "import \{[^}]+\} from ""lucide-react"";", $iconImport

# Fix the VIEW case
$content = $content -replace '(?s)      case "VIEW":.*?return <[^>]+>;', $viewCaseStatement

Set-Content -Path $filePath -Value $content

Write-Host "Fixed the icon imports and VIEW icon color." 