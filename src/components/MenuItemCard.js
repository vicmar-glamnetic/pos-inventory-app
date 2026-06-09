import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { formatPeso } from '../utils/formatCurrency';

const CATEGORY_COLORS = {
  Ulam: '#e8521a',
  Gulay: '#3a7d44',
  Sopas: '#1a6fb5',
  Extra: '#7b5ea7',
  Drinks: '#c49a2a',
  Inumin: '#c49a2a',
};

export default function MenuItemCard({ item, onPress, quantity = 0, categoryColor }) {
  const accentColor = categoryColor || CATEGORY_COLORS[item.category] || '#555';
  const isSoldOut = item.stock === 0;
  const isLowStock = item.stock > 0 && item.stock < 5;

  return (
    <TouchableOpacity
      style={[styles.card, { borderTopColor: accentColor }, isSoldOut && styles.cardDisabled]}
      onPress={() => !isSoldOut && onPress(item)}
      activeOpacity={isSoldOut ? 1 : 0.75}
    >
      {quantity > 0 && !isSoldOut && (
        <View style={[styles.badge, { backgroundColor: accentColor }]}>
          <Text style={styles.badgeText}>{quantity}</Text>
        </View>
      )}

      {isSoldOut && (
        <View style={styles.soldOutOverlay}>
          <Text style={styles.soldOutText}>Sold Out</Text>
        </View>
      )}

      <Text style={styles.category}>{item.category}</Text>
      <Text style={styles.name} numberOfLines={2}>{item.name}</Text>
      <Text style={[styles.price, { color: isSoldOut ? '#bbb' : accentColor }]}>
        {formatPeso(item.price)}
      </Text>

      {isLowStock && (
        <View style={styles.lowStockBadge}>
          <Text style={styles.lowStockText}>{item.stock} left</Text>
        </View>
      )}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: '#fff',
    borderRadius: 12,
    borderTopWidth: 4,
    padding: 12,
    margin: 6,
    flex: 1,
    minHeight: 100,
    justifyContent: 'flex-end',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 4,
    elevation: 3,
  },
  cardDisabled: {
    opacity: 0.55,
  },
  badge: {
    position: 'absolute',
    top: 8,
    right: 8,
    width: 26,
    height: 26,
    borderRadius: 13,
    justifyContent: 'center',
    alignItems: 'center',
  },
  badgeText: { color: '#fff', fontSize: 13, fontWeight: '700' },
  soldOutOverlay: {
    position: 'absolute',
    top: 8,
    right: 8,
    backgroundColor: '#e8521a',
    borderRadius: 6,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  soldOutText: { color: '#fff', fontSize: 10, fontWeight: '700' },
  lowStockBadge: {
    position: 'absolute',
    top: 8,
    right: 8,
    backgroundColor: '#fff3e0',
    borderRadius: 6,
    paddingHorizontal: 5,
    paddingVertical: 2,
    borderWidth: 1,
    borderColor: '#ffb74d',
  },
  lowStockText: { color: '#e65100', fontSize: 10, fontWeight: '600' },
  category: {
    fontSize: 10,
    color: '#999',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 2,
  },
  name: { fontSize: 15, fontWeight: '600', color: '#222', marginBottom: 4 },
  price: { fontSize: 16, fontWeight: '700' },
});
