"""Number the figures in docs/index.html in page order and fill every cross-reference.
Figures carry stable ids (fig-areas, fig-radar, ...); references are <span data-fig="id">N</span>."""
import os, re
p = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "docs", "index.html")
s = open(p).read()
ids = re.findall(r'<figure class="wide[^"]*" id="([^"]+)"', s)
num = {f: i + 1 for i, f in enumerate(ids)}
def cap(m):
    fid = m.group(1)
    return re.sub(r'<figcaption><b>Figure [^.<]*\.</b>', f'<figcaption><b>Figure {num[fid]}.</b>', m.group(0), count=1)
s = re.sub(r'<figure class="wide[^"]*" id="([^"]+)".*?</figure>', cap, s, flags=re.S)
s = re.sub(r'<span data-fig="([^"]+)">[^<]*</span>', lambda m: f'<span data-fig="{m.group(1)}">{num[m.group(1)]}</span>', s)
open(p, "w").write(s)
print(num)
