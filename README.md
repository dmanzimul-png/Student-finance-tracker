# Student Finance Tracker

**Live demo:** https://dmanzimul-png.github.io/student-finance-tracker/

Theme: **Student Finance Tracker**

---

## Features

- Add / edit / delete transactions with full validation
- Live regex search with match highlighting and case-toggle
- Sort by description, amount, or date (ascending/descending)
- Dashboard: total records, total spending, top category, last-7-days chart
- Monthly budget cap with ARIA live over/under announcements
- Currency display: USD / EUR / GBP with manual exchange rates
- JSON export and import (with structure validation)
- Full localStorage persistence (auto-save on every change)
- Mobile-first responsive layout (360px, 768px, 1024px breakpoints)
- Keyboard-only navigable; visible focus styles throughout
- Accessible: semantic landmarks, labels, ARIA live regions, skip-link

---

## Regex Catalog

| Rule | Pattern | Valid example | Invalid example |
|---|---|---|---|
| Description | `/^\S(?:.*\S)?$/` | `Lunch at cafe` | ` Lunch ` |
| Amount | `/^(0\|[1-9]\d*)(\.\d{1,2})?$/` | `12.50` | `01.5`, `12.999` |
| Date | `/^\d{4}-(0[1-9]\|1[0-2])-(0[1-9]\|[12]\d\|3[01])$/` | `2025-09-25` | `2025-13-01` |
| Category | `/^[A-Za-z]+(?:[ -][A-Za-z]+)*$/` | `Eating-Out` | `123`, `Food ` |
| **Advanced** — Duplicate words (back-reference) | `/\b(\w+)\s+\1\b/i` | — | `the the`, `Coffee coffee` |
| Cents present | `/\.\d{2}\b/` | `12.50` | `12` |
| Beverage keyword | `/(coffee\|tea)/i` | `Coffee` | `water` |

---

## Keyboard Map

| Key / Action | Effect |
|---|---|
| Tab / Shift+Tab | Move between focusable elements |
| Enter / Space | Activate button or submit form |
| Arrow keys | Navigate `<select>` options |
| Skip link (first Tab) | Jump straight to main content |
| Sort buttons (Enter) | Cycle sort direction |
| Escape | Cancel inline edit (Cancel button) |

---

## Accessibility Notes

- Semantic landmarks: `<header>`, `<nav>`, `<main>`, `<section>`, `<footer>`
- All form inputs have associated `<label>` elements
- Error messages use `role="alert"` for immediate announcement
- Status messages (`#status-message`, `#cap-status`, `#search-status`) use `aria-live`
- Budget cap switches from `polite` → `assertive` when exceeded
- Sort `<th>` buttons carry `aria-sort` attribute
- Table wrapped in scrollable region with `tabindex="0"` for keyboard scroll
- Color contrast ≥ 4.5:1 for all text
- Focus indicator: `outline: 3px solid #2563eb` on all interactive elements

---

## How to Run Tests

1. Serve the project with a local server (required for ES modules):
   ```bash
   npx serve .
   # or
   python -m http.server 8080
   ```
2. Open `http://localhost:8080/tests.html`
3. All assertions run automatically — results displayed on screen.

---

## How to Run the App

```bash
npx serve .
```
Open `http://localhost:3000` (or whichever port `serve` prints).

To load seed data: click **Import JSON** in Settings and select `seed.json`.

---

## File Structure

```
student-finance-tracker/
├── index.html
├── seed.json
├── tests.html
├── README.md
├── styles/
│   ├── styles.css       # base + component styles
│   └── responsive.css   # 360 / 768 / 1024 breakpoints
├── scripts/
│   ├── app.js           # main wiring (events, init)
│   ├── state.js         # in-memory records + settings
│   ├── storage.js       # localStorage + import/export
│   ├── ui.js            # DOM rendering (table, dashboard, chart)
│   ├── validator.js     # regex rules + validate()
│   └── search.js        # compileRegex() + highlight()
└── assets/
```
