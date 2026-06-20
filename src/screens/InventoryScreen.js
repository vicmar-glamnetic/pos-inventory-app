import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  TextInput,
  StyleSheet,
  Alert,
  Modal,
  Platform,
  KeyboardAvoidingView,
  ScrollView,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import {
  getAllMenuItemsAdmin,
  savePurchase,
  getPurchases,
  getPurchaseItems,
} from '../database/db';
import { pushStockRequest } from '../services/syncService';
import { supabase } from '../config/supabase';
import { formatPeso } from '../utils/formatCurrency';

const LOW_STOCK_THRESHOLD = 5;

// ── Edit Stock Modal ──────────────────────────────────────────────────────────

function EditStockModal({ visible, item, onSave, onClose }) {
  const [newStock, setNewStock] = useState('');

  React.useEffect(() => {
    if (visible && item) setNewStock(item.stock < 0 ? '' : String(item.stock));
  }, [visible, item]);

  if (!item) return null;

  const isUnlimited = item.stock < 0;
  const current = isUnlimited ? '∞' : item.stock;
  const newNum = parseInt(newStock, 10);
  const delta = !isNaN(newNum) && !isUnlimited ? newNum - item.stock : null;

  function handleUpdate() {
    if (newStock === '' || isNaN(newNum) || newNum < 0) {
      Alert.alert('Invalid', 'Enter a valid stock number (0 or more).');
      return;
    }
    onSave(item, newNum, false);
    onClose();
  }

  function handleSetUnlimited() {
    onSave(item, -1, true);
    onClose();
  }

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <KeyboardAvoidingView style={esStyles.overlay} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <View style={esStyles.card}>
          <View style={esStyles.header}>
            <Text style={esStyles.title}>Edit Stock</Text>
            <TouchableOpacity onPress={onClose}><Ionicons name="close" size={22} color="#666" /></TouchableOpacity>
          </View>

          <Text style={esStyles.itemName} numberOfLines={1}>{item.name}</Text>

          <View style={esStyles.stockCards}>
            <View style={esStyles.stockCard}>
              <Text style={esStyles.cardLabel}>Current</Text>
              <Text style={esStyles.cardValue}>{current}</Text>
            </View>
            <Ionicons name="arrow-forward" size={20} color="#ccc" />
            <View style={[esStyles.stockCard, esStyles.stockCardNew]}>
              <Text style={esStyles.cardLabel}>New</Text>
              <Text style={[esStyles.cardValue, { color: '#e8521a' }]}>{newStock === '' ? '–' : newNum}</Text>
            </View>
          </View>

          {delta !== null && (
            <Text style={[esStyles.delta, delta > 0 ? esStyles.deltaPos : delta < 0 ? esStyles.deltaNeg : esStyles.deltaZero]}>
              {delta > 0 ? `+${delta} will be added` : delta < 0 ? `${Math.abs(delta)} will be removed` : 'No change'}
            </Text>
          )}

          <TextInput
            style={esStyles.input}
            value={newStock}
            onChangeText={v => setNewStock(v.replace(/[^0-9]/g, ''))}
            keyboardType="number-pad"
            placeholder="Enter new stock"
            placeholderTextColor="#bbb"
            autoFocus
          />

          <View style={esStyles.actions}>
            <TouchableOpacity style={esStyles.cancelBtn} onPress={onClose}>
              <Text style={esStyles.cancelText}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity style={esStyles.updateBtn} onPress={handleUpdate}>
              <Text style={esStyles.updateText}>Update Stock</Text>
            </TouchableOpacity>
          </View>

          <TouchableOpacity style={esStyles.unlimitedBtn} onPress={handleSetUnlimited}>
            <Ionicons name="infinite-outline" size={18} color="#666" />
            <Text style={esStyles.unlimitedText}>Set as Unlimited (∞)</Text>
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const esStyles = StyleSheet.create({
  overlay:      { flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', alignItems: 'center', justifyContent: 'center' },
  card:         { backgroundColor: '#fff', borderRadius: 16, padding: 20, width: 320, shadowColor: '#000', shadowOpacity: 0.15, shadowRadius: 12, elevation: 8 },
  header:       { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
  title:        { fontSize: 16, fontWeight: '700', color: '#222' },
  itemName:     { fontSize: 13, color: '#666', marginBottom: 16 },
  stockCards:   { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 12, marginBottom: 8 },
  stockCard:    { flex: 1, backgroundColor: '#f5f5f5', borderRadius: 10, padding: 12, alignItems: 'center' },
  stockCardNew: { backgroundColor: '#fff8f5', borderWidth: 1.5, borderColor: '#e8521a' },
  cardLabel:    { fontSize: 11, color: '#999', fontWeight: '600', textTransform: 'uppercase', marginBottom: 4 },
  cardValue:    { fontSize: 26, fontWeight: '800', color: '#333' },
  delta:        { textAlign: 'center', fontSize: 13, fontWeight: '600', marginBottom: 12 },
  deltaPos:     { color: '#3a7d44' },
  deltaNeg:     { color: '#c62828' },
  deltaZero:    { color: '#aaa' },
  input:        { borderWidth: 1.5, borderColor: '#e8521a', borderRadius: 10, paddingHorizontal: 14, paddingVertical: 12, fontSize: 20, fontWeight: '700', textAlign: 'center', marginBottom: 14, color: '#222' },
  actions:      { flexDirection: 'row', gap: 8, marginBottom: 10 },
  cancelBtn:    { flex: 1, paddingVertical: 12, borderRadius: 10, borderWidth: 1.5, borderColor: '#ddd', alignItems: 'center' },
  cancelText:   { color: '#666', fontWeight: '600', fontSize: 14 },
  updateBtn:    { flex: 1, paddingVertical: 12, borderRadius: 10, backgroundColor: '#e8521a', alignItems: 'center' },
  updateText:   { color: '#fff', fontWeight: '700', fontSize: 14 },
  unlimitedBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: 10, borderRadius: 10, backgroundColor: '#f5f5f5' },
  unlimitedText:{ fontSize: 13, color: '#666', fontWeight: '600' },
});

// ── Log Purchase Modal ────────────────────────────────────────────────────────

function LogPurchaseModal({ visible, allItems, onSave, onClose }) {
  const [supplier, setSupplier] = useState('');
  const [note, setNote] = useState('');
  const [quantities, setQuantities] = useState({});  // itemId → qty string
  const [costs, setCosts] = useState({});            // itemId → unit cost string
  const [search, setSearch] = useState('');

  React.useEffect(() => {
    if (visible) { setSupplier(''); setNote(''); setQuantities({}); setCosts({}); setSearch(''); }
  }, [visible]);

  const filtered = allItems.filter((i) =>
    !search || i.name.toLowerCase().includes(search.toLowerCase())
  );

  const selectedItems = allItems.filter((i) => {
    const qty = parseInt(quantities[i.id] || '0', 10);
    return qty > 0;
  });

  const totalCost = selectedItems.reduce((sum, i) => {
    const qty = parseInt(quantities[i.id] || '0', 10);
    const cost = parseFloat(costs[i.id] || '0');
    return sum + qty * cost;
  }, 0);

  function setQty(itemId, val) {
    setQuantities((prev) => ({ ...prev, [itemId]: val }));
  }

  function setCost(itemId, val) {
    setCosts((prev) => ({ ...prev, [itemId]: val }));
  }

  function handleSave() {
    if (selectedItems.length === 0) {
      Alert.alert('No Items', 'Enter a quantity for at least one item.');
      return;
    }
    const items = selectedItems.map((i) => ({
      id: i.id,
      name: i.name,
      quantity: parseInt(quantities[i.id] || '0', 10),
      unit_cost: parseFloat(costs[i.id] || '0'),
    }));
    onSave(supplier, note, items);
  }

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <View style={styles.purchaseModalOverlay}>
          <View style={styles.purchaseModalCard}>
            {/* Header */}
            <View style={styles.purchaseModalHeader}>
              <Text style={styles.purchaseModalTitle}>Log Purchase</Text>
              <TouchableOpacity onPress={onClose}>
                <Ionicons name="close" size={24} color="#666" />
              </TouchableOpacity>
            </View>

            <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
              {/* Supplier & Note */}
              <Text style={styles.fieldLabel}>Supplier (optional)</Text>
              <TextInput style={styles.modalTextInput} value={supplier} onChangeText={setSupplier} placeholder="e.g. Ang Tirahan Grocery" />
              <Text style={styles.fieldLabel}>Note (optional)</Text>
              <TextInput style={styles.modalTextInput} value={note} onChangeText={setNote} placeholder="e.g. Weekly restock" />

              {/* Item search */}
              <View style={styles.purchaseSearchRow}>
                <Ionicons name="search-outline" size={15} color="#aaa" />
                <TextInput style={styles.purchaseSearch} value={search} onChangeText={setSearch} placeholder="Search products..." />
              </View>

              {/* Item list with qty + cost inputs */}
              <Text style={styles.fieldLabel}>Products</Text>
              <View style={styles.purchaseItemHeader}>
                <Text style={[styles.purchaseItemCol, { flex: 1 }]}>Item</Text>
                <Text style={styles.purchaseItemColSm}>Qty</Text>
                <Text style={styles.purchaseItemColSm}>Unit Cost</Text>
              </View>
              {filtered.map((item) => {
                const qty = quantities[item.id] || '';
                const cost = costs[item.id] || '';
                const active = parseInt(qty, 10) > 0;
                return (
                  <View key={item.id} style={[styles.purchaseItemRow, active && styles.purchaseItemRowActive]}>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.purchaseItemName} numberOfLines={1}>{item.name}</Text>
                      <Text style={styles.purchaseItemSub}>{item.category} · {formatPeso(item.price)}</Text>
                    </View>
                    <TextInput
                      style={styles.purchaseQtyInput}
                      value={qty}
                      onChangeText={(v) => setQty(item.id, v)}
                      keyboardType="number-pad"
                      placeholder="0"
                    />
                    <TextInput
                      style={styles.purchaseCostInput}
                      value={cost}
                      onChangeText={(v) => setCost(item.id, v)}
                      keyboardType="decimal-pad"
                      placeholder="0.00"
                    />
                  </View>
                );
              })}
              <View style={{ height: 16 }} />
            </ScrollView>

            {/* Footer */}
            <View style={styles.purchaseFooter}>
              <View>
                <Text style={styles.purchaseTotalLabel}>Total Cost</Text>
                <Text style={styles.purchaseTotalValue}>{formatPeso(totalCost)}</Text>
                <Text style={styles.purchaseItemCount}>{selectedItems.length} item(s)</Text>
              </View>
              <TouchableOpacity style={styles.purchaseSaveBtn} onPress={handleSave}>
                <Ionicons name="save-outline" size={18} color="#fff" />
                <Text style={styles.purchaseSaveBtnText}>Save Purchase</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

// ── Purchase Detail Modal ─────────────────────────────────────────────────────

function PurchaseDetailModal({ visible, purchase, items, onClose }) {
  if (!purchase) return null;
  const date = new Date(purchase.created_at);
  const dateStr = date.toLocaleDateString('en-PH', { month: 'short', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit' });

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.purchaseModalOverlay}>
        <View style={[styles.purchaseModalCard, { maxHeight: '70%' }]}>
          <View style={styles.purchaseModalHeader}>
            <View>
              <Text style={styles.purchaseModalTitle}>Purchase #{purchase.id}</Text>
              <Text style={styles.modalSub}>{dateStr}</Text>
            </View>
            <TouchableOpacity onPress={onClose}><Ionicons name="close" size={24} color="#666" /></TouchableOpacity>
          </View>
          {!!purchase.supplier && <Text style={styles.purchaseDetailMeta}>Supplier: {purchase.supplier}</Text>}
          {!!purchase.note && <Text style={styles.purchaseDetailMeta}>Note: {purchase.note}</Text>}
          <ScrollView style={{ marginTop: 8 }}>
            <View style={styles.purchaseItemHeader}>
              <Text style={[styles.purchaseItemCol, { flex: 1 }]}>Item</Text>
              <Text style={styles.purchaseItemColSm}>Qty</Text>
              <Text style={styles.purchaseItemColSm}>Unit</Text>
              <Text style={styles.purchaseItemColSm}>Total</Text>
            </View>
            {items.map((item, idx) => (
              <View key={idx} style={styles.purchaseItemRow}>
                <Text style={[styles.purchaseItemName, { flex: 1 }]} numberOfLines={1}>{item.item_name}</Text>
                <Text style={styles.purchaseItemColSm}>{item.quantity}</Text>
                <Text style={styles.purchaseItemColSm}>{formatPeso(item.unit_cost)}</Text>
                <Text style={styles.purchaseItemColSm}>{formatPeso(item.quantity * item.unit_cost)}</Text>
              </View>
            ))}
          </ScrollView>
          <View style={[styles.purchaseFooter, { borderTopWidth: 1, borderTopColor: '#eee', paddingTop: 12 }]}>
            <Text style={styles.purchaseTotalLabel}>Total Cost</Text>
            <Text style={styles.purchaseTotalValue}>{formatPeso(purchase.total_cost)}</Text>
          </View>
        </View>
      </View>
    </Modal>
  );
}

// ── Main Screen ───────────────────────────────────────────────────────────────

export default function InventoryScreen() {
  const [view, setView] = useState('stock'); // 'stock' | 'purchases'
  const [items, setItems] = useState([]);
  const [purchases, setPurchases] = useState([]);
  const [search, setSearch] = useState('');
  const [stockFilter, setStockFilter] = useState('all');
  const [editStockTarget, setEditStockTarget] = useState(null);
  const [logPurchaseVisible, setLogPurchaseVisible] = useState(false);
  const [detailPurchase, setDetailPurchase] = useState(null);
  const [detailItems, setDetailItems] = useState([]);
  const [pendingMap, setPendingMap] = useState({}); // item.name → requested stock

  useFocusEffect(useCallback(() => {
    reload();
    loadPendingRequests();
  }, []));

  function reload() {
    setItems(getAllMenuItemsAdmin());
    setPurchases(getPurchases());
  }

  async function loadPendingRequests() {
    const { data } = await supabase
      .from('stock_requests')
      .select('item_name, stock')
      .eq('source', 'app')
      .eq('status', 'pending');
    const map = {};
    for (const r of (data || [])) map[r.item_name] = r.stock;
    setPendingMap(map);
  }

  // ── Stock helpers ─────────────────────────────────────────────────────────

  const stockFiltered = items.filter((i) => {
    if (search && !i.name.toLowerCase().includes(search.toLowerCase())) return false;
    if (stockFilter === 'low') return i.stock > 0 && i.stock < LOW_STOCK_THRESHOLD;
    if (stockFilter === 'out') return i.stock === 0;
    return true;
  });

  const outCount = items.filter((i) => i.stock === 0).length;
  const lowCount = items.filter((i) => i.stock > 0 && i.stock < LOW_STOCK_THRESHOLD).length;

  async function handleEditStockSave(item, newStock, isUnlimited) {
    const requestedStock = isUnlimited ? -1 : newStock;
    const ok = await pushStockRequest(item.name, requestedStock);
    if (ok) {
      setPendingMap(prev => ({ ...prev, [item.name]: requestedStock }));
      Alert.alert(
        'Request Sent',
        `Stock change request for "${item.name}" has been sent to the web admin for approval.`
      );
    } else {
      Alert.alert('Error', 'Could not send request. Check your internet connection.');
    }
  }

  // ── Purchase helpers ──────────────────────────────────────────────────────

  function handleSavePurchase(supplier, note, purchaseItems) {
    savePurchase(supplier, note, purchaseItems);
    setLogPurchaseVisible(false);
    reload();
    Alert.alert('Saved', `Purchase recorded. ${purchaseItems.length} product(s) restocked.`);
  }

  function openPurchaseDetail(purchase) {
    setDetailPurchase(purchase);
    setDetailItems(getPurchaseItems(purchase.id));
  }

  // ── UI helpers ────────────────────────────────────────────────────────────

  function stockColor(item) {
    if (item.stock < 0) return '#aaa';
    if (item.stock === 0) return '#c62828';
    if (item.stock < LOW_STOCK_THRESHOLD) return '#e65100';
    return '#3a7d44';
  }

  function formatPurchaseDate(str) {
    return new Date(str).toLocaleDateString('en-PH', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
  }

  function formatRestockedAt(str) {
    return new Date(str).toLocaleDateString('en-PH', { month: 'short', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit' });
  }

  return (
    <View style={styles.root}>
      {/* View switcher */}
      <View style={styles.viewSwitcher}>
        <TouchableOpacity
          style={[styles.switchTab, view === 'stock' && styles.switchTabActive]}
          onPress={() => setView('stock')}
        >
          <Ionicons name="cube-outline" size={15} color={view === 'stock' ? '#e8521a' : '#999'} />
          <Text style={[styles.switchTabText, view === 'stock' && styles.switchTabTextActive]}>Stock</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.switchTab, view === 'purchases' && styles.switchTabActive]}
          onPress={() => setView('purchases')}
        >
          <Ionicons name="cart-outline" size={15} color={view === 'purchases' ? '#e8521a' : '#999'} />
          <Text style={[styles.switchTabText, view === 'purchases' && styles.switchTabTextActive]}>Purchases</Text>
        </TouchableOpacity>
      </View>

      {/* ── STOCK VIEW ─────────────────────────────────────────────────── */}
      {view === 'stock' && (
        <>
          <View style={styles.statsBar}>
            {[
              { key: 'all', label: `All (${items.length})`, color: null },
              { key: 'low', label: `Low (${lowCount})`, color: '#e65100' },
              { key: 'out', label: `Out (${outCount})`, color: '#c62828' },
            ].map(({ key, label, color }) => (
              <TouchableOpacity
                key={key}
                style={[styles.filterChip, stockFilter === key && styles.filterChipActive, color && { borderColor: color }]}
                onPress={() => setStockFilter(key)}
              >
                <Text style={[styles.filterChipText, stockFilter === key && styles.filterChipTextActive, color && stockFilter !== key && { color }]}>
                  {label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          <View style={styles.searchWrap}>
            <Ionicons name="search-outline" size={15} color="#aaa" style={{ marginRight: 6 }} />
            <TextInput style={styles.searchInput} placeholder="Search..." value={search} onChangeText={setSearch} />
          </View>

          <FlatList
            data={stockFiltered}
            keyExtractor={(item) => String(item.id)}
            contentContainerStyle={styles.list}
            renderItem={({ item }) => {
              const hasPending = pendingMap[item.name] != null;
              const pendingStock = pendingMap[item.name];
              return (
              <View style={[styles.stockRow, item.stock === 0 && !hasPending && styles.stockRowOut, hasPending && styles.stockRowPending]}>
                <View style={styles.stockCircle}>
                  <Text style={[styles.stockNum, { color: stockColor(item) }]}>
                    {item.stock < 0 ? '∞' : String(item.stock)}
                  </Text>
                  <Text style={styles.stockUnit}>{item.stock < 0 ? 'unlim' : 'left'}</Text>
                </View>
                <View style={styles.info}>
                  <Text style={styles.itemName}>{item.name}</Text>
                  <Text style={styles.itemMeta}>
                    {item.category}  ·  {formatPeso(item.price)}
                    {item.stock === 0 && !hasPending ? <Text style={styles.tagOut}>  SOLD OUT</Text>
                      : item.stock > 0 && item.stock < LOW_STOCK_THRESHOLD
                      ? <Text style={styles.tagLow}>  LOW</Text> : null}
                  </Text>
                  {hasPending && (
                    <Text style={styles.tagPending}>
                      Pending approval: {pendingStock === -1 ? '∞' : pendingStock} requested
                    </Text>
                  )}
                  {!!item.last_restocked_at && (
                    <Text style={styles.restockedAt}>
                      Restocked {formatRestockedAt(item.last_restocked_at)}
                    </Text>
                  )}
                </View>
                <TouchableOpacity style={styles.editBtn} onPress={() => setEditStockTarget(item)}>
                  <Ionicons name="pencil-outline" size={18} color="#e8521a" />
                </TouchableOpacity>
              </View>
              );
            }}
            ListEmptyComponent={
              <Text style={styles.empty}>
                {stockFilter === 'low' ? 'No low stock items.' : stockFilter === 'out' ? 'No sold out items.' : 'No items found.'}
              </Text>
            }
          />
        </>
      )}

      {/* ── PURCHASES VIEW ─────────────────────────────────────────────── */}
      {view === 'purchases' && (
        <>
          <TouchableOpacity style={styles.logPurchaseBtn} onPress={() => setLogPurchaseVisible(true)}>
            <Ionicons name="add-circle-outline" size={20} color="#fff" />
            <Text style={styles.logPurchaseBtnText}>Log Purchase</Text>
          </TouchableOpacity>

          <FlatList
            data={purchases}
            keyExtractor={(p) => String(p.id)}
            contentContainerStyle={styles.list}
            renderItem={({ item: p }) => (
              <TouchableOpacity style={styles.purchaseRow} onPress={() => openPurchaseDetail(p)} activeOpacity={0.75}>
                <View style={styles.purchaseRowLeft}>
                  <Text style={styles.purchaseRowTitle}>
                    {p.supplier || 'Purchase'} #{p.id}
                  </Text>
                  <Text style={styles.purchaseRowMeta}>
                    {formatPurchaseDate(p.created_at)}  ·  {p.item_count} item(s)
                  </Text>
                  {!!p.note && <Text style={styles.purchaseRowNote}>{p.note}</Text>}
                </View>
                <View style={styles.purchaseRowRight}>
                  <Text style={styles.purchaseRowCost}>{formatPeso(p.total_cost)}</Text>
                  <Ionicons name="chevron-forward" size={14} color="#ccc" />
                </View>
              </TouchableOpacity>
            )}
            ListEmptyComponent={
              <View style={styles.emptyPurchase}>
                <Ionicons name="cart-outline" size={48} color="#ddd" />
                <Text style={styles.empty}>No purchases recorded yet.</Text>
                <Text style={styles.emptySub}>Tap "Log Purchase" to record a supplier restock.</Text>
              </View>
            }
          />
        </>
      )}

      {/* Modals */}
      <EditStockModal
        visible={!!editStockTarget}
        item={editStockTarget}
        onSave={handleEditStockSave}
        onClose={() => setEditStockTarget(null)}
      />
      <LogPurchaseModal
        visible={logPurchaseVisible}
        allItems={items}
        onSave={handleSavePurchase}
        onClose={() => setLogPurchaseVisible(false)}
      />
      <PurchaseDetailModal
        visible={!!detailPurchase}
        purchase={detailPurchase}
        items={detailItems}
        onClose={() => setDetailPurchase(null)}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#f4f4f4' },

  // View switcher
  viewSwitcher: {
    flexDirection: 'row',
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  switchTab: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 5,
    paddingVertical: 12,
    borderBottomWidth: 2,
    borderBottomColor: 'transparent',
  },
  switchTabActive: { borderBottomColor: '#e8521a' },
  switchTabText: { fontSize: 14, color: '#999', fontWeight: '600' },
  switchTabTextActive: { color: '#e8521a' },

  // Stock view
  statsBar: {
    flexDirection: 'row',
    gap: 8,
    padding: 12,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  filterChip: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    backgroundColor: '#f0f0f0',
    borderWidth: 1,
    borderColor: '#e8e8e8',
  },
  filterChipActive: { backgroundColor: '#e8521a', borderColor: '#e8521a' },
  filterChipText: { fontSize: 13, color: '#555', fontWeight: '600' },
  filterChipTextActive: { color: '#fff' },
  searchWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    marginHorizontal: 12,
    marginTop: 10,
    marginBottom: 2,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderWidth: 1,
    borderColor: '#e8e8e8',
  },
  searchInput: { flex: 1, fontSize: 14, color: '#333' },
  list: { padding: 12, gap: 8 },
  stockRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 3,
    elevation: 2,
  },
  stockRowOut: { borderLeftWidth: 4, borderLeftColor: '#ef5350' },
  stockRowPending: { borderLeftWidth: 4, borderLeftColor: '#f59e0b' },
  stockCircle: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: '#f5f5f5',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  stockNum: { fontSize: 18, fontWeight: '700' },
  stockUnit: { fontSize: 9, color: '#aaa', marginTop: -2 },
  info: { flex: 1 },
  itemName: { fontSize: 15, fontWeight: '600', color: '#222' },
  itemMeta: { fontSize: 12, color: '#999', marginTop: 3 },
  tagOut: { color: '#c62828', fontWeight: '700' },
  tagLow: { color: '#e65100', fontWeight: '700' },
  tagPending: { fontSize: 11, color: '#d97706', fontWeight: '700', marginTop: 2 },
  restockedAt: { fontSize: 11, color: '#aaa', marginTop: 2 },
  editBtn: {
    padding: 8,
    borderRadius: 8,
    backgroundColor: '#fff8f5',
    borderWidth: 1,
    borderColor: '#f0ddd5',
  },

  // Purchases view
  logPurchaseBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: '#e8521a',
    margin: 12,
    borderRadius: 12,
    paddingVertical: 13,
  },
  logPurchaseBtnText: { color: '#fff', fontWeight: '700', fontSize: 15 },
  purchaseRow: {
    flexDirection: 'row',
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 14,
    marginBottom: 8,
    justifyContent: 'space-between',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  purchaseRowLeft: { flex: 1 },
  purchaseRowTitle: { fontSize: 14, fontWeight: '600', color: '#222' },
  purchaseRowMeta: { fontSize: 12, color: '#999', marginTop: 2 },
  purchaseRowNote: { fontSize: 12, color: '#888', fontStyle: 'italic', marginTop: 1 },
  purchaseRowRight: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  purchaseRowCost: { fontSize: 16, fontWeight: '700', color: '#1a6fb5' },
  emptyPurchase: { alignItems: 'center', marginTop: 40, paddingHorizontal: 32 },
  empty: { textAlign: 'center', color: '#bbb', marginTop: 12, fontSize: 14 },
  emptySub: { textAlign: 'center', color: '#ccc', marginTop: 4, fontSize: 12 },

  // Restock modal
  centeredOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.4)',
    justifyContent: 'center',
    paddingHorizontal: 24,
  },
  modalCard: { backgroundColor: '#fff', borderRadius: 16, padding: 24 },
  modalTitle: { fontSize: 17, fontWeight: '700', color: '#222', marginBottom: 4 },
  modalSub: { fontSize: 13, color: '#999', marginBottom: 16 },
  fieldLabel: { fontSize: 13, color: '#666', fontWeight: '600', marginBottom: 6, marginTop: 2 },
  modalInput: {
    borderWidth: 1.5, borderColor: '#ddd', borderRadius: 8,
    paddingHorizontal: 12, paddingVertical: 10, fontSize: 18,
    backgroundColor: '#fafafa', marginBottom: 12,
  },
  quickRow: { flexDirection: 'row', gap: 8, marginBottom: 16 },
  quickBtn: {
    flex: 1, backgroundColor: '#e8f4fd', borderRadius: 8,
    paddingVertical: 8, alignItems: 'center', borderWidth: 1, borderColor: '#90caf9',
  },
  quickBtnText: { color: '#1a6fb5', fontWeight: '700', fontSize: 14 },
  modalActions: { flexDirection: 'row', gap: 10 },
  modalCancelBtn: {
    flex: 1, borderWidth: 1.5, borderColor: '#ccc',
    borderRadius: 10, paddingVertical: 12, alignItems: 'center',
  },
  modalCancelText: { color: '#666', fontWeight: '600', fontSize: 15 },
  modalConfirmBtn: {
    flex: 1, backgroundColor: '#e8521a',
    borderRadius: 10, paddingVertical: 12, alignItems: 'center',
  },
  modalConfirmText: { color: '#fff', fontWeight: '700', fontSize: 15 },

  // Log purchase modal
  purchaseModalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  purchaseModalCard: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: '92%',
    paddingBottom: Platform.OS === 'ios' ? 32 : 16,
  },
  purchaseModalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  purchaseModalTitle: { fontSize: 18, fontWeight: '700', color: '#222' },
  purchaseDetailMeta: { fontSize: 13, color: '#888', paddingHorizontal: 20, marginTop: 2 },
  modalTextInput: {
    borderWidth: 1.5, borderColor: '#ddd', borderRadius: 8,
    paddingHorizontal: 12, paddingVertical: 9, fontSize: 15,
    backgroundColor: '#fafafa', marginBottom: 10, marginHorizontal: 20,
  },
  purchaseSearchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f5f5f5',
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 7,
    marginHorizontal: 20,
    marginBottom: 6,
    gap: 4,
  },
  purchaseSearch: { flex: 1, fontSize: 14, color: '#333' },
  purchaseItemHeader: {
    flexDirection: 'row',
    paddingHorizontal: 20,
    paddingVertical: 6,
    backgroundColor: '#f5f5f5',
    marginTop: 4,
  },
  purchaseItemCol: { fontSize: 11, fontWeight: '700', color: '#999', textTransform: 'uppercase' },
  purchaseItemColSm: { fontSize: 11, fontWeight: '700', color: '#999', width: 70, textAlign: 'center', textTransform: 'uppercase' },
  purchaseItemRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#f5f5f5',
  },
  purchaseItemRowActive: { backgroundColor: '#fff8f5' },
  purchaseItemName: { fontSize: 14, fontWeight: '500', color: '#222' },
  purchaseItemSub: { fontSize: 11, color: '#aaa', marginTop: 1 },
  purchaseQtyInput: {
    width: 60, borderWidth: 1.5, borderColor: '#ddd', borderRadius: 6,
    paddingHorizontal: 6, paddingVertical: 6, fontSize: 14,
    textAlign: 'center', backgroundColor: '#fafafa', marginHorizontal: 5,
  },
  purchaseCostInput: {
    width: 70, borderWidth: 1.5, borderColor: '#ddd', borderRadius: 6,
    paddingHorizontal: 6, paddingVertical: 6, fontSize: 14,
    textAlign: 'center', backgroundColor: '#fafafa',
  },
  purchaseFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 14,
    borderTopWidth: 1,
    borderTopColor: '#eee',
    backgroundColor: '#fff',
  },
  purchaseTotalLabel: { fontSize: 12, color: '#999', fontWeight: '600' },
  purchaseTotalValue: { fontSize: 20, fontWeight: '700', color: '#1a6fb5' },
  purchaseItemCount: { fontSize: 11, color: '#aaa', marginTop: 1 },
  purchaseSaveBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#e8521a',
    borderRadius: 12,
    paddingHorizontal: 18,
    paddingVertical: 13,
  },
  purchaseSaveBtnText: { color: '#fff', fontWeight: '700', fontSize: 15 },
});
