"""Static audit report renderer."""

from __future__ import annotations

import html


def _esc(value: object) -> str:
    return html.escape(str(value if value is not None else ""), quote=True)


def render_html(wp: dict, verification: dict) -> str:
    rows = "".join(
        f"<tr><td>{_esc(e.get('step'))}</td><td>{_esc(e.get('ticket_id'))}</td>"
        f"<td>{_esc(e.get('tool_args', {}).get('amount') if isinstance(e.get('tool_args'), dict) else '')}</td>"
        f"<td>{_esc(e.get('guard_evaluation'))}</td>"
        f"<td>{_esc(e.get('verdict', ''))}</td></tr>"
        for e in (wp.get("trace") if isinstance(wp.get("trace"), list) else [])
        if isinstance(e, dict)
    )
    status = "PASS" if verification.get("ok") else "FAIL"
    return f"""<!doctype html>
<html><head><meta charset="utf-8"><meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline'"><title>{_esc(wp.get('workpaper_id'))}</title>
<style>body{{font-family:monospace;background:#07080c;color:#ece7dc;padding:32px}}
h1{{color:#ff7a1a}} table{{border-collapse:collapse;width:100%}}
td,th{{border:1px solid #333;padding:6px}}</style></head>
<body>
<h1>SAAF-VERIFY {_esc(wp.get('workpaper_id'))} — {status}</h1>
<p>{_esc(wp.get('audit_standard'))}</p>
<p>Merkle: {_esc(wp.get('merkle_root'))}</p>
<table><thead><tr><th>Step</th><th>Ticket</th><th>Amount</th><th>Guard</th><th>Verdict</th></tr></thead>
<tbody>{rows}</tbody></table>
</body></html>"""

