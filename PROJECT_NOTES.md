# Cansi De Mansilingan — POS System

Full point-of-sale system built with React Native (Expo) for the Android tablet + a Next.js owner dashboard web app connected to Supabase.

---

## Apps

| App | Tech | URL / Location |
|-----|------|----------------|
| POS App | React Native + Expo SDK 54 | Android APK (EAS Build) |
| Owner Dashboard | Next.js 14 + Tailwind CSS | https://cansidemansi.vercel.app/ |
| Database | Supabase (PostgreSQL) | https://oxbyhzibbphzqhbtndnf.supabase.co |

---

## POS App

### Location
`/Users/vicmaryanson/Documents/POS Carenderia/`

### Key Details
- **Package:** `com.cansidemansilingan.pos`
- **EAS Project ID:** `b0b7a212-9563-49f5-9be5-3ed4f8b0510f`
- **EAS Owner:** `koolice234`
- **Expo SDK:** 54.0.35 / React Native 0.81.5 / React 19.1.0

### Screens / Tabs
| Tab | Description |
|-----|-------------|
| Order | Take orders, add to cart, apply discount, cash tendered / change |
| Products | Manage menu items (add, edit, toggle availability) |
| Inventory | Stock view + Purchases log. Shows last restock timestamp per item |
| Summary | Today's sales summary and order history |
| Settings | Store info, receipt footer, Change PIN |
| Admin | PIN-locked. Daily sales chart, sync status, recent orders, manual sync |

### Architecture
- **Offline-first:** SQLite (expo-sqlite v16) is the source of truth
- **Cloud sync:** When internet is available, unsynced orders and purchases are pushed to Supabase
- **Sync triggers:** On app start, on connectivity restore, and immediately after every order

### Database (SQLite)
| Table | Purpose |
|-------|---------|
| `menu_items` | Products with price, category, stock, `last_restocked_at` |
| `categories` | Product categories with color |
| `orders` | Sales orders with totals, discount, status, `supabase_id` |
| `order_items` | Line items per order |
| `purchases` | Stock purchase records, `supabase_id` |
| `purchase_items` | Items per purchase |
| `settings` | Store name, PIN, receipt footer, etc. |

### Important Notes
- Always install with `npm install --legacy-peer-deps` (React 19 peer dep conflicts)
- `isInternetReachable` returns `null` on Android — only check `isConnected` in NetInfo
- `last_restocked_at` is updated every time stock is added via restock or log purchase

### Building APK
```bash
eas build --platform android --profile preview --non-interactive
```
Profile `preview` = APK (direct install). Profile `production` = AAB (Play Store).

### Latest APK
`https://expo.dev/artifacts/eas/6qbbatXxR_JjemEtc_s7W9E_0eWjud_GylBK6wsEwQo.apk`
QR code saved at: `apk-download-qr.png`

---

## Owner Dashboard

### Location
`/Users/vicmaryanson/Documents/POS Owner Dashboard/`

### GitHub
https://github.com/vicmar-glamnetic/POS-Cansihan-Owner.git

### Pages
| Page | Path | Description |
|------|------|-------------|
| Login | `/` | PIN login (reads from Supabase `app_settings`) |
| Dashboard | `/dashboard` | Stats (today/month/all), daily sales bar chart, best sellers |
| Orders | `/orders` | Date range + status filter, expandable order rows |
| Purchases | `/purchases` | Full purchase transaction history with item breakdown |
| Inventory | `/inventory` | Last restock per item. Admin can log new stock additions. Shows "by Admin" or "by POS" badge |
| Settings | `/settings` | Change PIN (syncs to Supabase), Logout |

### "by Admin" vs "by POS"
- **by POS** — stock logged on the POS tablet. Has a `local_id` in Supabase.
- **by Admin** — stock logged from the owner dashboard. `local_id` is null.

### Note on Stock Counts
Stock added from the owner dashboard is saved to Supabase for record-keeping and cost tracking. The POS device's local stock count is managed separately on the device — staff still need to log the physical restock on the POS app to update live stock numbers.

---

## Supabase

### Tables
| Table | Purpose |
|-------|---------|
| `orders` | Synced orders from POS |
| `order_items` | Line items per order |
| `purchases` | Synced purchase records. `local_id` = null means added by admin |
| `purchase_items` | Items per purchase |
| `app_settings` | Key-value store. `admin_pin` used by both apps |

### RLS
Disabled on all tables (anon key used directly).

### Credentials
Stored in:
- POS app: `src/config/supabase.js`
- Owner dashboard: `.env.local` (`NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`)

---

## Admin PIN
Default: `1234`

- Change on POS app → Settings → Admin Security
- Change on owner dashboard → Settings → Change PIN
- Both apps read/write from Supabase `app_settings` table, so they stay in sync

---

## Bugs Fixed Along the Way
| Bug | Fix |
|-----|-----|
| `CartBody` defined inside component caused TextInput focus loss | Inlined JSX, removed nested component definition |
| Nested ScrollView on Android | Single ScrollView with `.map()` in split layout |
| `isInternetReachable` null on Android | Only check `state.isConnected` in NetInfo listener |
| Sync not firing immediately | Call `syncPending()` directly after every `saveOrder()` |
| Supabase URL trailing space | Trimmed in `supabase.js` |
| EAS slug mismatch after rename | Ran `eas init` to register new project ID |
| `appVersionSource` EAS warning | Added `"appVersionSource": "local"` to `eas.json` |
| `eas.json` blocked by `.gitignore` | Removed `eas.json` from `.gitignore` |
