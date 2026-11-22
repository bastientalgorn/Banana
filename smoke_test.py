from pathlib import Path
import re
import sys


def expect(condition: bool, message: str) -> None:
    if not condition:
        raise AssertionError(message)


def detect_project_root() -> Path:
    script_path = Path(__file__).resolve()
    candidates = [script_path.parent, *script_path.parents]

    for candidate in candidates:
        if (candidate / "index.xhtml").exists() and (candidate / "app.js").exists():
            return candidate

    return script_path.parent


def main() -> int:
    root = detect_project_root()
    index_path = root / "index.xhtml"
    css_path = root / "styles.css"
    js_path = root / "app.js"

    expect(index_path.exists(), "Missing index.xhtml")
    expect(css_path.exists(), "Missing styles.css")
    expect(js_path.exists(), "Missing app.js")

    index_content = index_path.read_text(encoding="utf-8")
    js_content = js_path.read_text(encoding="utf-8")

    expect('<section id="tab-cal"' in index_content, "Cal tab section missing")
    expect('<section id="tab-weight"' in index_content, "Weight tab section missing")
    expect('<section id="tab-data"' in index_content, "Data tab section missing")
    expect('id="weight-chart"' in index_content, "Weight chart canvas missing")

    for store_name in ["templates", "calEntries", "weightEntries"]:
        expect(store_name in js_content, f"Store name {store_name} missing in app.js")

    expect(re.search(r"indexedDB\.open\(", js_content) is not None, "IndexedDB init missing")
    expect("function refreshCalView" in js_content, "Cal refresh function missing")
    expect("function refreshWeightView" in js_content, "Weight refresh function missing")
    expect("function refreshDataView" in js_content, "Data refresh function missing")

    print("Smoke test passed: core files and features detected.")
    return 0


if __name__ == "__main__":
    try:
        raise SystemExit(main())
    except AssertionError as error:
        print(f"Smoke test failed: {error}")
        raise SystemExit(1)
