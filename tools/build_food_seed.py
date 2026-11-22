from __future__ import annotations

import json
import re
from pathlib import Path
from typing import Any

ROOT = Path(__file__).resolve().parents[1]
SOURCE_JSON = ROOT / "FoodData_Central_foundation_food_json_2026-10-29.json"
TARGET_JS = ROOT / "food_seed_data.js"
MAX_ITEMS = 100
# How many leading comma-separated segments of the USDA description to use
# when building the name for gram-based (non-countable) entries. Using only
# the first segment caused very different foods (e.g. many distinct cuts of
# beef, or egg white vs. egg yolk vs. whole egg) to collapse onto the same
# generated name and have their calorie values silently averaged together.
MAX_BASE_NAME_SEGMENTS = 4

IRREGULAR_SINGULAR = {
    "cookies": "cookie",
    "peaches": "peach",
    "potatoes": "potato",
    "tomatoes": "tomato",
    "sweet potatoes": "sweet potato",
}

COUNTABLE_KEYWORDS = {
    "egg",
    "banana",
    "apple",
    "orange",
    "pear",
    "peach",
    "plum",
    "kiwi",
    "avocado",
    "tomato",
    "potato",
    "onion",
    "carrot",
    "cookie",
    "muffin",
    "bagel",
    "sausage",
    "hot dog",
    "hotdog",
}

DISCRETE_UNIT_ALIASES = {
    "piece",
    "whole",
    "item",
    "slice",
    "link",
    "patty",
    "fillet",
    "stick",
    "wedge",
    "ear",
    "spear",
    "egg",
}


def normalize_name(raw: str) -> str:
    normalized = " ".join(raw.replace("\n", " ").split())
    return normalized.strip(" ,;")


_COUNTABLE_KEYWORD_PATTERN = re.compile(
    r"\b(" + "|".join(re.escape(keyword) for keyword in COUNTABLE_KEYWORDS) + r")(e?s)?\b"
)

_EGG_WHITE_PATTERN = re.compile(r"\bwhite\b")
_EGG_YOLK_PATTERN = re.compile(r"\byolk\b")

# Processed/concentrated forms (e.g. "Tomato, paste, canned") are nutritionally
# very different from the whole/fresh form of the same keyword (e.g. a fresh
# tomato), so they should not be averaged into the generic "1 tomato"-style
# countable entry; they fall back to a distinct gram-based entry instead.
_PROCESSED_FORM_PATTERN = re.compile(r"\b(paste|sauce|puree|juice|powder|extract|crushed)\b")

# Sausage covers very different proteins/styles (turkey breakfast link vs. pork
# chorizo) with wildly different calorie density, so it is disambiguated by
# protein type rather than collapsed into one generic "1 sausage" value.
_SAUSAGE_PROTEIN_PATTERN = re.compile(r"\b(beef|pork|turkey|chicken)\b")


def extract_kcal(food: dict[str, Any]) -> float | None:
    kcal_candidates: list[float] = []
    fallback_energy: list[float] = []

    for item in food.get("foodNutrients") or []:
        nutrient = item.get("nutrient") or {}
        nutrient_name = str(nutrient.get("name") or "")
        unit_name = str(nutrient.get("unitName") or "").upper()
        amount = item.get("amount")

        if not isinstance(amount, (int, float)):
            continue

        if unit_name == "KCAL" and nutrient_name == "Energy":
            kcal_candidates.append(float(amount))
        elif unit_name == "KCAL" and "Energy" in nutrient_name:
            fallback_energy.append(float(amount))

    if kcal_candidates:
        return kcal_candidates[0]
    if fallback_energy:
        return fallback_energy[0]
    return None


def should_use_unit_label(description: str) -> bool:
    lowered = description.lower()
    if _PROCESSED_FORM_PATTERN.search(lowered):
        return False
    return bool(_COUNTABLE_KEYWORD_PATTERN.search(lowered))


def pick_portion_grams(food: dict[str, Any]) -> float | None:
    portions = food.get("foodPortions") or []
    discrete_candidate: float | None = None
    racc_candidate: float | None = None

    for portion in portions:
        amount = portion.get("amount")
        gram_weight = portion.get("gramWeight")
        measure_unit = portion.get("measureUnit") or {}
        modifier = str(portion.get("modifier") or "").strip().lower()
        unit_name = str(measure_unit.get("name") or "").strip().lower()
        unit_abbr = str(measure_unit.get("abbreviation") or "").strip().lower()

        if amount != 1 or not isinstance(gram_weight, (int, float)):
            continue

        if unit_name == "racc" or unit_abbr == "racc":
            if gram_weight > 0:
                racc_candidate = float(gram_weight)
            continue

        tokens = {unit_name, unit_abbr, modifier}
        if any(token in DISCRETE_UNIT_ALIASES for token in tokens):
            if gram_weight > 0:
                discrete_candidate = float(gram_weight)
                break

    return discrete_candidate or racc_candidate


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


def format_entry(food: dict[str, Any], kcal_per_100g: float) -> dict[str, int | str] | None:
    description = normalize_name(str(food.get("description") or ""))
    if not description:
        return None

    segments = [normalize_name(segment) for segment in description.split(",")]
    segments = [segment for segment in segments if segment]
    if not segments:
        return None

    first_segment = segments[0]

    if should_use_unit_label(description):
        portion_grams = pick_portion_grams(food)
        if portion_grams and portion_grams > 0:
            singular = singularize(first_segment)
            unit_label = f"1 {singular}"
            if singular.lower() == "egg":
                qualifier = egg_component_qualifier(description)
                if qualifier:
                    unit_label = f"1 egg {qualifier}"
            elif singular.lower() == "sausage":
                qualifier = sausage_protein_qualifier(description)
                if qualifier:
                    unit_label = f"1 {qualifier} sausage"
            return {
                "name": unit_label,
                "calPerUnit": round(kcal_per_100g * portion_grams / 100.0, 2),
            }

    # Gram-based fallback: use several leading description segments (not just
    # the first) so genuinely different foods (different cuts/preparations,
    # e.g. "Beef, loin, tenderloin roast" vs. "Beef, round, eye of round
    # roast") get distinct names instead of being merged and averaged.
    base_name = ", ".join(segments[:MAX_BASE_NAME_SEGMENTS])
    return {
        "name": f"1g {base_name}",
        "calPerUnit": round(kcal_per_100g / 100.0, 3),
    }


def build_seed_data() -> list[dict[str, float | str]]:
    payload = json.loads(SOURCE_JSON.read_text(encoding="utf-8"))
    foods = payload.get("FoundationFoods") or payload.get("foods") or []

    aggregated: dict[str, dict[str, Any]] = {}

    for food in foods:
        kcal = extract_kcal(food)
        if kcal is None:
            continue

        if kcal <= 0:
            continue

        entry = format_entry(food, kcal)
        if not entry:
            continue

        entry_name = str(entry["name"]).strip()
        entry_key = entry_name.lower()
        calories = float(entry["calPerUnit"])

        bucket = aggregated.get(entry_key)
        if bucket is None:
            aggregated[entry_key] = {
                "name": entry_name,
                "calories": [calories],
            }
        else:
            bucket["calories"].append(calories)

    selected: list[dict[str, float | str]] = []
    for bucket in aggregated.values():
        calories_list = bucket["calories"]
        avg_calories = sum(calories_list) / len(calories_list)
        selected.append(
            {
                "name": bucket["name"],
                "calPerUnit": round(avg_calories, 3),
            }
        )

    selected.sort(key=lambda item: str(item["name"]).lower())
    return selected[:MAX_ITEMS]


def write_seed_file(items: list[dict[str, float | str]]) -> None:
    content = (
        "window.FOOD_TYPE_SEED = "
        + json.dumps(items, ensure_ascii=False, indent=2)
        + ";\n"
    )
    TARGET_JS.write_text(content, encoding="utf-8")


def main() -> int:
    items = build_seed_data()
    write_seed_file(items)
    print(f"Generated {len(items)} seed items at {TARGET_JS}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
