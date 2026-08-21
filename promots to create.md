# Brave Tyres Management — AI Agent Build Instructions (Batched)

**How to use this file:** Copy ONE batch at a time (the whole block including "CONTEXT" and "TASK") and paste it into your AI coding agent (Claude Code, Cursor, etc.) as a single prompt. Wait for it to finish and confirm it works before pasting the next batch. Each batch is self-contained and repeats the core context so the agent doesn't need memory of earlier batches.

Do the batches **in order, 0 → 9**. Do not skip batches.

---

## BATCH 0 — Project Setup & Scaffolding

```
You are building a Windows desktop application called "Brave Tyres Management".

PROJECT OVERVIEW:
- A tyre shop inventory app for a single user, fully OFFLINE, no server, no internet dependency.
- Built with Electron.js (desktop shell) + better-sqlite3 (local file-based database) + plain HTML/CSS/JS for the UI (no React, no frontend framework — keep it simple and dependency-light).
- Target OS: Windows 10 and Windows 11.
- App name (used everywhere: window title, package.json name/productName, Start Menu shortcut): "Brave Tyres Management"
- UI THEME: white / light theme throughout. White background (#ffffff or #fafafa), dark readable text (#1a1a1a / #333), light-grey borders/dividers (#e0e0e0) for tables, one accent color (blue, e.g. #2563eb) for buttons/highlights. No dark mode.

YOUR TASK FOR THIS BATCH (setup only — no business logic yet):
1. Initialize a new Electron project in the current folder using npm.
2. Install dependencies: electron, electron-builder (dev dependency), better-sqlite3.
3. Create this folder structure:
   - /main.js               (Electron main process entry)
   - /preload.js             (secure IPC bridge, contextIsolation enabled, nodeIntegration disabled)
   - /db/database.js         (initializes better-sqlite3, creates DB file in Electron's userData folder — NOT in app source folder, so data survives app updates)
   - /renderer/index.html    (main UI shell — just a white page with a top navbar placeholder for now: "Brave Tyres Management" as title, and empty nav links: Stock, Sell, Sales History, Dashboard, Backup)
   - /renderer/styles.css    (white theme base styles: resets, colors, typography, table base styles, button base styles — define CSS variables like --bg, --text, --border, --accent so later batches reuse them)
   - /renderer/renderer.js   (empty for now, just confirm the page loads)
   - /assets/icon.ico        (placeholder note: I will add a real .ico icon later — just reference the path, don't fail if missing)
   - package.json            configured with:
       - "name": "brave-tyres-management"
       - "productName": "Brave Tyres Management"
       - "main": "main.js"
       - scripts: "start" (runs electron .), "build" (runs electron-builder for Windows: nsis installer + portable exe)
       - electron-builder config targeting Windows (win.target: ["nsis", "portable"]), appId like "com.bravetyres.management"

4. main.js should:
   - Create a BrowserWindow sized ~1280x800, minWidth 1000x700
   - Load /renderer/index.html
   - Set window title to "Brave Tyres Management"
   - Use contextIsolation: true, nodeIntegration: false, preload: path to preload.js
   - Initialize the database (call db/database.js init function) before/when window is created
   - Handle app quit / all-windows-closed properly for Windows (quit app when all windows closed)

5. Do NOT implement any database tables, IPC handlers, or business logic yet — that is the next batch. Just get a blank white Electron window titled "Brave Tyres Management" running successfully with `npm start`.

6. After finishing, tell me exactly how to run it (`npm install` then `npm start`) and confirm the folder structure you created.
```

---

## BATCH 1 — Database Schema & IPC Handlers

```
Continue working on the existing Electron project "Brave Tyres Management" (offline tyre shop inventory app, better-sqlite3, plain HTML/CSS/JS, white theme, Windows 10/11 target). The project already has main.js, preload.js, db/database.js, renderer/index.html, renderer/styles.css, renderer/renderer.js set up and a blank white window runs successfully.

YOUR TASK FOR THIS BATCH: implement the database schema and IPC layer only (no UI changes yet beyond what's needed to test).

1. In db/database.js, create these SQLite tables if they don't exist (use `CREATE TABLE IF NOT EXISTS`):

   TABLE tyres:
     id INTEGER PRIMARY KEY AUTOINCREMENT
     serial_no TEXT UNIQUE            -- auto-generated like TY-0001, TY-0002 (also allow manual override)
     size TEXT NOT NULL                -- e.g. "185/70R13"
     pr TEXT                           -- ply rating, e.g. "6PR"
     pattern TEXT                      -- tread pattern / model name
     brand TEXT
     origin TEXT
     quantity INTEGER NOT NULL DEFAULT 0
     purchase_price REAL DEFAULT 0
     price_with_duty REAL DEFAULT 0
     set_price REAL DEFAULT 0          -- selling price per tyre
     min_stock_alert INTEGER DEFAULT 2
     created_at TEXT DEFAULT (datetime('now'))
     updated_at TEXT DEFAULT (datetime('now'))

   TABLE sales:
     id INTEGER PRIMARY KEY AUTOINCREMENT
     tyre_id INTEGER REFERENCES tyres(id)
     size TEXT NOT NULL                -- denormalized copy so history survives even if tyre row is deleted
     qty_sold INTEGER NOT NULL
     sale_price REAL NOT NULL          -- price per unit at time of sale
     total_amount REAL NOT NULL        -- qty_sold * sale_price
     customer_name TEXT
     note TEXT
     sold_at TEXT DEFAULT (datetime('now'))

   TABLE purchases:
     id INTEGER PRIMARY KEY AUTOINCREMENT
     tyre_id INTEGER REFERENCES tyres(id)
     qty_added INTEGER NOT NULL
     cost_price REAL
     supplier TEXT
     purchased_at TEXT DEFAULT (datetime('now'))

2. The database file must be stored in Electron's `app.getPath('userData')` folder (e.g. as `brave-tyres.sqlite`), NOT inside the project/app install folder, so user data persists across app reinstalls/updates. Export a function to get the current DB file path (needed later for the Backup feature).

3. Create IPC handlers in main.js (using ipcMain.handle) and expose matching safe methods via preload.js's contextBridge, for these operations. Namespace them clearly, e.g. window.api.tyres.*, window.api.sales.*, window.api.purchases.*:

   Tyres:
     - tyres:getAll()               -> returns all tyres with a calculated total_value field (quantity * set_price) added in the query result
     - tyres:getById(id)
     - tyres:create(tyreData)       -> auto-generates next serial_no if not provided (format TY-0001 incrementing), inserts row
     - tyres:update(id, tyreData)   -> updates fields, sets updated_at = now
     - tyres:delete(id)
     - tyres:addStock(id, qtyToAdd, costPrice, supplier)  -> increments quantity on the tyre AND inserts a row into purchases

   Sales:
     - sales:create(saleData)       -> saleData = { tyre_id, qty_sold, sale_price, customer_name, note }
         * MUST validate: tyre exists, quantity in stock >= qty_sold, qty_sold > 0. If not enough stock, return an error object, do not proceed.
         * On success: deduct qty_sold from tyres.quantity, insert into sales with total_amount = qty_sold * sale_price and size copied from the tyre, and return the updated tyre + the new sale record.
         * Wrap the deduction + insert in a database transaction so it can't partially fail.
     - sales:getAll(filters)        -> filters optional: { startDate, endDate, size }, returns sales ordered by sold_at DESC
     - sales:getSummary(filters)    -> returns { totalAmount, totalUnitsSold, count } for the given filter range (used later for dashboard)

   Purchases:
     - purchases:getAll()

4. Add basic input validation and error handling in every handler (never let the app crash on bad input — return a structured { success: false, error: "message" } instead, and { success: true, data: ... } on success, for every IPC call).

5. Do not change the UI visually yet. Just confirm in your response how I can quickly test these (e.g. temporary buttons in renderer.js or console calls via DevTools) — a minimal test is fine, real UI comes in later batches.
```

---

## BATCH 2 — Stock Table View (Main Screen)

```
Continue working on the existing Electron project "Brave Tyres Management" (offline tyre shop inventory app). Database and IPC layer already exist and work: window.api.tyres.getAll/create/update/delete/addStock, window.api.sales.create/getAll/getSummary, window.api.purchases.getAll — all following { success, data } / { success:false, error } response shape.

UI THEME reminder: white background, dark text, light-grey borders, one accent color for buttons/highlights, defined as CSS variables in renderer/styles.css (--bg, --text, --border, --accent). Reuse them.

YOUR TASK FOR THIS BATCH: build the main Stock Table view — this is the home screen of the app.

1. In renderer/index.html, build a top navbar (white background, subtle bottom border) with the app name "Brave Tyres Management" on the left and nav buttons on the right: Stock (default/active view), Sell, Sales History, Dashboard, Backup. Clicking switches the visible section (simple show/hide divs is fine — no routing library needed).

2. Build the Stock section as a table matching this column layout:
   S.No | Size | PR | Pattern | Brand | Qty | Price w/ Duty | Set Price | Total Value | Actions

   - S.No = serial_no from DB (e.g. TY-0001)
   - Total Value = quantity * set_price, computed and displayed (already returned by tyres:getAll)
   - Actions column: "Edit" and "Delete" buttons per row (Edit opens a modal/form — build the form now, reusing tyres:create/update; Delete asks for confirmation before calling tyres:delete)
   - Add a "+ Add New Tyre" button above the table that opens the same form (empty) for creating a new tyre. Form fields: Size, PR, Pattern, Brand, Origin, Quantity, Purchase Price, Price with Duty, Set Price, Min Stock Alert. Serial No is auto-generated and shown read-only when editing, hidden when creating new.
   - Add a search/filter input above the table that filters rows live by size, pattern, or brand (client-side filter on the already-loaded data is fine for this dataset size).
   - Rows where quantity <= min_stock_alert should be visually highlighted (light red/yellow background) so low stock is obvious at a glance.
   - Below the table, show a summary footer: "Total Sizes: X | Total Units in Stock: Y | Total Stock Value: Rs. Z" (sum across all currently loaded tyres, formatted with commas, e.g. Rs. 1,234,000).

3. renderer.js should:
   - On app load, call window.api.tyres.getAll() and render the table
   - Re-fetch and re-render after any create/update/delete/addStock action (keep it simple — full refresh is fine, no need for optimistic UI)
   - Show a simple inline success/error message (small toast or banner, styled with the accent color for success and red for error) after each action, using the { success, error } shape from the API

4. Currency formatting: assume Pakistani Rupees, format as "Rs. 1,234,000" (no decimals needed for whole rupee amounts) — use this formatting consistently; I'll confirm currency symbol later if needed, but default to Rs.

Keep styling clean and simple: white cards/table on white background, subtle shadows or borders to separate sections, readable font sizes (14-16px body). No need for anything fancy — clarity over decoration.
```

---

## BATCH 3 — Add Stock (Restock) Quick Action

```
Continue working on the existing Electron project "Brave Tyres Management". The Stock Table view (Batch 2) is working: table with Add/Edit/Delete, search filter, low-stock highlighting, and summary footer. IPC layer (Batch 1) is working including purchases:getAll and tyres:addStock.

YOUR TASK FOR THIS BATCH: add a quick "Add Stock" (restock) action, separate from full Edit, so restocking an existing size doesn't require re-typing the whole tyre form.

1. In the Stock table's Actions column, add a third button per row: "Add Stock" (alongside Edit and Delete).
2. Clicking "Add Stock" opens a small modal with just: Quantity to Add (number, required, must be > 0), Cost Price for this batch (optional number), Supplier (optional text).
3. On submit, call window.api.tyres.addStock(tyreId, qty, costPrice, supplier). This should already increment tyres.quantity and log a row in purchases (from Batch 1) — confirm this works, fix if it doesn't.
4. After success: close modal, refresh the stock table, show a success toast like "Added 10 units to 185/70R13 — new stock: 30".
5. Add a simple "Purchase History" sub-tab or button (can live inside the Stock section, e.g. a toggle "View Purchase History") that lists all purchases via window.api.purchases.getAll(): Date | Size | Qty Added | Cost Price | Supplier, most recent first. Keep it a plain table, same white theme.

Keep all existing functionality from Batch 2 working — don't break the main table, search, or edit/delete flow.
```

---

## BATCH 4 — Sell Flow (Core Feature: Deduct Stock on Sale)

```
Continue working on the existing Electron project "Brave Tyres Management". Stock table, Add/Edit/Delete, and Add Stock are all working. IPC layer includes sales:create(saleData) which validates stock availability, deducts quantity, and logs the sale in a transaction.

YOUR TASK FOR THIS BATCH: build the "Sell" screen — this is the core daily-use feature of the app.

1. In the Sell nav section, build a simple sell form:
   - Tyre picker: a searchable dropdown/autocomplete (type to filter by size/pattern) that lists all tyres with quantity > 0, showing "Size — Pattern (Qty available: X)" per option
   - When a tyre is selected, show its current details as read-only: Size, PR, Pattern, Current Stock, Set Price (this set_price becomes the default Sale Price, but make Sale Price an editable field in case a discount is given)
   - Quantity to Sell (number input, required, must be > 0 and <= current stock — validate on the frontend too, not just rely on backend)
   - Sale Price per unit (pre-filled from set_price, editable)
   - Show a live-calculated "Total Amount = Qty x Sale Price" as the user types
   - Customer Name (optional text)
   - Note (optional text)
   - "Confirm Sale" button

2. On submit, call window.api.sales.create({ tyre_id, qty_sold, sale_price, customer_name, note }).
   - If the backend returns success:false (e.g. not enough stock — this can happen if stock changed since the dropdown loaded), show a clear error and refresh the tyre picker's available quantity, don't just fail silently.
   - On success: show a confirmation like "Sold 3 x 185/70R13 for Rs. 34,890. Remaining stock: 17", clear the form, and refresh the tyre picker list (so quantities are current for the next sale).

3. Add a "Recent Sales" mini-list at the bottom of the Sell screen showing the last 5 sales (size, qty, amount, time) so the user gets immediate confirmation their sale was recorded, without needing to switch to the full Sales History tab.

4. Make sure the Stock table (Batch 2) reflects the new quantity automatically the next time it's viewed (it already re-fetches on load — confirm switching to the Stock tab after a sale shows updated numbers; if the stock data is cached anywhere, invalidate it after a sale).

This is the single most important workflow in the app — make sure the validation (can't oversell, quantity must be positive, tyre must be selected) is solid and the user always gets clear feedback.
```

---

## BATCH 5 — Sales History View

```
Continue working on the existing Electron project "Brave Tyres Management". Sell flow (Batch 4) is working and logging to the sales table correctly, deducting stock.

YOUR TASK FOR THIS BATCH: build the Sales History screen.

1. In the Sales History nav section, show a table of all sales via window.api.sales.getAll(): Date/Time | Size | Qty Sold | Sale Price | Total Amount | Customer | Note — most recent first.
2. Add filter controls above the table:
   - Date range (From / To date pickers) — defaults to showing all, but can be narrowed
   - Size filter (text input or dropdown of sizes that appear in sales)
   - "Apply Filter" button that re-calls window.api.sales.getAll(filters) and window.api.sales.getSummary(filters)
3. Show a summary bar above or below the table using sales:getSummary(filters): "Total Sales: Rs. X | Units Sold: Y | Transactions: Z" for the currently filtered range.
4. Add a "Today" and "This Month" quick-filter button that sets the date range automatically and applies it, since these will be the most common checks.
5. Keep the same white theme, table styling, and currency formatting (Rs. with commas) as the rest of the app.

Don't modify the Sell screen or Stock table logic — this batch only adds the history/reporting view on top of existing data.
```

---

## BATCH 6 — Dashboard Summary

```
Continue working on the existing Electron project "Brave Tyres Management". Stock, Sell, and Sales History screens are all working.

YOUR TASK FOR THIS BATCH: build the Dashboard nav section as a summary/overview screen — the first thing a shop owner checks each morning.

1. Fetch data needed via existing IPC calls (tyres:getAll, sales:getSummary with today's date range, sales:getSummary with this-month's date range) — do not create new backend logic unless something is missing, then add the minimal handler needed.

2. Display as a set of clean summary "cards" (white cards, light border/shadow, big bold number, small label underneath) in a grid:
   - Total Distinct Sizes in Stock
   - Total Units in Stock
   - Total Stock Value (Rs., based on quantity x set_price across all tyres)
   - Today's Sales (Rs.)
   - This Month's Sales (Rs.)
   - Low Stock Items count (tyres where quantity <= min_stock_alert)

3. Below the cards, show a "Low Stock Alerts" list/table: Size | Pattern | Current Qty | Min Alert — for any tyre at or below its alert threshold, so the owner knows what to reorder. If none, show a friendly "All stock levels are healthy" message.

4. Below that, show a small "Top Selling Sizes" list (top 5 by total qty sold, all-time or this month — this-month is fine) if this requires a new aggregation query, add a simple sales:getTopSelling(limit, filters) IPC handler that groups sales by size and sums qty_sold, ordered descending.

5. Make the Dashboard the default landing view when the app opens (instead of Stock) — update the navbar's default active state accordingly, but keep Stock as the next click.

Keep consistent white theme, spacing, and currency formatting.
```

---

## BATCH 7 — Export to Excel / CSV

```
Continue working on the existing Electron project "Brave Tyres Management". Dashboard, Stock, Sell, and Sales History are all working.

YOUR TASK FOR THIS BATCH: add export functionality, since the shop owner currently works in Excel and wants to keep that option.

1. Install a CSV/Excel export library appropriate for Node (e.g. a lightweight CSV writer is enough — do not over-engineer; a full .xlsx library is optional if you can also just produce clean CSV files that open fine in Excel). Prefer minimal dependencies.

2. Add an "Export to Excel/CSV" button on the Stock screen: exports the currently visible/filtered stock table (same columns as shown on screen: S.No, Size, PR, Pattern, Brand, Qty, Price w/ Duty, Set Price, Total Value) to a .csv file.

3. Add an "Export to Excel/CSV" button on the Sales History screen: exports the currently filtered sales list (Date, Size, Qty Sold, Sale Price, Total Amount, Customer, Note) to a .csv file.

4. Use Electron's dialog module (via IPC, exposed safely through preload.js) to let the user choose the save location and filename via a native "Save As" dialog, defaulting to a sensible filename like "brave-tyres-stock-2026-08-21.csv" or "brave-tyres-sales-2026-08-01-to-2026-08-21.csv".

5. Show a success confirmation ("Exported to [path]") or error message after the export completes.

Keep all existing functionality working — this batch only adds export buttons and their handlers, no changes to core data logic.
```

---

## BATCH 8 — Backup Feature

```
Continue working on the existing Electron project "Brave Tyres Management". All core features (Stock, Sell, Sales History, Dashboard, Export) are working. The database file lives in Electron's userData folder (from Batch 1) as brave-tyres.sqlite.

YOUR TASK FOR THIS BATCH: add a Backup screen/section, since this app has no cloud sync and the user is responsible for their own backups.

1. In the Backup nav section, show:
   - The current database file location (display path, read-only)
   - Current database file size and "last modified" timestamp
   - A "Backup Now" button

2. "Backup Now" should:
   - Open a native folder-picker dialog (via IPC + Electron's dialog module) for the user to choose where to save the backup
   - Copy the current .sqlite database file to that folder with a timestamped filename, e.g. "brave-tyres-backup-2026-08-21-1830.sqlite"
   - Show a success message with the saved path, or a clear error if it fails (e.g. disk full, permission denied)

3. Add a "Restore from Backup" option (secondary, less prominent button, with a confirmation warning like "This will replace all current data. Are you sure?"):
   - Opens a native file-picker to select a previously saved .sqlite backup file
   - On confirm, closes the current DB connection, replaces the live database file with the selected backup file, and restarts the app (or reloads the window and re-initializes the DB connection) so the restored data loads
   - This is a destructive action — require the user to type "RESTORE" or click a second confirmation before proceeding, to avoid accidental data loss

4. Optional but recommended: on app quit, silently copy the DB file to a local "auto-backups" folder inside userData (keep only the last 5 auto-backups, delete older ones) as a safety net — this does not require any user interaction, it's just insurance.

Keep everything else in the app working exactly as before.
```

---

## BATCH 9 — Windows Packaging & Final Polish

```
Continue working on the existing Electron project "Brave Tyres Management". All features are complete: Dashboard, Stock (add/edit/delete/restock), Sell, Sales History, Export, Backup/Restore.

YOUR TASK FOR THIS BATCH: finalize the app for Windows distribution and do a final polish pass.

1. Confirm electron-builder is configured in package.json to produce:
   - A Windows NSIS installer (.exe) with the option for the user to choose install directory, and a Start Menu + Desktop shortcut both named "Brave Tyres Management"
   - A portable .exe as a secondary option (no install required, runs from a USB stick or any folder) — this is useful for a shop owner who wants zero-friction setup
   - App icon: reference /assets/icon.ico for the Windows build (if I haven't provided a real icon file yet, use a simple placeholder and tell me exactly what size/format icon to provide — typically a 256x256 .ico with multiple embedded resolutions)

2. Run through this final checklist and fix anything broken:
   - App opens directly to Dashboard, shows correct summary numbers on a fresh empty database (should show zeros, not errors, on first run with no data)
   - Adding a tyre, editing it, restocking it, selling some of it, and checking Sales History and Dashboard all reflect changes correctly, in that order, as one end-to-end test
   - Selling more than available stock is blocked with a clear error, not a crash
   - Closing and reopening the app preserves all data (confirms DB is correctly stored in userData, not lost on restart)
   - Export buttons produce valid, correctly formatted CSV files that open cleanly in Excel
   - Backup Now produces a valid, restorable .sqlite file
   - No console errors in DevTools during normal use
   - White theme is consistent across every screen (no leftover default/dark browser styling anywhere, consistent spacing/typography)

3. Add a simple About/Help note somewhere accessible (e.g. small "?" icon in the navbar or a footer line) showing: "Brave Tyres Management v1.0 — Offline tyre inventory & sales tracker."

4. Produce the final build with `npm run build` and confirm the installer and portable .exe are generated successfully, and tell me exactly where to find the output files (typically in a /dist folder).

After this batch, the app should be a finished, installable Windows desktop application ready for daily use in the shop.
```

---

## Notes for You (not part of the AI prompts)

- **Test after every batch** before moving to the next one — each batch assumes the previous ones work correctly.
- If a batch's output breaks something from an earlier batch, paste back into the same AI session with: *"This broke [X] from an earlier batch — please fix without removing existing functionality."*
- Keep a copy of this file — if you switch AI tools or start a fresh chat mid-project, you can paste the relevant batch again along with "the project already has [list what's done]" so the AI has context.
- Batch 9 (packaging) needs a real `.ico` file for a polished result — a free icon can be made from any tyre/wheel image using an online "PNG to ICO" converter (256x256 recommended).
- Default currency is set to **Rs. (Pakistani Rupees)** throughout — say so explicitly if you want a different currency/format.