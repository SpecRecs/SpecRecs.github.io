"""Test: GPU prices from PCPartPicker via pypartpicker (unofficial scraper).

Setup (once):   py -3.13 -m venv test/.venv && test/.venv/Scripts/pip install pypartpicker
Run:            test/.venv/Scripts/python test/scrape_pcpartpicker.py ["rtx 5070" | <product url>]
"""
import json
import sys
from pathlib import Path

from pypartpicker import Client
from pypartpicker.errors import CloudflareException, RateLimitException

OUT = Path(__file__).parent / "out"
OUT.mkdir(exist_ok=True)

query = sys.argv[1] if len(sys.argv) > 1 else "rtx 5070"
client = Client()

def show_part(url):
    part = client.get_part(url)
    print(f"{part.name} ({part.type})  cheapest: {part.cheapest_price}")
    for v in part.vendors or []:
        print(f"  {v.name:<14} {v.price.total!s:>8}  {'in stock' if v.in_stock else 'out of stock'}")


try:
    if query.startswith("http"):  # e.g. https://pcpartpicker.com/product/XXXXXX/...
        show_part(query)
        sys.exit(0)
    result = client.get_part_search(query)
    print(f"Search '{query}': {len(result.parts)} parts (page {result.page}/{result.total_pages})")
    if not result.parts:
        print("No parts parsed. The search page is served without results (they load via JS) "
              "or the markup changed; see test/out/pcpp_search.html. Try passing a product URL instead.")
    rows = []
    for p in result.parts[:10]:
        price = p.cheapest_price.total if p.cheapest_price else None
        print(f"{price if price is not None else 'n/a':>8}  {p.name}")
        rows.append({"name": p.name, "url": p.url, "cheapest": price, "in_stock": p.in_stock, "vendors": []})

    # Per-retailer breakdown for the first few parts (one extra request each).
    for row in rows[:3]:
        if not row["url"]:
            continue
        part = client.get_part(row["url"])
        for v in part.vendors or []:
            row["vendors"].append({"vendor": v.name, "price": v.price.total, "in_stock": v.in_stock, "buy_url": v.buy_url})
        print(f"\n{part.name}")
        for v in row["vendors"]:
            print(f"  {v['vendor']:<14} {v['price']!s:>8}  {'in stock' if v['in_stock'] else 'out of stock'}")

    (OUT / "pcpartpicker.json").write_text(json.dumps(rows, indent=2))
    print("\nWrote test/out/pcpartpicker.json")
except CloudflareException:
    print("BLOCKED: Cloudflare challenge after max retries.")
    sys.exit(2)
except RateLimitException:
    print("BLOCKED: rate limited.")
    sys.exit(3)
