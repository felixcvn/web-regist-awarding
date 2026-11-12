<?php
// cPanel default page is index.php, and Apache prefers it over index.html.
// Serve the same maintenance page from one source so both stay in sync.
$page = __DIR__ . '/index.html';
if (is_readable($page)) {
  header('Content-Type: text/html; charset=utf-8');
  header('Cache-Control: no-store');
  readfile($page);
  return;
}
http_response_code(503);
header('Content-Type: text/html; charset=utf-8');
?>
<!DOCTYPE html>
<html lang="id">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<meta name="robots" content="noindex" />
<title>Sedang Dalam Perawatan — Fasilkom Awarding Night 2026</title>
<style>
  body { margin: 0; min-height: 100vh; display: flex; align-items: center; justify-content: center;
    font-family: 'Plus Jakarta Sans', system-ui, sans-serif; color: #F0E7F2; text-align: center;
    background: #0d0814 linear-gradient(165deg, #120b1e 0%, #0e0918 45%, #0b0713 100%); }
  .card { max-width: 560px; padding: 40px 28px; border-radius: 24px; background: #241835;
    border: 1px solid rgba(255, 181, 232, 0.28); box-shadow: 0 0 60px rgba(255, 181, 232, 0.16); }
  h1 { font-family: Georgia, serif; font-size: 1.5rem; margin: 0 0 12px; color: #FFB5E8; }
  p { margin: 0; line-height: 1.7; font-size: 0.92rem; }
</style>
</head>
<body>
  <div class="card">
    <h1>Fasilkom Awarding Night 2026</h1>
    <p>Website sedang dalam perawatan. Silakan kembali beberapa saat lagi.</p>
  </div>
</body>
</html>
