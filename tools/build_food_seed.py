from __future__ import annotations

import json
import re
from pathlib import Path
from typing import Any

ROOT = Path(__file__).resolve().parents[1]
SOURCE_JSON = ROOT / "FoodData_Central_sr_legacy_food_json_2018-04.json"
TARGET_JS = ROOT / "food_seed_data.js"


def round_sig(value: float, sig: int = 3) -> float:
    """Round to `sig` significant digits (e.g. 179.445614 -> 179, 15.899 -> 15.9,
    0.1264894 -> 0.126). Returns an int when the rounded result has no
    fractional part, so JSON serializes it as `179` instead of `179.0`."""
    if value == 0:
        return 0

    import math

    digits = sig - 1 - math.floor(math.log10(abs(value)))
    rounded = round(value, digits)
    if rounded == int(rounded):
        return int(rounded)
    return rounded
# No cap on item count or name length: accuracy matters more than trimming,
# so every distinguishable USDA food gets its own entry with its full
# description rather than being shortened/merged with unrelated foods.

# --- Category simplification -------------------------------------------------
# SR Legacy's native "foodCategory.description" has 25 fairly granular
# categories; collapse them down to a small, simple taxonomy.
CATEGORY_MAP = {
    "Beef Products": "Meat",
    "Lamb, Veal, and Game Products": "Meat",
    "Pork Products": "Meat",
    "Poultry Products": "Meat",
    "Sausages and Luncheon Meats": "Meat",
    "Finfish and Shellfish Products": "Fish",
    "Dairy and Egg Products": "Dairy",
    "Vegetables and Vegetable Products": "Vegetable",
    "Fruits and Fruit Juices": "Fruit",
    "Legumes and Legume Products": "Legume",
    "Nut and Seed Products": "Nuts & Seeds",
    "Cereal Grains and Pasta": "Grain",
    "Breakfast Cereals": "Grain",
    "Baked Products": "Grain",
    "Fats and Oils": "Fat/Oil",
    "Sweets": "Sweet",
    "Snacks": "Snack",
    "Beverages": "Beverage",
    "Soups, Sauces, and Gravies": "Sauce/Soup",
    "Spices and Herbs": "Spice",
    "Fast Foods": "Prepared",
    "Restaurant Foods": "Prepared",
    "Meals, Entrees, and Side Dishes": "Prepared",
    "Baby Foods": "Other",
    "American Indian/Alaska Native Foods": "Other",
}

# --- Countable ("1 X") unit support -----------------------------------------
# Foods where people commonly think/count in whole units rather than grams
# (e.g. "1 egg", "1 apple") rather than weighing them. Deliberately excludes
# things normally eaten/measured in bulk (grapes, berries), raw ingredients
# measured by weight/volume (flour, rice, meat cuts), and anything where the
# "whole unit" isn't a stable, well-known size.
COUNTABLE_KEYWORDS = {
    "egg",
    "banana",
    "apple",
    "orange",
    "pear",
    "peach",
    "plum",
    "kiwi",
    "kiwifruit",
    "avocado",
    "tomato",
    "potato",
    "onion",
    "carrot",
    "cucumber",
    "zucchini",
    "lemon",
    "lime",
    "grapefruit",
    "mango",
    "cookie",
    "muffin",
    "bagel",
    "tortilla",
    "pita",
    "waffle",
    "pancake",
    "doughnut",
    "donut",
    "roll",
    "sausage",
    "frankfurter",
    "hot dog",
    "hotdog",
}

IRREGULAR_SINGULAR = {
    "cookies": "cookie",
    "peaches": "peach",
    "potatoes": "potato",
    "tomatoes": "tomato",
    "sweet potatoes": "sweet potato",
    "onions": "onion",
    "carrots": "carrot",
    "cucumbers": "cucumber",
    "zucchinis": "zucchini",
    "lemons": "lemon",
    "limes": "lime",
    "grapefruits": "grapefruit",
    "mangos": "mango",
    "mangoes": "mango",
    "muffins": "muffin",
    "bagels": "bagel",
    "tortillas": "tortilla",
    "pitas": "pita",
    "waffles": "waffle",
    "pancakes": "pancake",
    "doughnuts": "doughnut",
    "donuts": "donut",
    "rolls": "roll",
    "frankfurters": "frankfurter",
    "avocados": "avocado",
    "kiwis": "kiwi",
    "kiwifruits": "kiwifruit",
}

# Discrete "whole item" modifier words, in priority order (best match first).
# "medium" is preferred as the most representative default size.
SIZE_PRIORITY = ["medium", "regular", "large", "small", "whole", "unit", "piece", "item", "fruit"]

# Portion modifier words that indicate a bulk/volume/weight measure rather
# than a single discrete whole unit; these are excluded from "1 X" portion
# selection even if amount == 1 (e.g. "1 cup, sliced", "1 oz", "1 slice").
BULK_UNIT_WORDS = {
    "cup",
    "tbsp",
    "tablespoon",
    "tsp",
    "teaspoon",
    "oz",
    "lb",
    "jar",
    "can",
    "package",
    "serving",
    "nlea",
    "fl",
    "container",
    "bar",
    "quart",
    "pint",
    "scoop",
    "slice",
    "chop",
    "steak",
    "roast",
    "fillet",
    "strip",
    "ring",
    "wedge",
    "skin",
}

# Processed/concentrated forms are nutritionally very different from the
# whole/fresh form of the same keyword (e.g. "Tomato, paste" vs. a fresh
# tomato), so they are excluded from the "1 X" countable-unit path; they
# still get a "1g ..." gram-based entry.
_PROCESSED_FORM_PATTERN = re.compile(
    r"\b(paste|sauce|puree|juice|powder|extract|crushed|dried|dehydrated|canned|jam|jelly|syrup|chips?)\b"
)

_SAUSAGE_PROTEIN_PATTERN = re.compile(r"\b(beef|pork|turkey|chicken)\b")
_EGG_WHITE_PATTERN = re.compile(r"\bwhite\b")
_EGG_YOLK_PATTERN = re.compile(r"\byolk\b")
_EGG_BIRD_PATTERN = re.compile(r"\b(duck|goose|turkey|quail)\b")

# Compound dish names that contain a countable keyword as a substring but are
# not actually that plain whole food (e.g. "Egg rolls" is a fried wrapper
# dish, not a chicken egg; "Wonton wrappers (includes egg roll wrappers)"
# mentions "egg" only in a parenthetical aside).
_DISH_EXCLUSION_PATTERN = re.compile(
    r"\begg\s*rolls?\b|\bspring\s*rolls?\b|\bcabbage\s*rolls?\b|\bsushi\s*rolls?\b|\bwonton\b"
)
_PARENTHETICAL_PATTERN = re.compile(r"\([^)]*\)")

# A small, explicit allowlist for foods where the true countable variety name
# appears in the second comma-segment, not the head (e.g. "Squash, summer,
# zucchini, raw" or "Bread, pita, white"). Deliberately narrow/manual rather
# than scanning all segments generally, which would reintroduce false
# positives like "Pepper, banana, raw" or "Pie, lemon meringue".
_SEGMENT_KEYWORD_OVERRIDES = {
    "squash": "zucchini",
    "bread": "pita",
}

_COUNTABLE_KEYWORD_PATTERN = re.compile(
    r"\b(" + "|".join(re.escape(keyword) for keyword in sorted(COUNTABLE_KEYWORDS, key=len, reverse=True)) + r")(e?s)?\b"
)


def normalize_name(raw: str) -> str:
    normalized = " ".join(str(raw or "").replace("\n", " ").split())
    return normalized.strip(" ,;")


def extract_kcal_per_100g(food: dict[str, Any]) -> float | None:
    for item in food.get("foodNutrients") or []:
        nutrient = item.get("nutrient") or {}
        amount = item.get("amount")
        if (
            str(nutrient.get("name") or "") == "Energy"
            and str(nutrient.get("unitName") or "").upper() == "KCAL"
            and isinstance(amount, (int, float))
        ):
            return float(amount)
    return None


def categorize(food: dict[str, Any]) -> str:
    category_desc = (food.get("foodCategory") or {}).get("description")
    return CATEGORY_MAP.get(category_desc, "Other")


def singularize(base_name: str) -> str:
    lowered = base_name.lower().strip()
    if lowered in IRREGULAR_SINGULAR:
        return IRREGULAR_SINGULAR[lowered]
    if lowered.endswith("ies") and len(lowered) > 3:
        return lowered[:-3] + "y"
    if lowered.endswith("oes") and len(lowered) > 3:
        return lowered[:-2]
    if lowered.endswith("s") and not lowered.endswith("ss") and len(lowered) > 2:
        return lowered[:-1]
    return lowered


def should_use_unit_label(description: str) -> bool:
    head = description.split(",", 1)[0].lower()
    head = _PARENTHETICAL_PATTERN.sub(" ", head)
    if _DISH_EXCLUSION_PATTERN.search(head):
        return False
    if _PROCESSED_FORM_PATTERN.search(head):
        return False
    if head.strip() in _SEGMENT_KEYWORD_OVERRIDES:
        override_keyword = _SEGMENT_KEYWORD_OVERRIDES[head.strip()]
        if override_keyword in description.lower():
            return True
    return bool(_COUNTABLE_KEYWORD_PATTERN.search(head))


def find_countable_keyword(description: str) -> str | None:
    # Only match against the first comma-segment (the head food name), not
    # the whole description. Otherwise dishes/flavorings that merely mention
    # a keyword elsewhere (e.g. "Pie, lemon meringue...", "Pepper, banana,
    # raw", "Fast foods, biscuit with egg...") would incorrectly be treated
    # as if they were the plain countable food itself.
    head = description.split(",", 1)[0].lower()
    head = _PARENTHETICAL_PATTERN.sub(" ", head)
    if _DISH_EXCLUSION_PATTERN.search(head):
        return None
    if head.strip() in _SEGMENT_KEYWORD_OVERRIDES:
        override_keyword = _SEGMENT_KEYWORD_OVERRIDES[head.strip()]
        if override_keyword in description.lower():
            return override_keyword
    match = _COUNTABLE_KEYWORD_PATTERN.search(head)
    return match.group(1) if match else None


def egg_bird_qualifier(description: str) -> str | None:
    match = _EGG_BIRD_PATTERN.search(description.lower())
    return match.group(1) if match else None


def egg_component_qualifier(description: str) -> str | None:
    lowered = description.lower()
    if _EGG_WHITE_PATTERN.search(lowered):
        return "white"
    if _EGG_YOLK_PATTERN.search(lowered):
        return "yolk"
    return None


def sausage_protein_qualifier(description: str) -> str | None:
    match = _SAUSAGE_PROTEIN_PATTERN.search(description.lower())
    return match.group(1) if match else None


def pick_discrete_portion_grams(food: dict[str, Any], keyword: str) -> float | None:
    """Pick the best "1 whole unit" gram weight for a countable food.

    Scans all portions, computes grams-per-unit (gramWeight / amount) for
    any portion whose modifier doesn't look like a bulk/volume measure, and
    prefers modifiers mentioning the food's own keyword or a size word
    (medium > regular > large > small > whole/unit/piece/item), in that
    priority order.
    """
    portions = food.get("foodPortions") or []
    best: tuple[int, float] | None = None

    for portion in portions:
        amount = portion.get("amount")
        gram_weight = portion.get("gramWeight")
        modifier = str(portion.get("modifier") or "").strip().lower()

        if not isinstance(amount, (int, float)) or amount <= 0:
            continue
        if not isinstance(gram_weight, (int, float)) or gram_weight <= 0:
            continue
        if not modifier:
            continue

        tokens = set(re.findall(r"[a-z]+", modifier))
        if tokens & BULK_UNIT_WORDS:
            continue

        grams_per_unit = float(gram_weight) / float(amount)

        if keyword in tokens or keyword in modifier:
            rank = 0
        else:
            rank = None
            for priority_index, size_word in enumerate(SIZE_PRIORITY, start=1):
                if size_word in tokens:
                    rank = priority_index
                    break
            if rank is None:
                continue

        if best is None or rank < best[0]:
            best = (rank, grams_per_unit)

    return best[1] if best else None


def format_entries(food: dict[str, Any], kcal_per_100g: float) -> list[dict[str, Any]]:
    description = normalize_name(str(food.get("description") or ""))
    if not description:
        return []

    category = categorize(food)
    entries: list[dict[str, Any]] = []

    # Always produce a gram-based entry using the full (non-truncated)
    # description, so distinct foods never get merged/averaged.
    entries.append(
        {
            "name": f"1g {description}",
            "category": category,
            "calPerUnit": round(kcal_per_100g / 100.0, 3),
        }
    )

    # Additionally produce a "1 X" countable-unit entry when relevant.
    if should_use_unit_label(description):
        keyword = find_countable_keyword(description)
        if keyword:
            portion_grams = pick_discrete_portion_grams(food, keyword)
            if portion_grams and portion_grams > 0:
                singular = singularize(keyword)
                if singular == "kiwifruit":
                    singular = "kiwi"
                unit_label = f"1 {singular}"

                if singular == "egg":
                    bird = egg_bird_qualifier(description)
                    qualifier = egg_component_qualifier(description)
                    if bird:
                        unit_label = f"1 {bird} egg" + (f" {qualifier}" if qualifier else "")
                    elif qualifier:
                        unit_label = f"1 egg {qualifier}"
                elif singular in ("sausage", "frankfurter", "hot dog", "hotdog"):
                    protein = sausage_protein_qualifier(description)
                    base_word = "hot dog" if singular in ("frankfurter", "hot dog", "hotdog") else "sausage"
                    unit_label = f"1 {protein} {base_word}" if protein else f"1 {base_word}"

                entries.append(
                    {
                        "name": unit_label,
                        "category": category,
                        "calPerUnit": round(kcal_per_100g * portion_grams / 100.0, 2),
                    }
                )

    return entries


def build_seed_data() -> list[dict[str, Any]]:
    payload = json.loads(SOURCE_JSON.read_text(encoding="utf-8"))
    foods = payload.get("SRLegacyFoods") or []

    aggregated: dict[str, dict[str, Any]] = {}

    for food in foods:
        kcal = extract_kcal_per_100g(food)
        if kcal is None or kcal <= 0:
            continue

        for entry in format_entries(food, kcal):
            entry_name = str(entry["name"]).strip()
            entry_key = entry_name.lower()
            calories = float(entry["calPerUnit"])

            bucket = aggregated.get(entry_key)
            if bucket is None:
                aggregated[entry_key] = {
                    "name": entry_name,
                    "category": entry["category"],
                    "calories": [calories],
                }
            else:
                bucket["calories"].append(calories)

    selected: list[dict[str, Any]] = []
    for bucket in aggregated.values():
        calories_list = bucket["calories"]
        avg_calories = sum(calories_list) / len(calories_list)
        selected.append(
            {
                "name": bucket["name"],
                "category": bucket["category"],
                "calPerUnit": round_sig(avg_calories, 3),
            }
        )

    selected.sort(key=lambda item: str(item["name"]).lower())
    return selected


# Default number of leading words used to detect groups of near-duplicate
# entries (e.g. many "Beef, chuck, arm pot roast, ..." cuts) that can be
# merged into a single representative entry when their calories are close
# enough. Exposed as a function parameter so the merge can be re-run with
# different values.
DEFAULT_MERGE_PREFIX_WORDS = 5
# Default max allowed ratio between min/max calories within a candidate merge
# group (e.g. 1.2 == max is at most 20% higher than min). Also a parameter.
DEFAULT_MERGE_MAX_RATIO = 1.2


def _first_n_words_prefix(name: str, n: int) -> str | None:
    """Return the substring of `name` covering its first `n` words, or None
    if `name` has fewer than `n` words."""
    matches = list(re.finditer(r"[A-Za-z]+", name))
    if len(matches) < n:
        return None
    return name[: matches[n - 1].end()]


def _longest_common_prefix(strings: list[str]) -> str:
    if not strings:
        return ""
    s1 = min(strings)
    s2 = max(strings)
    i = 0
    while i < len(s1) and i < len(s2) and s1[i] == s2[i]:
        i += 1
    return s1[:i]


def _trim_to_clean_boundary(prefix: str, names: list[str]) -> str:
    """Trim a longest-common-prefix string back to a clean boundary: never
    cut in the middle of a word, and never leave trailing
    comma/whitespace/other punctuation dangling. Also balances any unclosed
    '('. `names` is the full set of names the prefix was derived from, used
    to tell whether the prefix actually ends at a real word boundary (i.e.
    every name either ends exactly there or continues with a non-word
    character) versus mid-word (at least one name continues the same word).
    """
    trimmed = prefix

    def ends_mid_word(candidate: str) -> bool:
        length = len(candidate)
        if not candidate or not re.match(r"[A-Za-z0-9]$", candidate[-1]):
            return False
        for name in names:
            if len(name) > length and re.match(r"[A-Za-z0-9]", name[length]):
                return True
        return False

    def strip_trailing_punct(candidate: str) -> str:
        candidate = candidate.rstrip()
        while candidate and candidate[-1] in ",;:.-":
            candidate = candidate[:-1].rstrip()
        return candidate

    trimmed = strip_trailing_punct(trimmed)

    # Keep dropping the trailing (partial) word while the prefix cuts
    # through the middle of a word that some name in the group continues.
    while trimmed and ends_mid_word(trimmed):
        match = re.search(r"[A-Za-z0-9]+$", trimmed)
        if not match:
            break
        before_word = trimmed[: match.start()]
        trimmed = strip_trailing_punct(before_word)

    return _balance_parentheses(trimmed)


def _balance_parentheses(name: str) -> str:
    """If truncating a name left an unclosed '(' open, close it."""
    depth = 0
    for ch in name:
        if ch == "(":
            depth += 1
        elif ch == ")":
            depth = max(depth - 1, 0)
    if depth > 0:
        name = name + ")" * depth
    return name


def merge_similar_items(
    pairs: list[list[Any]],
    n: int = DEFAULT_MERGE_PREFIX_WORDS,
    max_ratio: float = DEFAULT_MERGE_MAX_RATIO,
) -> list[list[Any]]:
    """Within a single category's alphabetically-sorted [name, cal] pairs,
    find each full contiguous block of items that share the same first `n`
    words (since pairs are alphabetically sorted, all items sharing that
    prefix are already contiguous). For each whole block, check the
    min/max calorie ratio across ALL items in the block: if it satisfies
    `max_ratio`, merge the whole block into one representative entry (name =
    longest common prefix across the block, trimmed to a clean
    word/punctuation boundary; calories = average). If the block's ratio
    does not qualify, leave every item in the block unmerged/untouched --
    we do NOT merge a partial sub-run, to avoid producing multiple separate
    merged entries that collapse to the same (ambiguous) name."""
    merged: list[list[Any]] = []
    length = len(pairs)
    i = 0
    while i < length:
        name_i, _ = pairs[i]
        prefix = _first_n_words_prefix(name_i, n)
        if prefix is None:
            merged.append(pairs[i])
            i += 1
            continue

        # Find the full contiguous block sharing this prefix.
        end = i + 1
        while end < length and str(pairs[end][0]).startswith(prefix):
            end += 1
        block = pairs[i:end]

        if len(block) > 1:
            calories = [b[1] for b in block]
            block_min = min(calories)
            block_max = max(calories)
            if block_min > 0 and block_max < max_ratio * block_min:
                group_names = [str(b[0]) for b in block]
                common_prefix = _longest_common_prefix(group_names)
                merged_name = _trim_to_clean_boundary(common_prefix, group_names)
                if not merged_name:
                    # Fallback: shouldn't normally happen since all names
                    # share at least `prefix`, but guard against an empty
                    # result.
                    merged_name = _trim_to_clean_boundary(prefix, group_names) or prefix
                avg_cal = sum(calories) / len(calories)
                merged.append([merged_name, round_sig(avg_cal, 3)])
                i = end
                continue

        # Block didn't qualify for merging (or has only 1 item): keep every
        # item in it as-is.
        merged.extend(block)
        i = end

    return merged


def assert_no_duplicate_names(grouped: dict[str, list[list[Any]]]) -> None:
    """Raise if any category ends up with two entries sharing the exact same
    name -- that would make them indistinguishable in the app's suggestion
    list and silently shadow one another."""
    for category, pairs in grouped.items():
        seen: dict[str, float] = {}
        for name, cal in pairs:
            if name in seen:
                raise ValueError(
                    f"Duplicate template name produced in category {category!r}: "
                    f"{name!r} (calories {seen[name]!r} and {cal!r})"
                )
            seen[name] = cal


# Successive merge passes to run, each as (prefix_word_count, max_ratio).
# Later passes use a shorter prefix and a tighter calorie-ratio tolerance,
# catching broader groups of near-duplicates that survived the earlier,
# more conservative passes.
MERGE_PASSES = [
    (5, 1.2),
    (4, 1.1),
    (3, 1.05),
    (2, 1.03),
]


def write_seed_file(items: list[dict[str, Any]]) -> None:
    # Group by category and store each item as a compact [name, calPerUnit]
    # pair instead of a {"name":..., "category":..., "calPerUnit":...} object.
    # With ~7800 items, repeating the three key names (and the category
    # string) in every entry made up roughly half the file size; grouping by
    # category and dropping to positional pairs removes that repetition.
    grouped: dict[str, list[list[Any]]] = {}
    for item in items:
        category = str(item.get("category") or "Other")
        grouped.setdefault(category, []).append([item["name"], item["calPerUnit"]])

    # Sort categories alphabetically, and items within each category
    # alphabetically, for stable/diffable output.
    ordered = {category: grouped[category] for category in sorted(grouped)}

    # Further compress: run several merge passes (see MERGE_PASSES), each
    # merging runs of near-duplicate entries (same first N words, calories
    # within the given ratio of each other) within each category into one
    # representative entry. Re-sort between passes since merged names can
    # shift alphabetical order, which the next pass's prefix matching
    # depends on.
    for prefix_words, max_ratio in MERGE_PASSES:
        ordered = {
            category: sorted(
                merge_similar_items(pairs, n=prefix_words, max_ratio=max_ratio),
                key=lambda pair: str(pair[0]).lower(),
            )
            for category, pairs in ordered.items()
        }

    # Merging must never produce two entries with the exact same name
    # within a category -- that would make them indistinguishable/ambiguous
    # in the app. Fail loudly if it ever happens instead of shipping broken
    # data silently.
    assert_no_duplicate_names(ordered)

    # Render each [name, cal] pair on a single line (rather than json.dumps'
    # default of spreading nested arrays across multiple indented lines) to
    # further shrink the file -- whitespace/indentation otherwise adds up
    # considerably across ~7800 entries.
    lines = ["window.FOOD_TYPE_SEED = {"]
    categories = list(ordered.items())
    for category_index, (category, pairs) in enumerate(categories):
        lines.append(f"  {json.dumps(category, ensure_ascii=False)}: [")
        for pair_index, pair in enumerate(pairs):
            comma = "," if pair_index < len(pairs) - 1 else ""
            lines.append(f"    {json.dumps(pair, ensure_ascii=False)}{comma}")
        closing_comma = "," if category_index < len(categories) - 1 else ""
        lines.append(f"  ]{closing_comma}")
    lines.append("};")

    TARGET_JS.write_text("\n".join(lines) + "\n", encoding="utf-8")
    return sum(len(pairs) for pairs in ordered.values())


def main() -> int:
    items = build_seed_data()
    try:
        final_count = write_seed_file(items)
    except ValueError as error:
        print(f"ERROR: {error}")
        return 1
    size_kb = TARGET_JS.stat().st_size / 1024
    print(f"Generated {final_count} seed items (from {len(items)} before merging) at {TARGET_JS} ({size_kb:.1f} KB)")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
