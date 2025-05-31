$env:NEXT_PUBLIC_SUPABASE_URL = "https://piqkjmszeqwjjjonuxso.supabase.co"
$env:NEXT_PUBLIC_SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBpcWtqbXN6ZXF3ampqb251eHNvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3MDY3ODIxMzAsImV4cCI6MjAyMjM1ODEzMH0.Owz0JFhm6a-5TgvJp9B67sM_HbxKJuLyXPsWWG5FXmw"

Write-Host "Running coin transaction fix script..."
node scripts/run-coin-transaction-fix.js 