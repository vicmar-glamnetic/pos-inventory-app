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
  Switch,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import {
  getAllMenuItemsAdmin,
  addMenuItem,
  updateMenuItem,
  deleteMenuItem,
  getCategories,
} from '../database/db';
import { formatPeso } from '../utils/formatCurrency';

function ItemFormModal({ visible, item, categories, onSave, onClose }) {
  const [name, setName] = useState('');
  const [price, setPrice] = useState('');
  const [category, setCategory] = useState('');
  const [isAvailable, setIsAvailable] = useState(true);
  const [stock, setStock] = useState('');

  const defaultCat = categories[0]?.name || '';

  React.useEffect(() => {
    if (item) {
      setName(item.name);
      setPrice(String(item.price));
      setCategory(item.category);
      setIsAvailable(item.is_available === 1);
      setStock(item.stock >= 0 ? String(item.stock) : '');
    } else {
      setName('');
      setPrice('');
      setCategory(defaultCat);
      setIsAvailable(true);
      setStock('');
    }
  }, [item, visible, defaultCat]);

  function handleSave() {
    const trimmed = name.trim();
    const priceNum = parseFloat(price);
    if (!trimmed) return Alert.alert('Error', 'Please enter the item name.');
    if (isNaN(priceNum) || priceNum <= 0) return Alert.alert('Error', 'Please enter a valid price.');

    let stockNum = -1;
    if (stock.trim() !== '') {
      stockNum = parseInt(stock, 10);
      if (isNaN(stockNum) || stockNum < 0) {
        return Alert.alert('Error', 'Stock must be 0 or more, or leave blank for unlimited (∞).');
      }
    }

    onSave({ name: trimmed, price: priceNum, category, isAvailable, stock: stockNum });
  }

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <KeyboardAvoidingView
        style={styles.modalOverlay}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <View style={styles.formCard}>
          <Text style={styles.formTitle}>{item ? 'Edit Item' : 'New Item'}</Text>

          <Text style={styles.label}>Name</Text>
          <TextInput
            style={styles.input}
            value={name}
            onChangeText={setName}
            placeholder="e.g. Adobong Manok"
          />

          <Text style={styles.label}>Price (₱)</Text>
          <TextInput
            style={styles.input}
            value={price}
            onChangeText={setPrice}
            keyboardType="decimal-pad"
            placeholder="0.00"
          />

          <Text style={styles.label}>Category</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 12 }}>
            <View style={{ flexDirection: 'row', gap: 8 }}>
              {categories.map((cat) => (
                <TouchableOpacity
                  key={cat.name}
                  style={[styles.catChip, category === cat.name && { backgroundColor: cat.color, borderColor: cat.color }]}
                  onPress={() => setCategory(cat.name)}
                >
                  <Text style={[styles.catText, category === cat.name && styles.catTextActive]}>{cat.name}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </ScrollView>

          <Text style={styles.label}>
            Stock / Servings{' '}
            <Text style={{ color: '#aaa', fontWeight: '400' }}>(leave blank = unlimited ∞)</Text>
          </Text>
          <TextInput
            style={styles.input}
            value={stock}
            onChangeText={setStock}
            keyboardType="number-pad"
            placeholder="e.g. 20"
          />

          {item && (
            <View style={styles.switchRow}>
              <Text style={styles.label}>Available</Text>
              <Switch
                value={isAvailable}
                onValueChange={setIsAvailable}
                trackColor={{ true: '#e8521a' }}
              />
            </View>
          )}

          <View style={styles.formActions}>
            <TouchableOpacity style={styles.cancelBtn} onPress={onClose}>
              <Text style={styles.cancelText}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.saveBtn} onPress={handleSave}>
              <Text style={styles.saveBtnText}>Save</Text>
            </TouchableOpacity>
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

export default function MenuScreen() {
  const [items, setItems] = useState([]);
  const [categories, setCategories] = useState([]);
  const [formVisible, setFormVisible] = useState(false);
  const [editingItem, setEditingItem] = useState(null);
  const [search, setSearch] = useState('');

  useFocusEffect(
    useCallback(() => {
      setItems(getAllMenuItemsAdmin());
      setCategories(getCategories());
    }, [])
  );

  const filtered = items.filter((i) =>
    i.name.toLowerCase().includes(search.toLowerCase())
  );

  function handleSave({ name, price, category, isAvailable, stock }) {
    if (editingItem) {
      updateMenuItem(editingItem.id, name, price, category, isAvailable, stock);
    } else {
      addMenuItem(name, price, category, stock);
    }
    setItems(getAllMenuItemsAdmin());
    setFormVisible(false);
    setEditingItem(null);
  }

  function handleDelete(item) {
    Alert.alert(
      'Delete Item?',
      `Are you sure you want to delete "${item.name}"?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: () => {
            deleteMenuItem(item.id);
            setItems(getAllMenuItemsAdmin());
          },
        },
      ]
    );
  }

  function stockLabel(item) {
    if (item.stock < 0) return '∞';
    if (item.stock === 0) return 'Sold Out';
    return `${item.stock} left`;
  }

  function stockStyle(item) {
    if (item.stock < 0) return styles.stockUnlimited;
    if (item.stock === 0) return styles.stockOut;
    if (item.stock < 5) return styles.stockLow;
    return styles.stockOk;
  }

  return (
    <View style={styles.root}>
      <View style={styles.topBar}>
        <TextInput
          style={styles.searchInput}
          placeholder="Search items..."
          value={search}
          onChangeText={setSearch}
        />
        <TouchableOpacity style={styles.addBtn} onPress={() => { setEditingItem(null); setFormVisible(true); }}>
          <Ionicons name="add" size={22} color="#fff" />
          <Text style={styles.addBtnText}>Add</Text>
        </TouchableOpacity>
      </View>

      <FlatList
        data={filtered}
        keyExtractor={(item) => String(item.id)}
        contentContainerStyle={styles.list}
        renderItem={({ item }) => (
          <View style={[styles.row, !item.is_available && styles.rowDisabled]}>
            <View style={styles.info}>
              <Text style={styles.itemName}>{item.name}</Text>
              <View style={styles.meta}>
                <Text style={styles.itemCat}>{item.category}</Text>
                {!item.is_available && (
                  <View style={styles.unavailableBadge}>
                    <Text style={styles.unavailableText}>Unavailable</Text>
                  </View>
                )}
              </View>
            </View>
            <View style={styles.stockWrap}>
              <Text style={[styles.stockText, stockStyle(item)]}>{stockLabel(item)}</Text>
            </View>
            <Text style={styles.itemPrice}>{formatPeso(item.price)}</Text>
            <TouchableOpacity onPress={() => { setEditingItem(item); setFormVisible(true); }} style={styles.iconBtn}>
              <Ionicons name="pencil" size={20} color="#1a6fb5" />
            </TouchableOpacity>
            <TouchableOpacity onPress={() => handleDelete(item)} style={styles.iconBtn}>
              <Ionicons name="trash" size={20} color="#e8521a" />
            </TouchableOpacity>
          </View>
        )}
        ListEmptyComponent={<Text style={styles.empty}>No items found.</Text>}
      />

      <ItemFormModal
        visible={formVisible}
        item={editingItem}
        categories={categories}
        onSave={handleSave}
        onClose={() => { setFormVisible(false); setEditingItem(null); }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#f4f4f4' },
  topBar: {
    flexDirection: 'row',
    padding: 12,
    gap: 8,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  searchInput: {
    flex: 1,
    borderWidth: 1.5,
    borderColor: '#ddd',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    fontSize: 15,
    backgroundColor: '#fafafa',
  },
  addBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#e8521a',
    borderRadius: 8,
    paddingHorizontal: 14,
    paddingVertical: 8,
    gap: 4,
  },
  addBtnText: { color: '#fff', fontWeight: '700', fontSize: 15 },
  list: { padding: 12, gap: 8 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    borderRadius: 10,
    padding: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 3,
    elevation: 2,
  },
  rowDisabled: { opacity: 0.5 },
  info: { flex: 1 },
  itemName: { fontSize: 15, fontWeight: '600', color: '#222' },
  meta: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 3 },
  itemCat: { fontSize: 12, color: '#999' },
  unavailableBadge: {
    backgroundColor: '#fce8e2',
    borderRadius: 4,
    paddingHorizontal: 6,
    paddingVertical: 1,
  },
  unavailableText: { fontSize: 11, color: '#e8521a' },
  stockWrap: { marginRight: 8 },
  stockText: { fontSize: 12, fontWeight: '600' },
  stockUnlimited: { color: '#aaa' },
  stockOk: { color: '#3a7d44' },
  stockLow: { color: '#e65100' },
  stockOut: { color: '#c62828' },
  itemPrice: { fontSize: 15, fontWeight: '700', color: '#e8521a', marginRight: 4 },
  iconBtn: { padding: 6 },
  empty: { textAlign: 'center', color: '#aaa', marginTop: 40, fontSize: 15 },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.45)',
    justifyContent: 'flex-end',
  },
  formCard: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 24,
    paddingBottom: Platform.OS === 'ios' ? 40 : 24,
  },
  formTitle: { fontSize: 18, fontWeight: '700', color: '#222', marginBottom: 16 },
  label: { fontSize: 13, color: '#666', marginBottom: 4, fontWeight: '500' },
  input: {
    borderWidth: 1.5,
    borderColor: '#ddd',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 15,
    backgroundColor: '#fafafa',
    marginBottom: 12,
  },
  catChip: {
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 20,
    backgroundColor: '#f0f0f0',
  },
  catChipActive: { backgroundColor: '#e8521a' },
  catText: { fontSize: 14, color: '#666', fontWeight: '500' },
  catTextActive: { color: '#fff', fontWeight: '700' },
  switchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginVertical: 8,
  },
  formActions: { flexDirection: 'row', gap: 10, marginTop: 16 },
  cancelBtn: {
    flex: 1,
    borderWidth: 1.5,
    borderColor: '#ccc',
    borderRadius: 10,
    paddingVertical: 13,
    alignItems: 'center',
  },
  cancelText: { color: '#666', fontWeight: '600', fontSize: 15 },
  saveBtn: {
    flex: 1,
    backgroundColor: '#e8521a',
    borderRadius: 10,
    paddingVertical: 13,
    alignItems: 'center',
  },
  saveBtnText: { color: '#fff', fontWeight: '700', fontSize: 15 },
});
