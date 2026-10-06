"""Publish a static, explicitly non-live judge inspection companion."""
from pathlib import Path
import html
import re
import shutil

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / 'docs'
OUT.mkdir(exist_ok=True)
(OUT / 'assets').mkdir(exist_ok=True)
(OUT / '.nojekyll').write_text('')
script = (ROOT / 'presentation/JUDGES-SCRIPT.md').read_text()
shutil.copy2(ROOT / 'presentation/JUDGES-SCRIPT.md', OUT / 'JUDGES-SCRIPT.md')
shutil.copy2(ROOT / 'video/SAAF-judging-demo.mp4', OUT / 'SAAF-judging-demo.mp4')
shutil.copy2(ROOT / 'presentation/SAAF-plain-language.pdf', OUT / 'SAAF-plain-language.pdf')
shutil.copy2(ROOT / 'presentation/SAAF-plain-language.pptx', OUT / 'SAAF-plain-language.pptx')
shutil.copy2(ROOT / 'video/narration.srt', OUT / 'narration.srt')
shutil.copy2(ROOT / 'video/assets/live-workpaper.json', OUT / 'sample-workpaper.json')
shutil.copy2(ROOT / 'verification/RESULTS.md', OUT / 'RESULTS.md')

pages = [('command','Command','dashboard','src/app/page.tsx'),
 ('forge','Forge','forge','src/lib/forge.ts'),
 ('mirofish','MiroFish','rehearsal-off','src/lib/engine.ts'),
 ('sentinel','Jev Sentinel','sentinel-after','src/lib/live-sentinel.ts'),
 ('verify','Verify','verify-pass','src/lib/ledger.ts'),
 ('swarm','Swarm',None,'src/lib/personas.ts'),
 ('ledger','Ledger',None,'src/app/ledger/page.tsx')]
repo = 'https://github.com/knarayanareddy/SAAF-circuit-breaker'


def inline(text):
    value = html.escape(text)
    value = re.sub(r'`([^`]+)`', r'<code>\1</code>', value)
    value = re.sub(r'\*\*([^*]+)\*\*', r'<strong>\1</strong>', value)
    value = re.sub(r'\[([^\]]+)\]\((https?://[^)]+)\)', r'<a href="\2">\1</a>', value)
    return value


def markdown(text):
    parts = []
    for block in text.strip().split('\n\n'):
        if block.startswith('#'):
            title = block.split('\n')[0]
            count = min(4,len(title)-len(title.lstrip('#')))
            parts.append(f'<h{count}>{inline(title.lstrip("# "))}</h{count}>')
            if '\n' in block: parts.append('<p>'+inline(block.split('\n',1)[1])+'</p>')
        elif block.startswith('- '):
            parts.append('<ul>'+''.join('<li>'+inline(line[2:])+'</li>' for line in block.splitlines() if line.startswith('- '))+'</ul>')
        else: parts.append('<p>'+inline(block).replace('\n','<br>')+'</p>')
    return '\n'.join(parts)

sections = re.split(r'\n(?=## )', script)
assert len([s for s in sections if re.match(r'## [1-7]\. ', s)]) == 7
cards = []
for index,(key,name,image,source) in enumerate(pages,1):
    section = next(s for s in sections if s.startswith(f'## {index}. '))
    picture = ''
    if image:
        shutil.copy2(ROOT / f'video/assets/{image}.png', OUT / f'assets/{image}.png')
        picture = f'<figure><a href="assets/{image}.png"><img loading="lazy" src="assets/{image}.png" alt="Recorded {name} interface"></a><figcaption>Recorded interface from the working local prototype. Not a live service.</figcaption></figure>'
    else:
        actual = (ROOT/source).read_text()
        picture = '<details><summary>Inspect actual implementation</summary><pre>'+html.escape(actual)+'</pre></details>'
    cards.append(f'<section id="{key}" class="panel">{picture}{markdown(section)}<p><a href="{repo}/blob/main/{source}">Inspect {name} source on GitHub ↗</a></p></section>')
extra = '\n'.join(s for s in sections if s.startswith(('## How','## EU','## Judge','## Sources')))
nav = ''.join(f'<a href="#{key}">{name}</a>' for key,name,_,_ in pages)
style = '''*{box-sizing:border-box}html{scroll-behavior:smooth;scroll-padding-top:120px}body{margin:0;background:#07080c;color:#ece7dc;font:17px/1.65 system-ui,sans-serif}header{position:sticky;top:0;z-index:3;background:#07080cf0;border-bottom:1px solid #28323c;padding:16px 4vw}header strong{color:#3ee0c5}nav{display:flex;gap:18px;flex-wrap:wrap}a{color:#3ee0c5}main{max-width:1180px;margin:auto;padding:28px 24px}h1{font-size:clamp(30px,5vw,62px);line-height:1.08}h2{color:#ff7a1a;line-height:1.3}h3{color:#3ee0c5}.panel,.notice{background:#10141c;border:1px solid #28323c;border-radius:18px;padding:28px;margin:28px 0}.notice{border-color:#ff7a1a}img,video{display:block;width:100%;border-radius:12px}figure{margin:0 0 30px}figcaption{font-size:13px;color:#9aa3b2}code,pre{font-family:ui-monospace,monospace}pre{overflow:auto;max-height:420px;font-size:13px}details{margin:20px 0}summary{cursor:pointer;color:#3ee0c5}.links{display:flex;gap:16px;flex-wrap:wrap}p{overflow-wrap:anywhere}@media(max-width:600px){main{padding:15px}.panel,.notice{padding:18px}header{position:relative}html{scroll-padding-top:12px}}'''
site = f'''<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="description" content="SAAF Circuit Breaker judge inspection: seven-page script, real screenshots, evidence, and narrated demo."><title>SAAF Circuit Breaker — Judge Inspection</title><style>{style}</style></head><body><header><strong>SAAF CIRCUIT BREAKER · JUDGE INSPECTION</strong><nav>{nav}</nav></header><main><h1>The agent can learn.<br>The approved rules keep authority.</h1><div class="notice"><strong>Static inspection companion — not the live backend.</strong><br>These are recorded real interface screens, source links, and downloadable evidence. GitHub Pages does not run Next.js server routes, PostgreSQL, or Jev API calls. Rehearsal is scripted; workpapers are unsigned. No live payments or certified compliance.</div><div class="links"><a href="JUDGES-SCRIPT.md">Download full presenter script</a><a href="SAAF-plain-language.pdf">Slides PDF</a><a href="SAAF-plain-language.pptx">Editable slides</a><a href="sample-workpaper.json">Recorded workpaper</a><a href="RESULTS.md">Release verification</a><a href="{repo}">Full source + live setup</a></div><section class="panel"><h2>79-second narrated product demo</h2><video controls preload="metadata"><source src="SAAF-judging-demo.mp4" type="video/mp4">Download the video using the link below.</video><a href="SAAF-judging-demo.mp4">Download video</a> · <a href="narration.srt">Caption file</a></section>{markdown(sections[0])}{''.join(cards)}<section class="panel" id="comparison-and-regulation">{markdown(extra)}</section></main></body></html>'''
(OUT/'index.html').write_text(site)
assert all(f'id="{key}"' in site for key,_,_,_ in pages)
assert 'api_key' not in site.lower() or 'server' in site.lower()
print('Built seven-page static inspection companion:', OUT/'index.html')
