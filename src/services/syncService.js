import NetInfo from '@react-native-community/netinfo';
import { supabase, isSupabaseConfigured } from '../config/supabase';
import {
  getUnsyncedOrders,
  getUnsyncedPurchases,
  getOrderItems,
  getPurchaseItems,
  markOrderSynced,
  markPurchaseSynced,
  getAllMenuItemsAdmin,
  getDatabase,
} from '../database/db';

let _unsubscribe = null;
let _isSyncing = false;
let _onSyncChange = null;

export function startSync(onSyncChange) {
  if (!isSupabaseConfigured) return;
  _onSyncChange = onSyncChange || null;
  syncPending();
  _unsubscribe = NetInfo.addEventListener((state) => {
    if (state.isConnected) syncPending();
  });
}

export function stopSync() {
  if (_unsubscribe) { _unsubscribe(); _unsubscribe = null; }
}

export async function syncPending() {
  if (!isSupabaseConfigured || _isSyncing) return;
  _isSyncing = true;
  try {
    await syncMenuItems();       // push new items + metadata (no stock for existing)
    await syncOrders();          // push orders + decrement Supabase stock
    await syncPurchases();       // push purchases + increment Supabase stock
    await pullMenuItemUpdates(); // pull final stock from web into local SQLite
  } catch (e) {
    // Silent fail — will retry next connectivity event
  } finally {
    _isSyncing = false;
    if (_onSyncChange) {
      const { getPendingSyncCount } = require('../database/db');
      _onSyncChange(getPendingSyncCount());
    }
  }
}

// Submit a stock change request from the app — web admin must approve before it takes effect
export async function pushStockRequest(itemName, requestedStock) {
  if (!isSupabaseConfigured) return false;
  const { error } = await supabase.from('stock_requests').insert({
    item_name: itemName,
    stock: requestedStock,
    source: 'app',
    status: 'pending',
  });
  return !error;
}

// Pull latest stock values from Supabase (web is authoritative) into local SQLite
async function pullMenuItemUpdates() {
  const { data, error } = await supabase
    .from('menu_items')
    .select('local_id, stock, is_available');

  if (error || !data?.length) return;

  const db = getDatabase();
  for (const row of data) {
    if (row.local_id == null) continue;
    db.runSync(
      'UPDATE menu_items SET stock = ?, is_available = ? WHERE id = ?',
      [row.stock, row.is_available ? 1 : 0, row.local_id]
    );
  }
}

async function syncMenuItems() {
  const items = getAllMenuItemsAdmin();
  const localIds = items.map(i => i.id);

  if (localIds.length === 0) {
    await supabase.from('menu_items').delete().not('local_id', 'is', null);
    return;
  }

  // Remove items deleted from the app
  await supabase.from('menu_items')
    .delete()
    .not('local_id', 'in', `(${localIds.join(',')})`)
    .not('local_id', 'is', null);

  // Find which items are new (not yet in Supabase)
  const { data: existing } = await supabase
    .from('menu_items')
    .select('local_id')
    .in('local_id', localIds);
  const existingIds = new Set((existing || []).map(r => r.local_id));

  // Insert brand-new items with their initial stock
  const newItems = items.filter(i => !existingIds.has(i.id));
  if (newItems.length > 0) {
    await supabase.from('menu_items').insert(newItems.map(i => ({
      local_id: i.id,
      name: i.name,
      price: i.price,
      category: i.category || '',
      stock: i.stock,
      is_available: i.is_available === 1,
      last_restocked_at: i.last_restocked_at || null,
    })));
  }

  // Update metadata only for existing items — web controls stock for these
  const existingItems = items.filter(i => existingIds.has(i.id));
  if (existingItems.length > 0) {
    await Promise.all(existingItems.map(i =>
      supabase.from('menu_items').update({
        name: i.name,
        price: i.price,
        category: i.category || '',
        last_restocked_at: i.last_restocked_at || null,
      }).eq('local_id', i.id)
    ));
  }
}

async function syncOrders() {
  const orders = getUnsyncedOrders();
  for (const order of orders) {
    const { data, error } = await supabase
      .from('orders')
      .insert({
        local_id: order.id,
        total_amount: order.total_amount,
        subtotal: order.subtotal || order.total_amount,
        discount_amount: order.discount_amount || 0,
        discount_label: order.discount_label || '',
        amount_tendered: order.amount_tendered || 0,
        change_amount: order.change_amount || 0,
        table_name: order.table_name || '',
        note: order.note || '',
        status: order.status || 'completed',
        created_at: order.created_at,
      })
      .select()
      .single();

    if (!error && data) {
      const items = getOrderItems(order.id);
      if (items.length > 0) {
        await supabase.from('order_items').insert(
          items.map(i => ({
            order_id: data.id,
            menu_item_name: i.menu_item_name,
            price: i.price,
            quantity: i.quantity,
          }))
        );

        // Decrement Supabase stock per item sold (skip unlimited items)
        for (const item of items) {
          const { data: menuItem } = await supabase
            .from('menu_items')
            .select('stock')
            .eq('name', item.menu_item_name)
            .maybeSingle();
          if (menuItem && menuItem.stock !== -1 && menuItem.stock > 0) {
            await supabase.from('menu_items')
              .update({ stock: Math.max(0, menuItem.stock - item.quantity) })
              .eq('name', item.menu_item_name);
          }
        }
      }
      markOrderSynced(order.id, data.id);
    }
  }
}

async function syncPurchases() {
  const purchases = getUnsyncedPurchases();
  for (const purchase of purchases) {
    const { data, error } = await supabase
      .from('purchases')
      .insert({
        local_id: purchase.id,
        supplier: purchase.supplier || '',
        note: purchase.note || '',
        total_cost: purchase.total_cost || 0,
        created_at: purchase.created_at,
      })
      .select()
      .single();

    if (!error && data) {
      const items = getPurchaseItems(purchase.id);
      if (items.length > 0) {
        await supabase.from('purchase_items').insert(
          items.map(i => ({
            purchase_id: data.id,
            item_name: i.item_name,
            quantity: i.quantity,
            unit_cost: i.unit_cost,
          }))
        );

        // Increment Supabase stock per item purchased (skip unlimited items)
        for (const item of items) {
          if (item.quantity <= 0) continue;
          const { data: menuItem } = await supabase
            .from('menu_items')
            .select('stock')
            .eq('name', item.item_name)
            .maybeSingle();
          if (menuItem && menuItem.stock !== -1) {
            await supabase.from('menu_items')
              .update({ stock: (menuItem.stock || 0) + item.quantity })
              .eq('name', item.item_name);
          }
        }
      }
      markPurchaseSynced(purchase.id, data.id);
    }
  }
}
