import * as SQLite from 'expo-sqlite';

let db = null;

export function getDatabase() {
  if (!db) db = SQLite.openDatabaseSync('carenderia.db');
  return db;
}

export function initDatabase() {
  const database = getDatabase();

  database.execSync(`
    PRAGMA journal_mode = WAL;

    CREATE TABLE IF NOT EXISTS menu_items (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      price REAL NOT NULL,
      category TEXT DEFAULT 'Other',
      is_available INTEGER DEFAULT 1,
      stock INTEGER DEFAULT -1,
      created_at TEXT DEFAULT (datetime('now', 'localtime'))
    );

    CREATE TABLE IF NOT EXISTS categories (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL UNIQUE,
      color TEXT DEFAULT '#555555',
      sort_order INTEGER DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS orders (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      total_amount REAL NOT NULL,
      subtotal REAL NOT NULL DEFAULT 0,
      discount_amount REAL DEFAULT 0,
      discount_label TEXT DEFAULT '',
      amount_tendered REAL,
      change_amount REAL,
      table_name TEXT DEFAULT '',
      note TEXT,
      status TEXT DEFAULT 'completed',
      created_at TEXT DEFAULT (datetime('now', 'localtime'))
    );

    CREATE TABLE IF NOT EXISTS order_items (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      order_id INTEGER NOT NULL,
      menu_item_id INTEGER,
      menu_item_name TEXT NOT NULL,
      price REAL NOT NULL,
      quantity INTEGER NOT NULL,
      FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS purchases (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      supplier TEXT DEFAULT '',
      note TEXT DEFAULT '',
      total_cost REAL DEFAULT 0,
      created_at TEXT DEFAULT (datetime('now', 'localtime'))
    );

    CREATE TABLE IF NOT EXISTS purchase_items (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      purchase_id INTEGER NOT NULL,
      menu_item_id INTEGER,
      item_name TEXT NOT NULL,
      quantity INTEGER NOT NULL,
      unit_cost REAL DEFAULT 0,
      FOREIGN KEY (purchase_id) REFERENCES purchases(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS settings (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL DEFAULT ''
    );
  `);

  // Safe migrations for existing installs
  const migrations = [
    'ALTER TABLE menu_items ADD COLUMN stock INTEGER DEFAULT -1',
    'ALTER TABLE orders ADD COLUMN subtotal REAL DEFAULT 0',
    'ALTER TABLE orders ADD COLUMN discount_amount REAL DEFAULT 0',
    'ALTER TABLE orders ADD COLUMN discount_label TEXT DEFAULT ""',
    'ALTER TABLE orders ADD COLUMN table_name TEXT DEFAULT ""',
    'ALTER TABLE orders ADD COLUMN status TEXT DEFAULT "completed"',
    'ALTER TABLE orders ADD COLUMN supabase_id TEXT',
    'ALTER TABLE purchases ADD COLUMN supabase_id TEXT',
    'ALTER TABLE menu_items ADD COLUMN last_restocked_at TEXT',
  ];
  for (const sql of migrations) {
    try { database.execSync(sql); } catch {}
  }

  // Seed default settings
  const defaults = [
    ['store_name', 'My Store'],
    ['store_address', ''],
    ['store_phone', ''],
    ['store_tin', ''],
    ['receipt_footer', 'Thank you for your purchase!'],
    ['currency_symbol', '₱'],
    ['admin_pin', '1234'],
  ];
  for (const [key, value] of defaults) {
    database.runSync('INSERT OR IGNORE INTO settings (key, value) VALUES (?, ?)', [key, value]);
  }

  // Seed default categories
  const catCount = database.getFirstSync('SELECT COUNT(*) as c FROM categories');
  if (catCount.c === 0) {
    const defaultCats = [
      ['Food', '#e8521a', 0],
      ['Drinks', '#c49a2a', 1],
      ['Snacks', '#7b5ea7', 2],
      ['Produce', '#3a7d44', 3],
      ['Other', '#1a6fb5', 4],
    ];
    for (const [name, color, sort_order] of defaultCats) {
      database.runSync(
        'INSERT INTO categories (name, color, sort_order) VALUES (?, ?, ?)',
        [name, color, sort_order]
      );
    }
  }

  // Seed sample menu items if empty
  const count = database.getFirstSync('SELECT COUNT(*) as c FROM menu_items');
  if (count.c === 0) {
    const sampleItems = [
      ['Adobong Manok', 45, 'Food', 20],
      ['Sinigang na Baboy', 55, 'Food', 15],
      ['Pritong Isda', 40, 'Food', 10],
      ['Pinakbet', 35, 'Food', 20],
      ['Monggo', 30, 'Food', 25],
      ['Kanin', 10, 'Other', -1],
      ['Softdrinks', 20, 'Drinks', -1],
      ['Tubig', 15, 'Drinks', -1],
    ];
    for (const [name, price, category, stock] of sampleItems) {
      database.runSync(
        'INSERT INTO menu_items (name, price, category, stock) VALUES (?, ?, ?, ?)',
        [name, price, category, stock]
      );
    }
  }
}

// ── Categories ────────────────────────────────────────────────────────────────

export function getCategories() {
  return getDatabase().getAllSync(
    'SELECT * FROM categories ORDER BY sort_order, name'
  );
}

export function addCategory(name, color) {
  return getDatabase().runSync(
    `INSERT INTO categories (name, color, sort_order)
     VALUES (?, ?, (SELECT COALESCE(MAX(sort_order) + 1, 0) FROM categories))`,
    [name, color]
  );
}

export function updateCategory(id, name, color) {
  return getDatabase().runSync(
    'UPDATE categories SET name = ?, color = ? WHERE id = ?',
    [name, color, id]
  );
}

export function deleteCategory(id) {
  const database = getDatabase();
  const cat = database.getFirstSync('SELECT name FROM categories WHERE id = ?', [id]);
  if (!cat) return { success: false, error: 'Category not found.' };

  const usage = database.getFirstSync(
    'SELECT COUNT(*) as c FROM menu_items WHERE category = ?',
    [cat.name]
  );
  if (usage.c > 0) {
    return {
      success: false,
      error: `Cannot delete: ${usage.c} product(s) use this category.`,
    };
  }

  database.runSync('DELETE FROM categories WHERE id = ?', [id]);
  return { success: true };
}

// ── Menu Items ────────────────────────────────────────────────────────────────

export function getAllMenuItems() {
  // stock = -1 means unlimited, stock > 0 means in stock, stock = 0 means sold out (hidden from order screen)
  return getDatabase().getAllSync(
    'SELECT * FROM menu_items WHERE is_available = 1 AND stock != 0 ORDER BY category, name'
  );
}

export function getAllMenuItemsAdmin() {
  return getDatabase().getAllSync(
    'SELECT * FROM menu_items ORDER BY category, name'
  );
}

export function addMenuItem(name, price, category, stock = -1) {
  return getDatabase().runSync(
    'INSERT INTO menu_items (name, price, category, stock) VALUES (?, ?, ?, ?)',
    [name, price, category, stock]
  );
}

export function updateMenuItem(id, name, price, category, isAvailable, stock = -1) {
  return getDatabase().runSync(
    'UPDATE menu_items SET name=?, price=?, category=?, is_available=?, stock=? WHERE id=?',
    [name, price, category, isAvailable ? 1 : 0, stock, id]
  );
}

export function deleteMenuItem(id) {
  return getDatabase().runSync('DELETE FROM menu_items WHERE id=?', [id]);
}

export function restockItem(id, amount) {
  return getDatabase().runSync(
    "UPDATE menu_items SET stock = stock + ?, last_restocked_at = datetime('now', 'localtime') WHERE id = ? AND stock >= 0",
    [amount, id]
  );
}

export function touchRestockedAt(id) {
  return getDatabase().runSync(
    "UPDATE menu_items SET last_restocked_at = datetime('now', 'localtime') WHERE id = ?",
    [id]
  );
}

export function setUnlimitedStock(id) {
  return getDatabase().runSync(
    'UPDATE menu_items SET stock = -1 WHERE id = ?',
    [id]
  );
}

// ── Orders ────────────────────────────────────────────────────────────────────

export function saveOrder(items, subtotal, discountAmount, discountLabel, totalAmount, amountTendered, tableName = '', note = '') {
  const database = getDatabase();
  const change = amountTendered - totalAmount;

  const result = database.runSync(
    `INSERT INTO orders
      (subtotal, discount_amount, discount_label, total_amount, amount_tendered, change_amount, table_name, note, status)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'completed')`,
    [subtotal, discountAmount, discountLabel, totalAmount, amountTendered, change, tableName, note]
  );

  const orderId = result.lastInsertRowId;

  for (const item of items) {
    database.runSync(
      'INSERT INTO order_items (order_id, menu_item_id, menu_item_name, price, quantity) VALUES (?, ?, ?, ?, ?)',
      [orderId, item.id, item.name, item.price, item.quantity]
    );
    if (item.stock >= 0) {
      database.runSync(
        `UPDATE menu_items SET
          stock = MAX(0, stock - ?),
          is_available = CASE WHEN stock - ? <= 0 THEN 0 ELSE is_available END
        WHERE id = ?`,
        [item.quantity, item.quantity, item.id]
      );
    }
  }

  return orderId;
}

export function voidOrder(orderId) {
  const database = getDatabase();
  const order = database.getFirstSync('SELECT * FROM orders WHERE id = ?', [orderId]);
  if (!order || order.status === 'voided') return false;

  const items = database.getAllSync(
    'SELECT * FROM order_items WHERE order_id = ?', [orderId]
  );

  for (const item of items) {
    if (item.menu_item_id) {
      database.runSync(
        `UPDATE menu_items SET
          stock = CASE WHEN stock >= 0 THEN stock + ? ELSE stock END,
          is_available = CASE WHEN stock >= 0 AND stock + ? > 0 THEN 1 ELSE is_available END
        WHERE id = ?`,
        [item.quantity, item.quantity, item.menu_item_id]
      );
    }
  }

  database.runSync('UPDATE orders SET status = "voided" WHERE id = ?', [orderId]);
  return true;
}

export function getOrderItems(orderId) {
  return getDatabase().getAllSync(
    'SELECT * FROM order_items WHERE order_id = ?',
    [orderId]
  );
}

// ── Purchases ─────────────────────────────────────────────────────────────────

export function savePurchase(supplier, note, items) {
  const database = getDatabase();
  const totalCost = items.reduce((sum, i) => sum + i.quantity * i.unit_cost, 0);

  const result = database.runSync(
    'INSERT INTO purchases (supplier, note, total_cost) VALUES (?, ?, ?)',
    [supplier.trim(), note.trim(), totalCost]
  );
  const purchaseId = result.lastInsertRowId;

  for (const item of items) {
    database.runSync(
      'INSERT INTO purchase_items (purchase_id, menu_item_id, item_name, quantity, unit_cost) VALUES (?, ?, ?, ?, ?)',
      [purchaseId, item.id, item.name, item.quantity, item.unit_cost]
    );
    // Add to stock and mark restock timestamp
    database.runSync(
      `UPDATE menu_items SET
        stock = CASE WHEN stock >= 0 THEN stock + ? ELSE stock END,
        is_available = CASE WHEN stock >= 0 AND stock + ? > 0 THEN 1 ELSE is_available END,
        last_restocked_at = datetime('now', 'localtime')
      WHERE id = ?`,
      [item.quantity, item.quantity, item.id]
    );
  }

  return purchaseId;
}

export function getPurchases() {
  return getDatabase().getAllSync(`
    SELECT p.id, p.supplier, p.note, p.total_cost, p.created_at,
           COUNT(pi.id) as item_count
    FROM purchases p
    LEFT JOIN purchase_items pi ON p.id = pi.purchase_id
    GROUP BY p.id
    ORDER BY p.created_at DESC
  `);
}

export function getPurchaseItems(purchaseId) {
  return getDatabase().getAllSync(
    'SELECT * FROM purchase_items WHERE purchase_id = ?',
    [purchaseId]
  );
}

// ── Summary ───────────────────────────────────────────────────────────────────

export function getSummaryByDate(dateStr) {
  const database = getDatabase();
  const COMPLETED = `(status IS NULL OR status = 'completed')`;

  const totals = database.getFirstSync(`
    SELECT
      COUNT(*) as order_count,
      COALESCE(SUM(total_amount), 0) as total_sales,
      COALESCE(SUM(discount_amount), 0) as total_discount
    FROM orders
    WHERE date(created_at) = ? AND ${COMPLETED}
  `, [dateStr]);

  const bestSellers = database.getAllSync(`
    SELECT
      oi.menu_item_name as name,
      SUM(oi.quantity) as total_qty,
      SUM(oi.quantity * oi.price) as total_sales
    FROM order_items oi
    JOIN orders o ON oi.order_id = o.id
    WHERE date(o.created_at) = ? AND ${COMPLETED}
    GROUP BY oi.menu_item_name
    ORDER BY total_qty DESC
    LIMIT 5
  `, [dateStr]);

  const orders = database.getAllSync(`
    SELECT id, subtotal, discount_amount, discount_label, total_amount,
           amount_tendered, change_amount, table_name, note, status, created_at
    FROM orders
    WHERE date(created_at) = ?
    ORDER BY created_at DESC
  `, [dateStr]);

  return { totals, bestSellers, orders };
}

// ── Settings ──────────────────────────────────────────────────────────────────

export function getSettings() {
  const rows = getDatabase().getAllSync('SELECT key, value FROM settings');
  const obj = {};
  for (const row of rows) obj[row.key] = row.value;
  return obj;
}

export function saveSetting(key, value) {
  return getDatabase().runSync(
    'INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)',
    [key, String(value)]
  );
}

// ── Sync helpers ──────────────────────────────────────────────────────────────

export function getUnsyncedOrders() {
  return getDatabase().getAllSync(
    'SELECT * FROM orders WHERE supabase_id IS NULL ORDER BY created_at ASC'
  );
}

export function getUnsyncedPurchases() {
  return getDatabase().getAllSync(
    'SELECT * FROM purchases WHERE supabase_id IS NULL ORDER BY created_at ASC'
  );
}

export function markOrderSynced(localId, supabaseId) {
  return getDatabase().runSync(
    'UPDATE orders SET supabase_id = ? WHERE id = ?',
    [supabaseId, localId]
  );
}

export function markPurchaseSynced(localId, supabaseId) {
  return getDatabase().runSync(
    'UPDATE purchases SET supabase_id = ? WHERE id = ?',
    [supabaseId, localId]
  );
}

export function getPendingSyncCount() {
  const db = getDatabase();
  const orders = db.getFirstSync(
    'SELECT COUNT(*) as c FROM orders WHERE supabase_id IS NULL'
  )?.c || 0;
  const purchases = db.getFirstSync(
    'SELECT COUNT(*) as c FROM purchases WHERE supabase_id IS NULL'
  )?.c || 0;
  return orders + purchases;
}

// ── Admin helpers ─────────────────────────────────────────────────────────────

export function getAdminStats() {
  const db = getDatabase();
  const DONE = `(status IS NULL OR status = 'completed')`;
  const today = new Date().toISOString().split('T')[0];
  const monthStart = today.substring(0, 7) + '-01';

  const todayTotal = db.getFirstSync(
    `SELECT COALESCE(SUM(total_amount), 0) as v FROM orders WHERE date(created_at) = ? AND ${DONE}`,
    [today]
  )?.v || 0;

  const monthTotal = db.getFirstSync(
    `SELECT COALESCE(SUM(total_amount), 0) as v FROM orders WHERE date(created_at) >= ? AND ${DONE}`,
    [monthStart]
  )?.v || 0;

  const allTotal = db.getFirstSync(
    `SELECT COALESCE(SUM(total_amount), 0) as v FROM orders WHERE ${DONE}`
  )?.v || 0;

  const allOrders = db.getFirstSync(
    `SELECT COUNT(*) as v FROM orders WHERE ${DONE}`
  )?.v || 0;

  const voidedCount = db.getFirstSync(
    `SELECT COUNT(*) as v FROM orders WHERE status = 'voided'`
  )?.v || 0;

  const pendingSync = getPendingSyncCount();

  return { todayTotal, monthTotal, allTotal, allOrders, voidedCount, pendingSync };
}

export function getDailySales(days = 30) {
  return getDatabase().getAllSync(`
    SELECT
      date(created_at) as date,
      COUNT(*) as orders,
      COALESCE(SUM(total_amount), 0) as total
    FROM orders
    WHERE (status IS NULL OR status = 'completed')
      AND created_at >= date('now', '-${days} days')
    GROUP BY date(created_at)
    ORDER BY date DESC
  `);
}

export function getRecentOrdersAdmin(limit = 50) {
  return getDatabase().getAllSync(`
    SELECT id, subtotal, discount_amount, discount_label, total_amount,
           amount_tendered, change_amount, table_name, note, status, created_at, supabase_id
    FROM orders
    ORDER BY created_at DESC
    LIMIT ?
  `, [limit]);
}
