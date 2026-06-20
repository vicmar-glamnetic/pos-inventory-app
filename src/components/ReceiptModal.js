import React from 'react';
import {
  Modal,
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  Platform,
} from 'react-native';
import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import { formatPeso } from '../utils/formatCurrency';
import { getSettings } from '../database/db';

function buildHtml(order, items, settings) {
  const date = new Date(order.created_at || Date.now());
  const dateStr = date.toLocaleDateString('en-PH', {
    year: 'numeric', month: 'long', day: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });

  const rows = items
    .map(
      (i) =>
        `<tr>
          <td>${i.menu_item_name}</td>
          <td style="text-align:center">${i.quantity}</td>
          <td style="text-align:right">${formatPeso(i.price)}</td>
          <td style="text-align:right">${formatPeso(i.price * i.quantity)}</td>
        </tr>`
    )
    .join('');

  const discountRow =
    order.discount_amount > 0
      ? `<tr><td colspan="3" style="color:#2e7d32">${order.discount_label || 'Discount'}</td>
           <td style="text-align:right;color:#2e7d32">-${formatPeso(order.discount_amount)}</td></tr>`
      : '';

  return `
    <html><head><meta charset="utf-8">
    <style>
      @page { size: 80mm auto; margin: 4mm; }
      * { box-sizing: border-box; }
      body { font-family: Arial, 'Noto Sans', sans-serif; font-size: 11px; width: 72mm; margin: 0; padding: 0; }
      h2 { text-align:center; color:#e8521a; margin:0 0 2px; font-size:14px; }
      p.sub { text-align:center; color:#666; margin:0 0 2px; font-size:10px; }
      table { width:100%; border-collapse:collapse; }
      th { border-bottom:1px solid #ccc; padding:3px 2px; font-size:10px; }
      td { padding:3px 2px; font-size:11px; }
      .subtotal-row td { border-top:1px solid #ddd; color:#888; }
      .total-row td { border-top:2px solid #333; font-weight:bold; font-size:13px; }
      .footer { text-align:center; margin-top:12px; color:#999; font-size:10px; }
    </style>
    </head><body>
    <h2>${settings.store_name || 'My Store'}</h2>
    ${settings.store_address ? `<p class="sub">${settings.store_address}</p>` : ''}
    ${settings.store_phone ? `<p class="sub">Tel: ${settings.store_phone}</p>` : ''}
    ${settings.store_tin ? `<p class="sub">TIN: ${settings.store_tin}</p>` : ''}
    <p class="sub" style="border-top:1px dashed #ccc;margin-top:4px;padding-top:4px;">${dateStr}</p>
    <p class="sub">OR No.: ${String(order.id).padStart(6, '0')}</p>
    ${order.table_name ? `<p class="sub">Customer/Table: ${order.table_name}</p>` : ''}
    <table>
      <tr><th style="text-align:left">Description</th><th>Qty</th><th style="text-align:right">Price</th><th style="text-align:right">Amount</th></tr>
      ${rows}
      ${
        order.discount_amount > 0
          ? `<tr class="subtotal-row">
               <td colspan="3" style="text-align:left">Subtotal</td>
               <td style="text-align:right">${formatPeso(order.subtotal || (order.total_amount + order.discount_amount))}</td>
             </tr>
             ${discountRow}`
          : ''
      }
      <tr class="total-row">
        <td colspan="3" style="text-align:left">TOTAL DUE</td>
        <td style="text-align:right">${formatPeso(order.total_amount)}</td>
      </tr>
    </table>
    <table style="margin-top:6px">
      <tr><td>Cash Tendered</td><td style="text-align:right">${formatPeso(order.amount_tendered)}</td></tr>
      <tr><td>Change</td><td style="text-align:right">${formatPeso(order.change_amount)}</td></tr>
    </table>
    ${order.note ? `<p style="margin-top:6px;font-size:10px">Note: ${order.note}</p>` : ''}
    <p style="border-top:1px dashed #ccc;margin-top:8px;padding-top:6px;text-align:center;font-size:10px;">
      This is not an Official Receipt.<br>For BIR-registered receipt, please ask the cashier.
    </p>
    <p class="footer">${settings.receipt_footer || 'Thank you for your purchase!'}</p>
    </body></html>
  `;
}

export default function ReceiptModal({ visible, order, items, onClose, onVoid }) {
  const [settings, setSettings] = React.useState({});

  React.useEffect(() => {
    if (visible) setSettings(getSettings());
  }, [visible]);

  if (!order) return null;

  async function handleShare() {
    try {
      const { uri } = await Print.printToFileAsync({ html: buildHtml(order, items, settings), width: 227 }); // 80mm in points
      await Sharing.shareAsync(uri, { mimeType: 'application/pdf' });
    } catch (e) {
      console.warn('Share failed:', e);
    }
  }

  async function handlePrint() {
    try {
      await Print.printAsync({ html: buildHtml(order, items, settings), width: 227 });
    } catch (e) {
      console.warn('Print failed:', e);
    }
  }

  const date = new Date(order.created_at || Date.now());
  const timeStr = date.toLocaleTimeString('en-PH', { hour: '2-digit', minute: '2-digit' });
  const storeName = settings.store_name || 'My Store';

  const subtotal = order.subtotal != null
    ? order.subtotal
    : (order.total_amount + (order.discount_amount || 0));

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.overlay}>
        <View style={styles.container}>
          <View style={styles.header}>
            <Text style={styles.shopName}>{storeName}</Text>
            <Text style={styles.dateText}>{timeStr}</Text>
            {!!order.table_name && (
              <Text style={styles.tableText}>{order.table_name}</Text>
            )}
            {order.status === 'voided' && (
              <View style={styles.voidedBadge}>
                <Text style={styles.voidedBadgeText}>VOIDED</Text>
              </View>
            )}
          </View>

          <ScrollView style={styles.scroll} showsVerticalScrollIndicator={false}>
            <View style={styles.divider} />
            {items.map((item, idx) => (
              <View key={idx} style={styles.row}>
                <View style={styles.rowLeft}>
                  <Text style={styles.itemName}>{item.menu_item_name}</Text>
                  <Text style={styles.itemMeta}>x{item.quantity} @ {formatPeso(item.price)}</Text>
                </View>
                <Text style={styles.itemTotal}>{formatPeso(item.price * item.quantity)}</Text>
              </View>
            ))}
            <View style={styles.divider} />

            {order.discount_amount > 0 && (
              <>
                <View style={styles.subRow}>
                  <Text style={styles.subLabel}>Subtotal</Text>
                  <Text style={styles.subValue}>{formatPeso(subtotal)}</Text>
                </View>
                <View style={styles.subRow}>
                  <Text style={[styles.subLabel, { color: '#3a7d44' }]}>
                    {order.discount_label || 'Discount'}
                  </Text>
                  <Text style={[styles.subValue, { color: '#3a7d44' }]}>
                    -{formatPeso(order.discount_amount)}
                  </Text>
                </View>
              </>
            )}

            <View style={styles.totalRow}>
              <Text style={styles.totalLabel}>TOTAL</Text>
              <Text style={styles.totalValue}>{formatPeso(order.total_amount)}</Text>
            </View>
            <View style={styles.subRow}>
              <Text style={styles.subLabel}>Cash</Text>
              <Text style={styles.subValue}>{formatPeso(order.amount_tendered)}</Text>
            </View>
            <View style={styles.subRow}>
              <Text style={styles.subLabel}>Change</Text>
              <Text style={styles.subValue}>{formatPeso(order.change_amount)}</Text>
            </View>
            {!!order.note && (
              <Text style={styles.noteText}>Note: {order.note}</Text>
            )}
            <Text style={styles.thanks}>{settings.receipt_footer || 'Thank you for your purchase!'}</Text>
          </ScrollView>

          <View style={styles.actions}>
            <TouchableOpacity style={[styles.btn, styles.btnOutline]} onPress={handleShare}>
              <Text style={styles.btnOutlineText}>Share</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[styles.btn, styles.btnOutline]} onPress={handlePrint}>
              <Text style={styles.btnOutlineText}>Print</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[styles.btn, styles.btnPrimary]} onPress={onClose}>
              <Text style={styles.btnPrimaryText}>Close</Text>
            </TouchableOpacity>
          </View>

          {!!onVoid && order.status !== 'voided' && (
            <TouchableOpacity style={styles.voidBtn} onPress={onVoid}>
              <Text style={styles.voidBtnText}>Void This Order</Text>
            </TouchableOpacity>
          )}
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.55)',
    justifyContent: 'flex-end',
  },
  container: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: '85%',
    paddingBottom: Platform.OS === 'ios' ? 32 : 16,
  },
  header: {
    alignItems: 'center',
    paddingVertical: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  shopName: { fontSize: 20, fontWeight: '700', color: '#e8521a' },
  dateText: { fontSize: 12, color: '#999', marginTop: 2 },
  tableText: {
    fontSize: 13,
    color: '#555',
    fontWeight: '600',
    marginTop: 4,
    backgroundColor: '#f0f0f0',
    paddingHorizontal: 10,
    paddingVertical: 2,
    borderRadius: 8,
  },
  scroll: { paddingHorizontal: 24 },
  divider: {
    borderTopWidth: 1,
    borderStyle: 'dashed',
    borderColor: '#ccc',
    marginVertical: 12,
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 8,
  },
  rowLeft: { flex: 1, paddingRight: 12 },
  itemName: { fontSize: 14, fontWeight: '500', color: '#222' },
  itemMeta: { fontSize: 12, color: '#888', marginTop: 1 },
  itemTotal: { fontSize: 14, fontWeight: '600', color: '#222' },
  totalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 6,
  },
  totalLabel: { fontSize: 17, fontWeight: '700', color: '#222' },
  totalValue: { fontSize: 17, fontWeight: '700', color: '#e8521a' },
  subRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  subLabel: { fontSize: 14, color: '#666' },
  subValue: { fontSize: 14, color: '#444', fontWeight: '500' },
  noteText: { fontSize: 13, color: '#888', marginTop: 8, fontStyle: 'italic' },
  thanks: {
    textAlign: 'center',
    marginTop: 16,
    marginBottom: 8,
    color: '#999',
    fontSize: 13,
  },
  actions: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    paddingTop: 12,
    gap: 8,
  },
  btn: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 10,
    alignItems: 'center',
  },
  btnPrimary: { backgroundColor: '#e8521a' },
  btnPrimaryText: { color: '#fff', fontWeight: '700', fontSize: 15 },
  btnOutline: { borderWidth: 1.5, borderColor: '#e8521a' },
  btnOutlineText: { color: '#e8521a', fontWeight: '600', fontSize: 15 },
  voidBtn: {
    marginHorizontal: 16,
    marginTop: 4,
    paddingVertical: 12,
    borderRadius: 10,
    alignItems: 'center',
    borderWidth: 1.5,
    borderColor: '#c62828',
  },
  voidBtnText: { color: '#c62828', fontWeight: '600', fontSize: 14 },
  voidedBadge: {
    marginTop: 6,
    backgroundColor: '#c62828',
    borderRadius: 6,
    paddingHorizontal: 10,
    paddingVertical: 3,
  },
  voidedBadgeText: { color: '#fff', fontWeight: '700', fontSize: 12, letterSpacing: 1 },
});
