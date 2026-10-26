"""Layout helpers shared by the DSSSB parsers."""
from __future__ import annotations

import statistics

from stet.pdfutil import Row, group_rows

from .pdf import SSpan, row_top


def rows_with_scripts(spans: list[SSpan]) -> list[Row]:
    """Group a page into visual rows, folding superscript/subscript spans (10⁻¹², O(n²), log₂) into the line
    they belong to.  A script span is set in a smaller size than the body text; it is attached to the nearest
    line whose baseline is within 9 pt and written as "^x" / "_x" so the meaning survives in plain text."""
    sizes = [s.size for s in spans if s.text.strip() and s.size]
    if not sizes:
        return group_rows(spans)
    body = statistics.median(sizes)
    scripts = [s for s in spans if s.size and s.size <= 0.88 * body and len(s.text.strip()) <= 8]
    normal = [s for s in spans if s not in scripts]
    rows = group_rows(normal)
    for s in scripts:
        best, host = 1e9, None
        for r in rows:
            base = statistics.median(x.base for x in r.spans if isinstance(x, SSpan))
            d = abs(base - s.base)
            overlaps_x = min(x.x0 for x in r.spans) - 30 <= s.x0 <= max(x.x1 for x in r.spans) + 30
            if d < best and d <= 9 and overlaps_x:
                best, host = d, (r, base)
        if host is None or best < 1.0:
            # same baseline: an ordinary small-size span, not a script
            if host is not None:
                host[0].spans.append(s)
                host[0].spans.sort(key=lambda x: x.x0)
            else:
                rows.append(Row(s.page, [s]))
            continue
        r, base = host
        mark = "^" if s.base < base else "_"
        r.spans.append(SSpan(s.page, s.x0, s.y0, s.x1, s.y1, mark + s.text.strip(), s.font, s.color, s.size, s.base))
        r.spans.sort(key=lambda x: x.x0)
    rows.sort(key=lambda r: row_top(r.spans))
    return rows
