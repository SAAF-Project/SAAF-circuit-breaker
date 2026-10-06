"""Static audit report renderer."""

from __future__ import annotations


def render_html(wp: dict, verification: dict) -> str:
    rows = "".join(
        f"<tr><td>{e.get('step')}</td><td>{e.get('ticket_id')}</td>"
        f"<td>{e['tool_args']['amount']}</td><td>{e.get('guard_evaluation')}</td>"
        f"<td>{e.get('verdict','')}</td></tr>"
        for e in wp.get("trace", [])
    )
    status = "PASS" if verification.get("ok") else "FAIL"
    return f"""<!doctype html>
<html><head><meta charset="utf-8"><title>{wp.get('workpaper_id')}</title>
<style>body{{font-family:monospace;background:#07080c;color:#ece7dc;padding:32px}}
h1{{color:#ff7a1a}} table{{border-collapse:collapse;width:100%}}
td,th{{border:1px solid #333;padding:6px}}</style></head>
<body>
<h1>SAAF-VERIFY {wp.get('workpaper_id')} — {status}</h1>
<p>{wp.get('audit_standard')}</p>
<p>Merkle: {wp.get('merkle_root')}</p>
<table><thead><tr><th>Step</th><th>Ticket</th><th>Amount</th><th>Guard</th><th>Verdict</th></tr></thead>
<tbody>{rows}</tbody></table>
</body></html>"""
