"""Convert tools/filters/domains.txt into a WKContentRuleList JSON file
consumed by the iOS app at App/Resources/content_rules.json.

Usage:
    python generate_content_rules.py
"""

import json
from pathlib import Path

ROOT = Path(__file__).resolve().parent
FILTERS_FILE = ROOT / "filters" / "domains.txt"
OUTPUT_FILE = ROOT.parent / "App" / "Resources" / "content_rules.json"

RESOURCE_TYPES = [
    "document", "image", "script", "raw", "font", "media", "style-sheet",
]


def load_patterns():
    patterns = []
    for line in FILTERS_FILE.read_text(encoding="utf-8").splitlines():
        line = line.strip()
        if not line or line.startswith("#"):
            continue
        patterns.append(line)
    return patterns


def build_rules(patterns):
    rules = []
    for pattern in patterns:
        rules.append({
            "trigger": {
                "url-filter": pattern,
                "resource-type": RESOURCE_TYPES,
            },
            "action": {"type": "block"},
        })
    return rules


def main():
    patterns = load_patterns()
    rules = build_rules(patterns)
    OUTPUT_FILE.parent.mkdir(parents=True, exist_ok=True)
    OUTPUT_FILE.write_text(json.dumps(rules, indent=2), encoding="utf-8")
    print(f"Wrote {len(rules)} rules to {OUTPUT_FILE}")


if __name__ == "__main__":
    main()
