import React, { useState, useCallback, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Alert,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { getAdminStats, getDailySales, getRecentOrdersAdmin, getSettings } from '../database/db';
import { isSupabaseConfigured } from '../config/supabase';
import { formatPeso } from '../utils/formatCurrency';
import { useAdmin } from '../context/AdminContext';

const RANGES = [
  { key: '7',  label: '7 Days' },
  { key: '30', label: '30 Days' },
  { key: '90', label: '3 Months' },
];

export default function AdminScreen() {
  const { setIsAdminUnlocked, syncTick } = useAdmin();

  useEffect(() => { if (isUnlocked) loadData(); }, [syncTick]);
  const [isUnlocked, setIsUnlocked]   = useState(false);
  const [pinInput, setPinInput]       = useState('');
  const [pinError, setPinError]       = useState(false);
  const [stats, setStats]             = useState(null);
  const [dailySales, setDailySales]   = useState([]);
  const [recentOrders, setRecentOrders] = useState([]);
  const [range, setRange]             = useState('30');

  useFocusEffect(
    useCallback(() => {
      if (isUnlocked) loadData();
    }, [isUnlocked]) // eslint-disable-line react-hooks/exhaustive-deps
  );

  function loadData(days = range) {
    setStats(getAdminStats());
    setDailySales(getDailySales(parseInt(days)));
    setRecentOrders(getRecentOrdersAdmin(100));
  }

  function handlePinPress(key) {
    if (key === 'del') {
      setPinInput((p) => p.slice(0, -1));
      setPinError(false);
      return;
    }
    const next = pinInput + key;
    setPinInput(next);
    setPinError(false);

    if (next.length === 4) {
      const settings = getSettings();
      const savedPin = settings.admin_pin || '1234';
      if (next === savedPin) {
        setIsUnlocked(true);
        setIsAdminUnlocked(true);
        loadData();
      } else {
        setPinError(true);
        setTimeout(() => {
          setPinInput('');
          setPinError(false);
        }, 600);
      }
    }
  }

  function handleLock() {
    setIsUnlocked(false);
    setIsAdminUnlocked(false);
    setPinInput('');
  }

  function handleRangeChange(key) {
    setRange(key);
    loadData(key);
  }

  // ── PIN Lock Screen ──────────────────────────────────────────────────────────
  if (!isUnlocked) {
    const PAD = ['1','2','3','4','5','6','7','8','9','','0','del'];
    return (
      <View style={lock.root}>
        <Ionicons name="shield-checkmark" size={52} color="#e8521a" />
        <Text style={lock.title}>Admin Access</Text>
        <Text style={lock.sub}>Enter 4-digit PIN</Text>

        <View style={lock.dots}>
          {[0,1,2,3].map((i) => (
            <View
              key={i}
              style={[
                lock.dot,
                pinInput.length > i && (pinError ? lock.dotError : lock.dotFilled),
              ]}
            />
          ))}
        </View>

        {pinError && <Text style={lock.errorText}>Incorrect PIN</Text>}

        <View style={lock.pad}>
          {PAD.map((key, idx) => {
            if (key === '') return <View key={idx} style={lock.padEmpty} />;
            return (
              <TouchableOpacity
                key={idx}
                style={[lock.padKey, key === 'del' && lock.padDel]}
                onPress={() => handlePinPress(key)}
                activeOpacity={0.6}
              >
                {key === 'del'
                  ? <Ionicons name="backspace-outline" size={24} color="#555" />
                  : <Text style={lock.padKeyText}>{key}</Text>
                }
              </TouchableOpacity>
            );
          })}
        </View>

        <Text style={lock.hint}>Default PIN: 1234  •  Change in Settings</Text>
      </View>
    );
  }

  // ── Admin Dashboard ──────────────────────────────────────────────────────────
  return (
    <View style={styles.root}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Admin Dashboard</Text>
        <View style={styles.headerActions}>
          <TouchableOpacity style={styles.lockBtn} onPress={handleLock}>
            <Ionicons name="lock-closed-outline" size={16} color="#666" />
            <Text style={styles.lockBtnText}>Lock</Text>
          </TouchableOpacity>
        </View>
      </View>

      <ScrollView showsVerticalScrollIndicator={false}>

        {/* Sync status banner */}
        {isSupabaseConfigured && stats?.pendingSync > 0 && (
          <View style={styles.pendingBanner}>
            <Ionicons name="cloud-offline-outline" size={16} color="#fff" />
            <Text style={styles.pendingBannerText}>
              {stats.pendingSync} record{stats.pendingSync !== 1 ? 's' : ''} pending sync
            </Text>
          </View>
        )}
        {isSupabaseConfigured && stats?.pendingSync === 0 && (
          <View style={styles.syncedBanner}>
            <Ionicons name="checkmark-circle-outline" size={16} color="#3a7d44" />
            <Text style={styles.syncedBannerText}>All records synced to cloud</Text>
          </View>
        )}
        {!isSupabaseConfigured && (
          <View style={styles.notConfiguredBanner}>
            <Ionicons name="information-circle-outline" size={16} color="#555" />
            <Text style={styles.notConfiguredText}>
              Cloud sync not configured. Add your Supabase credentials to enable it.
            </Text>
          </View>
        )}

        {/* Stat cards */}
        {stats && (
          <View style={styles.statsGrid}>
            <View style={[styles.statCard, styles.statCardHighlight]}>
              <Text style={styles.statLabel}>Today</Text>
              <Text style={styles.statValue}>{formatPeso(stats.todayTotal)}</Text>
            </View>
            <View style={styles.statCard}>
              <Text style={styles.statLabel}>This Month</Text>
              <Text style={styles.statValue}>{formatPeso(stats.monthTotal)}</Text>
            </View>
            <View style={styles.statCard}>
              <Text style={styles.statLabel}>All Time</Text>
              <Text style={styles.statValue}>{formatPeso(stats.allTotal)}</Text>
            </View>
            <View style={styles.statCard}>
              <Text style={styles.statLabel}>Total Orders</Text>
              <Text style={[styles.statValue, styles.statValueSmall]}>{stats.allOrders}</Text>
            </View>
          </View>
        )}

        {/* Daily sales chart (list) */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Daily Sales</Text>
            <View style={styles.rangePills}>
              {RANGES.map((r) => (
                <TouchableOpacity
                  key={r.key}
                  style={[styles.rangePill, range === r.key && styles.rangePillActive]}
                  onPress={() => handleRangeChange(r.key)}
                >
                  <Text style={[styles.rangePillText, range === r.key && styles.rangePillTextActive]}>
                    {r.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>

          {dailySales.length === 0 ? (
            <Text style={styles.emptyText}>No sales in this period.</Text>
          ) : (
            <>
              {/* Max total for bar scaling */}
              {(() => {
                const max = Math.max(...dailySales.map((d) => d.total), 1);
                return dailySales.map((day) => (
                  <View key={day.date} style={styles.dayRow}>
                    <Text style={styles.dayDate}>{formatDate(day.date)}</Text>
                    <View style={styles.dayBarWrap}>
                      <View style={[styles.dayBar, { width: `${Math.max(2, (day.total / max) * 100)}%` }]} />
                    </View>
                    <Text style={styles.dayOrders}>{day.orders} order{day.orders !== 1 ? 's' : ''}</Text>
                    <Text style={styles.dayTotal}>{formatPeso(day.total)}</Text>
                  </View>
                ));
              })()}
            </>
          )}
        </View>

        {/* Recent orders */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Recent Orders</Text>
          {recentOrders.length === 0 ? (
            <Text style={styles.emptyText}>No orders yet.</Text>
          ) : (
            recentOrders.map((order) => (
              <View
                key={order.id}
                style={[styles.orderRow, order.status === 'voided' && styles.orderRowVoided]}
              >
                <View style={styles.orderLeft}>
                  <Text style={styles.orderTime}>{formatDateTime(order.created_at)}</Text>
                  {order.table_name ? (
                    <Text style={styles.orderTable}>{order.table_name}</Text>
                  ) : null}
                  {order.status === 'voided' && (
                    <View style={styles.voidedBadge}>
                      <Text style={styles.voidedText}>VOIDED</Text>
                    </View>
                  )}
                </View>
                <View style={styles.orderRight}>
                  <Text style={[styles.orderAmount, order.status === 'voided' && styles.orderAmountVoided]}>
                    {formatPeso(order.total_amount)}
                  </Text>
                  {order.supabase_id ? (
                    <Ionicons name="cloud-done-outline" size={12} color="#3a7d44" />
                  ) : (
                    <Ionicons name="cloud-offline-outline" size={12} color="#bbb" />
                  )}
                </View>
              </View>
            ))
          )}
        </View>

        <View style={{ height: 30 }} />
      </ScrollView>
    </View>
  );
}

function formatDate(dateStr) {
  const d = new Date(dateStr + 'T00:00:00');
  return d.toLocaleDateString('en-PH', { month: 'short', day: 'numeric', weekday: 'short' });
}

function formatDateTime(str) {
  if (!str) return '';
  const d = new Date(str);
  return d.toLocaleDateString('en-PH', { month: 'short', day: 'numeric' })
    + '  ' + d.toLocaleTimeString('en-PH', { hour: '2-digit', minute: '2-digit' });
}

// ── Styles ────────────────────────────────────────────────────────────────────

const lock = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: '#f4f4f4',
    alignItems: 'center',
    justifyContent: 'center',
    paddingBottom: 30,
    gap: 12,
  },
  title:    { fontSize: 22, fontWeight: '800', color: '#222', marginTop: 8 },
  sub:      { fontSize: 14, color: '#999', marginBottom: 4 },
  dots:     { flexDirection: 'row', gap: 16, marginVertical: 12 },
  dot: {
    width: 16, height: 16, borderRadius: 8,
    borderWidth: 2, borderColor: '#ccc', backgroundColor: 'transparent',
  },
  dotFilled: { backgroundColor: '#e8521a', borderColor: '#e8521a' },
  dotError:  { backgroundColor: '#c62828', borderColor: '#c62828' },
  errorText: { color: '#c62828', fontSize: 13, fontWeight: '600', height: 18 },
  pad: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    width: 240,
    gap: 12,
    marginTop: 8,
  },
  padKey: {
    width: 64, height: 64,
    borderRadius: 32,
    backgroundColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 4,
    elevation: 3,
  },
  padDel:    { backgroundColor: '#f4f4f4' },
  padEmpty:  { width: 64, height: 64 },
  padKeyText:{ fontSize: 24, fontWeight: '600', color: '#222' },
  hint:      { fontSize: 11, color: '#bbb', marginTop: 16 },
});

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#f4f4f4' },

  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  headerTitle:   { fontSize: 17, fontWeight: '700', color: '#222' },
  headerActions: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  syncBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: '#1a6fb5',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 7,
  },
  syncBtnText: { color: '#fff', fontWeight: '600', fontSize: 13 },
  lockBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 8,
    backgroundColor: '#f4f4f4',
    borderWidth: 1,
    borderColor: '#ddd',
  },
  lockBtnText: { fontSize: 13, fontWeight: '600', color: '#666' },

  pendingBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#e65100',
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  pendingBannerText: { color: '#fff', fontSize: 13, fontWeight: '600', flex: 1 },

  syncedBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#e8f5e9',
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  syncedBannerText: { color: '#3a7d44', fontSize: 13, fontWeight: '500' },

  notConfiguredBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#f5f5f5',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  notConfiguredText: { color: '#888', fontSize: 12, flex: 1 },

  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    padding: 12,
    gap: 10,
  },
  statCard: {
    flex: 1,
    minWidth: '45%',
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 3,
    elevation: 2,
  },
  statCardHighlight: { borderTopWidth: 3, borderTopColor: '#e8521a' },
  statLabel:      { fontSize: 12, color: '#999', fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.4, marginBottom: 4 },
  statValue:      { fontSize: 20, fontWeight: '800', color: '#222' },
  statValueSmall: { fontSize: 28 },

  section: {
    backgroundColor: '#fff',
    marginHorizontal: 12,
    marginBottom: 12,
    borderRadius: 12,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 3,
    elevation: 2,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  sectionTitle: { fontSize: 15, fontWeight: '700', color: '#222' },
  rangePills:   { flexDirection: 'row', gap: 6 },
  rangePill: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    backgroundColor: '#f0f0f0',
  },
  rangePillActive:     { backgroundColor: '#e8521a' },
  rangePillText:       { fontSize: 11, color: '#666', fontWeight: '600' },
  rangePillTextActive: { color: '#fff' },

  dayRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 6,
    gap: 8,
  },
  dayDate:   { fontSize: 12, color: '#666', width: 80 },
  dayBarWrap:{ flex: 1, height: 8, backgroundColor: '#f0f0f0', borderRadius: 4, overflow: 'hidden' },
  dayBar:    { height: 8, backgroundColor: '#e8521a', borderRadius: 4 },
  dayOrders: { fontSize: 11, color: '#999', width: 52, textAlign: 'right' },
  dayTotal:  { fontSize: 13, fontWeight: '700', color: '#222', width: 72, textAlign: 'right' },

  orderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#f5f5f5',
  },
  orderRowVoided: { opacity: 0.5 },
  orderLeft:  { flex: 1, gap: 2 },
  orderRight: { alignItems: 'flex-end', gap: 2 },
  orderTime:  { fontSize: 13, color: '#444' },
  orderTable: { fontSize: 11, color: '#999' },
  voidedBadge: {
    alignSelf: 'flex-start',
    backgroundColor: '#fce8e2',
    borderRadius: 4,
    paddingHorizontal: 5,
    paddingVertical: 1,
  },
  voidedText:  { fontSize: 10, color: '#c62828', fontWeight: '700' },
  orderAmount: { fontSize: 14, fontWeight: '700', color: '#222' },
  orderAmountVoided: { textDecorationLine: 'line-through', color: '#aaa' },

  emptyText: { color: '#bbb', fontSize: 14, textAlign: 'center', paddingVertical: 16 },
});
