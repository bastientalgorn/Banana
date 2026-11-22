# Banana App — Plan V2 (Consolidated)

## 1) Goal
Build a lightweight mobile-first web app to track:
- daily calories (eaten and spent), and
- daily body weight (one value per day).

Target device is phone portrait around `1080 × 2340`.
Usable height is often less than `2340` because of browser UI (address bar, nav) and keyboard.

## 2) Finalized navigation and tabs
Top navigation has exactly 3 tabs:
- `Cal`
- `Progress` (renamed from `Weight`)
- `Data`

No large tab title is shown inside each tab page.

## 3) Data model (implemented requirements)

### `ItemType`
- `id`
- `name`
- `calPerUnit` (can be positive, negative, and decimal)
- `color` (hex string, chosen from a fixed 10-color palette; defaults to the first palette color)

### `CalEntry`
- `id`
- `date` (`YYYY-MM-DD`)
- `itemTypeId`
- `quantity`
- `createdAt` (`HH:MM`, auto-set on creation)

### `WeightEntry`
- `date` (`YYYY-MM-DD`)
- `weightKg`
- `createdAt` (`HH:MM`, auto-set when created for that date)

## 4) `Cal` tab requirements

### Date and totals
- Date defaults to current local day.
- User can still change the date.
- Daily total is displayed.

### Entry list style
- Entries are shown in a compact one-line row.
- Each row shows a small color dot matching the item type's color, before the name.
- Each row has a small pen icon (`✎`) to edit.

### Add entry flow (simplified)
- Default view shows one light-blue button: `New entry`.
- Add form is hidden until user clicks `New entry`.
- Add form layout:
	- Row 1: type text field (placeholder `Type`) + small `New type` button.
	- Row 2: `Quantity` + quantity input + `+` and `-` buttons on same line.
	- Row 3 (below date/time, above actions): row of 10 small circular color swatches (fixed palette), one highlighted as selected. Picking a color updates the color stored on the entry's item type.
	- Row 4: `Add` and `Cancel` buttons.

### Smart quantity default
- When a type is selected/typed:
	- use last quantity used for that type,
	- otherwise default to `1`.

### Create-time timestamp
- Any newly created calorie entry auto-stores current local time (`HH:MM`).

## 5) `Progress` tab requirements

### Top data-entry row (simplified)
Single compact row:
- displayed date,
- calendar icon to pick date,
- text field for weight,
- `Save` button.

No weight unit label is shown.

### Day-of-week display
- Show 3-letter weekday (`Mon`, `Tue`, `Wed`, etc.) with date.

### History list style
- Each data point is one compact line.
- Each row uses small pen icon (`✎`) to edit.
- No unit text in the row.

### Create-time timestamp
- When a new day record is created, store creation time (`HH:MM`).

## 6) `Data` tab requirements
- Item type list uses same compact one-line style as `Cal`/`Progress`.
- Each row has pen icon (`✎`) for edit.
- Numeric validation for calories remains required.

## 7) Seeded common entry types from USDA JSON

### Source
- Parse: `FoodData_Central_foundation_food_json_2026-10-29.json`.

### Generated seed artifacts
- Generator script: `tools/build_food_seed.py`.
- Output seed file: `food_seed_data.js`.
- Seed loaded in app startup and inserted into IndexedDB if missing.

### Unit policy for generated types (agreed)
- Default for weight-based foods: `1g ...` (not `100g` or `10g`).
- For countable foods: `1 unit` style (example: `1 egg`).
- This unit decision is determined per food using USDA portion metadata.

## 8) Technical constraints
- One-page app: `XHTML` + linked `JavaScript`/`CSS`.
- Local persistence: `IndexedDB`.
- No backend required for V1.

## 9) Local run (Windows)
```bat
cd /d c:\PERSO\Banana
python -m http.server 8000
```

Open `http://localhost:8000/index.xhtml`.

## 10) Remaining open points
- Optional delete UX for compact pen-only lists.
- Optional import/export backup format.
- Optional extra stats in `Cal` (weekly trends, averages).





