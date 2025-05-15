$content = @"
  const getActionIcon = (action: string) => {
    switch (action) {
      case "LOGIN":
        return <Monitor className="mr-2 text-green-600" size={18} />;
      case "LOGOUT":
        return <ArrowLeft className="mr-2 text-orange-600" size={18} />;
      case "CREATE":
        return <Star className="mr-2 text-blue-600" size={18} />;
      case "UPDATE":
        return <RefreshCw className="mr-2 text-blue-500" size={18} />;
      case "DELETE":
        return <X className="mr-2 text-red-600" size={18} />;
      case "TRANSFER":
        return <ArrowLeftRight className="mr-2 text-purple-600" size={18} />;
      case "ALLOCATE":
        return <Gift className="mr-2 text-green-600" size={18} />;
      case "VIEW":
        return <Binoculars className="mr-2 text-gray-600" size={18} />;
      default:
        return <Filter className="mr-2 text-gray-500" size={18} />;
    }
  };
"@

$filePath = "app/dashboard/activity-logs/page.tsx"
$fileContent = Get-Content -Path $filePath -Raw
$pattern = "(?s)  const getActionIcon = \(action: string\) => \{.*?default:.*?}\;\r?\n"
$updatedContent = $fileContent -replace $pattern, "$content`r`n"
Set-Content -Path $filePath -Value $updatedContent

Write-Host "Icons updated successfully!" 