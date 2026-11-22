# Banana Tracker

Mobile-first local web app to track daily calories and body weight.

## Features
- 3 tabs: `Cal`, `Progress`, `Data`
- Local persistence with IndexedDB (`templates`, `calEntries`, `weightEntries`)
- Preloaded ~100 common food templates generated from USDA Foundation Foods JSON
- Calorie entries per day with quantity and optional name override
- Template CRUD with positive/negative calories
- Weight capture + editable history + simple trend chart
- No backend required

## Files
- `index.xhtml`: app markup and layout
- `styles.css`: mobile-first styles
- `app.js`: app logic and IndexedDB data layer
- `food_seed_data.js`: generated seed templates (`name`, `calPerUnit`)
- `tools/build_food_seed.py`: parses USDA JSON and regenerates `food_seed_data.js`
- `tests/smoke_test.py`: minimal validation test

## Quick start (Windows)
```bat
cd /d c:\PERSO\Banana
python -m http.server 8000
```

Then open:
- `http://localhost:8000/index.xhtml`

## Run smoke test
```bat
cd /d c:\PERSO\Banana
python tests\smoke_test.py
```

## Regenerate food seed data
```bat
cd /d c:\PERSO\Banana
python tools\build_food_seed.py
```

## Notes
- Data is stored in your browser (IndexedDB), per browser/profile.
- If you want a clean slate, clear site storage for `localhost:8000` in browser settings.
