from __future__ import annotations

import json
import re
from pathlib import Path
from typing import Any

ROOT = Path(__file__).resolve().parents[1]
SOURCE_JSON = ROOT / "FoodData_Central_sr_legacy_food_json_2018-04.json"
TARGET_JS = ROOT / "food_seed_data.js"
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
                "calPerUnit": round(avg_calories, 3),
            }
        )

    selected.sort(key=lambda item: str(item["name"]).lower())
    return selected


def write_seed_file(items: list[dict[str, Any]]) -> None:
    content = (
        "window.FOOD_TYPE_SEED = "
        + json.dumps(items, ensure_ascii=False, indent=2)
        + ";\n"
    )
    TARGET_JS.write_text(content, encoding="utf-8")


def main() -> int:
    items = build_seed_data()
    write_seed_file(items)
    size_kb = TARGET_JS.stat().st_size / 1024
    print(f"Generated {len(items)} seed items at {TARGET_JS} ({size_kb:.1f} KB)")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
