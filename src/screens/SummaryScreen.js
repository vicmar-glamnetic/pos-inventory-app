import React, { useState, useCallback, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Alert,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { getSummaryByDate, getOrderItems, voidOrder } from '../database/db';
import { formatPeso } from '../utils/formatCurrency';
import ReceiptModal from '../components/ReceiptModal';
import { useAdmin } from '../context/AdminContext';

function todayStr() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function formatDateLabel(dateStr) {
  const today = todayStr();
  if (dateStr === today) return 'Today';
  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  const yStr = `${yesterday.getFullYear()}-${String(yesterday.getMonth() + 1).padStart(2, '0')}-${String(yesterday.getDate()).padStart(2, '0')}`;
  if (dateStr === yStr) return 'Yesterday';
  const [y, m, day] = dateStr.split('-');
  return new Date(Number(y), Number(m) - 1, Number(day))
    .toLocaleDateString('en-PH', { month: 'short', day: 'numeric', year: 'numeric' });
}

function StatCard({ label, value, color = '#e8521a' }) {
  return (
    <View style={styles.statCard}>
      <Text style={[styles.statValue, { color }]}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

export default function SummaryScreen() {
  const { syncTick } = useAdmin();
  const [selectedDate, setSelectedDate] = useState(todayStr());
  const [summary, setSummary] = useState({ totals: {}, bestSellers: [], orders: [] });
  const [receiptOrder, setReceiptOrder] = useState(null);
  const [receiptItems, setReceiptItems] = useState([]);
  const [receiptVisible, setReceiptVisible] = useState(false);

  useFocusEffect(
    useCallback(() => {
      reload();
    }, [selectedDate])
  );

  useEffect(() => { reload(); }, [syncTick]);

  function reload() {
    setSummary(getSummaryByDate(selectedDate));
  }

  function changeDate(delta) {
    const parts = selectedDate.split('-');
    const d = new Date(Number(parts[0]), Number(parts[1]) - 1, Number(parts[2]));
    d.setDate(d.getDate() + delta);
    setSelectedDate(
      `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
    );
  }

  const isToday = selectedDate === todayStr();

  function openReceipt(order) {
    setReceiptOrder(order);
    setReceiptItems(getOrderItems(order.id));
    setReceiptVisible(true);
  }

  function handleVoid() {
    if (!receiptOrder) return;
    Alert.alert(
      'Void Order?',
      `Void Order #${receiptOrder.id} (${formatPeso(receiptOrder.total_amount)})? This will restore stock and remove it from sales totals.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Void Order',
          style: 'destructive',
          onPress: () => {
            voidOrder(receiptOrder.id);
            setReceiptVisible(false);
            setReceiptOrder(null);
            reload();
          },
        },
      ]
    );
  }

  const { totals, bestSellers, orders } = summary;

  function formatTime(dateStr) {
    return new Date(dateStr).toLocaleTimeString('en-PH', { hour: '2-digit', minute: '2-digit' });
  }

  const completedOrders = orders.filter((o) => o.status !== 'voided');
  const voidedOrders = orders.filter((o) => o.status === 'voided');

  return (
    <ScrollView style={styles.root} contentContainerStyle={styles.content}>
      {/* Date navigation */}
      <View style={styles.dateNav}>
        <TouchableOpacity style={styles.navBtn} onPress={() => changeDate(-1)}>
          <Ionicons name="chevron-back" size={20} color="#e8521a" />
        </TouchableOpacity>
        <Text style={styles.dateLabel}>{formatDateLabel(selectedDate)}</Text>
        <TouchableOpacity
          style={[styles.navBtn, isToday && styles.navBtnDisabled]}
          onPress={() => !isToday && changeDate(1)}
          disabled={isToday}
        >
          <Ionicons name="chevron-forward" size={20} color={isToday ? '#ccc' : '#e8521a'} />
        </TouchableOpacity>
      </View>

      {/* Stat cards */}
      <View style={styles.statsRow}>
        <StatCard label="Sales" value={formatPeso(totals.total_sales)} />
        <StatCard label="Orders" value={String(totals.order_count || 0)} color="#1a6fb5" />
        {(totals.total_discount || 0) > 0 && (
          <StatCard label="Discounts" value={formatPeso(totals.total_discount)} color="#3a7d44" />
        )}
      </View>

      {/* Best sellers */}
      {bestSellers.length > 0 && (
        <>
          <Text style={styles.sectionTitle}>Best Sellers</Text>
          <View style={styles.card}>
            {bestSellers.map((item, idx) => (
              <View key={idx} style={[styles.bsRow, idx < bestSellers.length - 1 && styles.bsDivider]}>
                <View style={[styles.rankBadge, idx === 0 && styles.rankBadgeGold]}>
                  <Text style={styles.rankText}>{idx + 1}</Text>
                </View>
                <Text style={styles.bsName}>{item.name}</Text>
                <View style={styles.bsRight}>
                  <Text style={styles.bsQty}>{item.total_qty}x</Text>
                  <Text style={styles.bsSales}>{formatPeso(item.total_sales)}</Text>
                </View>
              </View>
            ))}
          </View>
        </>
      )}

      {/* Completed orders */}
      <Text style={styles.sectionTitle}>Orders</Text>
      {completedOrders.length === 0 ? (
        <Text style={styles.empty}>
          {isToday ? 'No orders yet today.' : 'No orders on this day.'}
        </Text>
      ) : (
        completedOrders.map((order) => (
          <OrderRow key={order.id} order={order} onPress={openReceipt} formatTime={formatTime} />
        ))
      )}

      {/* Voided orders */}
      {voidedOrders.length > 0 && (
        <>
          <Text style={[styles.sectionTitle, { color: '#c62828' }]}>Voided</Text>
          {voidedOrders.map((order) => (
            <OrderRow key={order.id} order={order} onPress={openReceipt} formatTime={formatTime} voided />
          ))}
        </>
      )}

      <ReceiptModal
        visible={receiptVisible}
        order={receiptOrder}
        items={receiptItems}
        onClose={() => { setReceiptVisible(false); setReceiptOrder(null); }}
        onVoid={receiptOrder?.status !== 'voided' ? handleVoid : undefined}
      />
    </ScrollView>
  );
}

function OrderRow({ order, onPress, formatTime, voided }) {
  return (
    <TouchableOpacity
      style={[styles.orderRow, voided && styles.orderRowVoided]}
      onPress={() => onPress(order)}
      activeOpacity={0.75}
    >
      <View style={styles.orderLeft}>
        <Text style={[styles.orderId, voided && styles.textVoided]}>
          Order #{order.id}
          {order.table_name ? `  ·  ${order.table_name}` : ''}
          {voided ? '  ·  VOIDED' : ''}
        </Text>
        <Text style={styles.orderTime}>{formatTime(order.created_at)}</Text>
        {order.discount_amount > 0 && !voided && (
          <Text style={styles.orderDiscount}>-{formatPeso(order.discount_amount)} {order.discount_label}</Text>
        )}
        {!!order.note && <Text style={styles.orderNote}>{order.note}</Text>}
      </View>
      <View style={styles.orderRight}>
        <Text style={[styles.orderTotal, voided && styles.textVoided]}>
          {formatPeso(order.total_amount)}
        </Text>
        <Ionicons name="receipt-outline" size={16} color={voided ? '#ccc' : '#aaa'} style={{ marginTop: 2 }} />
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#f4f4f4' },
  content: { padding: 16, paddingBottom: 40 },
  dateNav: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#fff',
    borderRadius: 12,
    paddingVertical: 10,
    paddingHorizontal: 8,
    marginBottom: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  navBtn: { padding: 6 },
  navBtnDisabled: { opacity: 0.3 },
  dateLabel: { fontSize: 17, fontWeight: '700', color: '#333' },
  sectionTitle: {
    fontSize: 12,
    fontWeight: '700',
    color: '#999',
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    marginTop: 14,
    marginBottom: 7,
  },
  statsRow: { flexDirection: 'row', gap: 10, flexWrap: 'wrap' },
  statCard: {
    flex: 1,
    minWidth: 90,
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 14,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 3,
    elevation: 2,
  },
  statValue: { fontSize: 20, fontWeight: '700' },
  statLabel: { fontSize: 11, color: '#999', marginTop: 3 },
  card: {
    backgroundColor: '#fff',
    borderRadius: 12,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 3,
    elevation: 2,
  },
  bsRow: { flexDirection: 'row', alignItems: 'center', padding: 12 },
  bsDivider: { borderBottomWidth: 1, borderBottomColor: '#f0f0f0' },
  rankBadge: {
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: '#f0f0f0',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 10,
  },
  rankBadgeGold: { backgroundColor: '#f5c842' },
  rankText: { fontSize: 13, fontWeight: '700', color: '#333' },
  bsName: { flex: 1, fontSize: 14, fontWeight: '500', color: '#222' },
  bsRight: { alignItems: 'flex-end' },
  bsQty: { fontSize: 13, color: '#666', fontWeight: '600' },
  bsSales: { fontSize: 12, color: '#999' },
  orderRow: {
    flexDirection: 'row',
    backgroundColor: '#fff',
    borderRadius: 10,
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
  orderRowVoided: {
    opacity: 0.6,
    borderLeftWidth: 3,
    borderLeftColor: '#c62828',
  },
  orderLeft: { flex: 1 },
  orderId: { fontSize: 14, fontWeight: '600', color: '#333' },
  orderTime: { fontSize: 12, color: '#999', marginTop: 2 },
  orderDiscount: { fontSize: 12, color: '#3a7d44', marginTop: 1 },
  orderNote: { fontSize: 12, color: '#888', fontStyle: 'italic', marginTop: 1 },
  orderRight: { alignItems: 'flex-end' },
  orderTotal: { fontSize: 16, fontWeight: '700', color: '#e8521a' },
  textVoided: { color: '#bbb', textDecorationLine: 'line-through' },
  empty: { textAlign: 'center', color: '#bbb', marginTop: 24, fontSize: 14 },
});
