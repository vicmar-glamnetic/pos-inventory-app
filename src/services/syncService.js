import NetInfo from '@react-native-community/netinfo';
import { supabase, isSupabaseConfigured } from '../config/supabase';
import {
  getUnsyncedOrders,
  getUnsyncedPurchases,
  getOrderItems,
  getPurchaseItems,
  markOrderSynced,
  markPurchaseSynced,
} from '../database/db';

let _unsubscribe = null;
let _isSyncing = false;
let _onSyncChange = null; // callback(pendingCount) for UI updates

export function startSync(onSyncChange) {
  if (!isSupabaseConfigured) return;
  _onSyncChange = onSyncChange || null;

  // Sync immediately on start
  syncPending();

  // Re-sync whenever connectivity is restored
  _unsubscribe = NetInfo.addEventListener((state) => {
    if (state.isConnected && state.isInternetReachable !== false) {
      syncPending();
    }
  });
}

export function stopSync() {
  if (_unsubscribe) {
    _unsubscribe();
    _unsubscribe = null;
  }
}

export async function syncPending() {
  if (!isSupabaseConfigured || _isSyncing) return;
  _isSyncing = true;

  try {
    await syncOrders();
    await syncPurchases();
  } catch (e) {
    // Silent fail — will retry next time connectivity fires
  } finally {
    _isSyncing = false;
    // Notify UI of updated pending count
    if (_onSyncChange) {
      const { getPendingSyncCount } = require('../database/db');
      _onSyncChange(getPendingSyncCount());
    }
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
          items.map((i) => ({
            order_id: data.id,
            menu_item_name: i.menu_item_name,
            price: i.price,
            quantity: i.quantity,
          }))
        );
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
          items.map((i) => ({
            purchase_id: data.id,
            item_name: i.item_name,
            quantity: i.quantity,
            unit_cost: i.unit_cost,
          }))
        );
      }
      markPurchaseSynced(purchase.id, data.id);
    }
  }
}
