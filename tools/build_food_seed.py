from __future__ import annotations

import json
from pathlib import Path
from typing import Any

ROOT = Path(__file__).resolve().parents[1]
SOURCE_JSON = ROOT / "FoodData_Central_foundation_food_json_2026-10-29.json"
TARGET_JS = ROOT / "food_seed_data.js"
MAX_ITEMS = 100

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
}


def normalize_name(raw: str) -> str:
    normalized = " ".join(raw.replace("\n", " ").split())
    return normalized.strip(" ,;")


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
    return any(keyword in lowered for keyword in COUNTABLE_KEYWORDS)


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

    base_name = normalize_name(description.split(",", 1)[0])
    if not base_name:
        return None

    if should_use_unit_label(description):
        portion_grams = pick_portion_grams(food)
        if portion_grams and portion_grams > 0:
            singular = singularize(base_name)
            unit_label = "1 egg" if "egg" in singular else f"1 {singular}"
            return {
                "name": unit_label,
                "calPerUnit": round(kcal_per_100g * portion_grams / 100.0, 2),
            }

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
