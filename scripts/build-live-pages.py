"""Host the actual live app inside the GitHub Pages entrypoint.

The tunnel is explicitly temporary and needs an awake, connected backend host.
No application credentials are copied into this static entrypoint.
"""
from pathlib import Path
from urllib.parse import urlparse
import html
import json

ROOT = Path(__file__).resolve().parents[1]
DOCS = ROOT / 'docs'
config = json.loads((DOCS / 'live-origin.json').read_text())
origin = config['origin'].rstrip('/')
url = urlparse(origin)
assert url.scheme == 'https' and url.hostname and not url.username and not url.password
index = DOCS / 'index.html'
current = index.read_text()
if 'data-saaf-live-app' not in current:
    (DOCS / 'guide.html').write_text(current)
source = html.escape(origin, quote=True)
page = f'''<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="description" content="The actual SAAF Circuit Breaker live seven-page application, served through a temporary public judging tunnel."><title>SAAF Circuit Breaker — Live Build</title><style>*{{box-sizing:border-box}}html,body{{margin:0;width:100%;height:100%;background:#07080c;color:#ece7dc;font:12px system-ui,sans-serif}}aside{{height:36px;display:flex;align-items:center;gap:15px;justify-content:space-between;padding:0 14px;border-bottom:1px solid #253340}}a{{color:#3ee0c5}}iframe{{width:100%;height:calc(100% - 36px);border:0;display:block}}@media(max-width:650px){{aside{{height:58px;flex-wrap:wrap;gap:3px;padding:5px 10px}}iframe{{height:calc(100% - 58px)}}}} </style></head><body data-saaf-live-app="true"><aside><span>LIVE LOCAL BUILD · Temporary tunnel · Host must stay awake</span><span><a href="{source}/" target="_blank" rel="noopener">Open full-screen</a> · <a href="guide.html">Script &amp; evidence</a></span></aside><iframe title="SAAF Circuit Breaker live application" src="{source}/" allow="clipboard-write; fullscreen" referrerpolicy="strict-origin-when-cross-origin"></iframe><noscript>The app needs JavaScript. <a href="{source}/">Open the actual live build</a>.</noscript></body></html>'''
index.write_text(page)
print('Live Pages entrypoint generated:', origin)
