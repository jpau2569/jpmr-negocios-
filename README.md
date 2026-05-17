# jpmr-negocios-
Ayuda de Negocios JPMR
[index.html](https://github.com/user-attachments/files/27902146/index.html)
<!doctype html>
<html lang="es">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover" />
<title>Ayuda de Negocios JPMR</title>
<meta name="description" content="Plataforma JPMR — herramientas de IA y automatización para negocios: mapa de ruta, scripts, CRM, contenido y Castresana Render AI." />
<meta name="theme-color" content="#0b1224" />
<link rel="preconnect" href="https://fonts.googleapis.com" />
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
<link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap" rel="stylesheet" />
<link rel="manifest" href='data:application/manifest+json;charset=utf-8,{"name":"Ayuda de Negocios JPMR","short_name":"JPMR","start_url":".","display":"standalone","background_color":"%230b1224","theme_color":"%2316a34a","icons":[{"src":"data:image/svg+xml;charset=utf-8,%3Csvg xmlns=\"http://www.w3.org/2000/svg\" viewBox=\"0 0 192 192\"%3E%3Crect width=\"192\" height=\"192\" rx=\"40\" fill=\"%2316a34a\"/%3E%3Ctext x=\"96\" y=\"104\" font-family=\"Inter\" font-size=\"58\" font-weight=\"800\" fill=\"white\" text-anchor=\"middle\"%3EJPMR%3C/text%3E%3Ctext x=\"96\" y=\"148\" font-family=\"Inter\" font-size=\"24\" font-weight=\"700\" fill=\"white\" text-anchor=\"middle\"%3ENEGOCIOS%3C/text%3E%3C/svg%3E","sizes":"192x192","type":"image/svg+xml"}]}' />
<style>
  :root {
    --bg: #0b1224;
    --bg-2: #0f1729;
    --sidebar: #0d1426;
    --sidebar-border: #1b2540;
    --card: #141d36;
    --card-2: #182241;
    --card-3: #1a2542;
    --input: #0e1730;
    --input-border: #243056;
    --fg: #e8eefc;
    --muted: #7d8aab;
    --muted-2: #5b6480;
    --accent: #9fe7f5;
    --accent-2: #7dd3ee;
    --cyan: #22d3ee;
    --green: #00d774;
    --green-2: #00b964;
    --danger: #ef4444;
    --purple: #6c5ce7;
    --purple-2: #4d3fc8;
    --pink: #ff4d8d;
    --orange: #ffb86b;
    --required: #ff6b6b;
  }
  * { box-sizing: border-box; margin: 0; padding: 0; }
  html, body { height: 100%; }
  body {
    font-family: 'Inter', system-ui, -apple-system, sans-serif;
    background: var(--bg);
    color: var(--fg);
    -webkit-font-smoothing: antialiased;
    min-height: 100%;
    display: flex;
  }
  a { color: inherit; text-decoration: none; }
  button { font-family: inherit; cursor: pointer; border: none; background: none; color: inherit; }
  input, textarea, select { font-family: inherit; }

  /* ===== Sidebar ===== */
  .sidebar {
    width: 250px;
    flex-shrink: 0;
    background: var(--sidebar);
    border-right: 1px solid var(--sidebar-border);
    display: flex;
    flex-direction: column;
    padding: 22px 16px;
    position: sticky;
    top: 0;
    height: 100vh;
    z-index: 10;
  }
  .brand { display: flex; align-items: center; gap: 10px; padding: 4px 8px 22px; }
  .brand-logo {
    width: 44px; height: 44px; border-radius: 10px;
    background: linear-gradient(135deg, #6c5ce7 0%, #ff4d8d 50%, #ffb86b 100%);
    display: grid; place-items: center;
    font-weight: 800; color: #fff; line-height: 1; text-align: center;
    box-shadow: 0 6px 24px rgba(108, 92, 231, 0.35);
  }
  .brand-logo .l1 { font-size: 13px; }
  .brand-logo .l2 { font-size: 9px; margin-top: 2px; opacity: 0.95; }
  .nav { display: flex; flex-direction: column; gap: 4px; }
  .nav button {
    display: flex; align-items: center; gap: 12px;
    padding: 11px 12px; border-radius: 10px;
    color: #c9d2eb; font-size: 14px; font-weight: 500;
    transition: background 0.15s ease, color 0.15s ease;
    width: 100%; text-align: left;
  }
  .nav button:hover { background: rgba(255,255,255,0.04); color: #fff; }
  .nav button.active { background: rgba(159, 231, 245, 0.08); color: #fff; }
  .nav svg { width: 18px; height: 18px; flex-shrink: 0; opacity: 0.9; }
  .sidebar-bottom { margin-top: auto; }
  .user-card {
    display: flex; align-items: center; gap: 10px;
    padding: 10px 12px;
    background: rgba(255,255,255,0.03);
    border: 1px solid var(--sidebar-border);
    border-radius: 12px;
  }
  .user-avatar {
    width: 34px; height: 34px; border-radius: 50%;
    background: linear-gradient(135deg, #6c5ce7 0%, #ff4d8d 100%);
    display: grid; place-items: center;
    font-weight: 700; font-size: 13px; color: #fff; flex-shrink: 0;
  }
  .user-meta { flex: 1; min-width: 0; }
  .user-name { font-size: 13px; font-weight: 600; color: #fff; line-height: 1.2; }
  .user-email { font-size: 11px; color: var(--muted); margin-top: 2px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  .user-logout { width: 28px; height: 28px; display: grid; place-items: center; color: var(--muted); border-radius: 6px; }
  .user-logout:hover { background: rgba(255,255,255,0.05); color: #fff; }

  /* ===== Main ===== */
  .main { flex: 1; padding: 28px 32px 60px; min-width: 0; }
  .page-header { display: flex; align-items: flex-start; gap: 14px; margin-bottom: 22px; }
  .back-btn {
    width: 38px; height: 38px; border-radius: 10px;
    background: var(--card); border: 1px solid var(--input-border);
    display: grid; place-items: center; color: var(--fg); flex-shrink: 0; margin-top: 4px;
  }
  .back-btn:hover { background: var(--card-2); }
  .page-title { font-size: 32px; font-weight: 800; letter-spacing: -0.5px; line-height: 1.1; }
  .page-subtitle { color: var(--muted); font-size: 14px; margin-top: 6px; }

  .view { display: none; }
  .view.active { display: block; animation: fadeIn 0.25s ease; }
  @keyframes fadeIn { from { opacity: 0; transform: translateY(4px); } to { opacity: 1; transform: translateY(0); } }

  /* ===== Roadmap tabs ===== */
  .roadmap-header {
    display: flex; align-items: center; justify-content: space-between;
    gap: 16px; margin-bottom: 18px;
  }
  .roadmap-header h1 { font-size: 28px; font-weight: 800; letter-spacing: -0.5px; }
  .roadmap-logo {
    display: inline-flex; align-items: center; gap: 6px;
    font-weight: 800; color: #fff; font-size: 13px;
    background: linear-gradient(135deg, #6c5ce7 0%, #ff4d8d 100%);
    -webkit-background-clip: text; background-clip: text;
    -webkit-text-fill-color: transparent;
  }

  .tabs-bar {
    display: flex; gap: 8px; overflow-x: auto;
    padding: 4px 0 16px; margin-bottom: 18px;
    border-bottom: 1px solid var(--sidebar-border);
    scrollbar-width: thin;
  }
  .tabs-bar::-webkit-scrollbar { height: 6px; }
  .tabs-bar::-webkit-scrollbar-thumb { background: var(--input-border); border-radius: 4px; }
  .tab-btn {
    flex-shrink: 0;
    display: inline-flex; align-items: center; gap: 8px;
    padding: 12px 16px;
    background: var(--card);
    border: 1px solid var(--input-border);
    border-radius: 12px;
    color: #c9d2eb; font-size: 14px; font-weight: 600;
    transition: all 0.15s ease;
    min-width: 60px;
  }
  .tab-btn:hover { background: var(--card-2); color: #fff; }
  .tab-btn.active {
    background: linear-gradient(135deg, rgba(108,92,231,0.25), rgba(34,211,238,0.18));
    border-color: var(--purple);
    color: #fff;
    box-shadow: 0 6px 20px rgba(108,92,231,0.2);
  }
  .tab-btn svg { width: 16px; height: 16px; opacity: 0.95; }
  .tab-btn .num { font-weight: 700; }

  .tab-panel { display: none; }
  .tab-panel.active { display: block; animation: fadeIn 0.25s ease; }
  .tab-panel-header { margin-bottom: 18px; display: flex; align-items: center; gap: 12px; }
  .tab-panel-header h2 { font-size: 24px; font-weight: 800; letter-spacing: -0.3px; }
  .tab-panel-header .tab-icon {
    width: 40px; height: 40px; border-radius: 10px;
    background: rgba(34,211,238,0.12);
    border: 1px solid rgba(34,211,238,0.25);
    display: grid; place-items: center;
    color: var(--cyan);
  }
  .tab-panel-header .tab-icon svg { width: 20px; height: 20px; }
  .tab-panel-subtitle { color: var(--muted); font-size: 14px; margin-top: 4px; }

  .card {
    background: var(--card);
    border: 1px solid var(--input-border);
    border-radius: 16px;
    padding: 22px;
    display: flex; flex-direction: column; gap: 16px;
  }
  .card h3 {
    font-size: 16px; font-weight: 800;
    letter-spacing: 1.2px; text-transform: uppercase; color: #fff;
  }
  .card h3.flat { letter-spacing: 0; text-transform: none; font-size: 18px; }
  .card .card-desc { font-size: 13px; color: var(--muted); }

  .grid-2 { display: grid; grid-template-columns: 1fr 1fr; gap: 18px; }
  @media (max-width: 1024px) { .grid-2 { grid-template-columns: 1fr; } }

  /* Fields */
  .field { display: flex; flex-direction: column; gap: 8px; }
  .field label { font-size: 13px; font-weight: 600; color: #e8eefc; }
  .field label .req { color: var(--required); margin-left: 2px; }
  .field input, .field textarea, .field select {
    width: 100%; padding: 13px 14px; border-radius: 10px;
    background: var(--input); border: 1px solid var(--input-border);
    color: var(--fg); font-size: 14px; outline: none;
    transition: border-color 0.15s ease, box-shadow 0.15s ease;
    appearance: none; -webkit-appearance: none;
  }
  .field textarea { resize: vertical; min-height: 56px; }
  .field input::placeholder, .field textarea::placeholder { color: #5e6a8a; }
  .field input:focus, .field textarea:focus, .field select:focus {
    border-color: var(--accent-2);
    box-shadow: 0 0 0 3px rgba(159, 231, 245, 0.15);
  }
  .select-wrap { position: relative; }
  .select-wrap::after {
    content: ""; position: absolute; right: 16px; top: 50%;
    width: 9px; height: 9px;
    border-right: 2px solid var(--muted); border-bottom: 2px solid var(--muted);
    transform: translateY(-70%) rotate(45deg); pointer-events: none;
  }

  /* Buttons */
  .btn {
    display: inline-flex; align-items: center; justify-content: center; gap: 8px;
    padding: 14px 20px; border-radius: 12px;
    font-weight: 700; font-size: 15px;
    transition: transform 0.1s ease, filter 0.15s ease, opacity 0.15s ease;
    text-align: center;
  }
  .btn:active { transform: translateY(1px); }
  .btn-primary { background: linear-gradient(180deg, #b4ecf7 0%, #8fd9ee 100%); color: #0b1224; }
  .btn-primary:hover { filter: brightness(1.05); }
  .btn-cyan {
    background: linear-gradient(135deg, var(--cyan) 0%, #3b82f6 100%);
    color: #fff; box-shadow: 0 8px 24px rgba(34,211,238,0.25);
  }
  .btn-cyan:hover { filter: brightness(1.08); }
  .btn-green {
    background: linear-gradient(180deg, #00e07d 0%, #00b964 100%);
    color: #042713; box-shadow: 0 8px 24px rgba(0, 215, 116, 0.25);
  }
  .btn-green:hover { filter: brightness(1.05); }
  .btn-purple {
    background: linear-gradient(135deg, rgba(108,92,231,0.18), rgba(34,211,238,0.15));
    border: 1px solid rgba(108,92,231,0.6);
    color: var(--accent);
  }
  .btn-purple:hover { background: linear-gradient(135deg, rgba(108,92,231,0.28), rgba(34,211,238,0.22)); }
  .btn-ghost {
    background: var(--card-2); border: 1px solid var(--input-border);
    color: #fff;
  }
  .btn-ghost:hover { background: var(--card-3); }

  /* Step list (for Setter IA / How to) */
  .step-list { display: flex; flex-direction: column; gap: 12px; }
  .step-item {
    display: flex; align-items: center; gap: 14px;
    padding: 14px 16px;
    background: var(--card-2);
    border-radius: 12px;
  }
  .step-num {
    width: 34px; height: 34px; border-radius: 8px;
    background: var(--cyan); color: #0b1224;
    display: grid; place-items: center;
    font-weight: 800; font-size: 14px; flex-shrink: 0;
  }
  .step-text { font-size: 14px; color: #e8eefc; font-weight: 500; }

  /* Tip */
  .tip {
    display: flex; gap: 12px;
    padding: 14px 16px;
    background: rgba(255, 197, 23, 0.05);
    border: 1px solid rgba(255, 197, 23, 0.18);
    border-radius: 12px;
    font-size: 13px; color: #d8dff5; line-height: 1.55;
  }
  .tip .tip-ic { font-size: 18px; line-height: 1; }
  .tip strong { color: #ffd84a; }

  /* External tool card */
  .tool-card {
    background: var(--card);
    border: 1px solid var(--input-border);
    border-radius: 16px;
    padding: 20px;
    display: flex; flex-direction: column; gap: 12px;
  }
  .tool-card h4 { font-size: 18px; font-weight: 800; }
  .tool-card .tool-sub { font-size: 13px; color: var(--muted); }
  .tool-card .tool-desc { font-size: 13px; color: #d8dff5; line-height: 1.5; }
  .tool-card ul { list-style: none; display: flex; flex-direction: column; gap: 6px; padding: 0; }
  .tool-card ul li {
    font-size: 13px; color: #d8dff5;
    display: flex; align-items: center; gap: 8px;
  }
  .tool-card ul li::before {
    content: ""; width: 6px; height: 6px; border-radius: 50%;
    background: var(--cyan); flex-shrink: 0;
  }

  /* Big CTA */
  .big-cta {
    width: 100%; padding: 18px;
    background: linear-gradient(135deg, var(--cyan) 0%, #3b82f6 100%);
    color: #fff;
    border-radius: 14px;
    font-size: 17px; font-weight: 700;
    display: flex; align-items: center; justify-content: center; gap: 10px;
    box-shadow: 0 12px 32px rgba(34,211,238,0.25);
    transition: filter 0.15s ease, transform 0.1s ease;
  }
  .big-cta:hover { filter: brightness(1.08); }
  .big-cta:active { transform: translateY(1px); }
  .big-cta .ic-bolt { width: 22px; height: 22px; }

  /* Upload box */
  .upload-box {
    border: 1.5px dashed var(--input-border);
    border-radius: 12px;
    padding: 22px;
    display: flex; flex-direction: column; align-items: center; gap: 8px;
    color: var(--muted);
    background: rgba(255,255,255,0.015);
    cursor: pointer;
    transition: all 0.15s ease;
  }
  .upload-box:hover { border-color: var(--accent-2); color: var(--fg); background: rgba(159, 231, 245, 0.04); }
  .upload-box.dashed-cyan { border-color: rgba(159, 231, 245, 0.5); }
  .upload-box svg { width: 22px; height: 22px; }
  .upload-box .upload-text { font-size: 13px; font-weight: 600; }
  .upload-input { display: none; }
  .thumb-wrap { position: relative; border-radius: 12px; overflow: hidden; aspect-ratio: 16 / 9; background: var(--input); }
  .thumb-wrap img { width: 100%; height: 100%; object-fit: cover; display: block; }
  .thumb-remove {
    position: absolute; top: 8px; right: 8px;
    width: 32px; height: 32px; border-radius: 8px;
    background: var(--danger); color: #fff;
    display: grid; place-items: center;
    box-shadow: 0 4px 12px rgba(0,0,0,0.3);
  }
  .thumb-remove:hover { filter: brightness(1.1); }

  /* Flyer Generado */
  .result-card {
    margin-top: 22px; background: var(--card);
    border: 1px solid var(--input-border); border-radius: 16px;
    padding: 22px;
    display: flex; flex-direction: column; gap: 16px;
  }
  .result-card h3 {
    font-size: 16px; font-weight: 800; letter-spacing: 1.2px;
    text-transform: uppercase; color: var(--accent);
  }
  .result-canvas {
    width: 100%; max-width: 420px; aspect-ratio: 1 / 1; margin: 0 auto;
    border-radius: 14px;
    background: linear-gradient(180deg, #e7ecf2 0%, #ffffff 60%);
    color: #111;
    display: flex; flex-direction: column; align-items: center; text-align: center;
    padding: 26px 22px;
    box-shadow: 0 12px 40px rgba(0,0,0,0.35);
    overflow: hidden; position: relative;
  }
  .result-placeholder {
    width: 100%; max-width: 420px; aspect-ratio: 1 / 1; margin: 0 auto;
    border-radius: 14px;
    background: var(--input); border: 1.5px dashed var(--input-border);
    display: flex; align-items: center; justify-content: center;
    color: var(--muted); font-size: 14px; text-align: center; padding: 20px;
  }
  .download-btn {
    width: 100%; max-width: 420px; margin: 0 auto;
    background: linear-gradient(180deg, #6c5ce7 0%, #4d3fc8 100%); color: #fff;
  }
  .download-btn:hover { filter: brightness(1.08); }
  .flyer-brand { display: flex; align-items: center; gap: 8px; align-self: flex-start; background: #5a3df0; color: #fff; padding: 6px 12px; border-radius: 8px; font-size: 12px; font-weight: 700; }
  .flyer-brand .dot { width: 12px; height: 12px; border-radius: 3px; background: #fff; }
  .flyer-image { width: 100%; aspect-ratio: 16 / 9; margin-top: 14px; border-radius: 8px;
    background: linear-gradient(135deg, rgba(0,0,0,0.15), rgba(0,0,0,0)), linear-gradient(180deg, #c2b9a7 0%, #8f8470 60%, #4a5b3b 100%);
    position: relative; overflow: hidden; }
  .flyer-image::after { content: ""; position: absolute; inset: 0;
    background:
      repeating-linear-gradient(90deg, rgba(0,0,0,0.08) 0 2px, transparent 2px 14px),
      radial-gradient(circle at 30% 70%, rgba(40,80,40,0.55), transparent 35%),
      radial-gradient(circle at 70% 75%, rgba(40,80,40,0.55), transparent 35%); }
  .flyer-title { margin-top: 14px; font-weight: 800; font-size: 20px; color: #1a1a1a; }
  .flyer-sub { font-style: italic; font-size: 14px; color: #444; margin-top: 4px; }
  .flyer-bullets { margin-top: 10px; text-align: left; width: 100%;
    border: 1px solid #1a1a1a; padding: 10px 14px;
    font-size: 11px; line-height: 1.55; color: #1a1a1a; font-weight: 600; }
  .flyer-cta { background: #ff8a3d; color: #1a1a1a; padding: 4px 8px; border-radius: 4px; margin-top: 6px; font-size: 10px; font-weight: 800; align-self: flex-start; }
  .flyer-footer { margin-top: auto; width: 100%; background: #0d2540; color: #fff;
    padding: 8px 10px; border-radius: 6px; display: flex; justify-content: space-between;
    font-size: 9px; font-weight: 700; }

  /* Toast */
  .toast {
    position: fixed; bottom: 24px; left: 50%;
    transform: translateX(-50%) translateY(20px);
    background: #1a2440; border: 1px solid var(--input-border);
    color: #fff; padding: 12px 18px; border-radius: 10px;
    font-size: 14px; box-shadow: 0 10px 30px rgba(0,0,0,0.4);
    opacity: 0; transition: transform 0.25s ease, opacity 0.25s ease;
    pointer-events: none; z-index: 50;
  }
  .toast.show { transform: translateX(-50%) translateY(0); opacity: 1; }

  /* Mobile */
  .mobile-topbar { display: none; align-items: center; gap: 12px; padding: 12px 16px;
    background: var(--sidebar); border-bottom: 1px solid var(--sidebar-border);
    position: sticky; top: 0; z-index: 20; }
  .mobile-toggle { width: 38px; height: 38px; border-radius: 10px; background: var(--card); border: 1px solid var(--input-border); display: grid; place-items: center; }
  @media (max-width: 820px) {
    body { flex-direction: column; }
    .sidebar { position: fixed; top: 0; left: 0; transform: translateX(-100%);
      transition: transform 0.25s ease; z-index: 30; width: 260px; height: 100vh; }
    .sidebar.open { transform: translateX(0); }
    .mobile-topbar { display: flex; }
    .main { padding: 20px 16px 50px; }
    .page-title { font-size: 24px; }
    .roadmap-header h1 { font-size: 22px; }
    .backdrop { position: fixed; inset: 0; background: rgba(0,0,0,0.5); opacity: 0;
      pointer-events: none; transition: opacity 0.2s ease; z-index: 25; }
    .backdrop.show { opacity: 1; pointer-events: auto; }
  }

  /* Placeholder view */
  .placeholder-view {
    display: flex; flex-direction: column; align-items: center; justify-content: center;
    padding: 60px 20px; text-align: center; color: var(--muted);
    background: var(--card); border-radius: 16px; border: 1px solid var(--input-border);
  }
  .placeholder-view h2 { font-size: 22px; color: #fff; margin-bottom: 10px; }

  /* Misc */
  .row { display: flex; gap: 10px; align-items: center; flex-wrap: wrap; }
  .muted-note { font-size: 12px; color: var(--muted); text-align: center; }
  .divider { height: 1px; background: var(--input-border); margin: 4px 0; }

  /* ===== Dashboard ===== */
  .dashboard-title { font-size: 26px; font-weight: 800; margin-bottom: 22px; letter-spacing: -0.3px; }
  .resource-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 22px; margin-bottom: 30px; }
  @media (max-width: 820px) { .resource-grid { grid-template-columns: 1fr; } }

  .resource-card {
    position: relative;
    border-radius: 18px;
    background: radial-gradient(120% 90% at 50% 30%, rgba(108,92,231,0.35), rgba(11,18,36,0.95) 70%);
    border: 1px solid rgba(108,92,231,0.25);
    padding: 32px 24px 28px;
    text-align: center;
    overflow: hidden;
    transition: transform 0.2s ease, border-color 0.2s ease;
    cursor: pointer;
  }
  .resource-card:hover { transform: translateY(-3px); border-color: rgba(159,231,245,0.5); }
  .resource-card.pink { background: radial-gradient(120% 90% at 50% 30%, rgba(255,77,141,0.3), rgba(11,18,36,0.95) 70%); border-color: rgba(255,77,141,0.25); }
  .coin-badge {
    width: 170px; height: 170px; margin: 0 auto 18px;
    border-radius: 50%;
    background: conic-gradient(from 0deg, #6c5ce7, #22d3ee, #ff4d8d, #6c5ce7);
    display: grid; place-items: center;
    position: relative;
    box-shadow: 0 0 60px rgba(108,92,231,0.45), inset 0 0 30px rgba(0,0,0,0.5);
  }
  .coin-badge::before {
    content: "";
    position: absolute; inset: 12px;
    border-radius: 50%;
    background: radial-gradient(circle at 30% 30%, #2a1f4a, #0b1224 70%);
    border: 2px solid rgba(255,255,255,0.1);
  }
  .coin-badge .coin-text {
    position: relative; z-index: 2;
    font-weight: 900; font-size: 22px;
    background: linear-gradient(135deg, #6c5ce7, #ff4d8d, #22d3ee);
    -webkit-background-clip: text; background-clip: text; -webkit-text-fill-color: transparent;
    line-height: 1; text-align: center;
  }
  .coin-badge .coin-text small { display: block; font-size: 9px; opacity: 0.85; margin-top: 4px; letter-spacing: 1px; }
  .resource-card .arrow-fab {
    position: absolute; right: 28%; top: 58%;
    width: 48px; height: 48px; border-radius: 50%;
    background: linear-gradient(135deg, #6c5ce7, #22d3ee);
    display: grid; place-items: center; color: #fff;
    box-shadow: 0 6px 20px rgba(34,211,238,0.4);
  }
  .resource-card.pink .arrow-fab { background: linear-gradient(135deg, #ff4d8d, #ffb86b); box-shadow: 0 6px 20px rgba(255,77,141,0.4); }
  .resource-card h3 { font-size: 22px; font-weight: 800; margin-top: 12px; }
  .resource-card p { font-size: 14px; color: var(--muted); margin-top: 6px; line-height: 1.5; }

  /* Step hero cards */
  .step-cards { display: flex; flex-direction: column; gap: 18px; }
  .step-hero {
    position: relative;
    border-radius: 18px; overflow: hidden;
    padding: 0; min-height: 200px;
    border: 1px solid rgba(108,92,231,0.25);
    cursor: pointer;
    transition: transform 0.2s ease;
  }
  .step-hero:hover { transform: translateY(-3px); }
  .step-hero .bg {
    position: absolute; inset: 0;
    background: linear-gradient(135deg, rgba(108,92,231,0.85), rgba(45,20,90,0.95)),
                radial-gradient(circle at 70% 50%, rgba(255,255,255,0.1), transparent 50%);
  }
  .step-hero .bg.dark { background: linear-gradient(135deg, #1a1340 0%, #0b1224 100%); }
  .step-hero .bg.purple { background: radial-gradient(circle at 20% 50%, rgba(108,92,231,0.7), rgba(45,20,90,0.95)); }
  .step-hero .content {
    position: relative; z-index: 2;
    padding: 20px;
    height: 100%;
    display: flex; flex-direction: column; justify-content: space-between;
    min-height: 200px;
  }
  .step-hero .brand-tag { font-size: 11px; font-weight: 800; color: #fff; opacity: 0.95; letter-spacing: 0.5px; }
  .step-pill {
    align-self: flex-start;
    padding: 4px 10px; border-radius: 6px;
    background: rgba(0,0,0,0.45);
    font-size: 10px; font-weight: 800; letter-spacing: 1px;
    color: #ff4d8d; text-transform: uppercase;
  }
  .step-hero h3 { font-size: 22px; font-weight: 800; color: #fff; line-height: 1.15; }
  .step-hero .hero-icon {
    position: absolute; right: 22px; top: 50%;
    transform: translateY(-50%);
    width: 86px; height: 86px; border-radius: 18px;
    display: grid; place-items: center;
    box-shadow: 0 10px 24px rgba(0,0,0,0.35);
    z-index: 2;
  }
  .step-hero .hero-icon svg { width: 56px; height: 56px; }
  .step-hero .hero-emoji {
    position: absolute; right: 22px; top: 50%;
    transform: translateY(-50%);
    font-size: 64px; z-index: 2;
    filter: drop-shadow(0 6px 18px rgba(0,0,0,0.5));
  }

  /* Footer & chat bubble */
  .campus-footer {
    margin-top: 32px; padding: 20px 4px 80px;
    font-size: 13px; color: var(--muted);
    line-height: 1.6; text-align: left;
    border-top: 1px solid var(--sidebar-border);
  }
  .campus-footer a { color: var(--muted); }
  .campus-footer a:hover { color: var(--cyan); }

  .chat-bubble {
    position: fixed; bottom: 22px; right: 22px;
    width: 54px; height: 54px; border-radius: 50%;
    background: var(--purple);
    display: grid; place-items: center;
    color: #fff;
    box-shadow: 0 10px 24px rgba(108,92,231,0.5);
    z-index: 40;
    cursor: pointer;
    transition: transform 0.15s ease, filter 0.15s ease;
  }
  .chat-bubble:hover { transform: scale(1.08); filter: brightness(1.1); }
  .chat-bubble svg { width: 26px; height: 26px; }

  /* ===== Tab 1 — Marketing areas ===== */
  .area-list { display: flex; flex-direction: column; gap: 12px; }
  .area-card {
    display: flex; align-items: center; gap: 14px;
    padding: 18px 20px;
    background: var(--card);
    border: 1px solid var(--input-border);
    border-radius: 14px;
    cursor: pointer;
    transition: all 0.15s ease;
  }
  .area-card:hover { border-color: var(--cyan); background: var(--card-2); }
  .area-card.selected { border-color: var(--cyan); background: rgba(34,211,238,0.06); box-shadow: 0 0 0 1px var(--cyan); }
  .area-ic {
    width: 38px; height: 38px; border-radius: 10px;
    display: grid; place-items: center; flex-shrink: 0;
    color: var(--muted);
  }
  .area-card.selected .area-ic { color: var(--cyan); }
  .area-ic svg { width: 22px; height: 22px; }
  .area-meta h4 { font-size: 16px; font-weight: 700; color: #fff; }
  .area-meta p { font-size: 13px; color: var(--muted); margin-top: 2px; }

  /* ===== Tab 2 — Solucionar el Problema ===== */
  .empty-state {
    border: 1px solid var(--input-border);
    border-radius: 16px;
    background: var(--card);
    padding: 60px 30px;
    text-align: center;
    color: var(--muted);
  }
  .empty-state .empty-ic {
    width: 56px; height: 56px; margin: 0 auto 16px;
    color: var(--muted-2);
  }
  .empty-state .empty-ic svg { width: 56px; height: 56px; }
  .empty-state p { font-size: 15px; line-height: 1.5; }

  /* ===== Tab 3 — Seleccionar Nicho ===== */
  .nicho-card { background: var(--card); border: 1px solid var(--input-border); border-radius: 16px; padding: 22px; display: flex; flex-direction: column; gap: 18px; }
  .nicho-header { display: flex; align-items: center; gap: 12px; }
  .nicho-header svg { color: var(--cyan); width: 22px; height: 22px; }
  .nicho-header h3 { font-size: 18px; font-weight: 800; color: #fff; }
  .nicho-counter { margin-left: auto; font-size: 13px; color: var(--muted); font-weight: 600; }
  .nicho-add-row { display: grid; grid-template-columns: 1fr auto auto; gap: 8px; }
  @media (max-width: 600px) { .nicho-add-row { grid-template-columns: 1fr; } }
  .nicho-add-row input {
    padding: 12px 14px; border-radius: 10px;
    background: var(--input); border: 1px solid var(--input-border);
    color: var(--fg); font-size: 14px; outline: none;
  }
  .btn-outline-cyan {
    background: transparent; border: 1px solid rgba(34,211,238,0.45);
    color: var(--cyan); padding: 12px 18px; border-radius: 10px; font-weight: 700; font-size: 14px;
  }
  .btn-outline-cyan:hover { background: rgba(34,211,238,0.08); }
  .btn-solid-cyan {
    background: linear-gradient(135deg, #0e7490, #0891b2);
    color: #fff; padding: 12px 18px; border-radius: 10px; font-weight: 700; font-size: 14px;
  }
  .btn-solid-cyan:hover { filter: brightness(1.1); }

  .nicho-tag {
    display: inline-flex; align-items: center; gap: 8px;
    padding: 6px 12px; border-radius: 999px;
    background: rgba(34,211,238,0.1); border: 1px solid rgba(34,211,238,0.3);
    color: var(--cyan); font-size: 13px; font-weight: 600;
  }
  .nicho-tag button { color: var(--cyan); }

  .btn-purple-full {
    width: 100%;
    background: linear-gradient(135deg, rgba(108,92,231,0.15), rgba(34,211,238,0.12));
    border: 1px solid rgba(108,92,231,0.5);
    color: var(--accent);
    padding: 16px; border-radius: 12px; font-weight: 700; font-size: 15px;
  }
  .btn-purple-full:hover { background: linear-gradient(135deg, rgba(108,92,231,0.25), rgba(34,211,238,0.2)); }

  /* ===== Anterior / Siguiente ===== */
  .step-nav { display: flex; gap: 16px; margin-top: 22px; }
  .step-nav button {
    flex: 1; padding: 14px 20px;
    background: #fff; color: #0b1224;
    border-radius: 12px; font-weight: 700; font-size: 15px;
    display: inline-flex; align-items: center; justify-content: center; gap: 8px;
    transition: filter 0.15s ease, opacity 0.15s ease;
  }
  .step-nav button:hover { filter: brightness(0.92); }
  .step-nav button:disabled { opacity: 0.5; cursor: not-allowed; }
  .step-nav button.next-disabled { background: #c4c4c4; }

  /* ===== Tab 6 — SignalCore (cyan banner version) ===== */
  .signal-banner {
    background: linear-gradient(135deg, #22d3ee 0%, #0ea5e9 100%);
    border-radius: 16px;
    padding: 22px;
    display: flex; align-items: center; gap: 18px;
    margin-bottom: 22px;
    box-shadow: 0 10px 40px rgba(34,211,238,0.25);
  }
  .signal-logo {
    width: 72px; height: 72px; border-radius: 16px;
    background: #0b1224;
    display: grid; place-items: center; flex-shrink: 0;
    box-shadow: 0 6px 18px rgba(0,0,0,0.35);
  }
  .signal-logo svg { width: 36px; height: 36px; }
  .signal-banner h2 {
    font-size: 28px; font-weight: 900; color: #0b1224;
    letter-spacing: -0.3px; line-height: 1;
  }
  .signal-banner p { color: #0b1224; opacity: 0.85; font-size: 14px; margin-top: 4px; font-weight: 500; }

  .signal-feature {
    background: var(--card);
    border: 1px solid var(--input-border);
    border-radius: 16px;
    padding: 28px 20px;
    text-align: center;
    margin-bottom: 14px;
  }
  .signal-feature .feat-ic {
    width: 64px; height: 64px; margin: 0 auto 14px;
    border-radius: 50%;
    background: var(--cyan);
    display: grid; place-items: center;
    color: #0b1224;
  }
  .signal-feature .feat-ic svg { width: 30px; height: 30px; }
  .signal-feature h4 { font-size: 18px; font-weight: 800; color: #fff; }
  .signal-feature p { font-size: 14px; color: var(--muted); margin-top: 6px; line-height: 1.5; }

  /* Page sub-header for Claude tabs */
  .claude-subheader {
    display: flex; align-items: flex-start; gap: 14px;
    margin-bottom: 22px;
  }
  .claude-subheader .mini-badge {
    width: 38px; height: 38px; border-radius: 10px;
    background: linear-gradient(135deg, #6c5ce7 0%, #ff4d8d 50%, #ffb86b 100%);
    display: grid; place-items: center;
    flex-shrink: 0; font-weight: 800; color: #fff;
    font-size: 9px; line-height: 1; text-align: center;
  }
  .claude-subheader .mini-badge .l1 { font-size: 10px; }
  .claude-subheader .mini-badge .l2 { font-size: 7px; margin-top: 2px; }
  .claude-subheader h2 { font-size: 24px; font-weight: 800; letter-spacing: -0.3px; line-height: 1.15; }
  .claude-subheader .sub { font-size: 14px; color: var(--muted); margin-top: 4px; line-height: 1.5; }

  /* ===== Ayuda ===== */
  .help-hero {
    display: flex; flex-direction: column; gap: 14px;
    padding: 32px 30px;
    border-radius: 20px;
    background:
      radial-gradient(120% 90% at 100% 0%, rgba(108,92,231,0.35), transparent 50%),
      radial-gradient(80% 60% at 0% 100%, rgba(34,211,238,0.2), transparent 60%),
      linear-gradient(180deg, var(--card-2) 0%, var(--card) 100%);
    border: 1px solid var(--input-border);
    margin-bottom: 22px;
  }
  .help-hero-badge {
    width: 56px; height: 56px; border-radius: 14px;
    background: linear-gradient(135deg, #6c5ce7 0%, #ff4d8d 50%, #ffb86b 100%);
    display: grid; place-items: center;
    font-weight: 800; color: #fff; line-height: 1; text-align: center;
    box-shadow: 0 8px 24px rgba(108,92,231,0.35);
  }
  .help-hero-badge .l1 { font-size: 14px; }
  .help-hero-badge .l2 { font-size: 10px; margin-top: 3px; }
  .help-hero h1 { font-size: 32px; font-weight: 900; letter-spacing: -0.6px; line-height: 1.1; }
  .help-lead { color: #d8dff5; font-size: 15px; line-height: 1.65; max-width: 720px; }
  .help-lead strong { color: #fff; }

  .help-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 22px; }
  @media (max-width: 900px) { .help-grid { grid-template-columns: 1fr; } }

  .help-card { gap: 12px; }
  .help-card-wide { grid-column: 1 / -1; }
  .help-ic { width: 48px; height: 48px; border-radius: 12px; display: grid; place-items: center; flex-shrink: 0; }
  .help-ic svg { width: 24px; height: 24px; }
  .help-list { list-style: none; padding: 0; display: flex; flex-direction: column; gap: 10px; }
  .help-list li { font-size: 14px; line-height: 1.6; color: #d8dff5; padding-left: 22px; position: relative; }
  .help-list li::before {
    content: ""; position: absolute; left: 0; top: 8px;
    width: 8px; height: 8px; border-radius: 50%;
    background: linear-gradient(135deg, var(--cyan), var(--purple));
  }
  .help-list li strong { color: #fff; }
  .help-list li em { font-style: italic; color: var(--accent); }
  .help-example {
    margin-top: 6px; padding: 14px 16px;
    background: rgba(34,211,238,0.06);
    border-left: 3px solid var(--cyan);
    border-radius: 8px;
    font-size: 14px; line-height: 1.6; color: #d8dff5;
  }
  .help-example strong { color: var(--accent); }

  /* ===== Análisis técnico ===== */
  .analysis-divider {
    margin: 36px 0 18px;
    display: flex; align-items: center; gap: 14px;
  }
  .analysis-divider::before, .analysis-divider::after {
    content: ""; flex: 1; height: 1px;
    background: linear-gradient(90deg, transparent, var(--input-border), transparent);
  }
  .analysis-divider span {
    font-size: 12px; font-weight: 800; letter-spacing: 2px; text-transform: uppercase;
    color: var(--muted); padding: 0 6px;
  }
  .analysis-intro { margin-bottom: 22px; }
  .analysis-intro p { font-size: 14px; line-height: 1.7; color: #d8dff5; }
  .analysis-intro strong { color: #fff; }
  .analysis-intro em { color: var(--accent); font-style: italic; }

  .badge-grid { display: grid; grid-template-columns: 1fr; gap: 10px; margin-top: 6px; }
  .sector-badge {
    padding: 12px 14px; border-radius: 10px;
    font-size: 13px; line-height: 1.55;
    display: flex; flex-direction: column; gap: 4px;
  }
  .sector-badge strong { font-size: 13px; }
  .sector-badge.good { background: rgba(0,215,116,0.08); border: 1px solid rgba(0,215,116,0.25); }
  .sector-badge.good strong { color: var(--green); }
  .sector-badge.bad { background: rgba(251,107,107,0.08); border: 1px solid rgba(251,107,107,0.25); }
  .sector-badge.bad strong { color: #ff8a8a; }
  .sector-badge span { color: #d8dff5; }

  /* Comparison table */
  .compare-table {
    margin-top: 14px;
    border: 1px solid var(--input-border);
    border-radius: 12px;
    overflow: hidden;
    background: var(--card-2);
  }
  .compare-row {
    display: grid;
    grid-template-columns: 1.4fr 1fr 1.1fr 1.2fr;
    gap: 1px;
    background: var(--input-border);
  }
  .compare-row > div {
    padding: 12px 14px;
    background: var(--card);
    font-size: 13px; line-height: 1.5;
    display: flex; align-items: center;
  }
  .compare-row.compare-head > div {
    background: var(--card-2);
    font-weight: 700;
    font-size: 12px;
    color: var(--muted);
    text-transform: uppercase;
    letter-spacing: 0.5px;
  }
  .cell-good { color: #69e6a8; font-weight: 600; }
  .cell-mid { color: #ffd084; font-weight: 600; }
  .cell-bad { color: #ff8a8a; font-weight: 600; }
  @media (max-width: 760px) {
    .compare-row { grid-template-columns: 1fr; }
    .compare-row > div { border-bottom: 1px solid var(--input-border); }
    .compare-row.compare-head { display: none; }
    .compare-row > div::before {
      content: attr(data-label);
      display: inline-block;
      min-width: 130px;
      font-size: 11px;
      text-transform: uppercase;
      letter-spacing: 0.5px;
      color: var(--muted);
      font-weight: 700;
      margin-right: 8px;
    }
  }

  /* Diagnóstico */
  .diag-card p { font-size: 14px; line-height: 1.7; color: #d8dff5; }
  .diag-card strong { color: #fff; }
  .diag-card em { color: var(--accent); font-style: italic; }

  .recommendation-box {
    margin-top: 14px;
    padding: 18px 18px 16px;
    border-radius: 12px;
    background: linear-gradient(135deg, rgba(108,92,231,0.12), rgba(34,211,238,0.08));
    border: 1px solid rgba(108,92,231,0.35);
  }
  .recommendation-box h4 {
    font-size: 15px; font-weight: 800;
    margin-bottom: 12px; color: #fff;
    letter-spacing: 0.2px;
  }
  .rec-grid { display: flex; flex-direction: column; gap: 10px; }
  .rec-item {
    display: flex; align-items: flex-start; gap: 12px;
    font-size: 14px; line-height: 1.55; color: #d8dff5;
  }
  .rec-item strong { color: #fff; }
  .rec-num {
    flex-shrink: 0;
    width: 26px; height: 26px; border-radius: 8px;
    background: linear-gradient(135deg, var(--cyan), var(--purple));
    color: #fff; font-weight: 800; font-size: 13px;
    display: grid; place-items: center;
  }

  /* ===== Free tools (Claude, Gemini, Codex) ===== */
  .free-tools-grid {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: 14px;
    margin-top: 8px;
  }
  .free-tools-grid.four { grid-template-columns: repeat(2, 1fr); }
  @media (min-width: 1100px) { .free-tools-grid.four { grid-template-columns: repeat(4, 1fr); } }
  @media (max-width: 900px) { .free-tools-grid, .free-tools-grid.four { grid-template-columns: 1fr; } }

  .free-tool-card {
    display: flex; flex-direction: column; gap: 8px;
    padding: 18px 18px 16px;
    border-radius: 14px;
    background: var(--card-2);
    border: 1px solid var(--input-border);
    color: inherit;
    text-decoration: none;
    transition: transform 0.15s ease, border-color 0.15s ease, box-shadow 0.15s ease;
  }
  .free-tool-card:hover {
    transform: translateY(-3px);
    border-color: var(--accent-2);
    box-shadow: 0 12px 28px rgba(0,0,0,0.25);
  }
  .free-tool-card.claude:hover { border-color: #d97757; box-shadow: 0 12px 28px rgba(217,119,87,0.18); }
  .free-tool-card.gemini:hover { border-color: #9b72cb; box-shadow: 0 12px 28px rgba(155,114,203,0.18); }
  .free-tool-card.codex:hover { border-color: #10a37f; box-shadow: 0 12px 28px rgba(16,163,127,0.18); }
  .free-tool-card.abacus:hover { border-color: #ff6b35; box-shadow: 0 12px 28px rgba(255,107,53,0.2); }

  .tool-logo {
    width: 48px; height: 48px; border-radius: 12px;
    display: grid; place-items: center;
    margin-bottom: 4px;
  }
  .tool-logo.claude { background: #fff; color: #d97757; }
  .tool-logo.gemini { background: #fff; }
  .tool-logo.codex { background: #10a37f; color: #fff; }
  .tool-logo.abacus { background: linear-gradient(135deg, #ff6b35, #f7931e); color: #fff; }
  .tool-logo svg { width: 28px; height: 28px; }

  .free-tool-card h4 { font-size: 18px; font-weight: 800; color: #fff; line-height: 1.1; }
  .free-tool-card .tool-sub { font-size: 12px; color: var(--muted); font-weight: 500; }
  .free-tool-card .tool-desc { font-size: 13px; color: #d8dff5; line-height: 1.5; margin-top: 2px; }
  .free-tool-card ul {
    list-style: none; padding: 0;
    display: flex; flex-direction: column; gap: 6px;
    margin-top: 6px;
  }
  .free-tool-card ul li {
    font-size: 12.5px; color: #c9d2eb; line-height: 1.45;
    padding-left: 18px; position: relative;
  }
  .free-tool-card ul li::before {
    content: "";
    position: absolute; left: 0; top: 7px;
    width: 6px; height: 6px; border-radius: 50%;
    background: var(--cyan);
  }
  .free-tool-card.claude ul li::before { background: #d97757; }
  .free-tool-card.gemini ul li::before { background: #9b72cb; }
  .free-tool-card.codex ul li::before { background: #10a37f; }
  .free-tool-card.abacus ul li::before { background: #ff6b35; }

  .tool-cta {
    margin-top: auto;
    display: inline-flex; align-items: center; gap: 6px;
    padding-top: 10px;
    font-size: 13px; font-weight: 700;
    color: var(--cyan);
  }
  .free-tool-card.claude .tool-cta { color: #ff9d6c; }
  .free-tool-card.gemini .tool-cta { color: #b594d8; }
  .free-tool-card.codex .tool-cta { color: #2ec699; }
  .free-tool-card.abacus .tool-cta { color: #ff8a4d; }

  /* ===================================================================== */
  /* ========================  PRO UPGRADES  ============================= */
  /* ===================================================================== */

  /* Theme light */
  body.theme-light {
    --bg: #f4f6fb;
    --bg-2: #ffffff;
    --sidebar: #ffffff;
    --sidebar-border: #e6e9f2;
    --card: #ffffff;
    --card-2: #f7f9fd;
    --card-3: #eef2fa;
    --input: #f4f6fb;
    --input-border: #d8def0;
    --fg: #0b1224;
    --muted: #5b6480;
    --muted-2: #8893b1;
    color: var(--fg);
  }
  body.theme-light .nav button { color: #44506b; }
  body.theme-light .nav button:hover { background: rgba(108,92,231,0.08); }
  body.theme-light .nav button.active { background: rgba(108,92,231,0.1); color: #0b1224; }
  body.theme-light .user-card { background: #f7f9fd; }
  body.theme-light .user-email, body.theme-light .card-desc { color: var(--muted); }
  body.theme-light .help-list li, body.theme-light .help-lead,
  body.theme-light .help-example, body.theme-light .free-tool-card .tool-desc,
  body.theme-light .free-tool-card ul li, body.theme-light .help-card p,
  body.theme-light .diag-card p, body.theme-light .signal-feature p,
  body.theme-light .tool-card .tool-desc, body.theme-light .tool-card ul li,
  body.theme-light .analysis-intro p { color: #2d3658; }
  body.theme-light .help-lead strong, body.theme-light .help-list li strong,
  body.theme-light .diag-card strong, body.theme-light .recommendation-box h4,
  body.theme-light .rec-item strong, body.theme-light .free-tool-card h4,
  body.theme-light h1, body.theme-light h2, body.theme-light h3, body.theme-light h4,
  body.theme-light .step-text, body.theme-light .area-meta h4,
  body.theme-light .signal-feature h4, body.theme-light .tool-card h4 { color: #0b1224; }
  body.theme-light .field input, body.theme-light .field textarea, body.theme-light .field select { color: var(--fg); }
  body.theme-light .field input::placeholder, body.theme-light .field textarea::placeholder { color: #95a0bd; }
  body.theme-light .step-hero h3, body.theme-light .resource-card h3,
  body.theme-light .signal-banner h2, body.theme-light .signal-banner p { color: #fff; }
  body.theme-light .step-hero .bg.dark { background: linear-gradient(135deg, #1a1340 0%, #0b1224 100%); }
  body.theme-light .tip { background: rgba(255,197,23,0.08); color: #1a1f3a; }
  body.theme-light .toast { background: #fff; color: #0b1224; border-color: #d8def0; box-shadow: 0 10px 30px rgba(20,30,60,0.12); }
  body.theme-light .step-nav button { background: #0b1224; color: #fff; }
  body.theme-light .step-nav button.next-disabled { background: #cbd0e1; color: #6a7494; }
  body.theme-light .empty-state { background: #fff; }
  body.theme-light .empty-state p { color: var(--muted); }
  body.theme-light .compare-row > div { background: #fff; }
  body.theme-light .compare-row.compare-head > div { background: #f7f9fd; }

  /* App top bar (autosave / search / theme) */
  .app-topbar {
    display: flex; align-items: center; gap: 10px;
    padding: 10px 14px;
    margin: -12px -16px 18px;
    background: var(--card);
    border-bottom: 1px solid var(--input-border);
    border-radius: 0;
    position: sticky; top: 0; z-index: 15;
    backdrop-filter: blur(8px);
  }
  @media (min-width: 821px) {
    .app-topbar { margin: 0 0 22px; border-radius: 12px; padding: 10px 14px; border: 1px solid var(--input-border); }
  }
  .topbar-spacer { flex: 1; }
  .save-pill {
    display: inline-flex; align-items: center; gap: 6px;
    padding: 5px 10px; border-radius: 999px;
    background: rgba(0,215,116,0.1);
    color: var(--green);
    font-size: 12px; font-weight: 600;
    transition: opacity 0.2s ease;
  }
  .save-pill.saving { background: rgba(159,231,245,0.1); color: var(--accent-2); }
  .save-pill .dot {
    width: 6px; height: 6px; border-radius: 50%;
    background: currentColor;
    animation: pulse 1.6s ease-in-out infinite;
  }
  @keyframes pulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.3; } }
  .topbar-btn {
    display: inline-flex; align-items: center; gap: 6px;
    padding: 7px 12px; border-radius: 10px;
    background: var(--card-2);
    border: 1px solid var(--input-border);
    color: var(--fg); font-size: 13px; font-weight: 600;
    transition: background 0.15s ease, border-color 0.15s ease;
  }
  .topbar-btn:hover { background: var(--card-3); border-color: var(--accent-2); }
  .topbar-btn .kbd {
    margin-left: 6px;
    padding: 2px 6px; border-radius: 5px;
    background: var(--input); color: var(--muted);
    font-size: 10px; font-weight: 700; letter-spacing: 0.5px;
    font-family: 'SF Mono', Monaco, monospace;
  }
  .topbar-btn svg { width: 14px; height: 14px; }

  /* Roadmap progress */
  .roadmap-progress {
    display: flex; align-items: center; gap: 12px;
    margin-bottom: 16px;
    font-size: 12px; color: var(--muted);
    font-weight: 600;
  }
  .roadmap-progress .bar {
    flex: 1; height: 6px; border-radius: 999px;
    background: var(--input);
    overflow: hidden;
  }
  .roadmap-progress .fill {
    height: 100%;
    background: linear-gradient(90deg, var(--cyan), var(--purple), var(--pink));
    transition: width 0.4s cubic-bezier(0.2, 0.9, 0.3, 1);
    border-radius: 999px;
  }
  .roadmap-progress .pct { color: var(--fg); min-width: 36px; text-align: right; }

  /* Tab btn completion dot */
  .tab-btn { position: relative; }
  .tab-btn.completed::after {
    content: ""; position: absolute; top: 6px; right: 8px;
    width: 7px; height: 7px; border-radius: 50%;
    background: var(--green); box-shadow: 0 0 0 2px var(--card);
  }

  /* Command Palette */
  .cmd-overlay {
    position: fixed; inset: 0;
    background: rgba(11,18,36,0.7);
    backdrop-filter: blur(8px);
    display: flex; align-items: flex-start; justify-content: center;
    padding-top: 12vh;
    z-index: 100;
    opacity: 0; pointer-events: none;
    transition: opacity 0.18s ease;
  }
  .cmd-overlay.open { opacity: 1; pointer-events: auto; }
  .cmd-palette {
    width: min(640px, calc(100vw - 32px));
    background: var(--card);
    border: 1px solid var(--input-border);
    border-radius: 16px;
    overflow: hidden;
    box-shadow: 0 30px 80px rgba(0,0,0,0.5);
    transform: translateY(-8px);
    transition: transform 0.18s ease;
  }
  .cmd-overlay.open .cmd-palette { transform: translateY(0); }
  .cmd-input-row {
    display: flex; align-items: center; gap: 10px;
    padding: 14px 16px;
    border-bottom: 1px solid var(--input-border);
  }
  .cmd-input-row svg { width: 18px; height: 18px; color: var(--muted); flex-shrink: 0; }
  .cmd-input-row input {
    flex: 1; background: transparent; border: none; outline: none;
    color: var(--fg); font-size: 16px; font-family: inherit;
  }
  .cmd-input-row .kbd {
    padding: 3px 8px; border-radius: 6px;
    background: var(--input); color: var(--muted);
    font-size: 11px; font-weight: 700; letter-spacing: 0.5px;
    font-family: 'SF Mono', Monaco, monospace;
  }
  .cmd-list {
    max-height: 50vh; overflow-y: auto;
    padding: 8px;
  }
  .cmd-section { margin-bottom: 6px; }
  .cmd-section-title {
    font-size: 10px; font-weight: 700;
    text-transform: uppercase; letter-spacing: 1px;
    color: var(--muted);
    padding: 8px 10px 4px;
  }
  .cmd-item {
    display: flex; align-items: center; gap: 12px;
    padding: 10px 12px;
    border-radius: 8px;
    cursor: pointer;
    transition: background 0.1s ease;
  }
  .cmd-item:hover, .cmd-item.focused { background: var(--card-3); }
  .cmd-item .cmd-ic {
    width: 28px; height: 28px; border-radius: 7px;
    background: var(--input);
    display: grid; place-items: center;
    color: var(--muted); flex-shrink: 0;
  }
  .cmd-item.focused .cmd-ic, .cmd-item:hover .cmd-ic { color: var(--cyan); }
  .cmd-item .cmd-ic svg { width: 15px; height: 15px; }
  .cmd-item-text { flex: 1; min-width: 0; }
  .cmd-item-title { font-size: 14px; font-weight: 600; color: var(--fg); }
  .cmd-item-sub { font-size: 12px; color: var(--muted); }
  .cmd-empty { padding: 20px; text-align: center; color: var(--muted); font-size: 14px; }

  /* Tab 4 — Ofertas */
  .offer-cards { display: grid; grid-template-columns: repeat(3, 1fr); gap: 14px; }
  @media (max-width: 900px) { .offer-cards { grid-template-columns: 1fr; } }
  .offer-card {
    background: var(--card); border: 1px solid var(--input-border);
    border-radius: 16px; padding: 22px;
    display: flex; flex-direction: column; gap: 12px;
    position: relative; overflow: hidden;
  }
  .offer-card::before {
    content: ""; position: absolute; top: 0; left: 0; right: 0; height: 4px;
    background: linear-gradient(90deg, var(--cyan), var(--accent));
  }
  .offer-card.core::before { background: linear-gradient(90deg, var(--purple), var(--pink)); }
  .offer-card.premium::before { background: linear-gradient(90deg, var(--pink), var(--orange)); }
  .offer-tier {
    display: inline-block; padding: 4px 10px;
    background: rgba(34,211,238,0.12);
    color: var(--cyan);
    font-size: 10px; font-weight: 800;
    text-transform: uppercase; letter-spacing: 1px;
    border-radius: 4px;
    align-self: flex-start;
  }
  .offer-card.core .offer-tier { background: rgba(108,92,231,0.12); color: #a78bfa; }
  .offer-card.premium .offer-tier { background: rgba(255,77,141,0.12); color: var(--pink); }
  .offer-card h4 { font-size: 19px; font-weight: 800; color: var(--fg); line-height: 1.15; }
  .offer-card .offer-pitch { font-size: 13px; color: var(--muted); line-height: 1.55; }
  .offer-card .offer-price { font-size: 26px; font-weight: 900; color: var(--fg); }
  .offer-card .offer-price small { font-size: 12px; color: var(--muted); font-weight: 600; }
  .offer-card ul { list-style: none; padding: 0; display: flex; flex-direction: column; gap: 8px; }
  .offer-card ul li {
    font-size: 13px; color: var(--fg); padding-left: 22px; position: relative; line-height: 1.5;
  }
  body.theme-light .offer-card ul li { color: #2d3658; }
  .offer-card ul li::before {
    content: ""; position: absolute; left: 0; top: 6px;
    width: 14px; height: 14px;
    background: url("data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='%2300d774' stroke-width='3' stroke-linecap='round' stroke-linejoin='round'><polyline points='20 6 9 17 4 12'/></svg>") center/contain no-repeat;
  }

  /* Tab 11 — Métricas */
  .kpi-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 14px; margin-bottom: 18px; }
  @media (max-width: 1024px) { .kpi-grid { grid-template-columns: repeat(2, 1fr); } }
  @media (max-width: 540px) { .kpi-grid { grid-template-columns: 1fr 1fr; } }
  .kpi-card {
    background: var(--card); border: 1px solid var(--input-border);
    border-radius: 14px; padding: 16px 18px;
    display: flex; flex-direction: column; gap: 6px;
  }
  .kpi-card .kpi-label { font-size: 12px; color: var(--muted); font-weight: 600; text-transform: uppercase; letter-spacing: 0.5px; }
  .kpi-card .kpi-value { font-size: 28px; font-weight: 900; color: var(--fg); line-height: 1; }
  .kpi-card .kpi-delta {
    display: inline-flex; align-items: center; gap: 4px;
    font-size: 12px; font-weight: 700;
    color: var(--green);
  }
  .kpi-card .kpi-delta.down { color: var(--danger); }
  .kpi-card .kpi-delta svg { width: 12px; height: 12px; }

  .chart-card {
    background: var(--card); border: 1px solid var(--input-border);
    border-radius: 14px; padding: 22px;
    margin-bottom: 18px;
  }
  .chart-card-header { display: flex; align-items: center; justify-content: space-between; margin-bottom: 18px; }
  .chart-card h3 { font-size: 16px; font-weight: 700; color: var(--fg); }
  .chart-svg { width: 100%; height: 200px; }
  .chart-bar { fill: url(#chartGrad); transition: opacity 0.2s ease; cursor: pointer; }
  .chart-bar:hover { opacity: 0.7; }
  .chart-label { fill: var(--muted); font-size: 10px; font-weight: 600; font-family: 'Inter', sans-serif; }

  .activity-list { display: flex; flex-direction: column; gap: 10px; }
  .activity-item {
    display: flex; align-items: center; gap: 12px;
    padding: 12px 14px;
    background: var(--card-2); border-radius: 10px;
    font-size: 13px;
  }
  .activity-item .act-ic {
    width: 32px; height: 32px; border-radius: 8px;
    background: rgba(34,211,238,0.12); color: var(--cyan);
    display: grid; place-items: center; flex-shrink: 0;
  }
  .activity-item .act-ic svg { width: 16px; height: 16px; }
  .activity-item .act-text { flex: 1; color: var(--fg); }
  body.theme-light .activity-item .act-text { color: #2d3658; }
  .activity-item .act-time { font-size: 11px; color: var(--muted); white-space: nowrap; }

  /* Mis Proyectos */
  .projects-header { display: flex; align-items: center; justify-content: space-between; margin-bottom: 22px; gap: 12px; flex-wrap: wrap; }
  .projects-header h1 { font-size: 26px; font-weight: 800; }
  .projects-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(280px, 1fr)); gap: 14px; }
  .project-card {
    background: var(--card); border: 1px solid var(--input-border);
    border-radius: 14px; padding: 18px;
    display: flex; flex-direction: column; gap: 10px;
    transition: transform 0.15s ease, border-color 0.15s ease, box-shadow 0.15s ease;
    position: relative;
  }
  .project-card:hover { transform: translateY(-2px); border-color: var(--cyan); box-shadow: 0 8px 24px rgba(0,0,0,0.15); }
  .project-card.active { border-color: var(--cyan); box-shadow: 0 0 0 1px var(--cyan); }
  .project-card .active-badge {
    position: absolute; top: 12px; right: 12px;
    padding: 2px 8px; border-radius: 999px;
    background: rgba(34,211,238,0.15); color: var(--cyan);
    font-size: 10px; font-weight: 800; text-transform: uppercase; letter-spacing: 0.5px;
  }
  .project-card h4 { font-size: 16px; font-weight: 700; color: var(--fg); }
  .project-card .project-meta { font-size: 12px; color: var(--muted); }
  .project-card .project-bar { height: 4px; background: var(--input); border-radius: 999px; overflow: hidden; }
  .project-card .project-bar .fill { height: 100%; background: linear-gradient(90deg, var(--cyan), var(--purple)); transition: width 0.3s ease; }
  .project-card .project-actions { display: flex; gap: 6px; margin-top: 4px; }
  .project-card .project-actions button {
    flex: 1; padding: 7px 10px; border-radius: 7px;
    background: var(--card-2); border: 1px solid var(--input-border);
    color: var(--fg); font-size: 12px; font-weight: 600;
    transition: background 0.15s ease;
  }
  .project-card .project-actions button:hover { background: var(--card-3); }
  .project-card .project-actions button.danger:hover { background: rgba(239,68,68,0.15); color: var(--danger); border-color: var(--danger); }

  /* Ajustes */
  .settings-section {
    background: var(--card); border: 1px solid var(--input-border);
    border-radius: 14px; padding: 22px;
    margin-bottom: 16px;
  }
  .settings-section h3 { font-size: 16px; font-weight: 800; margin-bottom: 14px; color: var(--fg); }
  .settings-row {
    display: flex; align-items: center; gap: 14px;
    padding: 12px 0;
    border-bottom: 1px solid var(--input-border);
  }
  .settings-row:last-child { border-bottom: none; }
  .settings-row .label { flex: 1; font-size: 14px; }
  .settings-row .label small { display: block; color: var(--muted); font-size: 12px; margin-top: 2px; }

  .toggle {
    width: 44px; height: 24px; border-radius: 999px;
    background: var(--input); border: 1px solid var(--input-border);
    position: relative; cursor: pointer;
    transition: background 0.2s ease, border-color 0.2s ease;
  }
  .toggle::after {
    content: ""; position: absolute; top: 2px; left: 2px;
    width: 18px; height: 18px; border-radius: 50%;
    background: var(--muted); transition: transform 0.2s ease, background 0.2s ease;
  }
  .toggle.on { background: rgba(34,211,238,0.25); border-color: var(--cyan); }
  .toggle.on::after { transform: translateX(20px); background: var(--cyan); }

  .seg-control {
    display: inline-flex; padding: 3px;
    background: var(--input); border-radius: 10px;
    border: 1px solid var(--input-border);
  }
  .seg-control button {
    padding: 7px 12px; border-radius: 7px;
    font-size: 12px; font-weight: 600;
    color: var(--muted);
    transition: background 0.15s ease, color 0.15s ease;
  }
  .seg-control button.active { background: var(--card); color: var(--fg); box-shadow: 0 1px 3px rgba(0,0,0,0.2); }

  .api-key-row {
    display: grid; grid-template-columns: 1fr auto; gap: 8px;
    align-items: center; margin-top: 10px;
  }
  .api-key-row input {
    padding: 11px 14px; border-radius: 9px;
    background: var(--input); border: 1px solid var(--input-border);
    color: var(--fg); font-family: 'SF Mono', Monaco, monospace; font-size: 13px;
  }
  .api-key-row .status {
    width: 28px; height: 28px; border-radius: 50%;
    background: var(--input);
    display: grid; place-items: center;
    color: var(--muted);
  }
  .api-key-row .status.set { background: rgba(0,215,116,0.15); color: var(--green); }
  .api-key-row .status svg { width: 14px; height: 14px; }
  .api-provider-label { display: flex; align-items: center; gap: 8px; font-size: 13px; font-weight: 600; }
  .api-provider-label .dot {
    width: 8px; height: 8px; border-radius: 50%;
    background: var(--muted);
  }
  .api-provider-label.anthropic .dot { background: #d97757; }
  .api-provider-label.google .dot { background: #4285F4; }
  .api-provider-label.openai .dot { background: #10a37f; }
  .api-provider-label.abacus .dot { background: linear-gradient(135deg, #ff6b35, #f7931e); }

  /* Onboarding modal */
  .onboard-overlay {
    position: fixed; inset: 0;
    background: rgba(11,18,36,0.85);
    backdrop-filter: blur(10px);
    display: flex; align-items: center; justify-content: center;
    padding: 20px;
    z-index: 90;
    opacity: 0; pointer-events: none;
    transition: opacity 0.25s ease;
  }
  .onboard-overlay.open { opacity: 1; pointer-events: auto; }
  .onboard-card {
    width: min(520px, 100%);
    background: var(--card);
    border: 1px solid var(--input-border);
    border-radius: 20px;
    padding: 32px;
    transform: scale(0.95);
    transition: transform 0.25s ease;
  }
  .onboard-overlay.open .onboard-card { transform: scale(1); }
  .onboard-illust {
    width: 80px; height: 80px; margin: 0 auto 20px;
    border-radius: 20px;
    background: linear-gradient(135deg, #6c5ce7, #ff4d8d, #ffb86b);
    display: grid; place-items: center;
    box-shadow: 0 16px 40px rgba(108,92,231,0.35);
  }
  .onboard-illust svg { width: 40px; height: 40px; color: #fff; }
  .onboard-card h2 { font-size: 24px; font-weight: 800; text-align: center; margin-bottom: 10px; }
  .onboard-card p { text-align: center; color: var(--muted); font-size: 14px; line-height: 1.6; margin-bottom: 20px; }
  .onboard-dots { display: flex; gap: 6px; justify-content: center; margin: 18px 0; }
  .onboard-dot { width: 8px; height: 8px; border-radius: 50%; background: var(--input-border); transition: background 0.2s ease, width 0.2s ease; }
  .onboard-dot.active { background: var(--cyan); width: 24px; border-radius: 4px; }
  .onboard-actions { display: flex; gap: 10px; }
  .onboard-actions button { flex: 1; }

  /* Toast types */
  .toast.success { border-color: rgba(0,215,116,0.4); }
  .toast.error { border-color: rgba(239,68,68,0.4); }
  .toast.error .toast-ic { color: var(--danger); }
  .toast.success .toast-ic { color: var(--green); }
  .toast-ic { display: inline-block; margin-right: 8px; vertical-align: -3px; }

  /* Sidebar collapsed mode (small icons only) */
  @media (min-width: 821px) {
    .sidebar.collapsed { width: 72px; padding: 22px 12px; }
    .sidebar.collapsed .brand-logo + * { display: none; }
    .sidebar.collapsed .nav button span,
    .sidebar.collapsed .nav button:not(:has(svg)) { display: none; }
    .sidebar.collapsed .nav button { justify-content: center; }
    .sidebar.collapsed .nav button { font-size: 0; }
    .sidebar.collapsed .user-meta, .sidebar.collapsed .user-logout { display: none; }
    .sidebar.collapsed .user-card { justify-content: center; padding: 8px; }
  }

  /* Smooth view transitions */
  .view.active { animation: fadeSlide 0.3s cubic-bezier(0.2, 0.9, 0.3, 1); }
  @keyframes fadeSlide { from { opacity: 0; transform: translateY(8px); } to { opacity: 1; transform: translateY(0); } }

  /* Streaming text effect */
  .streaming-dot::after {
    content: "▎"; color: var(--cyan); animation: blink 1s steps(2) infinite;
  }
  @keyframes blink { 50% { opacity: 0; } }

  /* ===== Hub de Apps externas ===== */
  .apps-hub-header {
    display: flex; align-items: center; justify-content: space-between;
    gap: 16px; flex-wrap: wrap;
    margin: 36px 0 18px;
    padding-top: 22px;
    border-top: 1px solid var(--input-border);
  }
  .apps-hub-header h2 { font-size: 22px; font-weight: 800; letter-spacing: -0.3px; }
  .apps-hub-header p { font-size: 13px; color: var(--muted); margin-top: 4px; }

  .apps-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(320px, 1fr)); gap: 16px; }
  .app-card {
    background: var(--card);
    border: 1px solid var(--input-border);
    border-radius: 16px;
    overflow: hidden;
    display: flex; flex-direction: column;
    transition: transform 0.15s ease, border-color 0.15s ease, box-shadow 0.15s ease;
  }
  .app-card:hover { transform: translateY(-3px); border-color: var(--cyan); box-shadow: 0 12px 28px rgba(0,0,0,0.18); }
  .app-preview {
    position: relative;
    aspect-ratio: 16 / 10;
    background: linear-gradient(135deg, #1a1340 0%, #0b1224 100%);
    overflow: hidden;
  }
  .app-preview iframe {
    position: absolute; inset: 0;
    width: 100%; height: 100%;
    border: 0;
    transform: scale(0.55);
    transform-origin: top left;
    width: 182%;
    height: 182%;
    pointer-events: none;
    background: #fff;
  }
  .app-preview .blocked {
    position: absolute; inset: 0;
    display: flex; flex-direction: column; align-items: center; justify-content: center;
    gap: 8px; color: var(--muted); font-size: 12px;
    background: linear-gradient(135deg, rgba(108,92,231,0.15), rgba(34,211,238,0.08)), var(--card-2);
  }
  .app-preview .blocked svg { width: 26px; height: 26px; opacity: 0.6; }
  .app-platform-badge {
    position: absolute; top: 10px; left: 10px;
    z-index: 2;
    padding: 4px 10px; border-radius: 6px;
    background: rgba(11,18,36,0.85);
    color: #fff;
    font-size: 10px; font-weight: 800;
    text-transform: uppercase; letter-spacing: 0.7px;
    backdrop-filter: blur(6px);
  }
  .app-platform-badge.manus { background: rgba(108,92,231,0.92); }
  .app-platform-badge.base44 { background: rgba(34,211,238,0.92); color: #0b1224; }
  .app-platform-badge.vercel { background: rgba(0,0,0,0.92); }
  .app-platform-badge.lovable { background: rgba(255,77,141,0.92); }
  .app-platform-badge.bolt { background: rgba(0,215,116,0.92); color: #0b1224; }
  .app-platform-badge.netlify { background: rgba(0,173,181,0.92); color: #0b1224; }
  .app-platform-badge.other { background: rgba(125,138,171,0.92); }

  .app-body { padding: 16px; display: flex; flex-direction: column; gap: 8px; }
  .app-body h4 { font-size: 16px; font-weight: 700; color: var(--fg); }
  .app-body .app-url {
    font-size: 11px; color: var(--muted);
    font-family: 'SF Mono', Monaco, monospace;
    white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
  }
  .app-body .app-desc { font-size: 13px; color: var(--muted); line-height: 1.5; }
  .app-body .app-actions { display: flex; gap: 6px; margin-top: 6px; }
  .app-body .app-actions button, .app-body .app-actions a {
    flex: 1; padding: 8px 10px; border-radius: 7px;
    background: var(--card-2); border: 1px solid var(--input-border);
    color: var(--fg); font-size: 12px; font-weight: 600;
    text-decoration: none; text-align: center;
    display: inline-flex; align-items: center; justify-content: center; gap: 4px;
    transition: background 0.15s ease;
  }
  .app-body .app-actions button:hover, .app-body .app-actions a:hover { background: var(--card-3); }
  .app-body .app-actions .primary {
    background: linear-gradient(135deg, var(--cyan), #3b82f6);
    color: #fff; border-color: transparent;
  }
  .app-body .app-actions .primary:hover { filter: brightness(1.08); }
  .app-body .app-actions .danger:hover { background: rgba(239,68,68,0.15); color: var(--danger); border-color: var(--danger); }

  .apps-empty {
    grid-column: 1 / -1;
    padding: 40px 24px; text-align: center;
    color: var(--muted);
    background: var(--card); border: 1px dashed var(--input-border);
    border-radius: 14px;
  }

  /* ===== Castresana Render AI (replica) ===== */
  .cr2-app {
    --cr-green: #16a34a;
    --cr-green-dark: #15803d;
    --cr-green-light: #dcfce7;
    --cr-green-faint: #f0fdf4;
    --cr-bg: #0b1224;
    --cr-card-bg: #ffffff;
    --cr-card-border: #e5e7eb;
    --cr-text: #111827;
    --cr-muted: #6b7280;
    background: var(--cr-bg);
    border-radius: 18px;
    padding: 20px;
    margin: -4px 0;
  }
  body.theme-light .cr2-app { background: #f0f3f9; }

  .cr2-topbar {
    display: flex; align-items: center; justify-content: space-between;
    background: var(--cr-card-bg);
    border-radius: 14px;
    padding: 14px 18px;
    margin-bottom: 18px;
    box-shadow: 0 2px 6px rgba(0,0,0,0.04);
  }
  .cr2-brand { display: flex; align-items: center; gap: 12px; }
  .cr2-logo {
    width: 42px; height: 42px;
    background: var(--cr-green);
    border-radius: 10px;
    display: grid; place-items: center;
    flex-shrink: 0;
  }
  .cr2-logo svg { width: 24px; height: 24px; }
  .cr2-brand h1 { font-size: 18px; font-weight: 800; color: var(--cr-text); letter-spacing: -0.3px; }
  .cr2-login {
    background: var(--cr-green); color: #fff;
    padding: 9px 18px; border-radius: 9px;
    font-weight: 700; font-size: 14px;
    transition: background 0.15s ease;
  }
  .cr2-login:hover { background: var(--cr-green-dark); }

  .cr2-hero { text-align: center; padding: 18px 14px 26px; color: #fff; }
  body.theme-light .cr2-hero { color: var(--cr-text); }
  .cr2-hero h2 { font-size: 24px; font-weight: 800; letter-spacing: -0.4px; margin-bottom: 8px; }
  .cr2-hero p { font-size: 14px; color: rgba(255,255,255,0.7); line-height: 1.55; max-width: 540px; margin: 0 auto; }
  body.theme-light .cr2-hero p { color: var(--cr-muted); }
  .cr2-hero p strong { color: #fff; }
  body.theme-light .cr2-hero p strong { color: var(--cr-text); }

  .cr2-steps {
    display: grid; grid-template-columns: repeat(3, 1fr); gap: 14px;
    margin-bottom: 26px;
  }
  @media (max-width: 820px) { .cr2-steps { grid-template-columns: 1fr; } }
  .cr2-step {
    background: var(--cr-card-bg);
    border-radius: 14px;
    padding: 22px 18px;
    text-align: center;
    box-shadow: 0 2px 6px rgba(0,0,0,0.04);
  }
  .cr2-step-ic {
    width: 52px; height: 52px;
    margin: 0 auto 14px;
    color: var(--cr-green);
    display: grid; place-items: center;
  }
  .cr2-step-ic svg { width: 32px; height: 32px; }
  .cr2-step h3 { font-size: 16px; font-weight: 800; color: var(--cr-text); margin-bottom: 6px; }
  .cr2-step p { font-size: 13px; color: var(--cr-muted); line-height: 1.5; }

  .cr2-workspace { display: grid; grid-template-columns: 1fr 1fr; gap: 14px; }
  @media (max-width: 980px) { .cr2-workspace { grid-template-columns: 1fr; } }

  .cr2-card {
    background: var(--cr-card-bg);
    border-radius: 14px;
    padding: 22px;
    box-shadow: 0 2px 6px rgba(0,0,0,0.04);
    display: flex; flex-direction: column; gap: 14px;
  }
  .cr2-card-head { display: flex; align-items: center; gap: 10px; }
  .cr2-num {
    width: 28px; height: 28px; border-radius: 50%;
    background: var(--cr-green); color: #fff;
    display: grid; place-items: center;
    font-weight: 800; font-size: 13px; flex-shrink: 0;
  }
  .cr2-card h3 { font-size: 16px; font-weight: 800; color: var(--cr-text); }

  .cr2-dropzone {
    border: 2px dashed var(--cr-green);
    background: var(--cr-green-faint);
    border-radius: 12px;
    min-height: 180px;
    display: flex; align-items: center; justify-content: center;
    padding: 20px;
    cursor: pointer;
    transition: background 0.15s ease, border-color 0.15s ease;
    position: relative;
    overflow: hidden;
  }
  .cr2-dropzone:hover { background: var(--cr-green-light); }
  .cr2-dropzone.dragging { background: var(--cr-green-light); border-color: var(--cr-green-dark); }
  .cr2-dropzone.has-file { padding: 0; border-style: solid; background: #fff; }
  .cr2-drop-empty {
    display: flex; flex-direction: column; align-items: center; gap: 6px;
    color: var(--cr-green);
    text-align: center;
  }
  .cr2-drop-empty svg { width: 36px; height: 36px; margin-bottom: 6px; }
  .cr2-drop-empty strong { font-size: 14px; font-weight: 700; color: var(--cr-text); }
  .cr2-drop-empty span { font-size: 12px; color: var(--cr-muted); }
  #cr2DropImg { width: 100%; max-height: 240px; object-fit: contain; display: none; border-radius: 10px; }
  .cr2-dropzone.has-file #cr2DropImg { display: block; }
  .cr2-dropzone.has-file .cr2-drop-empty { display: none; }

  .cr2-row { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; }
  @media (max-width: 540px) { .cr2-row { grid-template-columns: 1fr; } }
  .cr2-field { display: flex; flex-direction: column; gap: 6px; }
  .cr2-field label { font-size: 12px; font-weight: 700; color: var(--cr-text); }
  .cr2-field select, .cr2-field textarea, .cr2-field input {
    padding: 10px 12px; border-radius: 9px;
    border: 1px solid var(--cr-card-border);
    background: #fff;
    color: var(--cr-text);
    font-size: 13px; outline: none;
    font-family: inherit;
    appearance: none; -webkit-appearance: none;
    transition: border-color 0.15s ease, box-shadow 0.15s ease;
  }
  .cr2-field textarea { resize: vertical; min-height: 60px; }
  .cr2-field select:focus, .cr2-field textarea:focus, .cr2-field input:focus {
    border-color: var(--cr-green);
    box-shadow: 0 0 0 3px rgba(22,163,74,0.12);
  }

  .cr2-btn {
    padding: 12px 18px; border-radius: 10px;
    font-weight: 700; font-size: 14px;
    display: inline-flex; align-items: center; justify-content: center; gap: 8px;
    transition: filter 0.15s ease, background 0.15s ease, transform 0.1s ease;
  }
  .cr2-btn:active { transform: translateY(1px); }
  .cr2-btn-primary { background: var(--cr-green); color: #fff; }
  .cr2-btn-primary:hover { background: var(--cr-green-dark); }
  .cr2-btn-ghost { background: #fff; color: var(--cr-text); border: 1px solid var(--cr-card-border); }
  .cr2-btn-ghost:hover { background: #f3f4f6; }

  .cr2-canvas {
    width: 100%; aspect-ratio: 1 / 1;
    border-radius: 12px;
    background: #f3f4f6;
    overflow: hidden;
    position: relative;
    display: flex; align-items: center; justify-content: center;
  }
  .cr2-canvas-empty {
    display: flex; flex-direction: column; align-items: center; gap: 10px;
    color: #9ca3af;
  }
  .cr2-canvas-empty svg { width: 48px; height: 48px; }
  .cr2-canvas-empty span { font-size: 13px; }

  /* The actual rendered "3D top-down" mock */
  .cr2-render {
    width: 100%; height: 100%;
    position: relative;
    background: linear-gradient(180deg, #f5f0e6 0%, #e8d9b6 100%);
    overflow: hidden;
  }
  .cr2-render::before {
    content: ""; position: absolute; inset: 8%;
    background: repeating-linear-gradient(0deg, rgba(0,0,0,0.03) 0 2px, transparent 2px 14px),
                repeating-linear-gradient(90deg, rgba(0,0,0,0.03) 0 2px, transparent 2px 14px),
                linear-gradient(180deg, #e8d9b6 0%, #d4bf95 100%);
    border-radius: 4px;
    box-shadow: inset 0 0 0 3px #8b7355, 0 8px 20px rgba(0,0,0,0.15);
  }
  /* rooms as colored rectangles */
  .cr2-render-room {
    position: absolute; border: 2px solid #8b7355;
    border-radius: 2px;
    box-shadow: inset 0 0 24px rgba(0,0,0,0.08);
    display: flex; align-items: center; justify-content: center;
    color: rgba(0,0,0,0.55); font-size: 10px; font-weight: 800;
    letter-spacing: 0.3px;
  }
  .cr2-render-furniture {
    position: absolute; background: rgba(40, 90, 60, 0.85);
    border-radius: 3px; box-shadow: 0 2px 4px rgba(0,0,0,0.2);
  }
  .cr2-render-label {
    position: absolute; bottom: 12px; left: 12px;
    background: rgba(0,0,0,0.7); color: #fff;
    padding: 5px 12px; border-radius: 6px;
    font-size: 10px; font-weight: 700; letter-spacing: 0.5px;
    backdrop-filter: blur(4px);
  }
  .cr2-render-watermark {
    position: absolute; top: 12px; right: 12px;
    display: flex; align-items: center; gap: 6px;
    background: rgba(22,163,74,0.92); color: #fff;
    padding: 5px 10px; border-radius: 6px;
    font-size: 9px; font-weight: 800; letter-spacing: 0.5px;
    backdrop-filter: blur(4px);
  }
  .cr2-render-watermark svg { width: 12px; height: 12px; }

  .cr2-details { background: var(--cr-green-faint); border: 1px solid var(--cr-green-light); border-radius: 10px; padding: 0 14px; }
  .cr2-details[open] { padding: 12px 14px; }
  .cr2-details summary {
    cursor: pointer; padding: 12px 0;
    font-size: 13px; font-weight: 700; color: var(--cr-green-dark);
    list-style: none; user-select: none;
  }
  .cr2-details summary::-webkit-details-marker { display: none; }
  .cr2-details summary::before {
    content: "+"; margin-right: 8px; font-weight: 800;
    transition: transform 0.2s ease; display: inline-block;
  }
  .cr2-details[open] summary::before { transform: rotate(45deg); }
  .cr2-details > .cr2-row, .cr2-details > .cr2-field { margin-bottom: 10px; }

  /* Brochure modal */
  .cr2-brochure-modal {
    position: fixed; inset: 0;
    background: rgba(0,0,0,0.85); backdrop-filter: blur(10px);
    display: none; align-items: center; justify-content: center;
    z-index: 100; padding: 20px;
  }
  .cr2-brochure-modal.open { display: flex; }
  .cr2-brochure-paper {
    width: min(640px, 100%);
    aspect-ratio: 1 / 1.414;
    background: #fff;
    color: #111;
    border-radius: 10px;
    overflow: hidden;
    box-shadow: 0 30px 80px rgba(0,0,0,0.5);
    display: flex; flex-direction: column;
    position: relative;
  }
  .cr2-bro-header {
    background: var(--cr-green); color: #fff;
    padding: 18px 22px;
    display: flex; align-items: center; justify-content: space-between;
  }
  .cr2-bro-header .left { display: flex; align-items: center; gap: 10px; }
  .cr2-bro-header .logo {
    width: 32px; height: 32px; background: #fff; border-radius: 8px;
    display: grid; place-items: center; color: var(--cr-green);
    font-weight: 900; font-size: 14px;
  }
  .cr2-bro-header h2 { font-size: 18px; font-weight: 900; margin: 0; }
  .cr2-bro-header small { font-size: 11px; opacity: 0.9; }
  .cr2-bro-status {
    background: #ff8a3d; color: #1a1a1a;
    padding: 6px 12px; border-radius: 6px;
    font-size: 10px; font-weight: 800; text-transform: uppercase;
  }
  .cr2-bro-image { flex: 1.4; position: relative; overflow: hidden; }
  .cr2-bro-image .cr2-render { width: 100%; height: 100%; }
  .cr2-bro-body { padding: 18px 22px; flex: 1; display: flex; flex-direction: column; gap: 10px; }
  .cr2-bro-title { font-size: 22px; font-weight: 900; line-height: 1.1; }
  .cr2-bro-price { font-size: 26px; font-weight: 900; color: var(--cr-green); }
  .cr2-bro-specs { display: grid; grid-template-columns: repeat(3, 1fr); gap: 8px; margin-top: 6px; }
  .cr2-bro-spec {
    background: var(--cr-green-faint); border: 1px solid var(--cr-green-light);
    border-radius: 8px; padding: 8px 12px; text-align: center;
  }
  .cr2-bro-spec strong { display: block; font-size: 16px; color: var(--cr-green-dark); font-weight: 800; }
  .cr2-bro-spec small { font-size: 10px; color: #6b7280; text-transform: uppercase; font-weight: 700; letter-spacing: 0.5px; }
  .cr2-bro-footer {
    background: #111; color: #fff;
    padding: 14px 22px;
    display: flex; justify-content: space-between; align-items: center;
    font-size: 11px; font-weight: 700;
  }
  .cr2-bro-footer .brand { display: flex; align-items: center; gap: 8px; }
  .cr2-bro-close {
    position: absolute; top: -50px; right: 0;
    background: rgba(255,255,255,0.1); color: #fff;
    width: 38px; height: 38px; border-radius: 50%;
    display: grid; place-items: center;
  }
  .cr2-bro-actions {
    position: absolute; top: -50px; left: 0;
    display: flex; gap: 8px;
  }
  .cr2-bro-actions button {
    background: rgba(255,255,255,0.1); color: #fff;
    padding: 8px 14px; border-radius: 8px;
    font-size: 13px; font-weight: 700;
    display: inline-flex; align-items: center; gap: 6px;
  }
  .cr2-bro-actions button:hover { background: rgba(255,255,255,0.18); }
  .cr2-render.dia { filter: brightness(1); }
  .cr2-render.atardecer { filter: brightness(0.92) sepia(0.3) hue-rotate(-10deg); }
  .cr2-render.noche { filter: brightness(0.55) sepia(0.2) hue-rotate(200deg); }

  .cr2-render-loading {
    position: absolute; inset: 0;
    background: linear-gradient(135deg, var(--cr-green-faint), #fff);
    display: flex; flex-direction: column; align-items: center; justify-content: center;
    gap: 10px;
    color: var(--cr-green);
  }
  .cr2-render-loading svg { width: 36px; height: 36px; animation: spin 1.2s linear infinite; }
  @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
  .cr2-render-loading strong { font-size: 14px; color: var(--cr-text); }
  .cr2-render-loading span { font-size: 12px; color: var(--cr-muted); }

  .cr2-result-actions { display: flex; gap: 8px; flex-wrap: wrap; }
  .cr2-result-actions .cr2-btn { flex: 1; min-width: 100px; }

  .cr2-history-block { margin-top: 6px; border-top: 1px solid var(--cr-card-border); padding-top: 14px; }
  .cr2-history-head { display: flex; justify-content: space-between; align-items: center; margin-bottom: 10px; }
  .cr2-history-head strong { font-size: 13px; color: var(--cr-text); }
  .cr2-history-head span { font-size: 12px; color: var(--cr-muted); }
  .cr2-history-list { display: grid; grid-template-columns: repeat(4, 1fr); gap: 8px; }
  .cr2-history-thumb {
    aspect-ratio: 1 / 1; border-radius: 8px; overflow: hidden;
    border: 1px solid var(--cr-card-border);
    cursor: pointer; position: relative;
    transition: transform 0.15s ease, border-color 0.15s ease;
  }
  .cr2-history-thumb:hover { transform: translateY(-2px); border-color: var(--cr-green); }
  .cr2-history-thumb img, .cr2-history-thumb .cr2-render {
    width: 100%; height: 100%; object-fit: cover;
  }
  .cr2-history-thumb .cr2-history-del {
    position: absolute; top: 4px; right: 4px;
    width: 22px; height: 22px; border-radius: 50%;
    background: rgba(0,0,0,0.6); color: #fff;
    display: grid; place-items: center;
    opacity: 0; transition: opacity 0.15s ease;
  }
  .cr2-history-thumb:hover .cr2-history-del { opacity: 1; }
  .cr2-history-thumb .cr2-history-del svg { width: 11px; height: 11px; }
  .cr2-history-empty {
    grid-column: 1 / -1;
    text-align: center; padding: 14px;
    font-size: 12px; color: var(--cr-muted);
  }

  .cr2-footer {
    display: flex; justify-content: space-between; align-items: center;
    margin-top: 20px; padding: 14px 4px;
    font-size: 12px; color: rgba(255,255,255,0.6);
  }
  body.theme-light .cr2-footer { color: var(--cr-muted); }
  .cr2-badge {
    background: var(--cr-green); color: #fff;
    padding: 3px 10px; border-radius: 999px;
    font-size: 11px; font-weight: 800; letter-spacing: 0.3px;
  }

  /* Legacy Cast Render placeholder (kept for compat) */
  .cr-hero {
    position: relative;
    display: grid; grid-template-columns: 1.4fr 1fr; gap: 22px; align-items: center;
    padding: 32px 30px;
    border-radius: 20px;
    background:
      radial-gradient(120% 90% at 100% 0%, rgba(34,211,238,0.3), transparent 50%),
      radial-gradient(80% 60% at 0% 100%, rgba(108,92,231,0.25), transparent 60%),
      linear-gradient(180deg, var(--card-2) 0%, var(--card) 100%);
    border: 1px solid var(--input-border);
    overflow: hidden;
    margin-bottom: 22px;
  }
  @media (max-width: 820px) { .cr-hero { grid-template-columns: 1fr; padding: 24px 20px; } }
  .cr-hero h1 { font-size: 28px; font-weight: 900; letter-spacing: -0.5px; line-height: 1.15; margin-bottom: 10px; }
  .cr-pill {
    display: inline-block; padding: 4px 12px; border-radius: 999px;
    background: linear-gradient(135deg, var(--cyan), var(--purple));
    color: #fff; font-size: 10px; font-weight: 800; letter-spacing: 1.2px;
    margin-bottom: 12px;
  }
  .cr-hero p { color: #d8dff5; font-size: 14px; line-height: 1.6; max-width: 540px; }
  body.theme-light .cr-hero p { color: #2d3658; }
  .cr-hero p strong { color: var(--fg); }
  body.theme-light .cr-hero h1 { color: #0b1224; }
  .cr-stats { display: flex; gap: 18px; margin-top: 18px; }
  .cr-stats > div { display: flex; flex-direction: column; }
  .cr-stats strong { font-size: 24px; font-weight: 900; color: var(--cyan); line-height: 1; }
  .cr-stats span { font-size: 11px; color: var(--muted); text-transform: uppercase; letter-spacing: 0.5px; margin-top: 4px; font-weight: 600; }

  .cr-hero-art { display: grid; place-items: center; position: relative; min-height: 180px; }
  .cr-card-stack {
    position: relative; width: 180px; height: 180px;
  }
  .cr-card-mini {
    position: absolute; width: 130px; height: 160px; border-radius: 12px;
    background: linear-gradient(180deg, #fff, #e8e8e8);
    box-shadow: 0 12px 28px rgba(0,0,0,0.25);
    overflow: hidden;
    border: 1px solid rgba(255,255,255,0.2);
  }
  .cr-card-mini::before {
    content: ""; display: block; height: 60%;
    background:
      linear-gradient(135deg, rgba(0,0,0,0.1), rgba(0,0,0,0)),
      linear-gradient(180deg, #c2b9a7 0%, #8f8470 60%, #4a5b3b 100%);
  }
  .cr-card-mini::after {
    content: "";
    display: block; height: 40%; padding: 8px;
    background-image:
      linear-gradient(90deg, #1a1a1a 0%, #1a1a1a 70%, transparent 70%),
      linear-gradient(90deg, #6a6a6a 0%, #6a6a6a 90%, transparent 90%),
      linear-gradient(90deg, #6a6a6a 0%, #6a6a6a 60%, transparent 60%);
    background-size: 100% 4px, 100% 3px, 100% 3px;
    background-position: 8px 8px, 8px 18px, 8px 26px;
    background-repeat: no-repeat;
  }
  .cr-card-mini.c1 { top: 0; left: 0; transform: rotate(-8deg); }
  .cr-card-mini.c2 { top: 14px; left: 40px; transform: rotate(2deg); z-index: 2; }
  .cr-card-mini.c3 { top: 28px; left: 80px; transform: rotate(10deg); }

  .cr-layout { display: grid; grid-template-columns: 1fr 1fr; gap: 22px; }
  @media (max-width: 980px) { .cr-layout { grid-template-columns: 1fr; } }

  .cr-form { gap: 14px; }
  .cr-form h3.flat { margin-bottom: 4px; }
  .cr-row { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; }
  .cr-row-3 { grid-template-columns: 2fr 1fr 1fr; }
  @media (max-width: 540px) { .cr-row, .cr-row-3 { grid-template-columns: 1fr; } }

  .cr-preview-col { display: flex; flex-direction: column; }
  .cr-preview-card { gap: 14px; }
  .cr-preview-header { display: flex; align-items: center; justify-content: space-between; }
  .cr-format-label {
    font-size: 11px; font-weight: 700; color: var(--muted);
    background: var(--input); padding: 4px 8px; border-radius: 6px;
    letter-spacing: 0.3px;
  }
  .cr-canvas-wrap {
    width: 100%; aspect-ratio: 1 / 1;
    border-radius: 14px;
    background: var(--input);
    border: 1.5px dashed var(--input-border);
    display: flex; align-items: center; justify-content: center;
    overflow: hidden;
    position: relative;
  }
  .cr-canvas-wrap.story { aspect-ratio: 9 / 16; }
  .cr-canvas-wrap.horizontal { aspect-ratio: 1200 / 628; }
  .cr-canvas-wrap.brochure { aspect-ratio: 1 / 1.414; }
  .cr-canvas-empty { color: var(--muted); font-size: 13px; padding: 20px; text-align: center; }

  /* The rendered card itself */
  .cr-output {
    width: 100%; height: 100%; background: #fff; color: #1a1a1a;
    display: flex; flex-direction: column;
    overflow: hidden;
    position: relative;
    border-radius: 14px;
  }
  .cr-out-brand {
    position: absolute; top: 14px; left: 14px;
    background: var(--purple); color: #fff;
    padding: 6px 12px; border-radius: 8px;
    font-size: 11px; font-weight: 800; letter-spacing: 0.3px;
    z-index: 3;
  }
  .cr-out-status {
    position: absolute; top: 14px; right: 14px;
    background: #ff8a3d; color: #1a1a1a;
    padding: 6px 12px; border-radius: 8px;
    font-size: 11px; font-weight: 800; text-transform: uppercase; letter-spacing: 0.5px;
    z-index: 3;
  }
  .cr-out-image {
    flex: 1.4; position: relative; overflow: hidden;
    background-size: cover; background-position: center;
  }
  .cr-out-image.placeholder {
    background:
      linear-gradient(135deg, rgba(0,0,0,0.15) 0%, rgba(0,0,0,0) 50%),
      linear-gradient(0deg, rgba(0,0,0,0.4) 0%, rgba(0,0,0,0) 40%),
      linear-gradient(180deg, #b9c7d6 0%, #6f8aa4 35%, #3d556e 70%, #1c2e44 100%);
  }
  .cr-out-image.placeholder::after {
    content: "";
    position: absolute; inset: 0;
    background:
      radial-gradient(ellipse at 20% 70%, rgba(40, 80, 60, 0.5), transparent 35%),
      radial-gradient(ellipse at 70% 60%, rgba(80, 100, 70, 0.4), transparent 40%),
      linear-gradient(180deg, transparent 50%, rgba(60, 70, 80, 0.7) 100%);
  }
  .cr-out-image.placeholder::before {
    content: "";
    position: absolute; left: 30%; right: 30%; top: 25%; bottom: 35%;
    background:
      repeating-linear-gradient(0deg, rgba(255,255,255,0.04) 0 6px, transparent 6px 14px),
      linear-gradient(180deg, #2c3a50 0%, #1a2536 100%);
    box-shadow: 0 20px 40px rgba(0,0,0,0.3);
  }
  .cr-out-body {
    padding: 14px 16px;
    background: linear-gradient(180deg, rgba(255,255,255,0.95), #fff);
    display: flex; flex-direction: column; gap: 6px;
    flex: 1;
  }
  .cr-out-title { font-size: 17px; font-weight: 900; color: #1a1a1a; letter-spacing: 0.5px; }
  .cr-out-sub { font-size: 13px; color: #555; font-style: italic; }
  .cr-out-feats {
    margin-top: 4px;
    border: 1.5px solid #1a1a1a;
    padding: 8px 12px;
    font-size: 10px; font-weight: 700;
    color: #1a1a1a; line-height: 1.55;
  }
  .cr-out-footer {
    margin-top: auto;
    background: #0d2540; color: #fff;
    padding: 8px 12px;
    display: flex; justify-content: space-between;
    font-size: 9px; font-weight: 700;
  }
  .cr-out-price {
    position: absolute; bottom: 90px; right: 14px;
    background: #0b1224; color: #fff;
    padding: 8px 14px; border-radius: 8px;
    font-size: 16px; font-weight: 900;
    box-shadow: 0 8px 24px rgba(0,0,0,0.35);
    z-index: 3;
  }

  /* Story / Horizontal / Brochure variants */
  .cr-canvas-wrap.story .cr-out-image { flex: 2.3; }
  .cr-canvas-wrap.story .cr-out-price { bottom: 130px; }
  .cr-canvas-wrap.horizontal .cr-output { flex-direction: row; }
  .cr-canvas-wrap.horizontal .cr-out-image { flex: 1.2; }
  .cr-canvas-wrap.horizontal .cr-out-body { flex: 1; }
  .cr-canvas-wrap.horizontal .cr-out-price { bottom: auto; top: 50%; transform: translateY(-50%); right: auto; left: 50%; margin-left: -40%; }
  .cr-canvas-wrap.brochure .cr-out-body { padding: 22px 24px; gap: 10px; }
  .cr-canvas-wrap.brochure .cr-out-title { font-size: 22px; }
  .cr-canvas-wrap.brochure .cr-out-sub { font-size: 15px; }

  .cr-actions { display: flex; gap: 8px; flex-wrap: wrap; }
  .cr-actions button { flex: 1; padding: 11px 14px; font-size: 13px; }

  .cr-saved-list { display: flex; flex-direction: column; gap: 8px; max-height: 220px; overflow-y: auto; }
  .cr-saved-item {
    display: flex; align-items: center; gap: 12px;
    padding: 8px 12px; border-radius: 9px;
    background: var(--card-2); border: 1px solid var(--input-border);
    cursor: pointer;
    transition: background 0.15s ease;
  }
  .cr-saved-item:hover { background: var(--card-3); }
  .cr-saved-item .thumb {
    width: 36px; height: 36px; border-radius: 7px;
    background: linear-gradient(135deg, #b9c7d6, #3d556e);
    flex-shrink: 0;
  }
  .cr-saved-item .meta { flex: 1; min-width: 0; }
  .cr-saved-item .meta strong { display: block; font-size: 13px; color: var(--fg); }
  .cr-saved-item .meta small { font-size: 11px; color: var(--muted); }
  .cr-saved-item button {
    background: transparent; color: var(--danger); padding: 4px;
    border-radius: 5px;
  }
  .cr-saved-item button:hover { background: rgba(239,68,68,0.1); }

  /* ===== Bottom mobile nav ===== */
  .bottom-nav {
    display: none;
    position: fixed; bottom: 0; left: 0; right: 0;
    border-top: 1px solid var(--input-border);
    padding: 6px 4px 8px;
    z-index: 35;
    backdrop-filter: blur(10px);
    background: rgba(20, 29, 54, 0.95);
  }
  body.theme-light .bottom-nav { background: rgba(255,255,255,0.95); }
  .bottom-nav button {
    flex: 1; padding: 8px 4px;
    display: flex; flex-direction: column; align-items: center; gap: 4px;
    color: var(--muted); font-size: 10px; font-weight: 600;
    border-radius: 8px;
    transition: color 0.15s ease, background 0.15s ease;
  }
  .bottom-nav button svg { width: 20px; height: 20px; }
  .bottom-nav button.active { color: var(--cyan); }
  .bottom-nav button.bn-primary {
    background: linear-gradient(135deg, #16a34a, #15803d);
    color: #fff !important;
    margin: -10px 2px 0;
    padding: 12px 4px;
    border-radius: 14px;
    box-shadow: 0 6px 20px rgba(22,163,74,0.4);
  }
  @media (max-width: 820px) {
    .bottom-nav { display: flex; }
    .main { padding-bottom: 80px; }
    .chat-bubble { bottom: 86px; }
  }

  /* ===== Shortcuts overlay ===== */
  .sc-list { display: flex; flex-direction: column; gap: 4px; margin-top: 8px; }
  .sc-row {
    display: flex; align-items: center; justify-content: space-between;
    gap: 8px; padding: 8px 0;
    font-size: 14px; color: var(--fg);
  }
  body.theme-light .sc-row { color: #0b1224; }
  .sc-row kbd {
    background: var(--input); border: 1px solid var(--input-border);
    padding: 3px 8px; border-radius: 5px;
    font-size: 11px; font-weight: 700; font-family: 'SF Mono', Monaco, monospace;
    color: var(--fg);
  }
  .sc-row span:first-child { flex: 1; }

  /* ===== Template picker ===== */
  .template-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; max-height: 360px; overflow-y: auto; padding: 4px; }
  @media (max-width: 540px) { .template-grid { grid-template-columns: 1fr; } }
  .template-card {
    display: flex; align-items: center; gap: 12px;
    padding: 12px;
    background: var(--card-2); border: 1px solid var(--input-border);
    border-radius: 10px;
    text-align: left;
    transition: border-color 0.15s ease, background 0.15s ease, transform 0.1s ease;
  }
  .template-card:hover { border-color: var(--cyan); background: var(--card-3); transform: translateY(-1px); }
  .tpl-ic {
    width: 36px; height: 36px; border-radius: 8px;
    display: grid; place-items: center; flex-shrink: 0;
  }
  .tpl-ic svg { width: 18px; height: 18px; }
  .template-card strong { display: block; font-size: 14px; color: var(--fg); font-weight: 700; }
  body.theme-light .template-card strong { color: #0b1224; }
  .template-card span { font-size: 11px; color: var(--muted); }

  /* AI indicator badge */
  .ai-badge {
    display: inline-flex; align-items: center; gap: 4px;
    padding: 2px 8px; border-radius: 999px;
    background: rgba(34,211,238,0.12);
    color: var(--cyan);
    font-size: 10px; font-weight: 700; letter-spacing: 0.3px;
    margin-left: 8px;
  }
  .ai-badge.live { background: rgba(0,215,116,0.15); color: var(--green); }
  .ai-badge .dot { width: 5px; height: 5px; border-radius: 50%; background: currentColor; }
  .ai-badge.live .dot { animation: pulse 1.6s ease-in-out infinite; }
</style>
</head>
<body>

  <!-- ============== SIDEBAR ============== -->
  <aside class="sidebar" id="sidebar">
    <div class="brand">
      <div class="brand-logo" aria-hidden="true">
        <span class="l1">JPMR</span>
        <span class="l2">NEGOCIOS</span>
      </div>
    </div>

    <nav class="nav" aria-label="Menú principal">
      <button data-view="dashboard" class="active">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/></svg>
        Dashboard
      </button>
      <button data-view="mapa">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="1 6 8 3 16 6 23 3 23 18 16 21 8 18 1 21 1 6"/><line x1="8" y1="3" x2="8" y2="18"/><line x1="16" y1="6" x2="16" y2="21"/></svg>
        Mapa de Ruta
      </button>
      <button data-view="creador">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="23 7 16 12 23 17 23 7"/><rect x="1" y="5" width="15" height="14" rx="2" ry="2"/></svg>
        Creador de contenido
      </button>
      <button data-view="proyectos">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/></svg>
        Mis Proyectos
      </button>
      <button data-view="ajustes">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>
        Ajustes
      </button>
      <button data-view="castrender">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>
        Cast Render
      </button>
      <button data-view="ayuda">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>
        Ayuda
      </button>
    </nav>

    <div class="sidebar-bottom">
      <div class="user-card">
        <div class="user-avatar">P</div>
        <div class="user-meta">
          <div class="user-name">PAU Rodríguez</div>
          <div class="user-email">appsmovilpau@gmail…</div>
        </div>
        <button class="user-logout" aria-label="Cerrar sesión" title="Cerrar sesión">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></svg>
        </button>
      </div>
    </div>
  </aside>
  <div class="backdrop" id="backdrop"></div>

  <!-- ============== MAIN ============== -->
  <main class="main">
    <div class="mobile-topbar">
      <button class="mobile-toggle" id="mobileToggle" aria-label="Abrir menú">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="12" x2="21" y2="12"/><line x1="3" y1="18" x2="21" y2="18"/></svg>
      </button>
      <strong style="font-size:14px;">Ayuda de Negocios JPMR</strong>
    </div>

    <!-- ===== Global top bar ===== -->
    <div class="app-topbar">
      <button class="topbar-btn" id="topbarSearch" title="Buscar (Ctrl/⌘+K)">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
        Buscar
        <span class="kbd">⌘K</span>
      </button>
      <button class="topbar-btn" id="projectSwitcher" title="Proyecto activo">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/></svg>
        <span id="activeProjectName">Sin proyecto</span>
      </button>
      <div class="topbar-spacer"></div>
      <span class="save-pill" id="savePill" title="Auto-guardado">
        <span class="dot"></span>
        <span id="savePillText">Guardado</span>
      </span>
      <button class="topbar-btn" id="themeToggle" title="Cambiar tema" aria-label="Cambiar tema">
        <svg id="themeIcon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/></svg>
      </button>
    </div>

    <!-- ====== DASHBOARD ====== -->
    <section class="view active" data-view-content="dashboard">
      <h1 class="dashboard-title">Recursos personalizados</h1>

      <div class="resource-grid">
        <div class="resource-card" onclick="switchView('mapa')">
          <div class="coin-badge">
            <div class="coin-text">MKT<small>HACKER</small><small style="margin-top:6px;">MAPA DE RUTA</small></div>
          </div>
          <div class="arrow-fab">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><line x1="5" y1="12" x2="19" y2="12"/><polyline points="12 5 19 12 12 19"/></svg>
          </div>
          <h3>Mapa de ruta</h3>
          <p>Planifica estrategia, define objetivos y crea tu hoja de ruta</p>
        </div>

        <div class="resource-card pink" onclick="switchView('creador')">
          <div class="coin-badge" style="background: conic-gradient(from 0deg, #ff4d8d, #ffb86b, #22d3ee, #ff4d8d);">
            <div class="coin-text">MKT<small>HACKER</small><small style="margin-top:6px;">CREACIÓN DE CONTENIDO</small></div>
          </div>
          <div class="arrow-fab">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><line x1="5" y1="12" x2="19" y2="12"/><polyline points="12 5 19 12 12 19"/></svg>
          </div>
          <h3>Creación de contenido</h3>
          <p>Genera flyers y contenido visual con IA</p>
        </div>
      </div>

      <div class="step-cards">
        <div class="step-hero" onclick="switchView('mapa')">
          <div class="bg purple"></div>
          <div class="content">
            <div class="brand-tag">JPMR Negocios</div>
            <span class="step-pill">PASO 2</span>
            <h3>Accede a El Constructor</h3>
          </div>
        </div>

        <div class="step-hero">
          <div class="bg dark"></div>
          <div class="content">
            <div class="brand-tag">JPMR Negocios</div>
            <span class="step-pill">PASO 3</span>
            <h3>Accede al Fast Track<br/>Formación – Manual</h3>
          </div>
        </div>

        <div class="step-hero">
          <div class="bg purple"></div>
          <div class="content">
            <div class="brand-tag">JPMR Negocios</div>
            <span class="step-pill" style="color:#a78bfa;">BONUS</span>
            <h3>Agencia de Clones</h3>
          </div>
          <div class="hero-emoji">👥</div>
        </div>

        <div class="step-hero">
          <div class="bg dark"></div>
          <div class="content">
            <div class="brand-tag">JPMR Negocios</div>
            <span class="step-pill" style="color:#a78bfa;">BONUS</span>
            <h3>Higgsfield para<br/>contenido y ads</h3>
          </div>
          <div class="hero-icon" style="background:#c0ff5e; color:#000;">
            <svg viewBox="0 0 24 24" fill="currentColor"><path d="M6 8c4-4 8-4 12 0s4 8 0 12-8 4-12 0 0-8 0-12z"/></svg>
          </div>
        </div>

        <div class="step-hero">
          <div class="bg dark"></div>
          <div class="content">
            <div class="brand-tag">JPMR Negocios</div>
            <span class="step-pill" style="color:#a78bfa;">BONUS</span>
            <h3>CLAUDE para<br/>Agencias IA</h3>
          </div>
          <div class="hero-icon" style="background:#fff; color:#d97757;">
            <svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 2 L13.5 9 L21 10 L13.5 11 L12 18 L10.5 11 L3 10 L10.5 9 Z"/><path d="M12 6 L12.7 9.3 L16 10 L12.7 10.7 L12 14 L11.3 10.7 L8 10 L11.3 9.3 Z" transform="rotate(45 12 10)"/></svg>
          </div>
        </div>

        <div class="step-hero">
          <div class="bg dark"></div>
          <div class="content">
            <div class="brand-tag">JPMR Negocios</div>
            <span class="step-pill" style="color:#a78bfa;">BONUS</span>
            <h3>Meta Ads<br/>con IA</h3>
          </div>
          <div class="hero-icon" style="background:transparent;">
            <svg viewBox="0 0 24 24" fill="none" stroke="#6c5ce7" stroke-width="2.5" stroke-linecap="round"><path d="M6 12c0-3 2-5 4-5s4 2 6 5 4 5 6 5-2-5-6-5-4 2-6 5-2 5-4 5-4-2-4-5-2-5 0-5z"/></svg>
          </div>
        </div>

        <div class="step-hero">
          <div class="bg purple"></div>
          <div class="content">
            <div class="brand-tag">JPMR Negocios</div>
            <span class="step-pill" style="color:#a78bfa;">BONUS AVANZADO</span>
            <h3>MASTER IA</h3>
          </div>
          <div class="hero-emoji">🤖</div>
        </div>

        <div class="step-hero">
          <div class="bg purple"></div>
          <div class="content">
            <div class="brand-tag">JPMR Negocios</div>
            <span class="step-pill" style="color:#a78bfa;">BONUS</span>
            <h3>Automatizaciones<br/>y Agentes</h3>
          </div>
        </div>

        <div class="step-hero">
          <div class="bg purple"></div>
          <div class="content">
            <div class="brand-tag">JPMR Negocios</div>
            <span class="step-pill" style="color:#a78bfa;">BONUS</span>
            <h3>IA<br/>para Redes</h3>
          </div>
        </div>

        <div class="step-hero">
          <div class="bg dark"></div>
          <div class="content">
            <div class="brand-tag">JPMR Negocios</div>
            <span class="step-pill" style="color:#a78bfa;">BONUS</span>
            <h3>Cierre de ventas<br/>en primera llamada</h3>
          </div>
          <div class="hero-emoji">📱</div>
        </div>

        <div class="step-hero">
          <div class="bg purple"></div>
          <div class="content">
            <div class="brand-tag">JPMR Negocios</div>
            <span class="step-pill" style="color:#a78bfa;">BONUS</span>
            <h3>Páginas web<br/>profesionales con IA</h3>
          </div>
        </div>

        <div class="step-hero">
          <div class="bg dark"></div>
          <div class="content">
            <div class="brand-tag">JPMR Negocios</div>
            <span class="step-pill" style="color:#a78bfa;">BONUS</span>
            <h3>Paquetes listos<br/>para usar</h3>
          </div>
          <div class="hero-emoji">🤖</div>
        </div>
      </div>

      <!-- ====== HUB DE APPS EXTERNAS ====== -->
      <div class="apps-hub-header">
        <div>
          <h2>Tus apps externas</h2>
          <p>Manus, Base44, Vercel, Lovable, Bolt… todo bajo un mismo techo.</p>
        </div>
        <button class="btn btn-cyan" id="btnAddApp" style="padding:10px 16px; font-size:13px;">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
          Añadir app
        </button>
      </div>
      <div class="apps-grid" id="appsGrid"></div>

      <footer class="campus-footer">
        JPMR Negocios © 2026 | Todos los derechos reservados | <a href="#">Aviso Legal</a> | <a href="#">Privacidad</a> | <a href="#">Cookies</a>
      </footer>
    </section>

    <!-- ===== App modal (add/edit) ===== -->
    <div class="onboard-overlay" id="appModal" role="dialog" aria-modal="true">
      <div class="onboard-card" style="max-width:480px;">
        <h2 id="appModalTitle" style="margin-bottom:8px;">Añadir app externa</h2>
        <p style="margin-bottom:18px; text-align:left; font-size:13px;">Registra cualquier app que tengas desplegada (Manus, Base44, Vercel…). Se guardará en tu navegador.</p>
        <div class="field"><label for="appName">Nombre</label><input id="appName" type="text" placeholder="Ej: Cast Render" /></div>
        <div class="field"><label for="appUrl">URL</label><input id="appUrl" type="url" placeholder="https://mi-app.manus.space" /></div>
        <div class="field"><label for="appDesc">Descripción</label><input id="appDesc" type="text" placeholder="Renderiza fichas de inmuebles con IA" /></div>
        <div class="field"><label for="appPlatform">Plataforma</label>
          <div class="select-wrap">
            <select id="appPlatform">
              <option value="manus">Manus</option>
              <option value="base44">Base44</option>
              <option value="vercel">Vercel</option>
              <option value="lovable">Lovable</option>
              <option value="bolt">Bolt</option>
              <option value="netlify">Netlify</option>
              <option value="other">Otra</option>
            </select>
          </div>
        </div>
        <div class="onboard-actions" style="margin-top:16px;">
          <button class="topbar-btn" id="appCancel">Cancelar</button>
          <button class="btn btn-cyan" id="appSave" style="padding:10px 16px; font-size:14px;">Guardar</button>
        </div>
      </div>
    </div>

    <!-- ====== MAPA DE RUTA ====== -->
    <section class="view" data-view-content="mapa">
      <div class="roadmap-header">
        <h1 id="tabTitle">Mapa de Ruta</h1>
        <span class="roadmap-logo">JPMR NEGOCIOS</span>
      </div>

      <div class="roadmap-progress">
        <span>Progreso del Mapa de Ruta</span>
        <div class="bar"><div class="fill" id="progressFill" style="width:0%;"></div></div>
        <span class="pct" id="progressPct">0%</span>
      </div>

      <div class="tabs-bar" id="tabsBar">
        <button class="tab-btn" data-tab="1"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 2l3 7h7l-5.5 4.5L18 21l-6-4-6 4 1.5-7.5L2 9h7z"/></svg><span class="num">1</span></button>
        <button class="tab-btn" data-tab="2"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg><span class="num">2</span></button>
        <button class="tab-btn" data-tab="3"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg><span class="num">3</span></button>
        <button class="tab-btn" data-tab="4"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg><span class="num">4</span></button>
        <button class="tab-btn" data-tab="5"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="2" y1="12" x2="22" y2="12"/><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/></svg><span class="num">5</span></button>
        <button class="tab-btn" data-tab="6"><svg viewBox="0 0 24 24" fill="currentColor"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/></svg><span class="num">6</span></button>
        <button class="tab-btn" data-tab="7"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="9" y1="13" x2="15" y2="13"/><line x1="9" y1="17" x2="15" y2="17"/></svg><span class="num">7</span></button>
        <button class="tab-btn active" data-tab="8"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg><span class="num">8</span></button>
        <button class="tab-btn" data-tab="9"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72c.13.96.37 1.9.72 2.81a2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c.91.35 1.85.59 2.81.72A2 2 0 0 1 22 16.92z"/></svg><span class="num">9</span></button>
        <button class="tab-btn" data-tab="10"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M4.5 16.5c-1.5 1.26-2 5-2 5s3.74-.5 5-2c.71-.84.7-2.13-.09-2.91a2.18 2.18 0 0 0-2.91-.09z"/><path d="M12 15l-3-3a22 22 0 0 1 2-3.95A12.88 12.88 0 0 1 22 2c0 2.72-.78 7.5-6 11a22.35 22.35 0 0 1-4 2z"/><path d="M9 12H4s.55-3.03 2-4c1.62-1.08 5 0 5 0"/></svg><span class="num">10</span></button>
        <button class="tab-btn" data-tab="11"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/></svg><span class="num">11</span></button>
      </div>

      <!-- ===== TAB 1 — Áreas de Marketing ===== -->
      <div class="tab-panel" data-tab-content="1">
        <div class="claude-subheader">
          <div class="mini-badge"><span class="l1">JPMR</span><span class="l2">NEGOCIOS</span></div>
          <div>
            <h2>Áreas de Marketing</h2>
            <p class="sub">Selecciona los problemas/áreas que quieras trabajar en tu negocio</p>
          </div>
        </div>

        <div class="area-list" id="areaList">
          <button class="area-card" data-area="captacion">
            <span class="area-ic"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg></span>
            <div class="area-meta"><h4>Captación de Leads</h4><p>Sin leads nuevos, el negocio muere</p></div>
          </button>
          <button class="area-card" data-area="atencion">
            <span class="area-ic"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg></span>
            <div class="area-meta"><h4>Atención a Leads</h4><p>Lead frío = venta perdida</p></div>
          </button>
          <button class="area-card" data-area="seguimientos">
            <span class="area-ic"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="23 4 23 10 17 10"/><polyline points="1 20 1 14 7 14"/><path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"/></svg></span>
            <div class="area-meta"><h4>Seguimientos y Recordatorios</h4><p>El dinero está en el seguimiento</p></div>
          </button>
          <button class="area-card" data-area="ltv">
            <span class="area-ic"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="23 6 13.5 15.5 8.5 10.5 1 18"/><polyline points="17 6 23 6 23 12"/></svg></span>
            <div class="area-meta"><h4>Lifetime Value (LTV)</h4><p>Maximizar valor por cliente</p></div>
          </button>
          <button class="area-card" data-area="fidelizacion">
            <span class="area-ic"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/></svg></span>
            <div class="area-meta"><h4>Fidelización</h4><p>Cliente feliz = cliente que vuelve</p></div>
          </button>
          <button class="area-card" data-area="ofertas">
            <span class="area-ic"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="20 12 20 22 4 22 4 12"/><rect x="2" y="7" width="20" height="5"/><line x1="12" y1="22" x2="12" y2="7"/><path d="M12 7H7.5a2.5 2.5 0 0 1 0-5C11 2 12 7 12 7z"/><path d="M12 7h4.5a2.5 2.5 0 0 0 0-5C13 2 12 7 12 7z"/></svg></span>
            <div class="area-meta"><h4>Ofertas y Comunicación</h4><p>Tu base de datos es oro</p></div>
          </button>
          <button class="area-card" data-area="upsells">
            <span class="area-ic"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/></svg></span>
            <div class="area-meta"><h4>Upsells / Cross-sells</h4><p>Más valor por cliente = más rentabilidad</p></div>
          </button>
        </div>

        <div style="margin-top:22px; padding-top:18px; border-top:1px solid var(--input-border);">
          <p style="font-size:14px; color:var(--muted); margin-bottom:10px;">¿No encuentras tu problema? Añade uno personalizado:</p>
          <div class="nicho-add-row" style="grid-template-columns: 1fr auto;">
            <input id="customProblem" type="text" placeholder="Ej: Gestión de inventario, etc." />
            <button class="btn btn-purple" id="btnAddCustomProblem" style="padding:12px 18px;">+ Añadir</button>
          </div>
        </div>

        <div class="step-nav">
          <button class="prev" disabled><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><polyline points="15 18 9 12 15 6"/></svg> Anterior</button>
          <button class="next" data-next="2">Siguiente <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><polyline points="9 18 15 12 9 6"/></svg></button>
        </div>
      </div>

      <!-- ===== TAB 2 — Solucionar el Problema ===== -->
      <div class="tab-panel" data-tab-content="2">
        <div class="claude-subheader">
          <div class="mini-badge"><span class="l1">JPMR</span><span class="l2">NEGOCIOS</span></div>
          <div>
            <h2>Solucionar el Problema</h2>
            <p class="sub">Convierte problemas en soluciones con IA</p>
          </div>
        </div>

        <div class="empty-state" id="problemaEmpty">
          <div class="empty-ic">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M9 21h6"/><path d="M12 17v4"/><path d="M12 3a6 6 0 0 0-4 10.5c.7.8 1 1.5 1 2.5v1h6v-1c0-1 .3-1.7 1-2.5A6 6 0 0 0 12 3z"/></svg>
          </div>
          <p>Selecciona problemas en la sección anterior para ver las soluciones</p>
        </div>

        <div id="problemaSolutions" style="display:none; flex-direction:column; gap:14px;"></div>

        <div class="step-nav">
          <button class="prev" data-prev="1"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><polyline points="15 18 9 12 15 6"/></svg> Anterior</button>
          <button class="next" data-next="3">Siguiente <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><polyline points="9 18 15 12 9 6"/></svg></button>
        </div>
      </div>

      <!-- ===== TAB 3 — Seleccionar Nicho ===== -->
      <div class="tab-panel" data-tab-content="3">
        <div class="claude-subheader">
          <div class="mini-badge"><span class="l1">JPMR</span><span class="l2">NEGOCIOS</span></div>
          <div>
            <h2>Seleccionar Nicho</h2>
            <p class="sub">Elige 1 nicho específico para enfocar tu oferta</p>
          </div>
        </div>

        <div class="nicho-card">
          <div class="nicho-header">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><circle cx="12" cy="12" r="6"/><circle cx="12" cy="12" r="2"/></svg>
            <h3>Añadir Nichos</h3>
            <span class="nicho-counter" id="nichoCounter">0/1 nicho</span>
          </div>

          <div class="nicho-add-row">
            <input id="nichoInput" type="text" placeholder="Ej: Asesorías gestorías" />
            <button class="btn-outline-cyan" id="btnAnalizarNicho">Analizar Nicho</button>
            <button class="btn-solid-cyan" id="btnAnadirNicho">Añadir</button>
          </div>

          <p id="nichoLimitMsg" style="font-size:13px; color:var(--required); margin-top:-6px;" hidden>
            Solo puedes elegir 1 nicho para mantener el enfoque
          </p>

          <div id="nichoTags" style="display:flex; flex-wrap:wrap; gap:8px;"></div>
        </div>

        <button class="btn-purple-full" style="margin-top:18px;" id="btnGenerarOfertas">
          Generar Ofertas y Propuesta de Valor
        </button>

        <div class="card" id="propuestaCard" style="margin-top:18px;" hidden>
          <div style="display:flex; align-items:center; gap:10px; justify-content:space-between;">
            <h3 class="flat" style="display:flex; align-items:center; gap:8px;">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="var(--cyan)" stroke-width="2"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>
              Propuesta de Valor Transformacional
            </h3>
            <button class="btn-outline-cyan" id="btnCopiarPropuesta" style="padding:8px 14px; font-size:13px;">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="vertical-align:-2px;margin-right:4px;"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>
              Copiar
            </button>
          </div>
          <p id="propuestaTexto" style="font-size:14px; line-height:1.7; color:#d8dff5; text-align:center;"></p>
        </div>

        <div class="step-nav">
          <button class="prev" data-prev="2"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><polyline points="15 18 9 12 15 6"/></svg> Anterior</button>
          <button class="next next-disabled" data-next="4">Siguiente <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><polyline points="9 18 15 12 9 6"/></svg></button>
        </div>
      </div>

      <!-- ===== TAB 4 — Ofertas y Propuesta de Valor ===== -->
      <div class="tab-panel" data-tab-content="4">
        <div class="claude-subheader">
          <div class="mini-badge"><span class="l1">JPMR</span><span class="l2">NEGOCIOS</span></div>
          <div>
            <h2>Ofertas y Propuesta de Valor</h2>
            <p class="sub">Tres niveles de oferta listos para vender al nicho seleccionado</p>
          </div>
        </div>

        <div class="card" style="margin-bottom:18px;">
          <div style="display:flex; align-items:center; gap:12px; justify-content:space-between; flex-wrap:wrap;">
            <p style="font-size:14px; color:#d8dff5;">
              <strong style="color:#fff;">Nicho activo:</strong>
              <span id="offerNichoLabel" style="color:var(--cyan);">— ninguno —</span>
            </p>
            <button class="btn btn-purple" id="btnGenerarOfertasTab" style="padding:10px 16px; font-size:13px;">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><path d="M12 1l2.39 6.95H22l-6.19 4.5L18.18 19 12 14.77 5.82 19l2.37-6.55L2 7.95h7.61z"/></svg>
              Regenerar ofertas
            </button>
          </div>
        </div>

        <div class="offer-cards" id="offerCards">
          <!-- Generadas por JS -->
        </div>

        <div class="step-nav">
          <button class="prev" data-prev="3"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><polyline points="15 18 9 12 15 6"/></svg> Anterior</button>
          <button class="next" data-next="5">Siguiente <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><polyline points="9 18 15 12 9 6"/></svg></button>
        </div>
      </div>

      <!-- ===== TAB 5 — Landing Pages ===== -->
      <div class="tab-panel" data-tab-content="5">
        <div class="claude-subheader">
          <div class="mini-badge"><span class="l1">JPMR</span><span class="l2">NEGOCIOS</span></div>
          <div>
            <h2 style="display:flex; align-items:center; gap:10px;">
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="var(--cyan)" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="2" y1="12" x2="22" y2="12"/><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/></svg>
              Configuración de Landing Pages
            </h2>
          </div>
        </div>

        <div class="card">
          <div class="field">
            <label for="agenciaNombre">Nombre de tu Agencia</label>
            <div style="display:grid; grid-template-columns: 1fr auto; gap:8px;">
              <input id="agenciaNombre" type="text" placeholder="Ej: Asesoría castresana" />
              <button class="btn-solid-cyan" id="btnGuardarAgencia" style="padding:0 16px;" aria-label="Guardar">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
              </button>
            </div>
            <small style="color:var(--muted); font-size:12px;">Guarda el nombre para usarlo en landing pages y setter IA</small>
          </div>

          <p style="font-size:14px; color:#d8dff5; line-height:1.6;">
            Genera un prompt completo para crear landing pages de alta conversión para cada nicho.
            Incluye tu propuesta de valor, soluciones IA y está optimizado para vender tus servicios.
          </p>

          <div class="field">
            <label for="landingModalidad">Modalidad de Landing</label>
            <div class="select-wrap">
              <select id="landingModalidad">
                <option value="tradicional">Tradicional - Con formulario de contacto</option>
                <option value="vsl">VSL - Con vídeo de venta</option>
                <option value="quiz">Quiz - Con cualificación</option>
                <option value="webinar">Webinar - Con registro</option>
              </select>
            </div>
            <small style="color:var(--muted); font-size:12px;" id="modalidadHelp">Landing con formulario integrado para captar leads</small>
          </div>

          <div class="field">
            <label for="landingIdioma">Idioma de la Landing</label>
            <div class="select-wrap">
              <select id="landingIdioma">
                <option value="es">🇪🇸 Español</option>
                <option value="en">🇬🇧 Inglés</option>
                <option value="pt">🇵🇹 Portugués</option>
                <option value="fr">🇫🇷 Francés</option>
              </select>
            </div>
            <small style="color:var(--muted); font-size:12px;" id="idiomaHelp">Todo el copy de la landing se generará en español</small>
          </div>

          <div id="landingNichos" style="display:flex; flex-direction:column; gap:8px;">
            <div style="padding:14px 16px; background:var(--card-2); border:1px solid var(--input-border); border-radius:10px; display:flex; justify-content:space-between; align-items:center; color:var(--muted);">
              <span>Sin nichos. Añade uno en la sección 3.</span>
            </div>
          </div>

          <button class="btn-purple-full" id="btnGenerarLanding">
            Generar Prompt para Landing Pages
          </button>
        </div>

        <div class="step-nav">
          <button class="prev" data-prev="4"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><polyline points="15 18 9 12 15 6"/></svg> Anterior</button>
          <button class="next" data-next="6">Siguiente <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><polyline points="9 18 15 12 9 6"/></svg></button>
        </div>
      </div>

      <!-- ===== TAB 6 — SignalCore ===== -->
      <div class="tab-panel" data-tab-content="6">
        <div class="signal-banner">
          <div class="signal-logo">
            <svg viewBox="0 0 24 24" fill="none"><defs><linearGradient id="sgGrad" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#ff4d8d"/><stop offset="1" stop-color="#ffb86b"/></linearGradient></defs><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" fill="url(#sgGrad)"/></svg>
          </div>
          <div>
            <h2>SIGNALCORE</h2>
            <p>Tu appointment setter con IA</p>
          </div>
        </div>

        <div class="signal-feature">
          <div class="feat-ic">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z"/></svg>
          </div>
          <h4>WhatsApp</h4>
          <p>Conecta tu número y atiende automáticamente</p>
        </div>

        <div class="signal-feature">
          <div class="feat-ic">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="11" width="18" height="10" rx="2"/><circle cx="12" cy="5" r="2"/><path d="M12 7v4"/><line x1="8" y1="16" x2="8" y2="16"/><line x1="16" y1="16" x2="16" y2="16"/></svg>
          </div>
          <h4>IA 24/7</h4>
          <p>Responde en segundos, cualquier hora</p>
        </div>

        <div class="signal-feature">
          <div class="feat-ic">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
          </div>
          <h4>Agenda Citas</h4>
          <p>Agenda citas automáticamente</p>
        </div>

        <div style="display:flex; flex-direction:column; gap:12px; margin-top:18px;">
          <button class="btn btn-purple">Generar Prompt para Setter IA</button>
          <button class="big-cta">
            <svg class="ic-bolt" viewBox="0 0 24 24" fill="currentColor"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/></svg>
            Acceder a SignalCore
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/></svg>
          </button>
        </div>

        <div class="tip" style="margin-top:14px;">
          <span class="tip-ic">💡</span>
          <span><strong>Tip:</strong> Usa el mismo sistema que vendes. Tus propios leads serán atendidos al instante, dando el ejemplo de lo que ofreces.</span>
        </div>

        <div class="step-nav">
          <button class="prev" data-prev="5"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><polyline points="15 18 9 12 15 6"/></svg> Anterior</button>
          <button class="next" data-next="7">Siguiente <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><polyline points="9 18 15 12 9 6"/></svg></button>
        </div>
      </div>

      <!-- ===== TAB 7 — CRM ===== -->
      <div class="tab-panel" data-tab-content="7">
        <div class="tab-panel-header"><div class="tab-icon">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="9" y1="13" x2="15" y2="13"/><line x1="9" y1="17" x2="15" y2="17"/></svg></div>
          <div><h2>CRM</h2><div class="tab-panel-subtitle">Gestiona tus contactos y ventas de manera profesional</div></div>
        </div>

        <div class="card">
          <h3 class="flat">Airtable</h3>
          <p class="card-desc">Base de datos que puedes moldear a tu gusto.</p>
          <button class="btn btn-purple">Generar Prompt para crear tu base de datos</button>
          <div class="tip">
            <span class="tip-ic">💡</span>
            <span><strong>Tip:</strong> Utiliza el CRM para dar seguimiento a todos los leads generados desde tus landings y campañas.</span>
          </div>
        </div>

        <div class="step-nav">
          <button class="prev" data-prev="6"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><polyline points="15 18 9 12 15 6"/></svg> Anterior</button>
          <button class="next" data-next="8">Siguiente <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><polyline points="9 18 15 12 9 6"/></svg></button>
        </div>
      </div>

      <!-- ===== TAB 8 — Analizador de Web (Claude) ===== -->
      <div class="tab-panel active" data-tab-content="8">
        <div class="tab-panel-header"><div class="tab-icon">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg></div>
          <div><h2>Analizador de Web</h2><div class="tab-panel-subtitle">Analiza cualquier web y genera un prompt para replicarla en Base44</div></div>
        </div>

        <div class="card">
          <h3 class="flat">¿Qué hace esta herramienta?</h3>
          <p class="card-desc" style="line-height:1.6;">
            Pega la URL de cualquier página web y esta herramienta la analiza para generar un
            <span style="color:var(--accent); font-weight:700;">prompt completo listo para Base44</span>.
            El prompt incluirá colores exactos, tipografías, layout, componentes, efectos y copys mejorados para
            que puedas replicarla en tu propia app.
          </p>
          <div class="divider"></div>
          <div class="field">
            <label for="urlAnalizar">URL a analizar <span class="req">*</span></label>
            <input id="urlAnalizar" type="url" placeholder="https://ejemplo.com" />
          </div>
          <div class="row">
            <button class="btn btn-cyan" id="btnAnalizar" style="flex:1;">Analizar y generar prompt</button>
            <button class="btn btn-ghost" id="btnCopiarPrompt" disabled>Copiar</button>
          </div>
          <div class="field" id="promptResultWrap" hidden>
            <label>Prompt generado para Base44</label>
            <textarea id="promptResult" rows="10" readonly></textarea>
          </div>
        </div>

        <div class="step-nav">
          <button class="prev" data-prev="7"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><polyline points="15 18 9 12 15 6"/></svg> Anterior</button>
          <button class="next" data-next="9">Siguiente <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><polyline points="9 18 15 12 9 6"/></svg></button>
        </div>
      </div>

      <!-- ===== TAB 9 — Generador de Scripts ===== -->
      <div class="tab-panel" data-tab-content="9">
        <div class="tab-panel-header"><div class="tab-icon">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72c.13.96.37 1.9.72 2.81a2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c.91.35 1.85.59 2.81.72A2 2 0 0 1 22 16.92z"/></svg></div>
          <div><h2>Generador de Scripts</h2><div class="tab-panel-subtitle">Genera scripts personalizados para llamadas en frío</div></div>
        </div>

        <div class="card">
          <h3 class="flat">Generador de Scripts</h3>
          <p class="card-desc">Se generarán scripts para los nichos seleccionados:</p>
          <p class="muted-note" style="text-align:left;" id="nichosInfo">No hay nichos seleccionados. Vuelve a la sección 3.</p>

          <div class="field">
            <label for="scrEmpresa">Nombre de empresa (ejemplo) <span class="req">*</span></label>
            <input id="scrEmpresa" type="text" placeholder="Ej: Inmobiliaria García" />
          </div>
          <div class="field">
            <label for="scrInvestigacion">Prueba de investigación</label>
            <input id="scrInvestigacion" type="text" placeholder="Ej: Google Maps, Instagram, web sin reservas online…" />
          </div>
          <div class="field">
            <label for="scrDolor">Dolor grande detectado <span class="req">*</span></label>
            <textarea id="scrDolor" rows="3" placeholder="Ej: Leads sin responder, no-shows, pocas reservas"></textarea>
          </div>
          <div class="field">
            <label for="scrCaballo">Caballo de Troya (asset) <span class="req">*</span></label>
            <textarea id="scrCaballo" rows="3" placeholder="Ej: web, agente IA de WhatsApp, auditoría gratuita…"></textarea>
          </div>
          <button class="btn btn-primary" id="btnGenerarScript">Generar Script</button>

          <div class="field" id="scriptResultWrap" hidden>
            <label>Script generado</label>
            <textarea id="scriptResult" rows="8" readonly></textarea>
          </div>
        </div>

        <div class="step-nav">
          <button class="prev" data-prev="8"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><polyline points="15 18 9 12 15 6"/></svg> Anterior</button>
          <button class="next" data-next="10">Siguiente <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><polyline points="9 18 15 12 9 6"/></svg></button>
        </div>
      </div>

      <!-- ===== TAB 10 — Apollo / Apify ===== -->
      <div class="tab-panel" data-tab-content="10">
        <div class="tab-panel-header"><div class="tab-icon">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M4.5 16.5c-1.5 1.26-2 5-2 5s3.74-.5 5-2c.71-.84.7-2.13-.09-2.91a2.18 2.18 0 0 0-2.91-.09z"/><path d="M12 15l-3-3a22 22 0 0 1 2-3.95A12.88 12.88 0 0 1 22 2c0 2.72-.78 7.5-6 11a22.35 22.35 0 0 1-4 2z"/><path d="M9 12H4s.55-3.03 2-4c1.62-1.08 5 0 5 0"/></svg></div>
          <div><h2>Herramientas de Prospección</h2><div class="tab-panel-subtitle">Apollo + Apify para automatizar tu captación</div></div>
        </div>

        <div class="grid-2">
          <div class="tool-card">
            <h4>Apollo.io</h4>
            <div class="tool-sub">Base de datos de empresas</div>
            <p class="tool-desc">Datos de empresas. Automatiza secuencias de prospección por email y LinkedIn.</p>
            <ul>
              <li>+275M de contactos</li>
              <li>Secuencias automatizadas</li>
              <li>Integración con CRM</li>
            </ul>
            <button class="btn btn-cyan" onclick="window.open('https://apollo.io', '_blank', 'noopener')">Ir a Apollo.io</button>
          </div>

          <div class="tool-card">
            <h4>Apify</h4>
            <div class="tool-sub">Web scraping y automatización</div>
            <p class="tool-desc">Extrae datos de LinkedIn, Google Maps, redes sociales y cualquier web. Automatiza tareas repetitivas.</p>
            <ul>
              <li>Scraping de LinkedIn</li>
              <li>Extracción de Google Maps</li>
              <li>Miles de actores disponibles</li>
            </ul>
            <button class="btn btn-cyan" onclick="window.open('https://apify.com', '_blank', 'noopener')">Ir a Apify</button>
          </div>
        </div>

        <div class="tip" style="margin-top:16px;">
          <span class="tip-ic">💡</span>
          <span><strong>Tip:</strong> Combina Apollo para enriquecer contactos y Apify para extraer prospectos de Google Maps en tu nicho.</span>
        </div>

        <div class="step-nav">
          <button class="prev" data-prev="9"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><polyline points="15 18 9 12 15 6"/></svg> Anterior</button>
          <button class="next" data-next="11">Siguiente <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><polyline points="9 18 15 12 9 6"/></svg></button>
        </div>
      </div>

      <!-- ===== TAB 11 — Métricas ===== -->
      <div class="tab-panel" data-tab-content="11">
        <div class="claude-subheader">
          <div class="mini-badge"><span class="l1">JPMR</span><span class="l2">NEGOCIOS</span></div>
          <div>
            <h2>Métricas</h2>
            <p class="sub">Resumen de actividad de tu sistema de captación e IA</p>
          </div>
        </div>

        <div class="kpi-grid">
          <div class="kpi-card">
            <span class="kpi-label">Leads captados</span>
            <span class="kpi-value" data-counter="184">0</span>
            <span class="kpi-delta">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round"><polyline points="18 15 12 9 6 15"/></svg>
              +24% vs anterior
            </span>
          </div>
          <div class="kpi-card">
            <span class="kpi-label">Conversaciones IA</span>
            <span class="kpi-value" data-counter="612">0</span>
            <span class="kpi-delta">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round"><polyline points="18 15 12 9 6 15"/></svg>
              +38%
            </span>
          </div>
          <div class="kpi-card">
            <span class="kpi-label">Citas agendadas</span>
            <span class="kpi-value" data-counter="47">0</span>
            <span class="kpi-delta">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round"><polyline points="18 15 12 9 6 15"/></svg>
              +12%
            </span>
          </div>
          <div class="kpi-card">
            <span class="kpi-label">Ingresos atribuidos</span>
            <span class="kpi-value">€<span data-counter="8420">0</span></span>
            <span class="kpi-delta down">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round"><polyline points="6 9 12 15 18 9"/></svg>
              -4%
            </span>
          </div>
        </div>

        <div class="chart-card">
          <div class="chart-card-header">
            <h3>Leads últimos 7 días</h3>
            <div class="seg-control">
              <button class="active" data-range="7d">7d</button>
              <button data-range="30d">30d</button>
              <button data-range="90d">90d</button>
            </div>
          </div>
          <svg class="chart-svg" id="leadsChart" viewBox="0 0 700 200" preserveAspectRatio="none">
            <defs>
              <linearGradient id="chartGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stop-color="#22d3ee"/>
                <stop offset="100%" stop-color="#6c5ce7"/>
              </linearGradient>
            </defs>
          </svg>
        </div>

        <div class="card">
          <h3 class="flat" style="margin-bottom:14px;">Actividad reciente</h3>
          <div class="activity-list">
            <div class="activity-item">
              <span class="act-ic"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z"/></svg></span>
              <span class="act-text">Setter IA cerró cita con <strong>María González</strong></span>
              <span class="act-time">hace 12 min</span>
            </div>
            <div class="activity-item">
              <span class="act-ic" style="background:rgba(108,92,231,0.15); color:#a78bfa;"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/></svg></span>
              <span class="act-text">Nuevo lead capturado desde Landing inmobiliaria</span>
              <span class="act-time">hace 38 min</span>
            </div>
            <div class="activity-item">
              <span class="act-ic" style="background:rgba(255,77,141,0.15); color:var(--pink);"><svg viewBox="0 0 24 24" fill="currentColor"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/></svg></span>
              <span class="act-text">SignalCore atendió 8 mensajes en WhatsApp</span>
              <span class="act-time">hace 1 h</span>
            </div>
            <div class="activity-item">
              <span class="act-ic" style="background:rgba(0,215,116,0.15); color:var(--green);"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="20 6 9 17 4 12"/></svg></span>
              <span class="act-text">Flyer "Oferta primavera" generado y descargado</span>
              <span class="act-time">hace 3 h</span>
            </div>
            <div class="activity-item">
              <span class="act-ic" style="background:rgba(251,188,4,0.15); color:#fbbc04;"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg></span>
              <span class="act-text">Cliente firmó contrato de servicio mensual</span>
              <span class="act-time">ayer</span>
            </div>
          </div>
        </div>

        <div class="step-nav">
          <button class="prev" data-prev="10"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><polyline points="15 18 9 12 15 6"/></svg> Anterior</button>
          <button class="next" data-next="1" style="opacity:0.5;">Reiniciar →</button>
        </div>
      </div>
    </section>

    <!-- ====== CREADOR DE CONTENIDO (Flyer Creator) ====== -->
    <section class="view" data-view-content="creador">
      <header class="page-header">
        <button class="back-btn" aria-label="Volver" onclick="switchView('mapa')">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="19" y1="12" x2="5" y2="12"/><polyline points="12 19 5 12 12 5"/></svg>
        </button>
        <div>
          <h1 class="page-title">Crear Anuncios Tipo Flyers</h1>
          <p class="page-subtitle">Genera flyers para captar clientes utilizando la inteligencia artificial</p>
        </div>
      </header>

      <form id="flyerForm" class="grid-2" onsubmit="return false;">
        <section class="card">
          <h3>Configuración del Flyer</h3>
          <div class="field">
            <label for="nicho">Nicho <span class="req">*</span></label>
            <input id="nicho" type="text" placeholder="Ej: Inmobiliaria" />
          </div>
          <div class="field">
            <label for="cliente">Cliente Final <span class="req">*</span></label>
            <div class="select-wrap">
              <select id="cliente">
                <option value="">Selecciona una opción</option>
                <option value="B2C">B2C (Consumidor final)</option>
                <option value="B2B">B2B (Empresas)</option>
                <option value="B2G">B2G (Sector público)</option>
                <option value="MIXTO">Mixto</option>
              </select>
            </div>
          </div>
          <div class="field">
            <label for="problema">Problema o Deseo Principal <span class="req">*</span></label>
            <textarea id="problema" rows="3" placeholder="Ej: Captar clientes y atención 24/7 y colgar vídeos en Instagram y TikTok"></textarea>
          </div>
          <div class="field">
            <label for="oferta">Oferta <span class="req">*</span></label>
            <textarea id="oferta" rows="2" placeholder="Ej: Sistema de automatización de reservas con IA"></textarea>
          </div>
          <div class="field">
            <label for="tono">Tono del Anuncio <span class="req">*</span></label>
            <textarea id="tono" rows="2" placeholder="Ej: Urgente, profesional, cercano, exclusivo…"></textarea>
          </div>
          <div class="field">
            <label for="formato1">Formato de Imagen <span class="req">*</span></label>
            <div class="select-wrap">
              <select id="formato1">
                <option value="1080x1080">Cuadrado (1080x1080) - Feed</option>
                <option value="1080x1350">Vertical (1080x1350) - Feed</option>
                <option value="1080x1920">Story (1080x1920)</option>
                <option value="1200x628">Horizontal (1200x628) - Ads</option>
              </select>
            </div>
          </div>
          <button type="button" class="btn btn-primary" id="btnGenerar">Generar Flyer</button>
        </section>

        <div style="display:flex; flex-direction:column; gap:18px;">
          <section class="card">
            <div>
              <h3>Imágenes de Referencia</h3>
              <p class="card-desc" style="margin-top:8px;">Sube imágenes de ejemplo para mejorar la calidad de generación</p>
            </div>
            <div id="thumbList" style="display:flex; flex-direction:column; gap:12px;"></div>
            <label class="upload-box dashed-cyan" for="refUpload">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>
              <span class="upload-text">Añadir imagen de referencia</span>
            </label>
            <input type="file" id="refUpload" class="upload-input" accept="image/*" multiple />
            <div class="field">
              <label for="instrucciones">Instrucciones para el flyer</label>
              <textarea id="instrucciones" rows="3" placeholder="Ej: Cambiar el texto por 'Nueva oferta especial', mantener el diseño pero corregir la palabra 'automático', usar misma paleta de colores…"></textarea>
            </div>
            <div class="field">
              <label for="formato2">Formato de Imagen</label>
              <div class="select-wrap">
                <select id="formato2">
                  <option value="1080x1080">Cuadrado (1080x1080)</option>
                  <option value="1080x1350">Vertical (1080x1350)</option>
                  <option value="1080x1920">Story (1080x1920)</option>
                  <option value="1200x628">Horizontal (1200x628)</option>
                </select>
              </div>
            </div>
            <button type="button" class="btn btn-primary" id="btnGenerarRef">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M12 1l2.39 6.95H22l-6.19 4.5L18.18 19 12 14.77 5.82 19l2.37-6.55L2 7.95h7.61z"/></svg>
              Generar Flyer
            </button>
          </section>

          <section class="card">
            <div>
              <h3>Generación Directa con Prompt</h3>
              <p class="card-desc" style="margin-top:8px;">Genera un flyer directamente con tu propio prompt (sin formulario)</p>
            </div>
            <div class="field">
              <textarea id="prompt" rows="4" placeholder="Escribe tu prompt aquí… Ej: Crea un flyer para un gimnasio con estilo moderno, colores neón, que promocione membresías mensuales…"></textarea>
            </div>
            <button type="button" class="btn btn-primary" id="btnGenerarPrompt">Generar con Prompt</button>
          </section>

          <div style="display:flex; flex-direction:column; gap:8px;">
            <button type="button" class="btn btn-green" id="btnGPT">Ir a GPT Prompting de Flyers</button>
            <p style="text-align:center; font-size:12px; color:var(--muted);">Genera prompts optimizados con nuestro GPT especializado</p>
          </div>
        </div>
      </form>

      <section class="result-card" id="resultCard" hidden>
        <h3>Flyer Generado</h3>
        <div id="resultArea">
          <div class="result-placeholder" id="resultPlaceholder">Aquí aparecerá tu flyer cuando lo generes.</div>
        </div>
        <button type="button" class="btn download-btn" id="btnDescargar" hidden>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
          Descargar Flyer
        </button>
      </section>
    </section>

    <!-- ====== PROYECTOS ====== -->
    <section class="view" data-view-content="proyectos">
      <div class="projects-header">
        <h1>Mis Proyectos</h1>
        <button class="btn btn-cyan" id="btnNuevoProyecto" style="padding:10px 16px; font-size:14px;">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
          Nuevo proyecto
        </button>
      </div>
      <div class="projects-grid" id="projectsGrid"></div>
      <div id="projectsEmpty" class="placeholder-view" style="display:none;">
        <h2>Aún no tienes proyectos</h2>
        <p>Pulsa "Nuevo proyecto" para crear el primero.</p>
      </div>
    </section>

    <!-- ====== AJUSTES ====== -->
    <section class="view" data-view-content="ajustes">
      <h1 class="dashboard-title">Ajustes</h1>

      <div class="settings-section">
        <h3>Perfil</h3>
        <div class="settings-row">
          <div class="label">
            Nombre
            <small>Cómo te llamamos en la app.</small>
          </div>
          <input class="topbar-btn" id="setUserName" type="text" value="PAU Rodríguez" style="border:1px solid var(--input-border); background:var(--input); padding:8px 12px; min-width:200px;" />
        </div>
        <div class="settings-row">
          <div class="label">
            Email
            <small>Solo para identificación local.</small>
          </div>
          <input class="topbar-btn" id="setUserEmail" type="email" value="appsmovilpau@gmail.com" style="border:1px solid var(--input-border); background:var(--input); padding:8px 12px; min-width:240px;" />
        </div>
      </div>

      <div class="settings-section">
        <h3>Apariencia e idioma</h3>
        <div class="settings-row">
          <div class="label">Tema<small>Claro u oscuro.</small></div>
          <div class="seg-control" id="themeSeg">
            <button data-theme="dark" class="active">🌙 Oscuro</button>
            <button data-theme="light">☀️ Claro</button>
          </div>
        </div>
        <div class="settings-row">
          <div class="label">Idioma<small>Idioma de la interfaz.</small></div>
          <div class="seg-control" id="langSeg">
            <button data-lang="es" class="active">🇪🇸 ES</button>
            <button data-lang="en">🇬🇧 EN</button>
          </div>
        </div>
        <div class="settings-row">
          <div class="label">Sidebar colapsado<small>Reduce el menú a iconos.</small></div>
          <div class="toggle" id="toggleSidebar"></div>
        </div>
      </div>

      <div class="settings-section">
        <h3>Claves API (opcional)</h3>
        <p style="font-size:13px; color:var(--muted); margin-bottom:10px;">
          Si pegas tu API key se usará para llamadas reales a la IA en lugar de respuestas simuladas.
          <strong style="color:var(--accent);">Se guardan solo en tu navegador (localStorage)</strong>, nunca se envían a ningún servidor de terceros.
        </p>

        <div style="margin-top:14px;">
          <span class="api-provider-label anthropic"><span class="dot"></span> Anthropic (Claude)</span>
          <div class="api-key-row">
            <input id="keyAnthropic" type="password" placeholder="sk-ant-..." autocomplete="off" />
            <span class="status" id="statusAnthropic" aria-label="Estado"></span>
          </div>
        </div>

        <div style="margin-top:14px;">
          <span class="api-provider-label google"><span class="dot"></span> Google (Gemini)</span>
          <div class="api-key-row">
            <input id="keyGoogle" type="password" placeholder="AIza..." autocomplete="off" />
            <span class="status" id="statusGoogle" aria-label="Estado"></span>
          </div>
        </div>

        <div style="margin-top:14px;">
          <span class="api-provider-label openai"><span class="dot"></span> OpenAI (ChatGPT)</span>
          <div class="api-key-row">
            <input id="keyOpenAI" type="password" placeholder="sk-..." autocomplete="off" />
            <span class="status" id="statusOpenAI" aria-label="Estado"></span>
          </div>
        </div>

        <div style="margin-top:14px;">
          <span class="api-provider-label abacus"><span class="dot"></span> Abacus AI (ChatLLM)</span>
          <div class="api-key-row">
            <input id="keyAbacus" type="password" placeholder="s2_..." autocomplete="off" />
            <span class="status" id="statusAbacus" aria-label="Estado"></span>
          </div>
          <small style="display:block; margin-top:6px; color:var(--muted); font-size:11px;">
            Funciona con tu cuenta y suscripción personal de Abacus.AI · ChatLLM.
            Consigue tu API key en <a href="https://abacus.ai/help/getting-started" target="_blank" rel="noopener" style="color:var(--cyan);">abacus.ai → Help → API</a>.
          </small>
          <div class="cr2-row" style="margin-top:10px;">
            <div class="cr2-field">
              <label for="abacusModel" style="color:var(--fg);">Modelo Abacus</label>
              <select id="abacusModel" style="background:var(--input); color:var(--fg); border:1px solid var(--input-border);">
                <option value="gpt-4o-mini">GPT-4o mini (rápido y barato)</option>
                <option value="gpt-4o">GPT-4o</option>
                <option value="claude-3-5-sonnet">Claude 3.5 Sonnet</option>
                <option value="claude-3-5-haiku">Claude 3.5 Haiku</option>
                <option value="gemini-1.5-pro">Gemini 1.5 Pro</option>
                <option value="gemini-2.0-flash">Gemini 2.0 Flash</option>
                <option value="llama-3.3-70b">Llama 3.3 70B</option>
                <option value="abacus-smaug-72b">Abacus Smaug 72B</option>
              </select>
            </div>
            <div class="cr2-field">
              <label for="preferredAI" style="color:var(--fg);">IA preferida</label>
              <select id="preferredAI" style="background:var(--input); color:var(--fg); border:1px solid var(--input-border);">
                <option value="auto">Auto (primera disponible)</option>
                <option value="anthropic">Claude (Anthropic)</option>
                <option value="abacus">Abacus AI</option>
                <option value="google">Gemini (Google)</option>
                <option value="openai">OpenAI</option>
              </select>
            </div>
          </div>
        </div>

        <div style="margin-top:14px; display:flex; gap:10px; align-items:center; flex-wrap:wrap;">
          <button class="topbar-btn" id="btnTestAI" style="padding:10px 16px;">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
            Probar conexión
          </button>
          <span id="aiStatus" style="font-size:12px; color:var(--muted);"></span>
        </div>
      </div>

      <div class="settings-section">
        <h3>Datos</h3>
        <div class="settings-row">
          <div class="label">Exportar configuración<small>Descarga un JSON con todos tus datos.</small></div>
          <button class="topbar-btn" id="btnExport">Exportar JSON</button>
        </div>
        <div class="settings-row">
          <div class="label">Importar configuración<small>Restaura desde un JSON exportado.</small></div>
          <label class="topbar-btn" style="cursor:pointer;">
            Importar JSON
            <input type="file" id="fileImport" accept="application/json" style="display:none;" />
          </label>
        </div>
        <div class="settings-row">
          <div class="label">Borrar todo<small style="color:var(--danger);">Acción irreversible.</small></div>
          <button class="topbar-btn" id="btnReset" style="border-color:var(--danger); color:var(--danger);">Borrar y reiniciar</button>
        </div>
      </div>

      <div class="settings-section">
        <h3>Sobre la app</h3>
        <div class="settings-row">
          <div class="label">Versión<small>Plataforma personal de Pau Moralejo.</small></div>
          <span style="font-size:13px; color:var(--muted); font-family:'SF Mono', Monaco, monospace;">Ayuda de Negocios JPMR · v1.1.0</span>
        </div>
        <div class="settings-row">
          <div class="label">Atajos de teclado<small>Combinaciones disponibles.</small></div>
          <button class="topbar-btn" onclick="document.getElementById('cmdOverlay').classList.add('open'); document.getElementById('cmdInput').focus();">Ver atajos</button>
        </div>
      </div>
    </section>

    <!-- ====== CASTRESANA RENDER AI — Replica 1:1 ====== -->
    <section class="view" data-view-content="castrender">
      <div class="cr2-app">
        <!-- Top brand bar -->
        <header class="cr2-topbar">
          <div class="cr2-brand">
            <div class="cr2-logo">
              <svg viewBox="0 0 24 24" fill="none"><path d="M12 2l1.7 4.6L18 8l-4.3 1.4L12 14l-1.7-4.6L6 8l4.3-1.4L12 2z" fill="white"/><circle cx="18" cy="6" r="1.6" fill="white"/></svg>
            </div>
            <h1>Castresana Render AI</h1>
          </div>
          <button class="cr2-login" id="cr2Login">Iniciar Sesión</button>
        </header>

        <!-- Hero subtitle -->
        <div class="cr2-hero">
          <h2>Renders 3D top-down con IA</h2>
          <p>Perfecto para presentar propiedades inmobiliarias en <strong>Asturias y Cantabria</strong>.</p>
        </div>

        <!-- 3 step cards -->
        <div class="cr2-steps">
          <div class="cr2-step">
            <div class="cr2-step-ic">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>
            </div>
            <h3>Sube Planos</h3>
            <p>Carga tus planos 2D o fotos de propiedades</p>
          </div>
          <div class="cr2-step">
            <div class="cr2-step-ic">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 2l1.7 4.6L18 8l-4.3 1.4L12 14l-1.7-4.6L6 8l4.3-1.4L12 2z"/><circle cx="18" cy="6" r="1.5"/><circle cx="6" cy="18" r="1.5"/></svg>
            </div>
            <h3>IA Genera Renders</h3>
            <p>Crea visualizaciones 3D top-down en minutos</p>
          </div>
          <div class="cr2-step">
            <div class="cr2-step-ic">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/><line x1="18" y1="3" x2="18" y2="7"/><line x1="16" y1="5" x2="20" y2="5"/></svg>
            </div>
            <h3>Descarga Resultados</h3>
            <p>Exporta tus renders en alta resolución</p>
          </div>
        </div>

        <!-- Main flow -->
        <div class="cr2-workspace">
          <!-- Step 1: Upload -->
          <section class="cr2-card cr2-upload-card">
            <div class="cr2-card-head">
              <span class="cr2-num">1</span>
              <h3>Sube tu plano o foto</h3>
            </div>

            <label class="cr2-dropzone" for="cr2File" id="cr2Drop">
              <div class="cr2-drop-empty" id="cr2DropEmpty">
                <svg viewBox="0 0 48 48" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M42 30v8a4 4 0 0 1-4 4H10a4 4 0 0 1-4-4v-8"/><polyline points="34 16 24 6 14 16"/><line x1="24" y1="6" x2="24" y2="30"/></svg>
                <strong>Arrastra tu plano aquí</strong>
                <span>o pulsa para seleccionar — PNG, JPG, PDF (máx. 20 MB)</span>
              </div>
              <img id="cr2DropImg" alt="Plano subido" />
            </label>
            <input id="cr2File" type="file" accept="image/*,application/pdf" style="display:none;" />

            <div class="cr2-row" id="cr2OptsRow">
              <div class="cr2-field">
                <label for="cr2Tipo">Tipo de propiedad</label>
                <select id="cr2Tipo">
                  <option value="piso">Piso</option>
                  <option value="atico">Ático</option>
                  <option value="chalet">Chalet</option>
                  <option value="duplex">Dúplex</option>
                  <option value="local">Local comercial</option>
                  <option value="oficina">Oficina</option>
                </select>
              </div>
              <div class="cr2-field">
                <label for="cr2Estilo">Estilo de render</label>
                <select id="cr2Estilo">
                  <option value="moderno">Moderno</option>
                  <option value="escandinavo">Escandinavo</option>
                  <option value="minimalista">Minimalista</option>
                  <option value="lujo">Lujo</option>
                  <option value="industrial">Industrial / Loft</option>
                  <option value="rustico">Rústico</option>
                </select>
              </div>
            </div>

            <div class="cr2-row">
              <div class="cr2-field">
                <label for="cr2Luz">Iluminación</label>
                <select id="cr2Luz">
                  <option value="dia">Diurna</option>
                  <option value="atardecer">Atardecer</option>
                  <option value="noche">Nocturna (cálida)</option>
                </select>
              </div>
              <div class="cr2-field">
                <label for="cr2Calidad">Calidad</label>
                <select id="cr2Calidad">
                  <option value="standard">Standard (1024×1024)</option>
                  <option value="hd">HD (2048×2048)</option>
                  <option value="4k">4K (4096×4096) · premium</option>
                </select>
              </div>
            </div>

            <div class="cr2-field">
              <label for="cr2Extra">Instrucciones adicionales (opcional)</label>
              <textarea id="cr2Extra" rows="2" placeholder="Ej: Tonos claros, suelos de madera, plantas, sofá esquinero"></textarea>
            </div>

            <details class="cr2-details">
              <summary>Datos comerciales del inmueble <span style="color:var(--cr-muted); font-weight:500;">(para brochure / WhatsApp)</span></summary>
              <div class="cr2-row" style="margin-top:10px;">
                <div class="cr2-field"><label for="cr2Titulo">Título</label><input id="cr2Titulo" type="text" placeholder="Ej: Apartamentos Paraíso Urbano" /></div>
                <div class="cr2-field"><label for="cr2Precio">Precio</label><input id="cr2Precio" type="text" placeholder="€ 295.000" /></div>
              </div>
              <div class="cr2-row">
                <div class="cr2-field"><label for="cr2M2">m²</label><input id="cr2M2" type="number" placeholder="120" /></div>
                <div class="cr2-field"><label for="cr2Hab">Habitaciones</label><input id="cr2Hab" type="number" placeholder="3" /></div>
              </div>
              <div class="cr2-field"><label for="cr2Ubic">Ubicación</label><input id="cr2Ubic" type="text" placeholder="Oviedo, Asturias" /></div>
              <div class="cr2-field"><label for="cr2Contacto">Contacto</label><input id="cr2Contacto" type="text" placeholder="+34 696 000 000 · info@castresana.es" /></div>
            </details>

            <button class="cr2-btn cr2-btn-primary" id="cr2Generar">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M12 2l1.7 4.6L18 8l-4.3 1.4L12 14l-1.7-4.6L6 8l4.3-1.4L12 2z"/></svg>
              Generar render con IA
            </button>
          </section>

          <!-- Step 2: Result -->
          <section class="cr2-card cr2-result-card">
            <div class="cr2-card-head">
              <span class="cr2-num">2</span>
              <h3>Tu render 3D</h3>
            </div>

            <div class="cr2-canvas" id="cr2Canvas">
              <div class="cr2-canvas-empty">
                <svg viewBox="0 0 48 48" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><rect x="6" y="6" width="36" height="36" rx="4"/><circle cx="17" cy="17" r="3"/><polyline points="42 30 32 20 10 42"/></svg>
                <span>El render aparecerá aquí</span>
              </div>
            </div>

            <div class="cr2-result-actions" id="cr2Actions" style="display:none;">
              <button class="cr2-btn cr2-btn-ghost" id="cr2Regen">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><polyline points="23 4 23 10 17 10"/><polyline points="1 20 1 14 7 14"/><path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"/></svg>
                Variar
              </button>
              <button class="cr2-btn cr2-btn-ghost" id="cr2Wa" title="Enviar por WhatsApp">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><path d="M17.5 14.4c-.3-.1-1.7-.8-2-.9s-.5-.2-.7.2c-.2.3-.8.9-1 1.1-.2.2-.4.2-.6 0-.7-.3-1.6-.8-2.4-1.5-.8-.7-1.4-1.5-1.5-1.7-.2-.3 0-.4.1-.6.1-.1.3-.3.4-.5.1-.2.2-.3.3-.5.1-.2 0-.3 0-.5-.1-.2-.7-1.7-1-2.3-.2-.6-.5-.5-.7-.5h-.6c-.2 0-.5.1-.8.4-.3.3-1 1-1 2.4 0 1.4 1 2.8 1.1 3 .2.2 2.1 3.2 5.1 4.4.7.3 1.3.5 1.7.6.7.2 1.4.2 1.9.1.6-.1 1.7-.7 2-1.4.2-.7.2-1.2.2-1.4-.1-.1-.3-.2-.5-.3zM12 2C6.5 2 2 6.5 2 12c0 1.9.5 3.7 1.5 5.3L2 22l4.8-1.5c1.5.8 3.3 1.3 5.2 1.3 5.5 0 10-4.5 10-10S17.5 2 12 2z"/></svg>
                WhatsApp
              </button>
              <button class="cr2-btn cr2-btn-ghost" id="cr2Brochure" title="Generar brochure A4">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="9" y1="13" x2="15" y2="13"/><line x1="9" y1="17" x2="15" y2="17"/></svg>
                Brochure
              </button>
              <button class="cr2-btn cr2-btn-primary" id="cr2Descargar">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
                Descargar
              </button>
            </div>

            <div class="cr2-history-block" id="cr2History">
              <div class="cr2-history-head">
                <strong>Historial</strong>
                <span id="cr2HistoryCount">0 renders</span>
              </div>
              <div class="cr2-history-list" id="cr2HistoryList"></div>
            </div>
          </section>
        </div>

        <footer class="cr2-footer">
          <span>© Castresana Render AI · Asturias & Cantabria</span>
          <span class="cr2-badge">Powered by IA · JPMR Negocios</span>
        </footer>
      </div>

      <!-- Brochure A4 modal -->
      <div class="cr2-brochure-modal" id="cr2BrochureModal" role="dialog" aria-modal="true">
        <div class="cr2-brochure-paper" id="cr2BrochurePaper">
          <button class="cr2-bro-close" onclick="document.getElementById('cr2BrochureModal').classList.remove('open')" aria-label="Cerrar">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
          </button>
          <div class="cr2-bro-actions">
            <button id="cr2BroDescargar">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
              Descargar brochure
            </button>
            <button id="cr2BroImprimir">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><polyline points="6 9 6 2 18 2 18 9"/><path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"/><rect x="6" y="14" width="12" height="8"/></svg>
              Imprimir / PDF
            </button>
          </div>
          <!-- Content rendered dynamically -->
        </div>
      </div>
    </section>

    <!-- ====== AYUDA / ¿Qué es El Constructor? ====== -->
    <section class="view" data-view-content="ayuda">
      <div class="help-hero">
        <div class="help-hero-badge">
          <span class="l1">JPMR</span><span class="l2">NEGOCIOS</span>
        </div>
        <h1>Ayuda de Negocios JPMR</h1>
        <p class="help-lead">
          Plataforma personal de <strong>Pau Moralejo Rodríguez</strong> para empaquetar y entregar
          servicios de IA y automatización para negocios reales: <strong>landings, agentes de WhatsApp 24/7,
          CRM, generación de contenido y Castresana Render AI</strong> para inmobiliarias en Asturias y Cantabria.
          Inspirada en la metodología de <a href="https://campus.mkthackers.com/academy/" target="_blank" rel="noopener" style="color:var(--cyan);">MKT Hackers Academy</a>.
        </p>
        <div style="display:flex; gap:10px; flex-wrap:wrap; margin-top:6px;">
          <button class="btn btn-cyan" style="padding:10px 16px; font-size:14px;" onclick="switchView('castrender')">
            Probar Castresana Render AI
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><line x1="5" y1="12" x2="19" y2="12"/><polyline points="12 5 19 12 12 19"/></svg>
          </button>
          <a href="https://campus.mkthackers.com/academy/" target="_blank" rel="noopener" class="btn btn-ghost" style="padding:10px 16px; font-size:14px;">
            Ir al campus de MKT Hackers
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/></svg>
          </a>
        </div>
      </div>

      <div class="help-grid">
        <div class="card help-card">
          <div class="help-ic" style="background:rgba(159,231,245,0.1); color:var(--cyan);">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 10v6M2 10l10-5 10 5-10 5z"/><path d="M6 12v5c3 3 9 3 12 0v-5"/></svg>
          </div>
          <h3 class="flat">Qué es la Academy</h3>
          <ul class="help-list">
            <li>Formación online creada por <strong>Miriam Lao</strong>, centrada en aplicar IA y automatización al marketing y a los negocios de servicios.</li>
            <li>Su promesa: montar una agencia de servicios de IA (agentes, automatizaciones, webs, contenidos) aunque empieces desde cero en marketing o programación.</li>
            <li>Más de <strong>2.000 alumnos</strong> han pasado por la academia, la mayoría sin experiencia técnica previa.</li>
          </ul>
        </div>

        <div class="card help-card">
          <div class="help-ic" style="background:rgba(108,92,231,0.12); color:#a78bfa;">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="9" y1="15" x2="15" y2="15"/><line x1="9" y1="11" x2="15" y2="11"/></svg>
          </div>
          <h3 class="flat">Qué ofrece a nivel de contenidos</h3>
          <ul class="help-list">
            <li>Módulos para usar herramientas de IA (chatbots, generación de contenido, automatizaciones) aplicadas a negocios reales.</li>
            <li>Crear ofertas y servicios de IA para empresas: agentes que atienden 24/7, automatización de leads, embudos…</li>
            <li>Parte fuerte de negocio: captar clientes, cerrar ventas, fijar precios y estructurar un modelo tipo agencia o <em>dropservicing</em>.</li>
            <li>Rutas paso a paso pensadas para lanzar servicios facturables en pocas semanas, no quedarse solo en teoría.</li>
          </ul>
          <p class="help-example">
            <strong>Ejemplo típico:</strong> vender a una pyme un agente de IA que responda leads y cierre citas, montado con sus plantillas y "El Constructor", y cobrarle mensualidad.
          </p>
        </div>

        <div class="card help-card">
          <div class="help-ic" style="background:rgba(0,215,116,0.12); color:var(--green);">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>
          </div>
          <h3 class="flat">Acompañamiento, comunidad y formato</h3>
          <ul class="help-list">
            <li>No es solo un curso grabado: incluye clases en vivo frecuentes (≈ <strong>4 por semana</strong>) para resolver dudas y hacer práctica.</li>
            <li>Comunidad activa de alumnos donde se comparten casos, resultados y dudas del día a día.</li>
            <li>Plantillas, flujos, guiones y sistemas ya listos para aplicar directamente en clientes (funnels, automatizaciones, copies…).</li>
          </ul>
        </div>

        <div class="card help-card">
          <div class="help-ic" style="background:rgba(255,77,141,0.12); color:var(--pink);">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/></svg>
          </div>
          <h3 class="flat">Herramienta propia: "El Constructor"</h3>
          <ul class="help-list">
            <li>La academy se apoya mucho en su software propio llamado <strong>El Constructor</strong>.</li>
            <li>Con unos pocos clics puedes crear <strong>páginas web, agentes de IA y creatividades</strong> para campañas sin necesidad de programar.</li>
            <li>La idea: el stack técnico está resuelto y tú te enfocas en vender, implementar y gestionar clientes.</li>
          </ul>
        </div>

        <div class="card help-card help-card-wide">
          <div class="help-ic" style="background:rgba(251,188,4,0.12); color:#fbbc04;">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
          </div>
          <h3 class="flat">Para quién encaja mejor</h3>
          <ul class="help-list">
            <li><strong>Emprendedores</strong> que quieren montar una agencia de servicios de IA/automatización y no quieren pelearse con código.</li>
            <li><strong>Freelancers</strong> de marketing, tráfico o consultoría que quieren subir ticket ofreciendo sistemas de IA en vez de solo "horas de trabajo".</li>
            <li>Personas que parten de cero en marketing/tech pero buscan un camino muy guiado, con sistema ya probado y soporte en comunidad.</li>
          </ul>
        </div>
      </div>

      <div class="card" style="margin-top:22px; text-align:center;">
        <h3 class="flat" style="text-align:center;">¿Quieres entrar al curso?</h3>
        <p style="color:var(--muted); font-size:14px;">El acceso oficial está en el campus de MKT Hackers.</p>
        <a href="https://campus.mkthackers.com/academy/" target="_blank" rel="noopener" class="big-cta" style="text-decoration:none; margin-top:10px;">
          <svg class="ic-bolt" viewBox="0 0 24 24" fill="currentColor"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/></svg>
          Ir a campus.mkthackers.com/academy
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/></svg>
        </a>
      </div>

      <!-- ===== Análisis técnico ===== -->
      <div class="analysis-divider">
        <span>Análisis técnico</span>
      </div>

      <div class="card analysis-intro">
        <h3 class="flat">Lectura técnica honesta</h3>
        <p>
          <strong>El Constructor</strong> se posiciona más como un <em>industrializador</em> de entregables
          para agencias de IA que como una plataforma abierta de automatización empresarial. La información pública
          habla de crear webs, agentes y creatividades "en pocos clics" con foco en captar clientes y vender servicios
          sin programar — pero <strong>no hay documentación pública con APIs, arquitectura, límites de concurrencia,
          logs, seguridad, versionado o SLA</strong>. Lo que sigue es análisis de capacidades declaradas, no auditoría.
        </p>
      </div>

      <div class="help-grid">
        <div class="card help-card">
          <div class="help-ic" style="background:rgba(34,211,238,0.12); color:var(--cyan);">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>
          </div>
          <h3 class="flat">Personalización por sector</h3>
          <p style="font-size:14px; color:#d8dff5; line-height:1.6;">
            Incorpora contexto de negocio y genera un prompt a medida + calendarios/flujos por nicho.
            Es <strong>personalización de configuración</strong>, no de arquitectura profunda.
          </p>
          <div class="badge-grid">
            <div class="sector-badge good">
              <strong>Funciona bien</strong>
              <span>Peluquerías · Clínicas pequeñas · Restaurantes · Gimnasios · Inmobiliarias con flujo simple de cita / lead / seguimiento</span>
            </div>
            <div class="sector-badge bad">
              <strong>Se queda corto</strong>
              <span>Sectores con CRM/ERP propio, facturación, inventario, compliance, histórico o reglas complejas — ahí hace falta API real, webhooks, BBDD y reglas de negocio</span>
            </div>
          </div>
        </div>

        <div class="card help-card">
          <div class="help-ic" style="background:rgba(108,92,231,0.15); color:#a78bfa;">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 21h18"/><path d="M5 21V9l7-5 7 5v12"/><path d="M10 21v-6h4v6"/></svg>
          </div>
          <h3 class="flat">Caso inmobiliario</h3>
          <ul class="help-list">
            <li><strong>Útil para:</strong> responder leads de Idealista/web, filtrar comprador/vendedor, agendar visita, recordatorios, captura de datos del inmueble, seguimiento y reactivación de leads fríos.</li>
            <li><strong>Insuficiente para:</strong> valoración automática seria conectada a CRM, histórico de operaciones, catastro, portales, scoring financiero, documentación, firma, pipeline comercial y reporting multiagente.</li>
          </ul>
        </div>

        <div class="card help-card help-card-wide">
          <div class="help-ic" style="background:rgba(251,107,107,0.12); color:#ff8a8a;">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z"/></svg>
          </div>
          <h3 class="flat">Mantenimiento que requerirá el cliente final</h3>
          <p style="font-size:14px; color:var(--muted); line-height:1.6;">
            Aunque se venda como no-code, cualquier agente instalado en un negocio necesita mantenimiento continuo.
            Como mínimo:
          </p>
          <ul class="help-list">
            <li><strong>Actualización del conocimiento:</strong> horarios, precios, servicios, stock, políticas, objeciones, promociones.</li>
            <li><strong>Revisión de conversaciones:</strong> detectar respuestas incorrectas, leads mal cualificados, llamadas perdidas, alucinaciones, mala transferencia a humano.</li>
            <li><strong>Mantenimiento de integraciones:</strong> calendarios, telefonía, WhatsApp, formularios, CRM, emails, permisos OAuth — fallan o caducan.</li>
            <li><strong>Optimización comercial:</strong> scripts, tono, cualificación, criterios de lead caliente, secuencias de seguimiento.</li>
            <li><strong>Control de costes:</strong> llamadas, tokens, voz, mensajes — crecen con el volumen.</li>
            <li><strong>Cumplimiento legal:</strong> consentimiento, grabación, RGPD, trazabilidad, datos sensibles.</li>
          </ul>
          <p class="help-example">
            <strong>Pregunta clave antes de venderlo como solución profesional:</strong> ¿hay modelo de mantenimiento,
            SLA, monitorización, logs, testing, control de versiones y handoff técnico al cliente final? La doc
            pública no lo detalla — no significa que no exista, pero hay que preguntarlo.
          </p>
        </div>

        <div class="card help-card help-card-wide">
          <div class="help-ic" style="background:rgba(0,215,116,0.12); color:var(--green);">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M9 11H1v3h8v3l4-4-4-4v2z"/><path d="M22 12c0-5.5-4.5-10-10-10S2 6.5 2 12"/></svg>
          </div>
          <h3 class="flat">Limitaciones vs Make / Zapier / agentes avanzados</h3>
          <p style="font-size:14px; color:var(--muted); line-height:1.6; margin-bottom:6px;">
            El Constructor está optimizado para <strong>velocidad y empaquetado</strong>.
            Make, Zapier, n8n, Vapi/Retell y APIs propias están optimizadas para
            <strong>integración, orquestación y operación a escala</strong>.
          </p>

          <div class="compare-table">
            <div class="compare-row compare-head">
              <div>Capacidad</div>
              <div>El Constructor</div>
              <div>Make / Zapier / n8n</div>
              <div>Custom (APIs / agente propio)</div>
            </div>
            <div class="compare-row">
              <div data-label="Capacidad">Time-to-demo</div>
              <div data-label="El Constructor" class="cell-good">Muy rápido</div>
              <div data-label="Make/Zapier/n8n" class="cell-mid">Rápido</div>
              <div data-label="Custom" class="cell-bad">Lento</div>
            </div>
            <div class="compare-row">
              <div data-label="Capacidad">Integraciones a medida</div>
              <div data-label="El Constructor" class="cell-bad">Limitadas</div>
              <div data-label="Make/Zapier/n8n" class="cell-good">Amplias</div>
              <div data-label="Custom" class="cell-good">Total</div>
            </div>
            <div class="compare-row">
              <div data-label="Capacidad">Observabilidad / logs</div>
              <div data-label="El Constructor" class="cell-bad">Opaca</div>
              <div data-label="Make/Zapier/n8n" class="cell-mid">Básica</div>
              <div data-label="Custom" class="cell-good">Total</div>
            </div>
            <div class="compare-row">
              <div data-label="Capacidad">Control de errores y retries</div>
              <div data-label="El Constructor" class="cell-bad">Limitado</div>
              <div data-label="Make/Zapier/n8n" class="cell-good">Sí</div>
              <div data-label="Custom" class="cell-good">Total</div>
            </div>
            <div class="compare-row">
              <div data-label="Capacidad">Versionado / testing</div>
              <div data-label="El Constructor" class="cell-bad">No documentado</div>
              <div data-label="Make/Zapier/n8n" class="cell-mid">Parcial</div>
              <div data-label="Custom" class="cell-good">Total (git, CI)</div>
            </div>
            <div class="compare-row">
              <div data-label="Capacidad">Coste a escala</div>
              <div data-label="El Constructor" class="cell-mid">Suscripción cerrada</div>
              <div data-label="Make/Zapier/n8n" class="cell-mid">Por operación</div>
              <div data-label="Custom" class="cell-good">Infra propia</div>
            </div>
            <div class="compare-row">
              <div data-label="Capacidad">Compliance / RGPD avanzado</div>
              <div data-label="El Constructor" class="cell-bad">Sin detalle público</div>
              <div data-label="Make/Zapier/n8n" class="cell-mid">Configurable</div>
              <div data-label="Custom" class="cell-good">Total</div>
            </div>
          </div>
        </div>

        <div class="card help-card help-card-wide">
          <div class="help-ic" style="background:rgba(0,215,116,0.12); color:var(--green);">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M20 6L9 17l-5-5"/></svg>
          </div>
          <h3 class="flat">Herramientas gratuitas para construir</h3>
          <p style="font-size:14px; color:var(--muted); line-height:1.6;">
            Tres herramientas con plan gratuito que puedes usar para montar lo mismo que ofrece El Constructor
            (e incluso más), sin pagar suscripción y manteniendo control técnico total.
          </p>

          <div class="free-tools-grid four">
            <a href="https://claude.ai" target="_blank" rel="noopener" class="free-tool-card claude">
              <div class="tool-logo claude">
                <svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 2 L13.5 9 L21 10 L13.5 11 L12 18 L10.5 11 L3 10 L10.5 9 Z"/><path d="M12 6 L12.7 9.3 L16 10 L12.7 10.7 L12 14 L11.3 10.7 L8 10 L11.3 9.3 Z" transform="rotate(45 12 10)"/></svg>
              </div>
              <h4>Claude</h4>
              <p class="tool-sub">Anthropic · claude.ai</p>
              <p class="tool-desc">Conversación + razonamiento + escritura de código. Ideal para construir prompts, agentes, copys de venta, scripts de llamada y refinar arquitectura.</p>
              <ul>
                <li>Plan gratuito con Claude Sonnet</li>
                <li>Proyectos y memoria por chat</li>
                <li>Subida de imágenes y PDFs</li>
                <li>Artifacts (vista previa de HTML/React)</li>
              </ul>
              <span class="tool-cta">Abrir Claude
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><line x1="7" y1="17" x2="17" y2="7"/><polyline points="7 7 17 7 17 17"/></svg>
              </span>
            </a>

            <a href="https://aistudio.google.com" target="_blank" rel="noopener" class="free-tool-card gemini">
              <div class="tool-logo gemini">
                <svg viewBox="0 0 24 24" fill="none"><defs><linearGradient id="gemGrad" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#4285F4"/><stop offset=".5" stop-color="#9b72cb"/><stop offset="1" stop-color="#d96570"/></linearGradient></defs><path fill="url(#gemGrad)" d="M12 2c.5 4 2.5 6 6.5 6.5C14.5 9 12.5 11 12 15c-.5-4-2.5-6-6.5-6.5C9.5 8 11.5 6 12 2zm0 9c.3 2.5 1.5 3.7 4 4-2.5.3-3.7 1.5-4 4-.3-2.5-1.5-3.7-4-4 2.5-.3 3.7-1.5 4-4z"/></svg>
              </div>
              <h4>Google AI Studio</h4>
              <p class="tool-sub">Gemini · aistudio.google.com</p>
              <p class="tool-desc">Playground de Gemini con API gratuita generosa. Perfecto para prototipar agentes, llamadas a IA en producción y procesar imágenes/audio/vídeo en lote.</p>
              <ul>
                <li>API key gratis con cuota diaria</li>
                <li>Multimodal: texto, imagen, audio, vídeo</li>
                <li>Gemini 2.5 Pro y Flash incluidos</li>
                <li>Function calling para conectar herramientas</li>
              </ul>
              <span class="tool-cta">Abrir AI Studio
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><line x1="7" y1="17" x2="17" y2="7"/><polyline points="7 7 17 7 17 17"/></svg>
              </span>
            </a>

            <a href="https://chatgpt.com/codex" target="_blank" rel="noopener" class="free-tool-card codex">
              <div class="tool-logo codex">
                <svg viewBox="0 0 24 24" fill="currentColor"><path d="M22.3 9.6a5.9 5.9 0 0 0-.5-4.8 6 6 0 0 0-6.4-2.9 5.9 5.9 0 0 0-10 2.1A6 6 0 0 0 1.7 14.4a5.9 5.9 0 0 0 .5 4.8 6 6 0 0 0 6.4 2.9 5.9 5.9 0 0 0 10-2.1 6 6 0 0 0 3.7-10.4zM13.4 20.4a4.4 4.4 0 0 1-2.8-1l.1-.1 4.7-2.7a.8.8 0 0 0 .4-.7v-6.6l2 1.2v5.5a4.4 4.4 0 0 1-4.4 4.4zM4 17.3a4.4 4.4 0 0 1-.5-3l.1.1 4.7 2.7a.8.8 0 0 0 .8 0l5.8-3.3v2.3l-4.8 2.8a4.4 4.4 0 0 1-6.1-1.6zm-1.2-9a4.4 4.4 0 0 1 2.3-1.9v5.7a.8.8 0 0 0 .4.7l5.7 3.3-2 1.2-4.8-2.8a4.4 4.4 0 0 1-1.6-6zm16.3 3.8L13.4 8.8l2-1.2 4.8 2.8a4.4 4.4 0 0 1-.7 7.9V12.8a.8.8 0 0 0-.4-.7zm2-3-.1-.1L16.3 6.3a.8.8 0 0 0-.8 0L9.7 9.6V7.3l4.8-2.8a4.4 4.4 0 0 1 6.6 4.6zM8.6 13.2l-2-1.2V6.5a4.4 4.4 0 0 1 7.2-3.4l-.1.1L9 5.9a.8.8 0 0 0-.4.7zm1-2.3 2.6-1.5 2.6 1.5v3l-2.6 1.5-2.6-1.5z"/></svg>
              </div>
              <h4>ChatGPT Codex</h4>
              <p class="tool-sub">OpenAI · chatgpt.com/codex</p>
              <p class="tool-desc">Agente de programación que vive dentro de ChatGPT. Le pides "crea esto", "arregla este bug", "monta esta integración" y lo hace en un sandbox propio.</p>
              <ul>
                <li>Incluido en el plan gratuito de ChatGPT</li>
                <li>Sandbox aislado por tarea</li>
                <li>Pull requests automáticas en GitHub</li>
                <li>Ejecuta tests, depura y refactoriza</li>
              </ul>
              <span class="tool-cta">Abrir Codex
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><line x1="7" y1="17" x2="17" y2="7"/><polyline points="7 7 17 7 17 17"/></svg>
              </span>
            </a>

            <a href="https://abacus.ai/" target="_blank" rel="noopener" class="free-tool-card abacus">
              <div class="tool-logo abacus">
                <svg viewBox="0 0 24 24" fill="currentColor"><path d="M3 4h18v2H3V4zm0 14h18v2H3v-2zM5 7h2v10H5V7zm4 0h2v10H9V7zm4 0h2v10h-2V7zm4 0h2v10h-2V7z"/><circle cx="6" cy="10" r="1.5" fill="white"/><circle cx="10" cy="13" r="1.5" fill="white"/><circle cx="14" cy="9" r="1.5" fill="white"/><circle cx="18" cy="14" r="1.5" fill="white"/></svg>
              </div>
              <h4>Abacus AI <span style="font-size:10px; background:#ff6b35; color:white; padding:1px 6px; border-radius:4px; margin-left:4px; vertical-align:middle;">SUSCRIPCIÓN</span></h4>
              <p class="tool-sub">ChatLLM · abacus.ai</p>
              <p class="tool-desc">Una suscripción te da acceso a GPT-4o, Claude 3.5 Sonnet, Gemini, Llama y modelos propios desde una sola API. Funciona con tu plan de pago — la app usa tu key.</p>
              <ul>
                <li>+10 modelos en una sola key</li>
                <li>API OpenAI-compatible</li>
                <li>Precio fijo mensual con tu suscripción</li>
                <li>Ya integrado en Ajustes → Claves API</li>
              </ul>
              <span class="tool-cta">Ir a Abacus
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><line x1="7" y1="17" x2="17" y2="7"/><polyline points="7 7 17 7 17 17"/></svg>
              </span>
            </a>
          </div>

          <div class="tip" style="margin-top:14px;">
            <span class="tip-ic">💡</span>
            <span><strong>Combinación recomendada:</strong> Claude para conversación/agentes y copys, Google AI Studio para tu API en producción (Gemini Flash es muy barato), ChatGPT Codex para escribirte el código de integraciones, y <strong>Abacus AI</strong> si prefieres pagar una suscripción única y tener todos los modelos top en una sola key. Las claves se configuran en <em>Ajustes → Claves API</em>.</span>
          </div>
        </div>

        <div class="card help-card help-card-wide diag-card">
          <div class="help-ic" style="background:rgba(255,184,107,0.15); color:var(--orange);">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/></svg>
          </div>
          <h3 class="flat">Diagnóstico final</h3>
          <p>
            <strong>El Constructor es bueno para</strong> crear demos rápidas, MVPs comerciales y servicios
            paquetizados de automatización para pymes. Su ventaja real es <em>reducir fricción</em>: alguien sin
            gran perfil técnico puede montar una web, un agente, una demo de atención/captación y un flujo
            comercial vendible en muy poco tiempo.
          </p>
          <p>
            <strong>No lo trataría como sustituto de una integración a medida</strong> cuando el cliente
            necesita procesos críticos, datos sensibles, CRM/ERP real, reporting, trazabilidad o automatización
            compleja. Ahí: Make, Zapier, n8n, Vapi/Retell, APIs propias o app/agente custom — porque necesitas
            control de errores, observabilidad, permisos, pruebas, escalabilidad y mantenimiento profesional.
          </p>
          <div class="recommendation-box">
            <h4>Recomendación práctica: arquitectura híbrida</h4>
            <div class="rec-grid">
              <div class="rec-item"><span class="rec-num">1</span><div><strong>El Constructor</strong> como capa de prototipado y venta — demo y activos iniciales para cerrar al cliente.</div></div>
              <div class="rec-item"><span class="rec-num">2</span><div><strong>Make / Zapier / n8n</strong> para flujos reales en producción.</div></div>
              <div class="rec-item"><span class="rec-num">3</span><div><strong>CRM</strong> como fuente de verdad de los datos del cliente.</div></div>
              <div class="rec-item"><span class="rec-num">4</span><div><strong>Vapi / Retell</strong> u otra plataforma especializada si hay llamadas importantes.</div></div>
            </div>
          </div>
        </div>
      </div>
    </section>
  </main>

  <!-- ===== Command Palette ===== -->
  <div class="cmd-overlay" id="cmdOverlay" role="dialog" aria-modal="true">
    <div class="cmd-palette">
      <div class="cmd-input-row">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
        <input id="cmdInput" type="text" placeholder="Saltar a sección, herramienta o acción…" autocomplete="off" />
        <span class="kbd">ESC</span>
      </div>
      <div class="cmd-list" id="cmdList"></div>
    </div>
  </div>

  <!-- ===== Onboarding Modal ===== -->
  <div class="onboard-overlay" id="onboardOverlay" role="dialog" aria-modal="true">
    <div class="onboard-card">
      <div class="onboard-illust" id="onboardIllust">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/></svg>
      </div>
      <h2 id="onboardTitle">Bienvenido a Ayuda de Negocios JPMR</h2>
      <p id="onboardText">Tu plataforma todo-en-uno para crear, vender y mantener servicios de IA para tu negocio. Te enseño en 4 pasos lo más importante.</p>
      <div class="onboard-dots" id="onboardDots">
        <span class="onboard-dot active"></span>
        <span class="onboard-dot"></span>
        <span class="onboard-dot"></span>
        <span class="onboard-dot"></span>
      </div>
      <div class="onboard-actions">
        <button class="topbar-btn" id="onboardSkip">Saltar</button>
        <button class="btn btn-cyan" id="onboardNext" style="padding:10px 16px; font-size:14px;">Siguiente</button>
      </div>
    </div>
  </div>

  <!-- ===== Shortcuts overlay ===== -->
  <div class="onboard-overlay" id="shortcutsOverlay" role="dialog">
    <div class="onboard-card" style="max-width:440px;">
      <h2 style="margin-bottom:14px;">Atajos de teclado</h2>
      <div class="sc-list">
        <div class="sc-row"><span>Abrir buscador / Command Palette</span><kbd>⌘K</kbd><kbd>Ctrl+K</kbd></div>
        <div class="sc-row"><span>Ver atajos</span><kbd>?</kbd></div>
        <div class="sc-row"><span>Cerrar modal / palette</span><kbd>Esc</kbd></div>
        <div class="sc-row"><span>Navegar en palette</span><kbd>↑</kbd><kbd>↓</kbd></div>
        <div class="sc-row"><span>Ejecutar comando</span><kbd>↵</kbd></div>
      </div>
      <div class="onboard-actions" style="margin-top:18px;">
        <button class="btn btn-cyan" style="flex:1; padding:10px 16px; font-size:14px;" onclick="document.getElementById('shortcutsOverlay').classList.remove('open')">Cerrar</button>
      </div>
    </div>
  </div>

  <!-- ===== Mobile bottom nav ===== -->
  <nav class="bottom-nav" aria-label="Navegación móvil">
    <button data-view="dashboard">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/></svg>
      <span>Inicio</span>
    </button>
    <button data-view="mapa">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="1 6 8 3 16 6 23 3 23 18 16 21 8 18 1 21 1 6"/></svg>
      <span>Ruta</span>
    </button>
    <button data-view="castrender" class="bn-primary">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 2l1.7 4.6L18 8l-4.3 1.4L12 14l-1.7-4.6L6 8l4.3-1.4L12 2z"/></svg>
      <span>Render</span>
    </button>
    <button data-view="proyectos">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/></svg>
      <span>Proyectos</span>
    </button>
    <button data-view="ajustes">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>
      <span>Ajustes</span>
    </button>
  </nav>

  <!-- ===== Project template picker ===== -->
  <div class="onboard-overlay" id="templateOverlay" role="dialog">
    <div class="onboard-card" style="max-width:540px;">
      <h2 style="margin-bottom:6px;">Elige plantilla</h2>
      <p style="margin-bottom:18px;">Empieza con datos pre-rellenados para tu sector o desde cero.</p>
      <div class="template-grid">
        <button class="template-card" data-tpl="blank">
          <div class="tpl-ic" style="background:#374151;">
            <svg viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>
          </div>
          <strong>En blanco</strong>
          <span>Empieza desde cero</span>
        </button>
        <button class="template-card" data-tpl="inmobiliaria">
          <div class="tpl-ic" style="background:#16a34a;">
            <svg viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>
          </div>
          <strong>Inmobiliaria</strong>
          <span>Captación + setter + render</span>
        </button>
        <button class="template-card" data-tpl="clinica">
          <div class="tpl-ic" style="background:#0ea5e9;">
            <svg viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2"><path d="M19 14V6a2 2 0 0 0-2-2H7a2 2 0 0 0-2 2v12l4-2 4 2 4-2 4 2v-4z"/></svg>
          </div>
          <strong>Clínica dental</strong>
          <span>Citas + recordatorios</span>
        </button>
        <button class="template-card" data-tpl="restaurante">
          <div class="tpl-ic" style="background:#f59e0b;">
            <svg viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2"><path d="M18 8h1a4 4 0 0 1 0 8h-1"/><path d="M2 8h16v9a4 4 0 0 1-4 4H6a4 4 0 0 1-4-4z"/><line x1="6" y1="1" x2="6" y2="4"/><line x1="10" y1="1" x2="10" y2="4"/><line x1="14" y1="1" x2="14" y2="4"/></svg>
          </div>
          <strong>Restaurante</strong>
          <span>Reservas + fidelización</span>
        </button>
        <button class="template-card" data-tpl="gimnasio">
          <div class="tpl-ic" style="background:#ef4444;">
            <svg viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2"><path d="M6 4v16M18 4v16M2 8h4M2 16h4M18 8h4M18 16h4M6 12h12"/></svg>
          </div>
          <strong>Gimnasio</strong>
          <span>Membresías + leads</span>
        </button>
        <button class="template-card" data-tpl="asesoria">
          <div class="tpl-ic" style="background:#6c5ce7;">
            <svg viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2"><path d="M9 11H1v3h8v3l4-4-4-4v2z"/><circle cx="17" cy="12" r="9"/></svg>
          </div>
          <strong>Asesoría / Gestoría</strong>
          <span>B2B + B2C profesional</span>
        </button>
      </div>
      <div class="onboard-actions" style="margin-top:18px;">
        <button class="topbar-btn" onclick="document.getElementById('templateOverlay').classList.remove('open')">Cancelar</button>
      </div>
    </div>
  </div>

  <button class="chat-bubble" aria-label="Ayuda" title="¿Qué es El Constructor?" onclick="switchView('ayuda')">
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z"/></svg>
  </button>

  <div class="toast" id="toast"></div>

<script>
  // ===== Sidebar mobile =====
  const sidebar = document.getElementById('sidebar');
  const backdrop = document.getElementById('backdrop');
  document.getElementById('mobileToggle')?.addEventListener('click', () => {
    sidebar.classList.add('open'); backdrop.classList.add('show');
  });
  backdrop.addEventListener('click', () => {
    sidebar.classList.remove('open'); backdrop.classList.remove('show');
  });

  // ===== Toast =====
  const toast = document.getElementById('toast');
  let toastTimer;
  function showToast(msg) {
    toast.textContent = msg; toast.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => toast.classList.remove('show'), 2600);
  }

  // ===== View switching =====
  function switchView(view) {
    document.querySelectorAll('.nav button').forEach(b => b.classList.toggle('active', b.dataset.view === view));
    document.querySelectorAll('[data-view-content]').forEach(el => el.classList.toggle('active', el.dataset.viewContent === view));
    sidebar.classList.remove('open'); backdrop.classList.remove('show');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }
  document.querySelectorAll('.nav button').forEach(b => {
    b.addEventListener('click', () => switchView(b.dataset.view));
  });

  // ===== Roadmap tabs =====
  const tabTitles = {
    '1': 'Áreas de Marketing', '2': 'Solucionar el Problema', '3': 'Seleccionar Nicho',
    '4': 'Ofertas y Propuesta de Valor', '5': 'Landing Pages', '6': 'SignalCore',
    '7': 'CRM', '8': 'Analizador de Web', '9': 'Generador de Scripts',
    '10': 'Prospección', '11': 'Métricas'
  };
  function gotoTab(t) {
    document.querySelectorAll('.tab-btn').forEach(x => x.classList.toggle('active', x.dataset.tab === String(t)));
    document.querySelectorAll('[data-tab-content]').forEach(x => x.classList.toggle('active', x.dataset.tabContent === String(t)));
    document.getElementById('tabTitle').textContent = tabTitles[t] || 'Mapa de Ruta';
    const activeBtn = document.querySelector(`.tab-btn[data-tab="${t}"]`);
    activeBtn?.scrollIntoView({ behavior: 'smooth', inline: 'center', block: 'nearest' });
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }
  document.querySelectorAll('.tab-btn').forEach(b => {
    b.addEventListener('click', () => gotoTab(b.dataset.tab));
  });
  // Anterior / Siguiente
  document.addEventListener('click', (e) => {
    const prev = e.target.closest('.step-nav .prev[data-prev]');
    const next = e.target.closest('.step-nav .next[data-next]');
    if (prev) gotoTab(prev.dataset.prev);
    if (next) gotoTab(next.dataset.next);
  });

  // ===== Tab 1 — Marketing areas =====
  const selectedAreas = new Set();
  const AREA_DATA = {
    captacion: {
      title: 'Captación de Leads',
      solutions: ['Crear landing page de captación', 'Configurar lead magnet', 'Automatizar Meta Ads + Google Ads']
    },
    atencion: {
      title: 'Atención a Leads',
      solutions: ['Agente IA en WhatsApp 24/7', 'Setter automatizado con SignalCore', 'Cualificación con IA en chat']
    },
    seguimientos: {
      title: 'Seguimientos y Recordatorios',
      solutions: ['Secuencias automáticas en CRM', 'Recordatorios SMS/WhatsApp', 'Reactivación de leads fríos']
    },
    ltv: {
      title: 'Lifetime Value (LTV)',
      solutions: ['Onboarding personalizado', 'Programa de fidelización', 'Upsell post-venta automatizado']
    },
    fidelizacion: {
      title: 'Fidelización',
      solutions: ['NPS automatizado', 'Programa de referidos', 'Newsletter exclusivo para clientes']
    },
    ofertas: {
      title: 'Ofertas y Comunicación',
      solutions: ['Campañas segmentadas en CRM', 'Email marketing con IA', 'WhatsApp broadcast personalizado']
    },
    upsells: {
      title: 'Upsells / Cross-sells',
      solutions: ['Order bumps en checkout', 'Bundles automáticos', 'Reactivación de carrito']
    }
  };
  document.querySelectorAll('.area-card').forEach(card => {
    card.addEventListener('click', () => {
      const a = card.dataset.area;
      if (selectedAreas.has(a)) { selectedAreas.delete(a); card.classList.remove('selected'); }
      else { selectedAreas.add(a); card.classList.add('selected'); }
      renderProblemSolutions();
    });
  });
  function renderProblemSolutions() {
    const empty = document.getElementById('problemaEmpty');
    const list = document.getElementById('problemaSolutions');
    if (!empty || !list) return;
    if (selectedAreas.size === 0) {
      empty.style.display = ''; list.style.display = 'none'; list.innerHTML = '';
      return;
    }
    empty.style.display = 'none'; list.style.display = 'flex';
    list.innerHTML = [...selectedAreas].map(key => {
      const a = AREA_DATA[key];
      return `
        <div class="card">
          <h3 class="flat">${a.title}</h3>
          <div class="step-list">
            ${a.solutions.map((s, i) => `<div class="step-item"><div class="step-num">${i+1}</div><div class="step-text">${s}</div></div>`).join('')}
          </div>
        </div>`;
    }).join('');
  }

  // ===== Tab 3 — Nichos =====
  const nichos = [];
  const nichoInput = document.getElementById('nichoInput');
  const nichoTags = document.getElementById('nichoTags');
  const nichoCounter = document.getElementById('nichoCounter');
  function renderNichos() {
    nichoTags.innerHTML = nichos.map((n, i) => `
      <span class="nicho-tag">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
        ${escapeHTML(n)}
        <button data-i="${i}" aria-label="Eliminar" style="color:var(--danger);">✕</button>
      </span>
    `).join('');
    nichoCounter.textContent = `${nichos.length}/1 nicho`;
    document.getElementById('nichoLimitMsg').hidden = nichos.length === 0;
    document.querySelectorAll('#nichoTags button').forEach(b => {
      b.addEventListener('click', () => {
        nichos.splice(+b.dataset.i, 1);
        renderNichos(); renderPropuesta(); renderLandingNichos();
      });
    });
    const info = document.getElementById('nichosInfo');
    if (info) info.textContent = nichos.length === 0
      ? 'No hay nichos seleccionados. Vuelve a la sección 3.'
      : `Nichos: ${nichos.join(', ')}`;
  }
  function renderPropuesta() {
    const card = document.getElementById('propuestaCard');
    if (!card) return;
    if (nichos.length === 0) { card.hidden = true; return; }
    card.hidden = false;
    const n = nichos[0];
    document.getElementById('propuestaTexto').textContent =
      `Como empresario en el sector de ${n.toLowerCase()}, seguro que enfrentas el dolor de perder oportunidades valiosas debido a la falta de una presencia digital sólida, una atención lenta a los leads y un seguimiento manual que se cae al primer descuido. Con nuestra solución, automatizamos tu captación, tu atención 24/7 con IA y tus seguimientos — para que dediques tu tiempo a cerrar y no a perseguir.`;
  }
  function renderLandingNichos() {
    const cont = document.getElementById('landingNichos');
    if (!cont) return;
    if (nichos.length === 0) {
      cont.innerHTML = `<div style="padding:14px 16px; background:var(--card-2); border:1px solid var(--input-border); border-radius:10px; display:flex; justify-content:space-between; align-items:center; color:var(--muted);"><span>Sin nichos. Añade uno en la sección 3.</span></div>`;
      return;
    }
    cont.innerHTML = nichos.map(n => `
      <div style="padding:14px 16px; background:var(--card-2); border:1px solid var(--input-border); border-radius:10px; display:flex; justify-content:space-between; align-items:center;">
        <span style="font-weight:600;">${escapeHTML(n)}</span>
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--cyan)" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
      </div>
    `).join('');
  }
  document.getElementById('btnAnadirNicho')?.addEventListener('click', () => {
    const v = nichoInput.value.trim();
    if (!v) return showToast('Escribe un nicho.');
    if (nichos.length >= 1) return showToast('Solo puedes elegir 1 nicho para mantener el enfoque.');
    nichos.push(v); nichoInput.value = '';
    renderNichos(); renderLandingNichos();
  });
  document.getElementById('btnAnalizarNicho')?.addEventListener('click', () => {
    const v = nichoInput.value.trim();
    if (!v) return showToast('Escribe un nicho para analizar.');
    showToast(`Analizando "${v}"… (simulado)`);
  });
  document.getElementById('btnGenerarOfertas')?.addEventListener('click', () => {
    if (nichos.length === 0) return showToast('Añade un nicho antes de generar ofertas.');
    renderPropuesta();
    document.getElementById('propuestaCard').scrollIntoView({ behavior: 'smooth', block: 'start' });
  });
  document.getElementById('btnCopiarPropuesta')?.addEventListener('click', async () => {
    const t = document.getElementById('propuestaTexto').textContent;
    try { await navigator.clipboard.writeText(t); showToast('Propuesta copiada al portapapeles.'); }
    catch { showToast('No se pudo copiar.'); }
  });

  // ===== Tab 1 — custom problem =====
  document.getElementById('btnAddCustomProblem')?.addEventListener('click', () => {
    const v = document.getElementById('customProblem').value.trim();
    if (!v) return showToast('Escribe un problema personalizado.');
    const list = document.getElementById('areaList');
    const key = 'custom_' + Date.now();
    AREA_DATA[key] = { title: v, solutions: ['Solución personalizada generada con IA para este problema.'] };
    const btn = document.createElement('button');
    btn.className = 'area-card selected';
    btn.dataset.area = key;
    btn.innerHTML = `
      <span class="area-ic"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg></span>
      <div class="area-meta"><h4>${escapeHTML(v)}</h4><p>Problema personalizado</p></div>
    `;
    btn.addEventListener('click', () => {
      if (selectedAreas.has(key)) { selectedAreas.delete(key); btn.classList.remove('selected'); }
      else { selectedAreas.add(key); btn.classList.add('selected'); }
      renderProblemSolutions();
    });
    list.appendChild(btn);
    selectedAreas.add(key);
    document.getElementById('customProblem').value = '';
    renderProblemSolutions();
  });

  // ===== Tab 5 — Landing config =====
  const MODALIDAD_HELP = {
    tradicional: 'Landing con formulario integrado para captar leads',
    vsl: 'Landing con vídeo de venta principal y CTA debajo',
    quiz: 'Landing con cuestionario para cualificar leads',
    webinar: 'Landing con registro a webinar en vivo o automático'
  };
  const IDIOMA_HELP = {
    es: 'Todo el copy de la landing se generará en español',
    en: 'All landing copy will be generated in English',
    pt: 'Todo o copy da landing será gerado em português',
    fr: 'Tous les textes de la landing seront générés en français'
  };
  document.getElementById('landingModalidad')?.addEventListener('change', (e) => {
    document.getElementById('modalidadHelp').textContent = MODALIDAD_HELP[e.target.value] || '';
  });
  document.getElementById('landingIdioma')?.addEventListener('change', (e) => {
    document.getElementById('idiomaHelp').textContent = IDIOMA_HELP[e.target.value] || '';
  });
  document.getElementById('btnGuardarAgencia')?.addEventListener('click', () => {
    const v = document.getElementById('agenciaNombre').value.trim();
    if (!v) return showToast('Escribe el nombre de tu agencia.');
    showToast(`Agencia "${v}" guardada.`);
  });
  document.getElementById('btnGenerarLanding')?.addEventListener('click', () => {
    if (nichos.length === 0) return showToast('Añade un nicho en la sección 3 antes de continuar.');
    showToast('Generando prompt para landing page…');
  });

  // ===== Tab 8: Analizador de Web =====
  document.getElementById('btnAnalizar').addEventListener('click', () => {
    const url = document.getElementById('urlAnalizar').value.trim();
    if (!url) return showToast('Pega una URL para analizar.');
    let host;
    try { host = new URL(url).hostname; } catch { return showToast('URL inválida.'); }
    const prompt = generateBase44Prompt(url, host);
    document.getElementById('promptResult').value = prompt;
    document.getElementById('promptResultWrap').hidden = false;
    document.getElementById('btnCopiarPrompt').disabled = false;
    showToast('Prompt generado.');
  });
  document.getElementById('btnCopiarPrompt').addEventListener('click', async () => {
    const text = document.getElementById('promptResult').value;
    try { await navigator.clipboard.writeText(text); showToast('Prompt copiado al portapapeles.'); }
    catch { showToast('No se pudo copiar.'); }
  });
  function generateBase44Prompt(url, host) {
    return `Replica en Base44 la página web ${url}.

ANÁLISIS VISUAL DETECTADO:
- Dominio: ${host}
- Paleta de colores: extraer los 4-5 colores principales del sitio (fondo, primario, acento, texto, hover).
- Tipografía: detectar familia principal (sans-serif/serif/display) y secundaria; pesos 400/600/800.
- Layout: hero a pantalla completa + secciones de beneficios + testimonios + CTA final + footer.
- Componentes: navbar sticky, hero con headline + CTA, cards con icono, formulario de contacto, modal/popup si lo hubiera.
- Efectos: fade-in al scroll, hover con elevación, gradientes sutiles, sombras suaves.

COPYS MEJORADOS:
- Headline más directo, orientado a beneficio del cliente.
- CTAs en imperativo ("Empieza ahora", "Reserva tu plaza").
- Microcopys que reduzcan fricción.

ENTREGA:
- Página totalmente responsive (mobile-first).
- Código limpio listo para pegar en Base44.
- Mantén jerarquía visual y respiración entre secciones.

Genera el sitio respetando estos puntos y optimiza para conversión.`;
  }

  // ===== Tab 9: Script generator =====
  document.getElementById('btnGenerarScript').addEventListener('click', () => {
    const empresa = document.getElementById('scrEmpresa').value.trim();
    const investigacion = document.getElementById('scrInvestigacion').value.trim();
    const dolor = document.getElementById('scrDolor').value.trim();
    const caballo = document.getElementById('scrCaballo').value.trim();
    if (!empresa || !dolor || !caballo) return showToast('Completa los campos obligatorios (*).');
    const script =
`SCRIPT DE LLAMADA EN FRÍO — ${empresa}

[APERTURA]
"Hola, ¿hablo con el responsable de ${empresa}? Soy [nombre]. Te llamo por algo muy concreto, ¿tienes 30 segundos?"

[ROMPER PATRÓN]
"Estuve mirando ${investigacion || 'tu presencia online'} y vi algo que probablemente te esté costando dinero sin que te des cuenta."

[DOLOR]
"La mayoría de empresas como la tuya tienen este problema: ${dolor}. ¿Te identificas?"

[CABALLO DE TROYA]
"Justamente tenemos un ${caballo} que ayuda exactamente con eso. No te vendo nada por teléfono — solo quiero enseñártelo en 15 minutos y que tú decidas."

[CIERRE]
"¿Te va mejor mañana a las 10 o el jueves a las 17?"`;
    document.getElementById('scriptResult').value = script;
    document.getElementById('scriptResultWrap').hidden = false;
    showToast('Script generado.');
  });

  // ===== Flyer Creator =====
  const refUpload = document.getElementById('refUpload');
  const thumbList = document.getElementById('thumbList');
  const uploadedRefs = [];
  refUpload?.addEventListener('change', (e) => {
    [...e.target.files].forEach(file => addRefImage(file));
    refUpload.value = '';
  });
  function addRefImage(file) {
    if (!file.type.startsWith('image/')) return;
    const url = URL.createObjectURL(file);
    uploadedRefs.push({ file, url });
    renderThumbs();
  }
  function renderThumbs() {
    thumbList.innerHTML = '';
    uploadedRefs.forEach((ref, idx) => {
      const wrap = document.createElement('div');
      wrap.className = 'thumb-wrap';
      wrap.innerHTML = `
        <img src="${ref.url}" alt="Referencia ${idx + 1}" />
        <button class="thumb-remove" aria-label="Eliminar imagen">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/><path d="M9 6V4a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2v2"/></svg>
        </button>
      `;
      wrap.querySelector('.thumb-remove').addEventListener('click', () => {
        URL.revokeObjectURL(ref.url); uploadedRefs.splice(idx, 1); renderThumbs();
      });
      thumbList.appendChild(wrap);
    });
  }

  const resultCard = document.getElementById('resultCard');
  const resultArea = document.getElementById('resultArea');
  const btnDescargar = document.getElementById('btnDescargar');
  function escapeHTML(str) {
    return String(str ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  }
  function buildFlyer({ nicho, oferta, problema, tono, brand }) {
    const title = oferta ? oferta.toUpperCase() : '¡TU NUEVA OPORTUNIDAD!';
    const subtitle = problema || 'Lo que necesitas, cuando lo necesitas.';
    const bullets = (tono || 'Profesional · Cercano · Eficaz').split(/[,·]+/).map(s => s.trim()).filter(Boolean).slice(0, 4);
    return `
      <div class="result-canvas" id="flyerCanvas">
        <div class="flyer-brand"><span class="dot"></span> ${escapeHTML(brand || (nicho || 'TU MARCA').toUpperCase())}</div>
        <div class="flyer-image"></div>
        <div class="flyer-title">${escapeHTML(title)}</div>
        <div class="flyer-sub">${escapeHTML(subtitle)}</div>
        <div class="flyer-bullets">${bullets.map(b => `• ${escapeHTML(b.toUpperCase())}`).join('<br/>')}</div>
        <div class="flyer-cta">¡SOLICITA MÁS INFORMACIÓN!</div>
        <div class="flyer-footer">
          <span>${escapeHTML((nicho || 'tu-marca').toLowerCase().replace(/\s+/g, ''))}.com</span>
          <span>+34 600 000 000</span>
        </div>
      </div>`;
  }
  function generateFromForm() {
    const nicho = document.getElementById('nicho').value.trim();
    const cliente = document.getElementById('cliente').value;
    const problema = document.getElementById('problema').value.trim();
    const oferta = document.getElementById('oferta').value.trim();
    const tono = document.getElementById('tono').value.trim();
    if (!nicho || !cliente || !problema || !oferta || !tono) return showToast('Completa los campos obligatorios (*) del formulario.');
    renderFlyer({ nicho, oferta, problema, tono });
  }
  function generateFromRef() {
    const instr = document.getElementById('instrucciones').value.trim();
    if (uploadedRefs.length === 0 && !instr) return showToast('Añade una imagen de referencia o instrucciones.');
    const nicho = document.getElementById('nicho').value.trim() || 'Tu marca';
    const oferta = document.getElementById('oferta').value.trim() || 'Nueva oferta especial';
    const problema = instr || document.getElementById('problema').value.trim() || 'Lo que tu cliente busca.';
    const tono = document.getElementById('tono').value.trim() || 'Moderno · Premium · Cercano';
    renderFlyer({ nicho, oferta, problema, tono });
  }
  function generateFromPrompt() {
    const p = document.getElementById('prompt').value.trim();
    if (!p) return showToast('Escribe un prompt para generar el flyer.');
    renderFlyer({ nicho: 'Tu marca', oferta: p.slice(0, 60), problema: p, tono: 'Generado con prompt directo' });
  }
  function renderFlyer(data) {
    resultCard.hidden = false;
    resultArea.innerHTML = `<div class="result-placeholder">Generando flyer con IA…</div>`;
    btnDescargar.hidden = true;
    setTimeout(() => {
      resultArea.innerHTML = buildFlyer(data);
      btnDescargar.hidden = false;
      resultCard.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, 700);
  }
  document.getElementById('btnGenerar')?.addEventListener('click', generateFromForm);
  document.getElementById('btnGenerarRef')?.addEventListener('click', generateFromRef);
  document.getElementById('btnGenerarPrompt')?.addEventListener('click', generateFromPrompt);
  document.getElementById('btnGPT')?.addEventListener('click', () => showToast('Aquí abriría el GPT especializado en un flujo real.'));

  // =====================================================================
  // ============ STATE MANAGEMENT + LOCALSTORAGE PERSISTENCE ============
  // =====================================================================
  const STATE_KEY = 'jpmr_state_v1';
  const ONBOARD_KEY = 'jpmr_onboarded_v1';

  // localStorage with in-memory fallback (some browsers / private mode block it)
  const safeStorage = (() => {
    try {
      const k = '__test__'; localStorage.setItem(k, '1'); localStorage.removeItem(k);
      return localStorage;
    } catch (e) {
      const mem = {};
      return {
        getItem: (k) => k in mem ? mem[k] : null,
        setItem: (k, v) => { mem[k] = String(v); },
        removeItem: (k) => { delete mem[k]; }
      };
    }
  })();

  const state = {
    version: 1,
    theme: 'dark',
    lang: 'es',
    sidebarCollapsed: false,
    user: { name: 'PAU Rodríguez', email: 'appsmovilpau@gmail.com' },
    activeProjectId: null,
    projects: [],
    keys: { anthropic: '', google: '', openai: '', abacus: '' },
    preferredAI: 'auto',
    abacusModel: 'gpt-4o-mini',
    currentProject: {
      areas: [],
      customAreas: [],
      nichos: [],
      agencia: '',
      landingModalidad: 'tradicional',
      landingIdioma: 'es'
    }
  };

  function loadState() {
    try {
      const raw = safeStorage.getItem(STATE_KEY);
      if (raw) Object.assign(state, JSON.parse(raw));
    } catch (e) { console.warn('Could not load state', e); }
  }
  let saveTimer;
  function saveState() {
    clearTimeout(saveTimer);
    setSavePill('saving');
    saveTimer = setTimeout(() => {
      try {
        safeStorage.setItem(STATE_KEY, JSON.stringify(state));
        setSavePill('saved');
      } catch (e) {
        setSavePill('error');
      }
    }, 350);
  }
  function setSavePill(status) {
    const pill = document.getElementById('savePill');
    const text = document.getElementById('savePillText');
    if (!pill) return;
    pill.classList.remove('saving');
    if (status === 'saving') { pill.classList.add('saving'); text.textContent = 'Guardando…'; }
    else if (status === 'saved') text.textContent = 'Guardado';
    else if (status === 'error') text.textContent = 'Error';
  }

  // ===== Theme =====
  function applyTheme(theme) {
    state.theme = theme;
    document.body.classList.toggle('theme-light', theme === 'light');
    const icon = document.getElementById('themeIcon');
    if (icon) {
      icon.innerHTML = theme === 'light'
        ? '<circle cx="12" cy="12" r="5"/><line x1="12" y1="1" x2="12" y2="3"/><line x1="12" y1="21" x2="12" y2="23"/><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/><line x1="1" y1="12" x2="3" y2="12"/><line x1="21" y1="12" x2="23" y2="12"/><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/>'
        : '<path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/>';
    }
    document.querySelectorAll('#themeSeg button').forEach(b => b.classList.toggle('active', b.dataset.theme === theme));
    saveState();
  }
  document.getElementById('themeToggle')?.addEventListener('click', () => {
    applyTheme(state.theme === 'dark' ? 'light' : 'dark');
  });
  document.querySelectorAll('#themeSeg button').forEach(b => {
    b.addEventListener('click', () => applyTheme(b.dataset.theme));
  });

  // ===== Sidebar collapsed =====
  function applySidebarCollapsed(collapsed) {
    state.sidebarCollapsed = collapsed;
    document.getElementById('sidebar').classList.toggle('collapsed', collapsed);
    document.getElementById('toggleSidebar')?.classList.toggle('on', collapsed);
    saveState();
  }
  document.getElementById('toggleSidebar')?.addEventListener('click', () => applySidebarCollapsed(!state.sidebarCollapsed));

  // ===== User profile =====
  function applyUser() {
    document.querySelector('.user-name').textContent = state.user.name;
    document.querySelector('.user-email').textContent = state.user.email.length > 22 ? state.user.email.slice(0, 21) + '…' : state.user.email;
    document.querySelector('.user-avatar').textContent = (state.user.name[0] || 'P').toUpperCase();
    document.getElementById('setUserName').value = state.user.name;
    document.getElementById('setUserEmail').value = state.user.email;
  }
  document.getElementById('setUserName')?.addEventListener('input', (e) => { state.user.name = e.target.value; applyUser(); saveState(); });
  document.getElementById('setUserEmail')?.addEventListener('input', (e) => { state.user.email = e.target.value; applyUser(); saveState(); });

  // ===== API keys =====
  function applyApiKey(provider) {
    const input = document.getElementById('key' + provider[0].toUpperCase() + provider.slice(1));
    const status = document.getElementById('status' + provider[0].toUpperCase() + provider.slice(1));
    if (!input || !status) return;
    input.value = state.keys[provider] || '';
    const ok = !!state.keys[provider] && state.keys[provider].length > 10;
    status.classList.toggle('set', ok);
    status.innerHTML = ok
      ? '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>'
      : '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>';
  }
  ['anthropic', 'google', 'openai', 'abacus'].forEach(p => {
    const id = 'key' + p[0].toUpperCase() + p.slice(1);
    document.getElementById(id)?.addEventListener('input', (e) => {
      state.keys[p] = e.target.value.trim();
      applyApiKey(p); saveState();
    });
  });

  // ===== Roadmap progress =====
  function updateProgress() {
    const total = 11;
    let done = 0;
    if (state.currentProject.areas.length > 0 || state.currentProject.customAreas.length > 0) done++;
    if (state.currentProject.areas.length > 0) done++;
    if (state.currentProject.nichos.length > 0) done++;
    if (state.currentProject.nichos.length > 0) done++;
    if (state.currentProject.agencia) done++;
    // Tabs 6-11 count as not-yet-done by default
    const pct = Math.round((done / total) * 100);
    const fill = document.getElementById('progressFill');
    const pctEl = document.getElementById('progressPct');
    if (fill) fill.style.width = pct + '%';
    if (pctEl) pctEl.textContent = pct + '%';
    document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('completed'));
    if (state.currentProject.areas.length > 0) document.querySelector('.tab-btn[data-tab="1"]')?.classList.add('completed');
    if (state.currentProject.areas.length > 0) document.querySelector('.tab-btn[data-tab="2"]')?.classList.add('completed');
    if (state.currentProject.nichos.length > 0) document.querySelector('.tab-btn[data-tab="3"]')?.classList.add('completed');
    if (state.currentProject.nichos.length > 0) document.querySelector('.tab-btn[data-tab="4"]')?.classList.add('completed');
    if (state.currentProject.agencia) document.querySelector('.tab-btn[data-tab="5"]')?.classList.add('completed');
  }

  // ===== Tab 4 — Ofertas =====
  function renderOfertas() {
    const cards = document.getElementById('offerCards');
    const label = document.getElementById('offerNichoLabel');
    if (!cards) return;
    const nicho = nichos[0] || '— ninguno —';
    if (label) label.textContent = nicho;
    if (nichos.length === 0) {
      cards.innerHTML = `<div class="placeholder-view" style="grid-column:1/-1;"><h2>Selecciona un nicho primero</h2><p>Ve a la sección 3 y añade un nicho para generar tus ofertas.</p></div>`;
      return;
    }
    const n = nichos[0];
    const offers = [
      {
        tier: 'Front-end', cls: '',
        title: `Auditoría IA gratuita para ${n}`,
        pitch: 'Imán de leads: análisis rápido del negocio + propuesta de mejoras con IA. Gratis para enganchar.',
        price: '€ 0', priceSub: 'lead magnet',
        bullets: ['Auditoría 30 min', 'Diagnóstico personalizado', '3 mejoras concretas', 'Sin compromiso']
      },
      {
        tier: 'Core', cls: 'core',
        title: `Setter IA + Web para ${n}`,
        pitch: 'Sistema completo de captación y atención automática 24/7. El servicio que vendes a casi todos.',
        price: '€ 497', priceSub: '/mes',
        bullets: ['Agente IA en WhatsApp', 'Landing optimizada', 'CRM con seguimiento', 'Soporte y mantenimiento']
      },
      {
        tier: 'Premium', cls: 'premium',
        title: `Sistema integral IA para ${n}`,
        pitch: 'Implementación completa con integración a CRM/ERP, dashboard de métricas y consultoría mensual.',
        price: '€ 1.997', priceSub: '/mes',
        bullets: ['Todo lo del plan Core', 'Integraciones a medida', 'Dashboard de métricas', 'Consultoría 1:1 mensual', 'SLA con respuesta < 4h']
      }
    ];
    cards.innerHTML = offers.map(o => `
      <div class="offer-card ${o.cls}">
        <span class="offer-tier">${o.tier}</span>
        <h4>${escapeHTML(o.title)}</h4>
        <p class="offer-pitch">${escapeHTML(o.pitch)}</p>
        <div class="offer-price">${o.price} <small>${o.priceSub}</small></div>
        <ul>${o.bullets.map(b => `<li>${escapeHTML(b)}</li>`).join('')}</ul>
      </div>
    `).join('');
  }
  document.getElementById('btnGenerarOfertasTab')?.addEventListener('click', () => {
    if (nichos.length === 0) return showToast('Añade un nicho en la sección 3 primero.', 'error');
    renderOfertas();
    showToast('Ofertas regeneradas.', 'success');
  });

  // ===== Tab 11 — Métricas =====
  function animateCounters() {
    document.querySelectorAll('[data-counter]').forEach(el => {
      const target = +el.dataset.counter;
      const duration = 1100;
      const start = performance.now();
      function step(now) {
        const p = Math.min((now - start) / duration, 1);
        const eased = 1 - Math.pow(1 - p, 3);
        el.textContent = Math.round(target * eased).toLocaleString('es-ES');
        if (p < 1) requestAnimationFrame(step);
      }
      requestAnimationFrame(step);
    });
  }
  function renderChart() {
    const svg = document.getElementById('leadsChart');
    if (!svg) return;
    const data = [12, 18, 14, 26, 22, 31, 38];
    const labels = ['L', 'M', 'X', 'J', 'V', 'S', 'D'];
    const max = Math.max(...data);
    const w = 700, h = 200, pad = 24, barW = (w - pad * 2) / data.length * 0.65, gap = (w - pad * 2) / data.length;
    const defs = svg.querySelector('defs');
    svg.innerHTML = defs.outerHTML;
    data.forEach((v, i) => {
      const bh = (v / max) * (h - 50);
      const x = pad + i * gap + (gap - barW) / 2;
      const y = h - bh - 30;
      const rect = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
      rect.setAttribute('class', 'chart-bar');
      rect.setAttribute('x', x); rect.setAttribute('y', h);
      rect.setAttribute('width', barW); rect.setAttribute('height', 0);
      rect.setAttribute('rx', 6);
      svg.appendChild(rect);
      const txt = document.createElementNS('http://www.w3.org/2000/svg', 'text');
      txt.setAttribute('class', 'chart-label');
      txt.setAttribute('x', x + barW / 2); txt.setAttribute('y', h - 10);
      txt.setAttribute('text-anchor', 'middle'); txt.textContent = labels[i];
      svg.appendChild(txt);
      const val = document.createElementNS('http://www.w3.org/2000/svg', 'text');
      val.setAttribute('class', 'chart-label');
      val.setAttribute('x', x + barW / 2); val.setAttribute('y', y - 6);
      val.setAttribute('text-anchor', 'middle'); val.textContent = v;
      svg.appendChild(val);
      setTimeout(() => {
        rect.setAttribute('y', y); rect.setAttribute('height', bh);
        rect.style.transition = 'y 0.7s cubic-bezier(0.2,0.9,0.3,1), height 0.7s cubic-bezier(0.2,0.9,0.3,1)';
      }, 60 + i * 70);
    });
  }
  document.querySelectorAll('[data-range]').forEach(b => {
    b.addEventListener('click', () => {
      document.querySelectorAll('[data-range]').forEach(x => x.classList.remove('active'));
      b.classList.add('active');
      renderChart();
    });
  });

  // ===== Mis Proyectos =====
  function uid() { return 'p_' + Math.random().toString(36).slice(2, 10); }
  function snapshotCurrent() {
    return {
      areas: [...selectedAreas],
      customAreas: state.currentProject.customAreas,
      nichos: [...nichos],
      agencia: state.currentProject.agencia,
      landingModalidad: state.currentProject.landingModalidad,
      landingIdioma: state.currentProject.landingIdioma
    };
  }
  function projectName(p) {
    return p.nichos[0] ? `${p.nichos[0]}` : (p.agencia || 'Proyecto sin nombre');
  }
  function projectCompletion(p) {
    let done = 0;
    if (p.areas && p.areas.length) done += 2;
    if (p.nichos && p.nichos.length) done += 2;
    if (p.agencia) done += 1;
    return Math.round((done / 5) * 100);
  }
  function renderProjects() {
    const grid = document.getElementById('projectsGrid');
    const empty = document.getElementById('projectsEmpty');
    if (!grid) return;
    if (state.projects.length === 0) {
      grid.innerHTML = ''; empty.style.display = 'flex'; return;
    }
    empty.style.display = 'none';
    grid.innerHTML = state.projects.map(p => {
      const completion = projectCompletion(p);
      const isActive = p.id === state.activeProjectId;
      return `
      <div class="project-card ${isActive ? 'active' : ''}" data-id="${p.id}">
        ${isActive ? '<span class="active-badge">Activo</span>' : ''}
        <h4>${escapeHTML(projectName(p))}</h4>
        <div class="project-meta">${p.agencia ? escapeHTML(p.agencia) + ' · ' : ''}${new Date(p.createdAt).toLocaleDateString('es-ES')}</div>
        <div class="project-bar"><div class="fill" style="width:${completion}%"></div></div>
        <div class="project-meta">${completion}% completado</div>
        <div class="project-actions">
          <button data-action="open" data-id="${p.id}">Abrir</button>
          <button data-action="duplicate" data-id="${p.id}">Duplicar</button>
          <button data-action="delete" data-id="${p.id}" class="danger">Borrar</button>
        </div>
      </div>`;
    }).join('');
  }
  function setActiveProject(id) {
    state.activeProjectId = id;
    const p = state.projects.find(x => x.id === id);
    if (p) {
      // restore into current
      selectedAreas.clear();
      (p.areas || []).forEach(a => selectedAreas.add(a));
      nichos.length = 0;
      (p.nichos || []).forEach(n => nichos.push(n));
      state.currentProject = { ...state.currentProject, ...p };
      document.querySelectorAll('.area-card').forEach(c => c.classList.toggle('selected', selectedAreas.has(c.dataset.area)));
      const agInput = document.getElementById('agenciaNombre');
      if (agInput) agInput.value = p.agencia || '';
      renderNichos(); renderProblemSolutions(); renderPropuesta();
      renderLandingNichos(); renderOfertas();
      const activeName = document.getElementById('activeProjectName');
      if (activeName) activeName.textContent = projectName(p);
    }
    renderProjects(); updateProgress(); saveState();
  }
  document.getElementById('btnNuevoProyecto')?.addEventListener('click', () => {
    const id = uid();
    const newP = { id, createdAt: Date.now(), ...snapshotCurrent() };
    state.projects.unshift(newP);
    setActiveProject(id);
    showToast('Proyecto creado.', 'success');
  });
  document.getElementById('projectsGrid')?.addEventListener('click', (e) => {
    const btn = e.target.closest('button[data-action]');
    if (!btn) return;
    const id = btn.dataset.id;
    if (btn.dataset.action === 'open') setActiveProject(id);
    else if (btn.dataset.action === 'duplicate') {
      const src = state.projects.find(p => p.id === id);
      if (!src) return;
      const copy = { ...JSON.parse(JSON.stringify(src)), id: uid(), createdAt: Date.now() };
      state.projects.unshift(copy);
      renderProjects(); saveState();
      showToast('Proyecto duplicado.', 'success');
    } else if (btn.dataset.action === 'delete') {
      if (!confirm('¿Borrar este proyecto?')) return;
      state.projects = state.projects.filter(p => p.id !== id);
      if (state.activeProjectId === id) {
        state.activeProjectId = state.projects[0]?.id || null;
        if (state.activeProjectId) setActiveProject(state.activeProjectId);
        else { document.getElementById('activeProjectName').textContent = 'Sin proyecto'; }
      }
      renderProjects(); saveState();
      showToast('Proyecto borrado.', 'success');
    }
  });
  document.getElementById('projectSwitcher')?.addEventListener('click', () => switchView('proyectos'));

  // ===== Auto-save hooks =====
  function autoSaveCurrent() {
    if (state.activeProjectId) {
      const p = state.projects.find(x => x.id === state.activeProjectId);
      if (p) Object.assign(p, snapshotCurrent());
    }
    saveState();
    updateProgress();
  }
  document.addEventListener('input', (e) => {
    if (e.target.id === 'agenciaNombre') state.currentProject.agencia = e.target.value;
    if (e.target.id === 'landingModalidad') state.currentProject.landingModalidad = e.target.value;
    if (e.target.id === 'landingIdioma') state.currentProject.landingIdioma = e.target.value;
    autoSaveCurrent();
  });

  // Wrap area click + nicho add to autosave
  const _origRenderProblemSolutions = renderProblemSolutions;
  renderProblemSolutions = function() { _origRenderProblemSolutions(); autoSaveCurrent(); renderOfertas(); };
  const _origRenderNichos = renderNichos;
  renderNichos = function() { _origRenderNichos(); autoSaveCurrent(); renderOfertas(); };

  // ===== Export / Import / Reset =====
  document.getElementById('btnExport')?.addEventListener('click', () => {
    const blob = new Blob([JSON.stringify(state, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = 'el-constructor-backup.json';
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    showToast('Backup descargado.', 'success');
  });
  document.getElementById('fileImport')?.addEventListener('change', (e) => {
    const f = e.target.files[0];
    if (!f) return;
    const r = new FileReader();
    r.onload = () => {
      try {
        const data = JSON.parse(r.result);
        Object.assign(state, data);
        localStorage.setItem(STATE_KEY, JSON.stringify(state));
        showToast('Importado. Recargando…', 'success');
        setTimeout(() => location.reload(), 800);
      } catch { showToast('JSON inválido.', 'error'); }
    };
    r.readAsText(f);
  });
  document.getElementById('btnReset')?.addEventListener('click', () => {
    if (!confirm('Esto borrará TODO (proyectos, claves, ajustes). ¿Continuar?')) return;
    localStorage.removeItem(STATE_KEY);
    localStorage.removeItem(ONBOARD_KEY);
    location.reload();
  });

  // ===== Command Palette =====
  const COMMANDS = [
    { id: 'go-dashboard', section: 'Navegación', title: 'Ir a Dashboard', sub: 'Recursos personalizados', action: () => switchView('dashboard') },
    { id: 'go-mapa', section: 'Navegación', title: 'Ir a Mapa de Ruta', sub: 'Las 11 pestañas del flujo', action: () => switchView('mapa') },
    { id: 'go-creador', section: 'Navegación', title: 'Ir a Creador de contenido', sub: 'Flyer Creator', action: () => switchView('creador') },
    { id: 'go-proyectos', section: 'Navegación', title: 'Ir a Mis Proyectos', sub: 'Gestionar proyectos', action: () => switchView('proyectos') },
    { id: 'go-ajustes', section: 'Navegación', title: 'Ir a Ajustes', sub: 'Tema, API keys, perfil…', action: () => switchView('ajustes') },
    { id: 'go-ayuda', section: 'Navegación', title: 'Ir a Ayuda', sub: '¿Qué es El Constructor?', action: () => switchView('ayuda') },
    { id: 'tab-areas', section: 'Mapa de Ruta', title: 'Áreas de Marketing', sub: 'Paso 1', action: () => { switchView('mapa'); gotoTab(1); } },
    { id: 'tab-soluciones', section: 'Mapa de Ruta', title: 'Solucionar el Problema', sub: 'Paso 2', action: () => { switchView('mapa'); gotoTab(2); } },
    { id: 'tab-nicho', section: 'Mapa de Ruta', title: 'Seleccionar Nicho', sub: 'Paso 3', action: () => { switchView('mapa'); gotoTab(3); } },
    { id: 'tab-ofertas', section: 'Mapa de Ruta', title: 'Ofertas y Propuesta de Valor', sub: 'Paso 4', action: () => { switchView('mapa'); gotoTab(4); } },
    { id: 'tab-landing', section: 'Mapa de Ruta', title: 'Configuración de Landing Pages', sub: 'Paso 5', action: () => { switchView('mapa'); gotoTab(5); } },
    { id: 'tab-signalcore', section: 'Mapa de Ruta', title: 'SignalCore — Setter IA', sub: 'Paso 6', action: () => { switchView('mapa'); gotoTab(6); } },
    { id: 'tab-crm', section: 'Mapa de Ruta', title: 'CRM (Airtable)', sub: 'Paso 7', action: () => { switchView('mapa'); gotoTab(7); } },
    { id: 'tab-analizador', section: 'Mapa de Ruta', title: 'Analizador de Web', sub: 'Paso 8', action: () => { switchView('mapa'); gotoTab(8); } },
    { id: 'tab-scripts', section: 'Mapa de Ruta', title: 'Generador de Scripts', sub: 'Paso 9', action: () => { switchView('mapa'); gotoTab(9); } },
    { id: 'tab-prospeccion', section: 'Mapa de Ruta', title: 'Apollo / Apify', sub: 'Paso 10', action: () => { switchView('mapa'); gotoTab(10); } },
    { id: 'tab-metricas', section: 'Mapa de Ruta', title: 'Métricas', sub: 'Paso 11', action: () => { switchView('mapa'); gotoTab(11); } },
    { id: 'act-theme', section: 'Acciones', title: 'Cambiar tema', sub: 'Alternar claro / oscuro', action: () => applyTheme(state.theme === 'dark' ? 'light' : 'dark') },
    { id: 'act-new-project', section: 'Acciones', title: 'Crear nuevo proyecto', sub: 'Guarda el estado actual', action: () => document.getElementById('btnNuevoProyecto').click() },
    { id: 'act-export', section: 'Acciones', title: 'Exportar JSON', sub: 'Descargar backup', action: () => document.getElementById('btnExport').click() },
    { id: 'act-onboarding', section: 'Acciones', title: 'Ver tour de bienvenida', sub: 'Volver a ver el onboarding', action: () => { safeStorage.removeItem(ONBOARD_KEY); startOnboarding(); } },
    { id: 'act-test-ai', section: 'IA', title: 'Probar conexión con IA', sub: 'Verifica que las claves API funcionan', action: () => { switchView('ajustes'); setTimeout(() => document.getElementById('btnTestAI')?.click(), 200); } },
    { id: 'go-abacus', section: 'IA', title: 'Configurar Abacus AI', sub: 'Conecta tu suscripción de ChatLLM', action: () => { switchView('ajustes'); setTimeout(() => document.getElementById('keyAbacus')?.focus(), 200); } }
  ];
  let cmdFocus = 0; let cmdFiltered = COMMANDS;
  function renderCmdList() {
    const list = document.getElementById('cmdList');
    if (!list) return;
    if (cmdFiltered.length === 0) {
      list.innerHTML = '<div class="cmd-empty">Sin resultados</div>'; return;
    }
    const grouped = {};
    cmdFiltered.forEach(c => { (grouped[c.section] = grouped[c.section] || []).push(c); });
    list.innerHTML = Object.keys(grouped).map(section => `
      <div class="cmd-section">
        <div class="cmd-section-title">${section}</div>
        ${grouped[section].map(c => {
          const idx = cmdFiltered.indexOf(c);
          return `<div class="cmd-item ${idx === cmdFocus ? 'focused' : ''}" data-idx="${idx}">
            <span class="cmd-ic"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><polyline points="9 18 15 12 9 6"/></svg></span>
            <div class="cmd-item-text"><div class="cmd-item-title">${escapeHTML(c.title)}</div><div class="cmd-item-sub">${escapeHTML(c.sub)}</div></div>
          </div>`;
        }).join('')}
      </div>
    `).join('');
    list.querySelectorAll('.cmd-item').forEach(el => {
      el.addEventListener('click', () => { cmdFiltered[+el.dataset.idx].action(); closeCmd(); });
      el.addEventListener('mousemove', () => { cmdFocus = +el.dataset.idx; renderCmdList(); });
    });
  }
  function openCmd() {
    document.getElementById('cmdOverlay').classList.add('open');
    setTimeout(() => document.getElementById('cmdInput').focus(), 50);
    cmdFocus = 0; cmdFiltered = COMMANDS; document.getElementById('cmdInput').value = ''; renderCmdList();
  }
  function closeCmd() { document.getElementById('cmdOverlay').classList.remove('open'); }
  document.getElementById('topbarSearch')?.addEventListener('click', openCmd);
  document.getElementById('cmdInput')?.addEventListener('input', (e) => {
    const q = e.target.value.toLowerCase().trim();
    cmdFiltered = q ? COMMANDS.filter(c => (c.title + ' ' + c.sub + ' ' + c.section).toLowerCase().includes(q)) : COMMANDS;
    cmdFocus = 0; renderCmdList();
  });
  document.getElementById('cmdInput')?.addEventListener('keydown', (e) => {
    if (e.key === 'ArrowDown') { cmdFocus = Math.min(cmdFocus + 1, cmdFiltered.length - 1); renderCmdList(); e.preventDefault(); }
    else if (e.key === 'ArrowUp') { cmdFocus = Math.max(cmdFocus - 1, 0); renderCmdList(); e.preventDefault(); }
    else if (e.key === 'Enter') { cmdFiltered[cmdFocus]?.action(); closeCmd(); e.preventDefault(); }
    else if (e.key === 'Escape') closeCmd();
  });
  document.getElementById('cmdOverlay')?.addEventListener('click', (e) => { if (e.target.id === 'cmdOverlay') closeCmd(); });

  // Global shortcuts
  document.addEventListener('keydown', (e) => {
    if ((e.metaKey || e.ctrlKey) && e.key === 'k') { e.preventDefault(); openCmd(); }
    if (e.key === 'Escape') {
      closeCmd();
      document.getElementById('onboardOverlay')?.classList.remove('open');
      document.getElementById('appModal')?.classList.remove('open');
      document.getElementById('cr2BrochureModal')?.classList.remove('open');
      document.getElementById('shortcutsOverlay')?.classList.remove('open');
    }
    if (e.key === '?' && !['INPUT','TEXTAREA','SELECT'].includes(document.activeElement?.tagName)) {
      e.preventDefault();
      document.getElementById('shortcutsOverlay')?.classList.add('open');
    }
  });

  // ===== Onboarding =====
  const ONBOARD_STEPS = [
    { title: 'Bienvenido a Ayuda de Negocios JPMR', text: 'Tu plataforma todo-en-uno para crear, vender y mantener servicios de IA para tu negocio o tus clientes. Incluye Castresana Render AI para inmobiliarias.', icon: '<polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/>' },
    { title: 'Mapa de Ruta en 11 pasos', text: 'Desde elegir nicho hasta atender leads con IA — todo guiado paso a paso en la sección Mapa de Ruta.', icon: '<polygon points="1 6 8 3 16 6 23 3 23 18 16 21 8 18 1 21 1 6"/><line x1="8" y1="3" x2="8" y2="18"/><line x1="16" y1="6" x2="16" y2="21"/>' },
    { title: 'Tus proyectos siempre guardados', text: 'Cada cambio se autoguarda en tu navegador. Crea varios proyectos desde "Mis Proyectos".', icon: '<path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/>' },
    { title: 'Ctrl/⌘ + K para todo', text: 'Pulsa ⌘K o usa el botón Buscar para saltar a cualquier sección, herramienta o acción al instante.', icon: '<circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>' }
  ];
  let onboardStep = 0;
  function renderOnboard() {
    const s = ONBOARD_STEPS[onboardStep];
    document.getElementById('onboardTitle').textContent = s.title;
    document.getElementById('onboardText').textContent = s.text;
    document.getElementById('onboardIllust').innerHTML = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${s.icon}</svg>`;
    document.querySelectorAll('.onboard-dot').forEach((d, i) => d.classList.toggle('active', i === onboardStep));
    document.getElementById('onboardNext').textContent = onboardStep === ONBOARD_STEPS.length - 1 ? 'Empezar' : 'Siguiente';
  }
  function startOnboarding() {
    onboardStep = 0; renderOnboard();
    document.getElementById('onboardOverlay').classList.add('open');
  }
  function endOnboarding() {
    document.getElementById('onboardOverlay').classList.remove('open');
    safeStorage.setItem(ONBOARD_KEY, '1');
  }
  document.getElementById('onboardSkip')?.addEventListener('click', endOnboarding);
  document.getElementById('onboardNext')?.addEventListener('click', () => {
    if (onboardStep < ONBOARD_STEPS.length - 1) { onboardStep++; renderOnboard(); }
    else endOnboarding();
  });
  // Click outside or ESC closes onboarding
  document.getElementById('onboardOverlay')?.addEventListener('click', (e) => {
    if (e.target.id === 'onboardOverlay') endOnboarding();
  });

  // ===== Toast types =====
  const _origShowToast = showToast;
  showToast = function(msg, type = '') {
    const t = document.getElementById('toast');
    t.classList.remove('success', 'error');
    if (type === 'success') t.classList.add('success');
    else if (type === 'error') t.classList.add('error');
    const ic = type === 'success'
      ? '<svg class="toast-ic" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>'
      : type === 'error'
      ? '<svg class="toast-ic" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>'
      : '';
    t.innerHTML = ic + escapeHTML(msg);
    t.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => t.classList.remove('show'), 2600);
  };

  // ===== Render metrics when tab opens =====
  let metricsRendered = false;
  document.querySelector('.tab-btn[data-tab="11"]')?.addEventListener('click', () => {
    if (metricsRendered) return;
    metricsRendered = true;
    setTimeout(() => { animateCounters(); renderChart(); }, 200);
  });

  // =====================================================================
  // ============ HUB DE APPS EXTERNAS (Manus, Base44, ...) ==============
  // =====================================================================
  const DEFAULT_APPS = [
    {
      id: 'app_castrender_default',
      name: 'Cast Render',
      url: 'https://cast-render-ukuxamze.manus.space/',
      desc: 'App externa montada en Manus — vinculada a tu nicho (Asesoría Castresana).',
      platform: 'manus',
      pinned: true,
      createdAt: Date.now()
    },
    {
      id: 'app_castresanaflow_default',
      name: 'Castresana Smart Flow',
      url: 'https://castresana-smart-flow.base44.app/',
      desc: 'Flujo inteligente desplegado en Base44 — landing + setter + agenda.',
      platform: 'base44',
      pinned: true,
      createdAt: Date.now()
    }
  ];
  if (!state.apps) state.apps = [];
  // First-time seed if state has no apps yet
  if (state.apps.length === 0 && !localStorage.getItem('mkthacker_apps_seeded_v1')) {
    state.apps = [...DEFAULT_APPS];
    localStorage.setItem('mkthacker_apps_seeded_v1', '1');
  }

  function platformLabel(p) {
    return { manus: 'Manus', base44: 'Base44', vercel: 'Vercel', lovable: 'Lovable', bolt: 'Bolt', netlify: 'Netlify', other: 'Externa' }[p] || 'Externa';
  }
  function renderApps() {
    const grid = document.getElementById('appsGrid');
    if (!grid) return;
    if (state.apps.length === 0) {
      grid.innerHTML = `<div class="apps-empty">Sin apps registradas. Pulsa "Añadir app" para empezar.</div>`;
      return;
    }
    grid.innerHTML = state.apps.map(a => `
      <div class="app-card" data-id="${a.id}">
        <div class="app-preview">
          <span class="app-platform-badge ${a.platform}">${platformLabel(a.platform)}</span>
          <div class="blocked">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="3" width="20" height="14" rx="2"/><line x1="8" y1="21" x2="16" y2="21"/><line x1="12" y1="17" x2="12" y2="21"/></svg>
            <span>Vista previa no disponible — abrir directamente</span>
          </div>
          <iframe src="${escapeHTML(a.url)}" loading="lazy" referrerpolicy="no-referrer" sandbox="allow-scripts allow-same-origin"
                  onload="this.parentElement.querySelector('.blocked').style.display='none';"
                  onerror="this.style.display='none';"></iframe>
        </div>
        <div class="app-body">
          <h4>${escapeHTML(a.name)}</h4>
          <div class="app-url">${escapeHTML(a.url)}</div>
          <div class="app-desc">${escapeHTML(a.desc || '')}</div>
          <div class="app-actions">
            <a class="primary" href="${escapeHTML(a.url)}" target="_blank" rel="noopener">
              Abrir
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><line x1="7" y1="17" x2="17" y2="7"/><polyline points="7 7 17 7 17 17"/></svg>
            </a>
            <button data-action="copy" data-url="${escapeHTML(a.url)}">Copiar URL</button>
            <button data-action="edit" data-id="${a.id}">Editar</button>
            <button data-action="delete" data-id="${a.id}" class="danger">Borrar</button>
          </div>
        </div>
      </div>
    `).join('');
  }

  let editingAppId = null;
  function openAppModal(app = null) {
    editingAppId = app?.id || null;
    document.getElementById('appModalTitle').textContent = app ? 'Editar app externa' : 'Añadir app externa';
    document.getElementById('appName').value = app?.name || '';
    document.getElementById('appUrl').value = app?.url || '';
    document.getElementById('appDesc').value = app?.desc || '';
    document.getElementById('appPlatform').value = app?.platform || 'manus';
    document.getElementById('appModal').classList.add('open');
    setTimeout(() => document.getElementById('appName').focus(), 50);
  }
  function closeAppModal() {
    document.getElementById('appModal').classList.remove('open');
    editingAppId = null;
  }
  document.getElementById('btnAddApp')?.addEventListener('click', () => openAppModal());
  document.getElementById('appCancel')?.addEventListener('click', closeAppModal);
  document.getElementById('appSave')?.addEventListener('click', () => {
    const name = document.getElementById('appName').value.trim();
    const url = document.getElementById('appUrl').value.trim();
    const desc = document.getElementById('appDesc').value.trim();
    const platform = document.getElementById('appPlatform').value;
    if (!name || !url) return showToast('Pon al menos nombre y URL.', 'error');
    try { new URL(url); } catch { return showToast('URL inválida.', 'error'); }
    if (editingAppId) {
      const app = state.apps.find(a => a.id === editingAppId);
      if (app) Object.assign(app, { name, url, desc, platform });
    } else {
      state.apps.unshift({
        id: 'app_' + Math.random().toString(36).slice(2, 10),
        name, url, desc, platform,
        createdAt: Date.now()
      });
    }
    saveState(); renderApps(); closeAppModal();
    showToast('App guardada.', 'success');
  });

  document.getElementById('appsGrid')?.addEventListener('click', async (e) => {
    const btn = e.target.closest('button[data-action]');
    if (!btn) return;
    const id = btn.dataset.id;
    const action = btn.dataset.action;
    if (action === 'copy') {
      try { await navigator.clipboard.writeText(btn.dataset.url); showToast('URL copiada.', 'success'); }
      catch { showToast('No se pudo copiar.', 'error'); }
    } else if (action === 'edit') {
      openAppModal(state.apps.find(a => a.id === id));
    } else if (action === 'delete') {
      if (!confirm('¿Borrar esta app de la lista? (no se desplegará nada externo)')) return;
      state.apps = state.apps.filter(a => a.id !== id);
      saveState(); renderApps();
      showToast('App borrada.', 'success');
    }
  });
  document.getElementById('appModal')?.addEventListener('click', (e) => {
    if (e.target.id === 'appModal') closeAppModal();
  });

  // Add Cast Render command to palette
  COMMANDS.push(
    { id: 'go-castrender-internal', section: 'Navegación', title: 'Ir a Cast Render', sub: 'Renderizador de fichas inmobiliarias IA', action: () => switchView('castrender') },
    { id: 'go-castrender', section: 'Apps externas', title: 'Abrir Cast Render (Manus)', sub: 'cast-render-ukuxamze.manus.space', action: () => window.open('https://cast-render-ukuxamze.manus.space/', '_blank', 'noopener') },
    { id: 'go-smartflow', section: 'Apps externas', title: 'Abrir Castresana Smart Flow', sub: 'Base44 · castresana-smart-flow.base44.app', action: () => window.open('https://castresana-smart-flow.base44.app/', '_blank', 'noopener') },
    { id: 'act-add-app', section: 'Apps externas', title: 'Añadir nueva app externa', sub: 'Registra una URL en el hub', action: () => { switchView('dashboard'); setTimeout(() => document.getElementById('btnAddApp').click(), 200); } }
  );

  // =====================================================================
  // ============ CASTRESANA RENDER AI (1:1 replica) =====================
  // =====================================================================
  if (!state.cr2) state.cr2 = { history: [], count: 0 };

  let cr2FileUrl = null;
  let cr2FileName = null;
  const cr2Drop = document.getElementById('cr2Drop');
  const cr2FileInput = document.getElementById('cr2File');
  const cr2DropImg = document.getElementById('cr2DropImg');

  function cr2HandleFile(file) {
    if (!file) return;
    if (!file.type.startsWith('image/') && file.type !== 'application/pdf') {
      return showToast('Solo PNG, JPG o PDF.', 'error');
    }
    if (file.size > 20 * 1024 * 1024) {
      return showToast('Máximo 20 MB.', 'error');
    }
    if (cr2FileUrl) URL.revokeObjectURL(cr2FileUrl);
    cr2FileUrl = URL.createObjectURL(file);
    cr2FileName = file.name;
    cr2DropImg.src = cr2FileUrl;
    cr2Drop.classList.add('has-file');
  }
  cr2FileInput?.addEventListener('change', (e) => cr2HandleFile(e.target.files[0]));
  ['dragover', 'dragenter'].forEach(ev => {
    cr2Drop?.addEventListener(ev, (e) => { e.preventDefault(); cr2Drop.classList.add('dragging'); });
  });
  ['dragleave', 'drop'].forEach(ev => {
    cr2Drop?.addEventListener(ev, (e) => { e.preventDefault(); cr2Drop.classList.remove('dragging'); });
  });
  cr2Drop?.addEventListener('drop', (e) => cr2HandleFile(e.dataTransfer.files[0]));

  function buildCR2Render(opts) {
    // Generates a mock 3D top-down: rectangle plot with rooms inside, furniture and a label
    const rooms = {
      piso: [
        { x: 5, y: 5, w: 50, h: 38, label: 'SALÓN' },
        { x: 57, y: 5, w: 38, h: 22, label: 'COCINA' },
        { x: 57, y: 29, w: 38, h: 14, label: 'BAÑO' },
        { x: 5, y: 45, w: 35, h: 50, label: 'DORM. PRINCIPAL' },
        { x: 42, y: 45, w: 28, h: 25, label: 'DORM. 2' },
        { x: 42, y: 72, w: 28, h: 23, label: 'PASILLO' },
        { x: 72, y: 45, w: 23, h: 50, label: 'DORM. 3' }
      ],
      atico: [
        { x: 5, y: 5, w: 70, h: 50, label: 'SALÓN-COMEDOR' },
        { x: 77, y: 5, w: 18, h: 28, label: 'COCINA' },
        { x: 77, y: 35, w: 18, h: 20, label: 'BAÑO' },
        { x: 5, y: 57, w: 50, h: 38, label: 'DORM. PRINCIPAL' },
        { x: 57, y: 57, w: 38, h: 38, label: 'TERRAZA' }
      ],
      chalet: [
        { x: 5, y: 5, w: 42, h: 35, label: 'SALÓN' },
        { x: 49, y: 5, w: 46, h: 35, label: 'COCINA-COMEDOR' },
        { x: 5, y: 42, w: 28, h: 30, label: 'DORM. 1' },
        { x: 35, y: 42, w: 28, h: 30, label: 'DORM. 2' },
        { x: 65, y: 42, w: 30, h: 30, label: 'DORM. PRINC.' },
        { x: 5, y: 74, w: 60, h: 21, label: 'JARDÍN' },
        { x: 67, y: 74, w: 28, h: 21, label: 'BAÑO' }
      ],
      duplex: [
        { x: 5, y: 5, w: 45, h: 45, label: 'SALÓN PB' },
        { x: 52, y: 5, w: 43, h: 45, label: 'COCINA PB' },
        { x: 5, y: 52, w: 30, h: 43, label: 'DORM. 1' },
        { x: 37, y: 52, w: 30, h: 43, label: 'BAÑO' },
        { x: 69, y: 52, w: 26, h: 43, label: 'DORM. 2' }
      ],
      local: [
        { x: 5, y: 5, w: 60, h: 55, label: 'ZONA COMERCIAL' },
        { x: 67, y: 5, w: 28, h: 28, label: 'ALMACÉN' },
        { x: 67, y: 35, w: 28, h: 25, label: 'BAÑO' },
        { x: 5, y: 62, w: 90, h: 33, label: 'ESCAPARATE / ENTRADA' }
      ],
      oficina: [
        { x: 5, y: 5, w: 90, h: 30, label: 'OPEN SPACE' },
        { x: 5, y: 37, w: 30, h: 30, label: 'SALA REUNIÓN' },
        { x: 37, y: 37, w: 30, h: 30, label: 'DESPACHO' },
        { x: 69, y: 37, w: 26, h: 30, label: 'COCINA' },
        { x: 5, y: 69, w: 50, h: 26, label: 'COWORKING' },
        { x: 57, y: 69, w: 38, h: 26, label: 'BAÑO' }
      ]
    };
    const list = rooms[opts.tipo] || rooms.piso;
    const styleColors = {
      moderno: { wall: '#8b7355', floor1: '#f5f0e6', floor2: '#e8d9b6', furniture: 'rgba(40, 90, 60, 0.85)' },
      escandinavo: { wall: '#bfbfbf', floor1: '#fbfaf7', floor2: '#ece6da', furniture: 'rgba(120, 90, 60, 0.65)' },
      minimalista: { wall: '#999', floor1: '#fafafa', floor2: '#ededed', furniture: 'rgba(50, 50, 50, 0.7)' },
      lujo: { wall: '#8a6f3b', floor1: '#e8dcb7', floor2: '#caa86c', furniture: 'rgba(60, 30, 30, 0.85)' },
      industrial: { wall: '#4a4a4a', floor1: '#a39787', floor2: '#7a6f5e', furniture: 'rgba(30, 30, 30, 0.85)' },
      rustico: { wall: '#6e4f2a', floor1: '#d6b481', floor2: '#a8814d', furniture: 'rgba(80, 50, 30, 0.9)' }
    };
    const c = styleColors[opts.estilo] || styleColors.moderno;

    const roomsHTML = list.map((r, i) => {
      const furniture = [];
      // add 1-3 furniture rectangles per room
      const fcount = (i + opts.tipo.length) % 3 + 1;
      for (let j = 0; j < fcount; j++) {
        const fx = r.x + 4 + (j * 6 + i * 3) % Math.max(r.w - 12, 8);
        const fy = r.y + 6 + (j * 5 + i * 2) % Math.max(r.h - 12, 6);
        const fw = 6 + (j + i) % 5;
        const fh = 4 + (j + i) % 4;
        furniture.push(`<div class="cr2-render-furniture" style="left:${fx}%;top:${fy}%;width:${fw}%;height:${fh}%;background:${c.furniture}"></div>`);
      }
      return `<div class="cr2-render-room" style="left:${r.x}%;top:${r.y}%;width:${r.w}%;height:${r.h}%;border-color:${c.wall}">${r.label}</div>${furniture.join('')}`;
    }).join('');

    return `<div class="cr2-render ${opts.luz}" style="background:linear-gradient(180deg, ${c.floor1} 0%, ${c.floor2} 100%);">
      ${roomsHTML}
      <div class="cr2-render-watermark">
        <svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 2l1.7 4.6L18 8l-4.3 1.4L12 14l-1.7-4.6L6 8l4.3-1.4L12 2z"/></svg>
        CASTRESANA RENDER AI
      </div>
      <div class="cr2-render-label">${opts.tipo.toUpperCase()} · ${opts.estilo.toUpperCase()} · ${opts.calidad.toUpperCase()}</div>
    </div>`;
  }

  function cr2CollectCommercial() {
    return {
      titulo: document.getElementById('cr2Titulo')?.value.trim() || '',
      precio: document.getElementById('cr2Precio')?.value.trim() || '',
      m2: document.getElementById('cr2M2')?.value.trim() || '',
      hab: document.getElementById('cr2Hab')?.value.trim() || '',
      ubic: document.getElementById('cr2Ubic')?.value.trim() || '',
      contacto: document.getElementById('cr2Contacto')?.value.trim() || ''
    };
  }

  function cr2CollectOpts() {
    return {
      tipo: document.getElementById('cr2Tipo').value,
      estilo: document.getElementById('cr2Estilo').value,
      luz: document.getElementById('cr2Luz').value,
      calidad: document.getElementById('cr2Calidad').value,
      extra: document.getElementById('cr2Extra').value.trim()
    };
  }

  async function cr2NodeToDataURL(node, size = 1024) {
    const rect = node.getBoundingClientRect();
    const clone = node.cloneNode(true);
    clone.style.width = size + 'px';
    clone.style.height = size + 'px';
    const css = [...document.styleSheets].map(s => {
      try { return [...s.cssRules].map(r => r.cssText).join('\n'); } catch { return ''; }
    }).join('\n');
    const wrap = document.createElement('div'); wrap.appendChild(clone);
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}">
      <foreignObject width="100%" height="100%">
        <div xmlns="http://www.w3.org/1999/xhtml" style="font-family: Inter, sans-serif; width:${size}px; height:${size}px;">
          <style>${css}</style>${wrap.innerHTML}
        </div>
      </foreignObject>
    </svg>`;
    return 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg);
  }

  function cr2RenderHistory() {
    const list = document.getElementById('cr2HistoryList');
    const count = document.getElementById('cr2HistoryCount');
    if (!list) return;
    const items = state.cr2.history || [];
    count.textContent = `${items.length} render${items.length === 1 ? '' : 's'}`;
    if (items.length === 0) {
      list.innerHTML = '<div class="cr2-history-empty">Tus renders aparecerán aquí</div>';
      return;
    }
    list.innerHTML = items.map(h => `
      <div class="cr2-history-thumb" data-id="${h.id}" title="${escapeHTML(h.tipo + ' · ' + h.estilo)}">
        ${h.html}
        <button class="cr2-history-del" data-del="${h.id}" aria-label="Borrar">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
        </button>
      </div>
    `).join('');
  }

  document.getElementById('cr2Generar')?.addEventListener('click', () => {
    const opts = cr2CollectOpts();
    const canvas = document.getElementById('cr2Canvas');
    canvas.innerHTML = `
      <div class="cr2-render-loading">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M21 12a9 9 0 1 1-9-9"/></svg>
        <strong>Generando render 3D…</strong>
        <span>Analizando plano y aplicando estilo ${opts.estilo}</span>
      </div>`;
    document.getElementById('cr2Actions').style.display = 'none';
    setTimeout(() => {
      const html = buildCR2Render(opts);
      canvas.innerHTML = html;
      document.getElementById('cr2Actions').style.display = 'flex';
      state.cr2.count = (state.cr2.count || 0) + 1;
      state.cr2.history = state.cr2.history || [];
      state.cr2.history.unshift({
        id: 'r_' + Date.now(),
        tipo: opts.tipo, estilo: opts.estilo, luz: opts.luz, calidad: opts.calidad,
        html, createdAt: Date.now()
      });
      state.cr2.history = state.cr2.history.slice(0, 12);
      cr2RenderHistory();
      saveState();
      showToast('Render generado.', 'success');
    }, 1400);
  });

  document.getElementById('cr2Regen')?.addEventListener('click', () => {
    document.getElementById('cr2Generar').click();
  });

  document.getElementById('cr2Descargar')?.addEventListener('click', async () => {
    const node = document.querySelector('#cr2Canvas .cr2-render');
    if (!node) return showToast('Genera un render primero.', 'error');
    const calidad = document.getElementById('cr2Calidad').value;
    const size = calidad === '4k' ? 4096 : calidad === 'hd' ? 2048 : 1024;
    try {
      const dataUrl = await cr2NodeToDataURL(node, size);
      const img = new Image();
      img.crossOrigin = 'anonymous';
      img.onload = () => {
        const c = document.createElement('canvas');
        c.width = size; c.height = size;
        const ctx = c.getContext('2d');
        ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, size, size);
        ctx.drawImage(img, 0, 0, size, size);
        c.toBlob((blob) => {
          if (!blob) return showToast('No se pudo exportar.', 'error');
          const url = URL.createObjectURL(blob);
          const a = document.createElement('a');
          a.href = url; a.download = `castresana-render-${Date.now()}.png`;
          a.click();
          setTimeout(() => URL.revokeObjectURL(url), 1500);
          showToast('Descargado en ' + size + '×' + size + '.', 'success');
        }, 'image/png');
      };
      img.onerror = () => showToast('Tu navegador bloqueó la exportación. Haz captura.', 'error');
      img.src = dataUrl;
    } catch (e) {
      showToast('Exportación no disponible.', 'error');
    }
  });

  document.getElementById('cr2Wa')?.addEventListener('click', () => {
    const d = cr2CollectCommercial();
    const opts = cr2CollectOpts();
    const lines = [];
    lines.push(`🏠 *${d.titulo || 'Nuevo inmueble disponible'}*`);
    if (d.ubic) lines.push(`📍 ${d.ubic}`);
    lines.push('');
    lines.push(`✨ Render 3D generado con Castresana Render AI`);
    lines.push(`   Estilo: ${opts.estilo} · Iluminación: ${opts.luz}`);
    lines.push('');
    const specs = [];
    if (opts.tipo) specs.push(`✦ ${opts.tipo[0].toUpperCase() + opts.tipo.slice(1)}`);
    if (d.m2) specs.push(`📐 ${d.m2} m²`);
    if (d.hab) specs.push(`🛏️ ${d.hab} habs.`);
    if (specs.length) { lines.push(specs.join(' · ')); lines.push(''); }
    if (d.precio) { lines.push(`💰 *${d.precio}*`); lines.push(''); }
    if (d.contacto) lines.push(`📞 ${d.contacto}`);
    lines.push('');
    lines.push('— Renderizado con Castresana Render AI');
    const msg = encodeURIComponent(lines.join('\n'));
    window.open(`https://wa.me/?text=${msg}`, '_blank', 'noopener');
  });

  function cr2BuildBrochure() {
    const opts = cr2CollectOpts();
    const d = cr2CollectCommercial();
    const renderHTML = buildCR2Render(opts).replace('class="cr2-render-watermark"', 'class="cr2-render-watermark" style="display:none;"');
    return `
      <div class="cr2-bro-header">
        <div class="left">
          <div class="logo">JR</div>
          <div>
            <h2>${escapeHTML(d.titulo || 'Inmueble destacado')}</h2>
            <small>${escapeHTML(d.ubic || 'Asturias / Cantabria')}</small>
          </div>
        </div>
        <span class="cr2-bro-status">En venta</span>
      </div>
      <div class="cr2-bro-image">${renderHTML}</div>
      <div class="cr2-bro-body">
        ${d.precio ? `<div class="cr2-bro-price">${escapeHTML(d.precio)}</div>` : ''}
        <div style="font-size:14px; color:#555; line-height:1.55;">
          ${escapeHTML(opts.tipo[0].toUpperCase() + opts.tipo.slice(1))} en estilo <strong>${escapeHTML(opts.estilo)}</strong>${opts.extra ? ` — ${escapeHTML(opts.extra)}` : ''}.
        </div>
        <div class="cr2-bro-specs">
          ${d.m2 ? `<div class="cr2-bro-spec"><strong>${escapeHTML(d.m2)}</strong><small>metros²</small></div>` : ''}
          ${d.hab ? `<div class="cr2-bro-spec"><strong>${escapeHTML(d.hab)}</strong><small>habs.</small></div>` : ''}
          <div class="cr2-bro-spec"><strong>${opts.calidad === '4k' ? '4K' : opts.calidad === 'hd' ? 'HD' : 'STD'}</strong><small>render</small></div>
        </div>
      </div>
      <div class="cr2-bro-footer">
        <div class="brand">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2l1.7 4.6L18 8l-4.3 1.4L12 14l-1.7-4.6L6 8l4.3-1.4L12 2z"/></svg>
          Castresana Render AI · JPMR Negocios
        </div>
        <span>${escapeHTML(d.contacto || 'castresana.es')}</span>
      </div>`;
  }

  document.getElementById('cr2Brochure')?.addEventListener('click', () => {
    const node = document.querySelector('#cr2Canvas .cr2-render');
    if (!node) return showToast('Genera un render primero.', 'error');
    document.getElementById('cr2BrochurePaper').innerHTML = cr2BuildBrochure();
    // Re-attach close button and actions since innerHTML replaced them
    const paper = document.getElementById('cr2BrochurePaper');
    const closeBtn = document.createElement('button');
    closeBtn.className = 'cr2-bro-close'; closeBtn.setAttribute('aria-label', 'Cerrar');
    closeBtn.innerHTML = '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>';
    closeBtn.onclick = () => document.getElementById('cr2BrochureModal').classList.remove('open');
    const actions = document.createElement('div');
    actions.className = 'cr2-bro-actions';
    actions.innerHTML = `
      <button id="cr2BroDescargarDyn"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg> Descargar PNG</button>
      <button id="cr2BroImprimirDyn"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><polyline points="6 9 6 2 18 2 18 9"/><path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"/><rect x="6" y="14" width="12" height="8"/></svg> Imprimir / PDF</button>
    `;
    paper.appendChild(closeBtn);
    paper.appendChild(actions);
    document.getElementById('cr2BroDescargarDyn').onclick = cr2DownloadBrochure;
    document.getElementById('cr2BroImprimirDyn').onclick = cr2PrintBrochure;
    document.getElementById('cr2BrochureModal').classList.add('open');
  });
  document.getElementById('cr2BrochureModal')?.addEventListener('click', (e) => {
    if (e.target.id === 'cr2BrochureModal') e.target.classList.remove('open');
  });

  async function cr2DownloadBrochure() {
    const paper = document.getElementById('cr2BrochurePaper');
    if (!paper) return;
    const dataUrl = await cr2NodeToDataURL(paper, 1200);
    const img = new Image();
    img.onload = () => {
      const c = document.createElement('canvas');
      const ratio = 1.414;
      c.width = 1200; c.height = 1200 * ratio;
      const ctx = c.getContext('2d');
      ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, c.width, c.height);
      ctx.drawImage(img, 0, 0, c.width, c.height);
      c.toBlob((blob) => {
        if (!blob) return showToast('No se pudo exportar.', 'error');
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url; a.download = `castresana-brochure-${Date.now()}.png`;
        a.click();
        setTimeout(() => URL.revokeObjectURL(url), 1500);
        showToast('Brochure descargado.', 'success');
      }, 'image/png');
    };
    img.onerror = () => showToast('Exportación bloqueada. Usa "Imprimir / PDF".', 'error');
    img.src = dataUrl;
  }

  function cr2PrintBrochure() {
    const paper = document.getElementById('cr2BrochurePaper');
    if (!paper) return;
    const w = window.open('', '_blank');
    if (!w) return showToast('Activa popups para imprimir.', 'error');
    const css = [...document.styleSheets].map(s => {
      try { return [...s.cssRules].map(r => r.cssText).join('\n'); } catch { return ''; }
    }).join('\n');
    w.document.write(`<!doctype html><html><head><meta charset="utf-8"><title>Brochure Castresana</title>
      <style>${css}
        @page { size: A4 portrait; margin: 0; }
        body { margin: 0; background: #fff; }
        .print-wrap { width: 210mm; height: 297mm; }
        .cr2-brochure-paper { width: 100%; height: 100%; border-radius: 0; box-shadow: none; }
        .cr2-bro-close, .cr2-bro-actions { display: none !important; }
      </style></head><body><div class="print-wrap">${paper.outerHTML.replace(/<button class="cr2-bro-close"[\s\S]*?<\/button>/, '').replace(/<div class="cr2-bro-actions">[\s\S]*?<\/div>/, '')}</div>
      <script>setTimeout(() => { window.print(); }, 300);<\/script>
      </body></html>`);
    w.document.close();
  }

  document.getElementById('cr2HistoryList')?.addEventListener('click', (e) => {
    const del = e.target.closest('[data-del]');
    if (del) {
      e.stopPropagation();
      state.cr2.history = state.cr2.history.filter(h => h.id !== del.dataset.del);
      cr2RenderHistory(); saveState();
      return;
    }
    const thumb = e.target.closest('[data-id]');
    if (thumb) {
      const h = state.cr2.history.find(x => x.id === thumb.dataset.id);
      if (!h) return;
      document.getElementById('cr2Tipo').value = h.tipo;
      document.getElementById('cr2Estilo').value = h.estilo;
      document.getElementById('cr2Luz').value = h.luz;
      document.getElementById('cr2Calidad').value = h.calidad;
      document.getElementById('cr2Canvas').innerHTML = h.html;
      document.getElementById('cr2Actions').style.display = 'flex';
      document.getElementById('cr2Canvas').scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  });

  document.getElementById('cr2Login')?.addEventListener('click', () => {
    showToast('Login simulado — todo se guarda en tu navegador.', 'success');
  });

  // Legacy old castRender — keep noop fallbacks (functions referenced in init)
  function renderCRSaved() { /* deprecated: replaced by cr2RenderHistory */ }
  function updateCRFormat() { /* deprecated */ }

  // =====================================================================
  // ============ LEGACY castRender state (kept for migration) ===========
  // =====================================================================
  if (!state.castRender) state.castRender = { saved: [], count: 0 };

  let crCurrentPhotoUrl = null;
  document.getElementById('crFoto')?.addEventListener('change', (e) => {
    const f = e.target.files[0];
    if (!f || !f.type.startsWith('image/')) return;
    if (crCurrentPhotoUrl) URL.revokeObjectURL(crCurrentPhotoUrl);
    crCurrentPhotoUrl = URL.createObjectURL(f);
    document.getElementById('crFotoLabel').textContent = `✓ ${f.name}`;
  });
  document.getElementById('crFormato')?.addEventListener('change', updateCRFormat);
  function updateCRFormat() {
    const f = document.getElementById('crFormato').value;
    const wrap = document.getElementById('crCanvasWrap');
    wrap.className = 'cr-canvas-wrap';
    wrap.classList.add(f === 'post' ? '' : f);
    const labels = { post: 'Post 1080×1080', story: 'Story 1080×1920', horizontal: 'Horizontal 1200×628', brochure: 'Brochure A4' };
    document.getElementById('crFormatLabel').textContent = labels[f] || '';
  }

  function buildCRCopy(d) {
    const lines = [];
    lines.push(`🏠 ${d.titulo || 'Nuevo inmueble disponible'}`);
    if (d.subtitulo) lines.push(d.subtitulo);
    lines.push('');
    const specs = [];
    if (d.tipo) specs.push(`✨ ${capitalize(d.tipo)}`);
    if (d.m2) specs.push(`📐 ${d.m2} m²`);
    if (d.hab) specs.push(`🛏️ ${d.hab} habitaciones`);
    if (d.ubic) specs.push(`📍 ${d.ubic}`);
    if (specs.length) lines.push(specs.join('  ·  '));
    if (d.caract) { lines.push(''); d.caract.split(/\n|·|,/).map(s => s.trim()).filter(Boolean).forEach(c => lines.push(`✓ ${c}`)); }
    lines.push('');
    if (d.precio) lines.push(`💰 ${d.precio}`);
    if (d.estado) lines.push(`📌 ${capitalize(d.estado)}`);
    lines.push('');
    if (d.contacto) lines.push(`📞 ${d.contacto}`);
    if (d.marca) lines.push(`— ${d.marca}`);
    lines.push('');
    lines.push('#inmobiliaria #viviendaIdeal #' + (d.ubic || 'casa').toLowerCase().replace(/[^a-z0-9]/g, ''));
    return lines.join('\n');
  }
  function capitalize(s) { return s ? s[0].toUpperCase() + s.slice(1) : ''; }

  function renderCRCard(d) {
    const feats = (d.caract || '').split(/\n|·|,/).map(s => s.trim().toUpperCase()).filter(Boolean).slice(0, 4);
    const photoStyle = crCurrentPhotoUrl ? `background-image:url('${crCurrentPhotoUrl}')` : '';
    return `
      <div class="cr-output">
        ${d.marca ? `<div class="cr-out-brand">▸ ${escapeHTML(d.marca)}</div>` : ''}
        ${d.estado ? `<div class="cr-out-status">¡${escapeHTML(estadoLabel(d.estado))}!</div>` : ''}
        <div class="cr-out-image ${crCurrentPhotoUrl ? '' : 'placeholder'}" style="${photoStyle}"></div>
        ${d.precio ? `<div class="cr-out-price">${escapeHTML(d.precio)}</div>` : ''}
        <div class="cr-out-body">
          <div class="cr-out-title">${escapeHTML((d.titulo || 'TU NUEVO HOGAR TE ESPERA').toUpperCase())}</div>
          ${d.subtitulo ? `<div class="cr-out-sub">${escapeHTML(d.subtitulo)}</div>` : ''}
          ${feats.length ? `<div class="cr-out-feats">${feats.map(f => `• ${escapeHTML(f)}`).join('<br/>')}</div>` : ''}
          <div class="cr-out-footer">
            <span>${escapeHTML(d.contacto || (d.marca ? d.marca.toLowerCase().replace(/\s+/g, '') + '.es' : 'castresana.es'))}</span>
            <span>${escapeHTML('¡SOLICITA MÁS INFO!')}</span>
          </div>
        </div>
      </div>`;
  }
  function estadoLabel(s) { return ({ venta: 'En venta', alquiler: 'En alquiler', reserva: 'Reserva', vendido: 'Vendido', lanzamiento: 'Lanzamiento' })[s] || s; }

  function collectCR() {
    return {
      tipo: document.getElementById('crTipo').value,
      estilo: document.getElementById('crEstilo').value,
      titulo: document.getElementById('crTitulo').value.trim(),
      subtitulo: document.getElementById('crSubtitulo').value.trim(),
      ubic: document.getElementById('crUbic').value.trim(),
      m2: document.getElementById('crM2').value.trim(),
      hab: document.getElementById('crHab').value.trim(),
      precio: document.getElementById('crPrecio').value.trim(),
      estado: document.getElementById('crEstado').value,
      caract: document.getElementById('crCaract').value.trim(),
      marca: document.getElementById('crMarca').value.trim(),
      contacto: document.getElementById('crContacto').value.trim(),
      formato: document.getElementById('crFormato').value,
      photo: crCurrentPhotoUrl
    };
  }

  function generateCR() {
    const d = collectCR();
    if (!d.titulo) return showToast('Pon al menos un título para el inmueble.', 'error');
    updateCRFormat();
    const wrap = document.getElementById('crCanvasWrap');
    wrap.innerHTML = `<div class="cr-canvas-empty streaming-dot">Renderizando con IA</div>`;
    document.getElementById('crActions').style.display = 'none';
    setTimeout(() => {
      wrap.innerHTML = renderCRCard(d);
      document.getElementById('crCopy').value = buildCRCopy(d);
      document.getElementById('crActions').style.display = 'flex';
      state.castRender.count = (state.castRender.count || 0) + 1;
      const stat = document.getElementById('crStatProps');
      if (stat) stat.textContent = state.castRender.count;
      // auto-save snapshot to saved list (latest = first)
      const snap = { ...d, id: 'cr_' + Date.now(), createdAt: Date.now() };
      state.castRender.saved = state.castRender.saved || [];
      state.castRender.saved.unshift(snap);
      state.castRender.saved = state.castRender.saved.slice(0, 12);
      renderCRSaved();
      saveState();
      showToast('Ficha generada.', 'success');
    }, 700);
  }

  function renderCRSaved() {
    const list = document.getElementById('crSavedList');
    if (!list) return;
    const items = state.castRender.saved || [];
    if (items.length === 0) {
      list.innerHTML = '<div style="color:var(--muted); font-size:13px;">Aún no has guardado ninguna ficha.</div>';
      return;
    }
    list.innerHTML = items.map(s => `
      <div class="cr-saved-item" data-id="${s.id}">
        <div class="thumb"></div>
        <div class="meta">
          <strong>${escapeHTML(s.titulo || 'Sin título')}</strong>
          <small>${escapeHTML(s.precio || '—')} · ${new Date(s.createdAt).toLocaleString('es-ES', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}</small>
        </div>
        <button data-action="cr-delete" data-id="${s.id}" aria-label="Borrar">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/></svg>
        </button>
      </div>
    `).join('');
  }

  document.getElementById('crGenerar')?.addEventListener('click', generateCR);
  document.getElementById('crRegenerar')?.addEventListener('click', generateCR);
  document.getElementById('crCopiarCopy')?.addEventListener('click', async () => {
    const t = document.getElementById('crCopy').value;
    if (!t) return showToast('No hay copy para copiar.', 'error');
    try { await navigator.clipboard.writeText(t); showToast('Copy copiado al portapapeles.', 'success'); }
    catch { showToast('No se pudo copiar.', 'error'); }
  });
  document.getElementById('crDescargar')?.addEventListener('click', () => {
    // Reuse the SVG/foreignObject export trick already defined
    const node = document.querySelector('#crCanvasWrap .cr-output');
    if (!node) return showToast('Genera la ficha primero.', 'error');
    showToast('La descarga directa requiere un servicio de render. Haz una captura por ahora.', 'success');
  });
  document.getElementById('crSavedList')?.addEventListener('click', (e) => {
    const btn = e.target.closest('button[data-action="cr-delete"]');
    const item = e.target.closest('.cr-saved-item');
    if (btn) {
      state.castRender.saved = state.castRender.saved.filter(s => s.id !== btn.dataset.id);
      renderCRSaved(); saveState();
      showToast('Variante borrada.', 'success'); return;
    }
    if (item) {
      const s = state.castRender.saved.find(x => x.id === item.dataset.id);
      if (!s) return;
      document.getElementById('crTipo').value = s.tipo || 'piso';
      document.getElementById('crEstilo').value = s.estilo || 'moderno';
      document.getElementById('crTitulo').value = s.titulo || '';
      document.getElementById('crSubtitulo').value = s.subtitulo || '';
      document.getElementById('crUbic').value = s.ubic || '';
      document.getElementById('crM2').value = s.m2 || '';
      document.getElementById('crHab').value = s.hab || '';
      document.getElementById('crPrecio').value = s.precio || '';
      document.getElementById('crEstado').value = s.estado || 'venta';
      document.getElementById('crCaract').value = s.caract || '';
      document.getElementById('crMarca').value = s.marca || '';
      document.getElementById('crContacto').value = s.contacto || '';
      document.getElementById('crFormato').value = s.formato || 'post';
      updateCRFormat();
      generateCR();
    }
  });

  // ===== INIT =====
  loadState();
  applyTheme(state.theme || 'dark');
  applySidebarCollapsed(state.sidebarCollapsed);
  applyUser();
  ['anthropic', 'google', 'openai', 'abacus'].forEach(applyApiKey);
  // Restore preferredAI and abacusModel selects
  if (document.getElementById('preferredAI')) document.getElementById('preferredAI').value = state.preferredAI || 'auto';
  if (document.getElementById('abacusModel')) document.getElementById('abacusModel').value = state.abacusModel || 'gpt-4o-mini';
  // Restore current project into UI
  if (state.currentProject) {
    (state.currentProject.areas || []).forEach(a => selectedAreas.add(a));
    document.querySelectorAll('.area-card').forEach(c => c.classList.toggle('selected', selectedAreas.has(c.dataset.area)));
    (state.currentProject.nichos || []).forEach(n => nichos.push(n));
    if (state.currentProject.agencia) document.getElementById('agenciaNombre').value = state.currentProject.agencia;
    if (state.currentProject.landingModalidad) document.getElementById('landingModalidad').value = state.currentProject.landingModalidad;
    if (state.currentProject.landingIdioma) document.getElementById('landingIdioma').value = state.currentProject.landingIdioma;
    _origRenderProblemSolutions(); _origRenderNichos(); renderPropuesta(); renderLandingNichos(); renderOfertas();
  }
  if (state.activeProjectId) {
    const p = state.projects.find(x => x.id === state.activeProjectId);
    if (p) document.getElementById('activeProjectName').textContent = projectName(p);
  }
  renderProjects();
  renderApps();
  cr2RenderHistory();
  updateProgress();

  // First-time onboarding
  if (!safeStorage.getItem(ONBOARD_KEY)) {
    setTimeout(startOnboarding, 600);
  }

  // =====================================================================
  // ============ BOTTOM MOBILE NAV ======================================
  // =====================================================================
  function updateBottomNav() {
    const current = document.querySelector('.view.active')?.dataset.viewContent;
    document.querySelectorAll('.bottom-nav button').forEach(b => {
      b.classList.toggle('active', b.dataset.view === current);
    });
  }
  document.querySelectorAll('.bottom-nav button').forEach(b => {
    b.addEventListener('click', () => { switchView(b.dataset.view); updateBottomNav(); });
  });
  // Hook into existing switchView
  const _origSwitchView = switchView;
  switchView = function(v) { _origSwitchView(v); updateBottomNav(); };
  updateBottomNav();

  // =====================================================================
  // ============ PROJECT TEMPLATES ======================================
  // =====================================================================
  const TEMPLATES = {
    blank: { name: 'Proyecto en blanco', areas: [], nichos: [], agencia: '' },
    inmobiliaria: {
      name: 'Inmobiliaria',
      areas: ['captacion', 'atencion', 'seguimientos', 'fidelizacion'],
      nichos: ['Inmobiliaria'],
      agencia: 'Asesoría Castresana'
    },
    clinica: {
      name: 'Clínica dental',
      areas: ['captacion', 'atencion', 'seguimientos', 'fidelizacion'],
      nichos: ['Clínicas dentales'],
      agencia: ''
    },
    restaurante: {
      name: 'Restaurante',
      areas: ['atencion', 'fidelizacion', 'ofertas'],
      nichos: ['Restaurantes'],
      agencia: ''
    },
    gimnasio: {
      name: 'Gimnasio',
      areas: ['captacion', 'atencion', 'fidelizacion', 'ltv'],
      nichos: ['Gimnasios y centros deportivos'],
      agencia: ''
    },
    asesoria: {
      name: 'Asesoría / Gestoría',
      areas: ['captacion', 'atencion', 'seguimientos', 'ofertas'],
      nichos: ['Asesorías y gestorías'],
      agencia: ''
    }
  };
  function applyTemplate(key) {
    const tpl = TEMPLATES[key];
    if (!tpl) return;
    // Build a fresh project from template
    const id = uid();
    const newP = {
      id, createdAt: Date.now(),
      areas: [...tpl.areas],
      customAreas: [],
      nichos: [...tpl.nichos],
      agencia: tpl.agencia,
      landingModalidad: 'tradicional',
      landingIdioma: 'es',
      templateName: tpl.name
    };
    state.projects.unshift(newP);
    setActiveProject(id);
    document.getElementById('templateOverlay').classList.remove('open');
    showToast(`Plantilla "${tpl.name}" cargada.`, 'success');
    switchView('mapa');
  }
  document.querySelectorAll('.template-card').forEach(c => {
    c.addEventListener('click', () => applyTemplate(c.dataset.tpl));
  });
  document.getElementById('templateOverlay')?.addEventListener('click', (e) => {
    if (e.target.id === 'templateOverlay') e.target.classList.remove('open');
  });
  // Hook "Nuevo proyecto" button to open template picker
  const origNewProject = document.getElementById('btnNuevoProyecto');
  if (origNewProject) {
    const newBtn = origNewProject.cloneNode(true);
    origNewProject.parentNode.replaceChild(newBtn, origNewProject);
    newBtn.addEventListener('click', () => {
      document.getElementById('templateOverlay').classList.add('open');
    });
  }

  // =====================================================================
  // ============ REAL AI INTEGRATION (Anthropic / Google) ===============
  // =====================================================================
  async function callAnthropic(prompt, system = '') {
    const key = state.keys.anthropic;
    if (!key) return null;
    try {
      const res = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': key,
          'anthropic-version': '2023-06-01',
          'anthropic-dangerous-direct-browser-access': 'true'
        },
        body: JSON.stringify({
          model: 'claude-haiku-4-5-20251001',
          max_tokens: 1024,
          system: system || 'Eres un asistente experto en marketing digital y servicios IA para pymes españolas. Responde en español, conciso y accionable.',
          messages: [{ role: 'user', content: prompt }]
        })
      });
      if (!res.ok) {
        const t = await res.text();
        console.warn('Anthropic error:', t);
        return null;
      }
      const data = await res.json();
      return data.content?.[0]?.text || null;
    } catch (e) {
      console.warn('Anthropic fetch error', e);
      return null;
    }
  }
  async function callGemini(prompt) {
    const key = state.keys.google;
    if (!key) return null;
    try {
      const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${key}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }]
        })
      });
      if (!res.ok) return null;
      const data = await res.json();
      return data.candidates?.[0]?.content?.parts?.[0]?.text || null;
    } catch (e) {
      return null;
    }
  }
  async function callOpenAI(prompt, system = '') {
    const key = state.keys.openai;
    if (!key) return null;
    try {
      const res = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer ' + key
        },
        body: JSON.stringify({
          model: 'gpt-4o-mini',
          max_tokens: 1024,
          messages: [
            ...(system ? [{ role: 'system', content: system }] : []),
            { role: 'user', content: prompt }
          ]
        })
      });
      if (!res.ok) return null;
      const data = await res.json();
      return data.choices?.[0]?.message?.content || null;
    } catch (e) {
      return null;
    }
  }

  async function callAbacus(prompt, system = '') {
    const key = state.keys.abacus;
    if (!key) return null;
    const model = state.abacusModel || 'gpt-4o-mini';
    // Abacus exposes an OpenAI-compatible chat completions endpoint at this base
    const endpoints = [
      'https://routellm.abacus.ai/v1/chat/completions',
      'https://api.abacus.ai/v1/chat/completions'
    ];
    for (const url of endpoints) {
      try {
        const res = await fetch(url, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': 'Bearer ' + key
          },
          body: JSON.stringify({
            model,
            max_tokens: 1024,
            messages: [
              ...(system ? [{ role: 'system', content: system }] : []),
              { role: 'user', content: prompt }
            ]
          })
        });
        if (res.ok) {
          const data = await res.json();
          const text = data.choices?.[0]?.message?.content || data.result || null;
          if (text) return text;
        }
      } catch (e) { /* try next endpoint */ }
    }
    return null;
  }

  const PROVIDER_LABELS = {
    anthropic: 'Claude (Anthropic)',
    abacus: 'Abacus AI',
    google: 'Gemini',
    openai: 'OpenAI'
  };

  async function callAI(prompt, system = '') {
    const order = state.preferredAI && state.preferredAI !== 'auto'
      ? [state.preferredAI, 'anthropic', 'abacus', 'google', 'openai'].filter((v, i, a) => a.indexOf(v) === i)
      : ['anthropic', 'abacus', 'google', 'openai'];

    for (const p of order) {
      if (!state.keys[p]) continue;
      let text = null;
      if (p === 'anthropic') text = await callAnthropic(prompt, system);
      else if (p === 'abacus') text = await callAbacus(prompt, system);
      else if (p === 'google') text = await callGemini((system ? system + '\n\n' : '') + prompt);
      else if (p === 'openai') text = await callOpenAI(prompt, system);
      if (text) return { text, provider: PROVIDER_LABELS[p] || p };
    }
    return null;
  }

  function hasAIKey() {
    return !!(state.keys.anthropic || state.keys.google || state.keys.openai || state.keys.abacus);
  }

  // Test connection button
  document.getElementById('btnTestAI')?.addEventListener('click', async () => {
    const statusEl = document.getElementById('aiStatus');
    if (!hasAIKey()) {
      statusEl.textContent = 'No hay ninguna clave configurada.';
      statusEl.style.color = 'var(--danger)';
      return;
    }
    statusEl.textContent = 'Probando…';
    statusEl.style.color = 'var(--muted)';
    const r = await callAI('Devuelve solamente la palabra OK en mayúsculas. Sin nada más.', 'Eres un asistente que responde de forma extremadamente breve.');
    if (r) {
      statusEl.textContent = `✓ Funciona con ${r.provider}`;
      statusEl.style.color = 'var(--green)';
      showToast(`IA activa: ${r.provider}`, 'success');
    } else {
      statusEl.textContent = '✗ Ninguna IA respondió. Revisa las claves.';
      statusEl.style.color = 'var(--danger)';
      showToast('Las claves no funcionaron — revisa que estén bien copiadas y que tengan saldo.', 'error');
    }
  });

  // Listeners for preferredAI and abacusModel
  document.getElementById('preferredAI')?.addEventListener('change', (e) => {
    state.preferredAI = e.target.value; saveState();
    showToast('IA preferida: ' + (PROVIDER_LABELS[e.target.value] || 'Auto'), 'success');
  });
  document.getElementById('abacusModel')?.addEventListener('change', (e) => {
    state.abacusModel = e.target.value; saveState();
  });

  // Wrap the analizador button to use real AI when key is set
  const _origBtnAnalizar = document.getElementById('btnAnalizar');
  if (_origBtnAnalizar) {
    const newBtn = _origBtnAnalizar.cloneNode(true);
    _origBtnAnalizar.parentNode.replaceChild(newBtn, _origBtnAnalizar);
    newBtn.addEventListener('click', async () => {
      const url = document.getElementById('urlAnalizar').value.trim();
      if (!url) return showToast('Pega una URL para analizar.', 'error');
      let host;
      try { host = new URL(url).hostname; } catch { return showToast('URL inválida.', 'error'); }

      const wrap = document.getElementById('promptResultWrap');
      const out = document.getElementById('promptResult');
      wrap.hidden = false;
      out.value = 'Generando…';
      document.getElementById('btnCopiarPrompt').disabled = true;

      if (hasAIKey()) {
        const result = await callAI(
          `Analiza la web ${url} y genera un prompt completo en español listo para pegarlo en Base44 que reproduzca esta web con: colores exactos, tipografía, layout, componentes principales, secciones, microinteracciones, copys optimizados para conversión y CTAs claros. Devuelve solo el prompt, sin introducciones.`,
          'Eres experto en análisis de webs y redacción de prompts técnicos para Base44.'
        );
        if (result) {
          out.value = result.text;
          showToast(`Prompt generado con ${result.provider}.`, 'success');
        } else {
          out.value = generateBase44Prompt(url, host);
          showToast('Clave API inválida — usando plantilla local.', 'error');
        }
      } else {
        out.value = generateBase44Prompt(url, host);
        showToast('Sin API key — plantilla local. Configúrala en Ajustes para IA real.', 'success');
      }
      document.getElementById('btnCopiarPrompt').disabled = false;
    });
  }

  // Wrap script generator
  const _origBtnScript = document.getElementById('btnGenerarScript');
  if (_origBtnScript) {
    const newBtn = _origBtnScript.cloneNode(true);
    _origBtnScript.parentNode.replaceChild(newBtn, _origBtnScript);
    newBtn.addEventListener('click', async () => {
      const empresa = document.getElementById('scrEmpresa').value.trim();
      const investigacion = document.getElementById('scrInvestigacion').value.trim();
      const dolor = document.getElementById('scrDolor').value.trim();
      const caballo = document.getElementById('scrCaballo').value.trim();
      if (!empresa || !dolor || !caballo) return showToast('Completa los campos obligatorios (*).', 'error');

      const wrap = document.getElementById('scriptResultWrap');
      const out = document.getElementById('scriptResult');
      wrap.hidden = false; out.value = 'Generando…';

      if (hasAIKey()) {
        const r = await callAI(
          `Genera un script de llamada en frío en español para vender servicios a ${empresa}.
Investigación previa: ${investigacion || 'web pública'}.
Dolor detectado: ${dolor}.
Asset / caballo de Troya: ${caballo}.
Estructura: apertura · romper patrón · dolor · caballo de Troya · cierre con dos opciones de horario. Tono directo, español de España, máximo 200 palabras.`,
          'Eres experto en ventas B2B en frío y redacción de scripts comerciales en español.'
        );
        if (r) { out.value = r.text; showToast(`Script generado con ${r.provider}.`, 'success'); return; }
      }
      // Fallback to local template
      out.value = `SCRIPT DE LLAMADA EN FRÍO — ${empresa}

[APERTURA]
"Hola, ¿hablo con el responsable de ${empresa}? Soy [nombre]. Te llamo por algo muy concreto, ¿tienes 30 segundos?"

[ROMPER PATRÓN]
"Estuve mirando ${investigacion || 'tu presencia online'} y vi algo que probablemente te esté costando dinero sin que te des cuenta."

[DOLOR]
"La mayoría de empresas como la tuya tienen este problema: ${dolor}. ¿Te identificas?"

[CABALLO DE TROYA]
"Justamente tenemos un ${caballo} que ayuda exactamente con eso. No te vendo nada por teléfono — solo quiero enseñártelo en 15 minutos y que tú decidas."

[CIERRE]
"¿Te va mejor mañana a las 10 o el jueves a las 17?"`;
      showToast(hasAIKey() ? 'API falló — plantilla local.' : 'Sin API key — plantilla local.', 'success');
    });
  }

  // Register service worker (PWA) — uses Blob URL so no extra file needed
  if ('serviceWorker' in navigator) {
    const swCode = `self.addEventListener('install', e => self.skipWaiting());
self.addEventListener('activate', e => self.clients.claim());
self.addEventListener('fetch', e => { e.respondWith(fetch(e.request).catch(() => caches.match(e.request))); });`;
    try {
      const blob = new Blob([swCode], { type: 'text/javascript' });
      navigator.serviceWorker.register(URL.createObjectURL(blob)).catch(() => {});
    } catch (e) { /* silent */ }
  }
</script>

<script>
  // === Diagnostic: visible JS-running indicator + error banner ===
  (function(){
    function showErrorBanner(msg){
      var b = document.getElementById('__errBanner');
      if(!b){
        b = document.createElement('div');
        b.id = '__errBanner';
        b.style.cssText = 'position:fixed;top:0;left:0;right:0;background:#dc2626;color:#fff;padding:10px 16px;font:12px/1.4 monospace;z-index:99999;white-space:pre-wrap;max-height:40vh;overflow:auto;box-shadow:0 4px 12px rgba(0,0,0,0.3);';
        b.innerHTML = '<strong>⚠️ Error JS — copia este mensaje y mándamelo:</strong><br>';
        document.body && document.body.appendChild(b);
      }
      b.innerHTML += '• ' + String(msg).replace(/</g,'&lt;') + '<br>';
    }
    window.addEventListener('error', function(e){
      showErrorBanner((e.message||'?') + ' @ ' + (e.filename||'').split('/').pop() + ':' + (e.lineno||0));
    });
    window.addEventListener('unhandledrejection', function(e){
      showErrorBanner('Promise rejection: ' + ((e.reason && e.reason.message) || e.reason || '?'));
    });
    function showOk(){
      var pill = document.createElement('div');
      pill.id = '__jsOkPill';
      pill.textContent = '✓ JS funciona';
      pill.style.cssText = 'position:fixed;bottom:8px;left:8px;background:#16a34a;color:#fff;padding:6px 12px;font:600 11px/1 -apple-system,sans-serif;z-index:99998;border-radius:999px;box-shadow:0 4px 12px rgba(0,215,116,0.4);transition:opacity 0.4s ease;';
      document.body && document.body.appendChild(pill);
      setTimeout(function(){ pill.style.opacity = '0'; setTimeout(function(){ pill.remove(); }, 500); }, 3500);
    }
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', showOk);
    else showOk();
  })();
</script>
</body>
</html>
