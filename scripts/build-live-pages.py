"""Open the real live app directly; avoid fragile cross-origin iframe paint.

Both origins remain temporary and require an awake, connected backend host.
No application credentials are copied into these static launch pages.
"""
from pathlib import Path
from urllib.parse import urlparse
import html
import json

ROOT = Path(__file__).resolve().parents[1]
DOCS = ROOT / 'docs'
config = json.loads((DOCS / 'live-origin.json').read_text())


def launcher(origin, label):
    target = origin.rstrip('/') + '/'
    url = urlparse(target)
    if url.scheme != 'https' or not url.hostname or url.username or url.password:
        raise ValueError('A public HTTPS app origin without credentials is required')
    escaped = html.escape(target, quote=True)
    javascript = json.dumps(target).replace('<', '\\u003c')
    return f'''<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>SAAF Circuit Breaker — {html.escape(label)}</title>
<meta http-equiv="refresh" content="1; url={escaped}">
<meta name="description" content="Open the actual live SAAF Circuit Breaker application directly.">
<style>body{{margin:0;padding:32px;background:#07080c;color:#ece7dc;font:16px/1.6 system-ui,sans-serif}}main{{max-width:720px;margin:12vh auto}}a{{color:#3ee0c5}}h1{{font-size:28px}}p{{overflow-wrap:anywhere}}</style>
</head><body data-saaf-live-app="direct"><main><h1>Opening SAAF Circuit Breaker</h1>
<p><a href="{escaped}">Open the {html.escape(label.lower())} now →</a></p>
<p>This opens the actual app directly, without an embedded frame. The temporary backend must stay awake and connected.</p>
<p><a href="original.html">Original version</a> · <a href="guide.html">Presenter notes, video and evidence</a></p>
</main><script>window.location.replace({javascript});</script></body></html>'''


index = DOCS / 'index.html'
current = index.read_text()
if 'data-saaf-live-app' not in current:
    (DOCS / 'guide.html').write_text(current)
index.write_text(launcher(config['origin'], 'Live build'))
if config.get('original_origin'):
    (DOCS / 'original.html').write_text(launcher(config['original_origin'], 'Original build'))
print('Direct live launch pages generated:', config['origin'])
