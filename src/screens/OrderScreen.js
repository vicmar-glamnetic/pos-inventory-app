import React, { useState, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  TextInput,
  Alert,
  KeyboardAvoidingView,
  Platform,
  useWindowDimensions,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import MenuItemCard from '../components/MenuItemCard';
import ReceiptModal from '../components/ReceiptModal';
import { getAllMenuItems, saveOrder, getOrderItems, getCategories } from '../database/db';
import { formatPeso } from '../utils/formatCurrency';

const DISCOUNT_TYPES = [
  { key: 'none',  label: 'None' },
  { key: 'pwd',   label: '20% PWD/Senior' },
  { key: 'pct',   label: '% Off' },
  { key: 'fixed', label: '₱ Off' },
];

export default function OrderScreen() {
  const { width, height } = useWindowDimensions();
  // Tablet landscape: wider than tall, and wide enough (≥ 700dp)
  const useSplitLayout = width > height && width >= 700;
  const menuCols = useSplitLayout ? 4 : 3;

  const [menuItems, setMenuItems]         = useState([]);
  const [categories, setCategories]       = useState([]);
  const [cart, setCart]                   = useState({});
  const [activeCategory, setActiveCategory] = useState('All');
  const [tendered, setTendered]           = useState('');
  const [note, setNote]                   = useState('');
  const [tableName, setTableName]         = useState('');
  const [discountType, setDiscountType]   = useState('none');
  const [discountValue, setDiscountValue] = useState('');
  const [receiptVisible, setReceiptVisible] = useState(false);
  const [lastOrder, setLastOrder]         = useState(null);
  const [lastOrderItems, setLastOrderItems] = useState([]);

  useFocusEffect(
    useCallback(() => {
      setMenuItems(getAllMenuItems());
      setCategories(getCategories());
    }, [])
  );

  const categoryColorMap = useMemo(() => {
    const map = {};
    for (const c of categories) map[c.name] = c.color;
    return map;
  }, [categories]);

  const filtered =
    activeCategory === 'All'
      ? menuItems
      : menuItems.filter((i) => i.category === activeCategory);

  const cartItems  = Object.values(cart).filter((i) => i.quantity > 0);
  const subtotal   = cartItems.reduce((sum, i) => sum + i.price * i.quantity, 0);

  const discountNum = parseFloat(discountValue) || 0;
  let discountAmount = 0;
  let discountLabel  = '';
  if (discountType === 'pwd') {
    discountAmount = subtotal * 0.20;
    discountLabel  = '20% PWD / Senior';
  } else if (discountType === 'pct' && discountNum > 0) {
    discountAmount = subtotal * (discountNum / 100);
    discountLabel  = `${discountNum}% Discount`;
  } else if (discountType === 'fixed' && discountNum > 0) {
    discountAmount = Math.min(discountNum, subtotal);
    discountLabel  = `₱${discountNum} Off`;
  }
  discountAmount   = Math.round(discountAmount * 100) / 100;
  const total      = Math.max(0, subtotal - discountAmount);
  const tenderedNum = parseFloat(tendered) || 0;
  const change     = tenderedNum - total;

  function addToCart(item) {
    const currentQty = cart[item.id]?.quantity || 0;
    if (item.stock >= 0 && currentQty >= item.stock) {
      Alert.alert('Stock Limit', `Only ${item.stock} serving(s) available for "${item.name}".`);
      return;
    }
    setCart((prev) => {
      const existing = prev[item.id];
      return { ...prev, [item.id]: { ...item, quantity: existing ? existing.quantity + 1 : 1 } };
    });
  }

  function removeFromCart(itemId) {
    setCart((prev) => {
      const existing = prev[itemId];
      if (!existing || existing.quantity <= 1) {
        const next = { ...prev };
        delete next[itemId];
        return next;
      }
      return { ...prev, [itemId]: { ...existing, quantity: existing.quantity - 1 } };
    });
  }

  function clearCart() {
    setCart({});
    setTendered('');
    setNote('');
    setTableName('');
    setDiscountType('none');
    setDiscountValue('');
  }

  function selectDiscount(key) {
    setDiscountType(key);
    if (key !== 'pct' && key !== 'fixed') setDiscountValue('');
  }

  function handleConfirmOrder() {
    if (cartItems.length === 0) {
      Alert.alert('Empty Cart', 'Please add items before placing an order.');
      return;
    }
    if (tenderedNum < total) {
      Alert.alert('Insufficient Payment', `${formatPeso(tenderedNum)} is less than ${formatPeso(total)}.`);
      return;
    }
    const orderId = saveOrder(
      cartItems, subtotal, discountAmount, discountLabel,
      total, tenderedNum, tableName.trim(), note.trim()
    );
    const items = getOrderItems(orderId);
    setLastOrder({
      id: orderId, subtotal, discount_amount: discountAmount, discount_label: discountLabel,
      total_amount: total, amount_tendered: tenderedNum, change_amount: change,
      table_name: tableName.trim(), note: note.trim(), created_at: new Date().toISOString(),
    });
    setLastOrderItems(items);
    setReceiptVisible(true);
    clearCart();
    setMenuItems(getAllMenuItems());
    setCategories(getCategories());
  }

  // ── Category bar (same in both layouts) ─────────────────────────────────────
  const CategoryBar = (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      style={styles.catBar}
      contentContainerStyle={styles.catContent}
    >
      <TouchableOpacity
        style={[styles.catChip, activeCategory === 'All' && styles.catChipActive]}
        onPress={() => setActiveCategory('All')}
      >
        <Text style={[styles.catText, activeCategory === 'All' && styles.catTextActive]}>All</Text>
      </TouchableOpacity>
      {categories.map((cat) => (
        <TouchableOpacity
          key={cat.name}
          style={[styles.catChip, activeCategory === cat.name && { backgroundColor: cat.color }]}
          onPress={() => setActiveCategory(cat.name)}
        >
          <Text style={[styles.catText, activeCategory === cat.name && styles.catTextActive]}>
            {cat.name}
          </Text>
        </TouchableOpacity>
      ))}
    </ScrollView>
  );

  // ── Discount chips (reused in both layouts) ──────────────────────────────────
  const DiscountSection = (
    <View style={styles.discountSection}>
      <Text style={styles.discountSectionLabel}>Discount</Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false}>
        <View style={styles.discountChips}>
          {DISCOUNT_TYPES.map((dt) => (
            <TouchableOpacity
              key={dt.key}
              style={[
                styles.discountChip,
                discountType === dt.key && (dt.key === 'pwd' ? styles.pwdChipActive : styles.discountChipActive),
                dt.key === 'pwd' && discountType !== 'pwd' && styles.pwdChip,
              ]}
              onPress={() => selectDiscount(dt.key)}
            >
              <Text style={[styles.discountChipText, discountType === dt.key && styles.discountChipTextActive]}>
                {dt.label}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      </ScrollView>
      {(discountType === 'pct' || discountType === 'fixed') && (
        <TextInput
          style={styles.discountInput}
          placeholder={discountType === 'pct' ? 'Enter %' : 'Enter ₱ amount'}
          keyboardType="decimal-pad"
          value={discountValue}
          onChangeText={setDiscountValue}
        />
      )}
    </View>
  );

  // ── Totals block ─────────────────────────────────────────────────────────────
  const TotalsBlock = (
    <View style={styles.totalSection}>
      {discountAmount > 0 && (
        <>
          <View style={styles.totalRow}>
            <Text style={styles.totalSubLabel}>Subtotal</Text>
            <Text style={styles.totalSubValue}>{formatPeso(subtotal)}</Text>
          </View>
          <View style={styles.totalRow}>
            <Text style={styles.discountLine}>{discountLabel}</Text>
            <Text style={styles.discountLineValue}>-{formatPeso(discountAmount)}</Text>
          </View>
        </>
      )}
      <View style={styles.totalRow}>
        <Text style={styles.totalLabel}>Total</Text>
        <Text style={styles.totalValue}>{formatPeso(total)}</Text>
      </View>
    </View>
  );

  // ── SPLIT LAYOUT (landscape tablet) ─────────────────────────────────────────
  if (useSplitLayout) {
    const splitCartWidth = Math.min(360, Math.floor(width * 0.36));
    const cartEmpty = cartItems.length === 0;

    return (
      <KeyboardAvoidingView
        style={styles.root}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <View style={styles.splitRoot}>

          {/* ── LEFT: category bar + menu grid ── */}
          <View style={styles.splitLeft}>
            {CategoryBar}
            <FlatList
              data={filtered}
              keyExtractor={(item) => String(item.id)}
              numColumns={menuCols}
              key={`split-${menuCols}`}
              style={styles.grid}
              contentContainerStyle={styles.gridContent}
              renderItem={({ item }) => (
                <MenuItemCard
                  item={item}
                  quantity={cart[item.id]?.quantity || 0}
                  onPress={addToCart}
                  categoryColor={categoryColorMap[item.category]}
                />
              )}
              ListEmptyComponent={<Text style={styles.empty}>No items in this category.</Text>}
            />
          </View>

          {/* ── RIGHT: cart panel ── */}
          <View style={[styles.splitRight, { width: splitCartWidth }]}>

            {/* Cart header */}
            <View style={styles.splitHeader}>
              <Text style={styles.splitHeaderTitle}>Order</Text>
              {!cartEmpty && (
                <View style={styles.splitBadge}>
                  <Text style={styles.splitBadgeText}>{cartItems.length}</Text>
                </View>
              )}
            </View>

            {cartEmpty ? (
              /* Empty state */
              <View style={styles.splitEmpty}>
                <Ionicons name="cart-outline" size={56} color="#e8e8e8" />
                <Text style={styles.splitEmptyTitle}>Cart is empty</Text>
                <Text style={styles.splitEmptySub}>Tap any item to add it</Text>
              </View>
            ) : (
              /* Single ScrollView — no nested scroll */
              <ScrollView
                style={styles.splitScroll}
                contentContainerStyle={styles.splitScrollContent}
                showsVerticalScrollIndicator={false}
                keyboardShouldPersistTaps="handled"
              >
                {/* Table / Customer */}
                <TextInput
                  style={styles.tableInput}
                  placeholder="Table / Customer (optional)"
                  value={tableName}
                  onChangeText={setTableName}
                  placeholderTextColor="#bbb"
                />

                {/* Cart items (no nested ScrollView) */}
                {cartItems.map((item) => (
                  <View key={item.id} style={styles.cartRow}>
                    <TouchableOpacity onPress={() => removeFromCart(item.id)} style={styles.qtyBtn}>
                      <Ionicons name="remove-circle" size={22} color="#e8521a" />
                    </TouchableOpacity>
                    <Text style={styles.cartName} numberOfLines={1}>{item.name}</Text>
                    <Text style={styles.cartQty}>×{item.quantity}</Text>
                    <Text style={styles.cartPrice}>{formatPeso(item.price * item.quantity)}</Text>
                    <TouchableOpacity onPress={() => addToCart(item)} style={styles.qtyBtn}>
                      <Ionicons name="add-circle" size={22} color="#3a7d44" />
                    </TouchableOpacity>
                  </View>
                ))}

                <View style={styles.cartDivider} />

                {DiscountSection}
                {TotalsBlock}

                {/* Payment */}
                <TextInput
                  style={styles.tenderedInput}
                  placeholder="Cash Tendered (₱)"
                  keyboardType="numeric"
                  value={tendered}
                  onChangeText={setTendered}
                />
                {tenderedNum >= total && total > 0 && (
                  <Text style={styles.changeText}>Change: {formatPeso(change)}</Text>
                )}

                {/* Note */}
                <TextInput
                  style={[styles.noteInput, { marginBottom: 0 }]}
                  placeholder="Note (optional)"
                  value={note}
                  onChangeText={setNote}
                />
              </ScrollView>
            )}

            {/* Fixed bottom actions */}
            <View style={styles.splitActions}>
              <TouchableOpacity
                style={[styles.splitClearBtn, cartEmpty && styles.btnDisabled]}
                onPress={clearCart}
                disabled={cartEmpty}
              >
                <Ionicons name="trash-outline" size={18} color="#e8521a" />
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.splitOrderBtn, cartEmpty && styles.btnDisabled]}
                onPress={handleConfirmOrder}
                disabled={cartEmpty}
              >
                <Text style={styles.splitOrderBtnText} numberOfLines={1}>
                  {cartEmpty ? 'Place Order' : `Place Order  ${formatPeso(total)}`}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>

        <ReceiptModal
          visible={receiptVisible}
          order={lastOrder}
          items={lastOrderItems}
          onClose={() => setReceiptVisible(false)}
        />
      </KeyboardAvoidingView>
    );
  }

  // ── PORTRAIT LAYOUT ──────────────────────────────────────────────────────────
  return (
    <KeyboardAvoidingView
      style={styles.root}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      {CategoryBar}

      <FlatList
        data={filtered}
        keyExtractor={(item) => String(item.id)}
        numColumns={3}
        key="portrait-3"
        style={styles.grid}
        contentContainerStyle={styles.gridContent}
        renderItem={({ item }) => (
          <MenuItemCard
            item={item}
            quantity={cart[item.id]?.quantity || 0}
            onPress={addToCart}
            categoryColor={categoryColorMap[item.category]}
          />
        )}
        ListEmptyComponent={<Text style={styles.empty}>No items in this category.</Text>}
      />

      {/* Bottom cart panel — only when cart has items */}
      {cartItems.length > 0 && (
        <View style={styles.cartPanel}>
          <TextInput
            style={styles.tableInput}
            placeholder="Table / Customer (optional)"
            value={tableName}
            onChangeText={setTableName}
            placeholderTextColor="#bbb"
          />

          {/* Cart items with their own scroller */}
          <ScrollView style={styles.cartScroll} showsVerticalScrollIndicator={false}>
            {cartItems.map((item) => (
              <View key={item.id} style={styles.cartRow}>
                <TouchableOpacity onPress={() => removeFromCart(item.id)} style={styles.qtyBtn}>
                  <Ionicons name="remove-circle" size={24} color="#e8521a" />
                </TouchableOpacity>
                <Text style={styles.cartName} numberOfLines={1}>{item.name}</Text>
                <Text style={styles.cartQty}>×{item.quantity}</Text>
                <Text style={styles.cartPrice}>{formatPeso(item.price * item.quantity)}</Text>
                <TouchableOpacity onPress={() => addToCart(item)} style={styles.qtyBtn}>
                  <Ionicons name="add-circle" size={24} color="#3a7d44" />
                </TouchableOpacity>
              </View>
            ))}
          </ScrollView>

          {DiscountSection}
          {TotalsBlock}

          <View style={styles.payRow}>
            <TextInput
              style={styles.tenderedInput}
              placeholder="Cash Tendered (₱)"
              keyboardType="numeric"
              value={tendered}
              onChangeText={setTendered}
            />
            {tenderedNum >= total && total > 0 && (
              <Text style={styles.changeText}>Change: {formatPeso(change)}</Text>
            )}
          </View>

          <TextInput
            style={styles.noteInput}
            placeholder="Note (optional)"
            value={note}
            onChangeText={setNote}
          />

          <View style={styles.actionRow}>
            <TouchableOpacity style={styles.clearBtn} onPress={clearCart}>
              <Ionicons name="trash-outline" size={20} color="#e8521a" />
              <Text style={styles.clearText}>Clear</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.orderBtn} onPress={handleConfirmOrder}>
              <Text style={styles.orderBtnText}>Place Order  {formatPeso(total)}</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}

      <ReceiptModal
        visible={receiptVisible}
        order={lastOrder}
        items={lastOrderItems}
        onClose={() => setReceiptVisible(false)}
      />
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#f4f4f4' },

  // ── Split layout ─────────────────────────────────────────────────────────────
  splitRoot:  { flex: 1, flexDirection: 'row' },
  splitLeft:  { flex: 1 },
  splitRight: {
    backgroundColor: '#fff',
    borderLeftWidth: 1,
    borderLeftColor: '#ddd',
    flexDirection: 'column',
  },
  splitHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 11,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
    gap: 8,
    backgroundColor: '#fafafa',
  },
  splitHeaderTitle: { fontSize: 15, fontWeight: '700', color: '#333' },
  splitBadge: {
    backgroundColor: '#e8521a',
    borderRadius: 10,
    minWidth: 20,
    height: 20,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 5,
  },
  splitBadgeText: { color: '#fff', fontSize: 11, fontWeight: '700' },
  splitScroll: { flex: 1 },
  splitScrollContent: { padding: 12, paddingBottom: 4 },
  splitEmpty: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingBottom: 48,
    gap: 6,
  },
  splitEmptyTitle: { fontSize: 15, color: '#ccc', fontWeight: '600' },
  splitEmptySub:   { fontSize: 12, color: '#ddd' },
  splitActions: {
    flexDirection: 'row',
    gap: 8,
    padding: 10,
    borderTopWidth: 1,
    borderTopColor: '#eee',
    backgroundColor: '#fafafa',
  },
  splitClearBtn: {
    borderWidth: 1.5,
    borderColor: '#e8521a',
    borderRadius: 10,
    paddingVertical: 12,
    paddingHorizontal: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  splitOrderBtn: {
    flex: 1,
    backgroundColor: '#e8521a',
    borderRadius: 10,
    paddingVertical: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  splitOrderBtnText: { color: '#fff', fontWeight: '700', fontSize: 13 },
  btnDisabled: { opacity: 0.35 },

  // ── Category bar ─────────────────────────────────────────────────────────────
  catBar:    { backgroundColor: '#fff', maxHeight: 52, borderBottomWidth: 1, borderBottomColor: '#eee' },
  catContent: { paddingHorizontal: 12, paddingVertical: 10, gap: 8 },
  catChip:   { paddingHorizontal: 16, paddingVertical: 6, borderRadius: 20, backgroundColor: '#f0f0f0' },
  catChipActive: { backgroundColor: '#e8521a' },
  catText:   { fontSize: 14, color: '#666', fontWeight: '500' },
  catTextActive: { color: '#fff', fontWeight: '700' },

  // ── Menu grid ────────────────────────────────────────────────────────────────
  grid:        { flex: 1 },
  gridContent: { padding: 6 },
  empty:       { textAlign: 'center', color: '#aaa', marginTop: 40, fontSize: 15 },

  // ── Portrait cart panel ───────────────────────────────────────────────────────
  cartPanel: {
    backgroundColor: '#fff',
    borderTopWidth: 1,
    borderTopColor: '#ddd',
    paddingHorizontal: 14,
    paddingTop: 8,
    maxHeight: 460,
  },
  cartScroll: { maxHeight: 120 },

  // ── Shared cart body fields ───────────────────────────────────────────────────
  tableInput: {
    borderWidth: 1.5,
    borderColor: '#e0e0e0',
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 6,
    fontSize: 13,
    backgroundColor: '#fafafa',
    marginBottom: 6,
    color: '#444',
  },
  cartRow:   { flexDirection: 'row', alignItems: 'center', paddingVertical: 4 },
  qtyBtn:    { padding: 2 },
  cartName:  { flex: 1, fontSize: 13, color: '#222', marginHorizontal: 5 },
  cartQty:   { fontSize: 13, color: '#666', width: 28, textAlign: 'center' },
  cartPrice: { fontSize: 13, fontWeight: '600', color: '#222', width: 66, textAlign: 'right', marginRight: 4 },
  cartDivider: { height: 1, backgroundColor: '#f0f0f0', marginVertical: 8 },

  // ── Discount ─────────────────────────────────────────────────────────────────
  discountSection:      { borderTopWidth: 1, borderTopColor: '#f0f0f0', paddingTop: 7, marginTop: 4 },
  discountSectionLabel: { fontSize: 11, color: '#999', fontWeight: '700', marginBottom: 5, textTransform: 'uppercase', letterSpacing: 0.5 },
  discountChips:       { flexDirection: 'row', gap: 6, paddingBottom: 4 },
  discountChip:        { paddingHorizontal: 10, paddingVertical: 5, borderRadius: 14, backgroundColor: '#f0f0f0', borderWidth: 1, borderColor: '#e8e8e8' },
  discountChipActive:  { backgroundColor: '#1a6fb5', borderColor: '#1a6fb5' },
  pwdChip:             { backgroundColor: '#fff3e0', borderColor: '#ffb74d' },
  pwdChipActive:       { backgroundColor: '#e65100', borderColor: '#e65100' },
  discountChipText:    { fontSize: 12, color: '#555', fontWeight: '500' },
  discountChipTextActive: { color: '#fff', fontWeight: '700' },
  discountInput: {
    marginTop: 5,
    borderWidth: 1.5,
    borderColor: '#1a6fb5',
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 6,
    fontSize: 14,
    backgroundColor: '#f0f6ff',
  },

  // ── Totals ────────────────────────────────────────────────────────────────────
  totalSection:     { borderTopWidth: 1, borderTopColor: '#eee', paddingTop: 6, marginTop: 4 },
  totalRow:         { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 2 },
  totalSubLabel:    { fontSize: 13, color: '#999' },
  totalSubValue:    { fontSize: 13, color: '#999' },
  discountLine:     { fontSize: 13, color: '#3a7d44', fontWeight: '500' },
  discountLineValue:{ fontSize: 13, color: '#3a7d44', fontWeight: '600' },
  totalLabel:       { fontSize: 16, fontWeight: '700', color: '#333' },
  totalValue:       { fontSize: 18, fontWeight: '700', color: '#e8521a' },

  // ── Payment ───────────────────────────────────────────────────────────────────
  payRow: { flexDirection: 'row', alignItems: 'center', marginTop: 6, gap: 10 },
  tenderedInput: {
    flex: 1,
    borderWidth: 1.5,
    borderColor: '#ddd',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    fontSize: 15,
    backgroundColor: '#fafafa',
    marginTop: 8,
  },
  changeText: { fontSize: 13, color: '#3a7d44', fontWeight: '600' },
  noteInput: {
    marginTop: 6,
    borderWidth: 1.5,
    borderColor: '#ddd',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 7,
    fontSize: 14,
    backgroundColor: '#fafafa',
  },

  // ── Portrait action row ───────────────────────────────────────────────────────
  actionRow: { flexDirection: 'row', marginTop: 7, gap: 10, marginBottom: 6 },
  clearBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1.5,
    borderColor: '#e8521a',
    borderRadius: 10,
    paddingVertical: 12,
    paddingHorizontal: 16,
    gap: 6,
  },
  clearText:    { color: '#e8521a', fontWeight: '600', fontSize: 15 },
  orderBtn:     { flex: 1, backgroundColor: '#e8521a', borderRadius: 10, paddingVertical: 14, alignItems: 'center' },
  orderBtnText: { color: '#fff', fontWeight: '700', fontSize: 16 },
});
