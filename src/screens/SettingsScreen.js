import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Alert,
  Modal,
  KeyboardAvoidingView,
  Platform,
  FlatList,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import {
  getSettings, saveSetting,
  getCategories, addCategory, updateCategory, deleteCategory,
} from '../database/db';

const BRAND = '#e8521a';

const PRESET_COLORS = [
  '#e8521a', '#c62828', '#f57c00', '#f5c842',
  '#3a7d44', '#00897b', '#1a6fb5', '#7b5ea7',
  '#c49a2a', '#546e7a', '#e91e8c', '#555555',
];

// ── Category Modal (add / edit) ───────────────────────────────────────────────

function CategoryModal({ visible, category, onSave, onClose }) {
  const [name, setName] = useState('');
  const [color, setColor] = useState(PRESET_COLORS[0]);

  React.useEffect(() => {
    if (visible) {
      setName(category ? category.name : '');
      setColor(category ? category.color : PRESET_COLORS[0]);
    }
  }, [visible, category]);

  function handleSave() {
    const trimmed = name.trim();
    if (!trimmed) { Alert.alert('Required', 'Category name cannot be empty.'); return; }
    onSave(trimmed, color);
  }

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <KeyboardAvoidingView
        style={styles.catModalOverlay}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <View style={styles.catModalCard}>
          <Text style={styles.catModalTitle}>{category ? 'Edit Category' : 'New Category'}</Text>

          <Text style={styles.fieldLabel}>Name</Text>
          <TextInput
            style={styles.catInput}
            value={name}
            onChangeText={setName}
            placeholder="e.g. Electronics"
            autoFocus
          />

          <Text style={styles.fieldLabel}>Color</Text>
          <View style={styles.colorGrid}>
            {PRESET_COLORS.map((c) => (
              <TouchableOpacity
                key={c}
                style={[styles.colorDot, { backgroundColor: c }, color === c && styles.colorDotSelected]}
                onPress={() => setColor(c)}
              >
                {color === c && <Ionicons name="checkmark" size={14} color="#fff" />}
              </TouchableOpacity>
            ))}
          </View>

          {/* Preview */}
          <View style={[styles.catPreview, { borderTopColor: color }]}>
            <Text style={styles.catPreviewText}>{name || 'Category Name'}</Text>
          </View>

          <View style={styles.catModalActions}>
            <TouchableOpacity style={styles.catCancelBtn} onPress={onClose}>
              <Text style={styles.catCancelText}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[styles.catSaveBtn, { backgroundColor: color }]} onPress={handleSave}>
              <Text style={styles.catSaveText}>Save</Text>
            </TouchableOpacity>
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

// ── Settings Field / Section helpers ─────────────────────────────────────────

function Field({ label, value, onChangeText, placeholder, hint }) {
  return (
    <View style={styles.field}>
      <Text style={styles.fieldLabel}>{label}</Text>
      {hint && <Text style={styles.hint}>{hint}</Text>}
      <TextInput
        style={styles.fieldInput}
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor="#bbb"
      />
    </View>
  );
}

function SectionHeader({ title }) {
  return <Text style={styles.sectionTitle}>{title}</Text>;
}

// ── Main Screen ───────────────────────────────────────────────────────────────

export default function SettingsScreen() {
  // Store settings
  const [storeName, setStoreName] = useState('');
  const [storeAddress, setStoreAddress] = useState('');
  const [storePhone, setStorePhone] = useState('');
  const [receiptFooter, setReceiptFooter] = useState('');
  const [currencySymbol, setCurrencySymbol] = useState('₱');
  const [dirty, setDirty] = useState(false);

  // Categories
  const [categories, setCategories] = useState([]);
  const [catModalVisible, setCatModalVisible] = useState(false);
  const [editingCat, setEditingCat] = useState(null);

  useFocusEffect(
    useCallback(() => {
      loadAll();
    }, [])
  );

  function loadAll() {
    const s = getSettings();
    setStoreName(s.store_name || '');
    setStoreAddress(s.store_address || '');
    setStorePhone(s.store_phone || '');
    setReceiptFooter(s.receipt_footer || '');
    setCurrencySymbol(s.currency_symbol || '₱');
    setDirty(false);
    setCategories(getCategories());
  }

  function mark(setter) {
    return (val) => { setter(val); setDirty(true); };
  }

  function handleSaveSettings() {
    if (!storeName.trim()) { Alert.alert('Required', 'Store name cannot be empty.'); return; }
    saveSetting('store_name', storeName.trim());
    saveSetting('store_address', storeAddress.trim());
    saveSetting('store_phone', storePhone.trim());
    saveSetting('receipt_footer', receiptFooter.trim() || 'Thank you for your purchase!');
    saveSetting('currency_symbol', currencySymbol.trim() || '₱');
    setDirty(false);
    Alert.alert('Saved', 'Store settings updated.');
  }

  // Category handlers
  function handleSaveCategory(name, color) {
    if (editingCat) {
      updateCategory(editingCat.id, name, color);
    } else {
      addCategory(name, color);
    }
    setCatModalVisible(false);
    setEditingCat(null);
    setCategories(getCategories());
  }

  function handleDeleteCategory(cat) {
    const result = deleteCategory(cat.id);
    if (!result.success) {
      Alert.alert('Cannot Delete', result.error);
    } else {
      setCategories(getCategories());
    }
  }

  function openAddCategory() {
    setEditingCat(null);
    setCatModalVisible(true);
  }

  function openEditCategory(cat) {
    setEditingCat(cat);
    setCatModalVisible(true);
  }

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView style={styles.root} contentContainerStyle={styles.content}>

        {/* Store Info */}
        <SectionHeader title="Store Info" />
        <View style={styles.card}>
          <Field label="Store Name" value={storeName} onChangeText={mark(setStoreName)} placeholder="e.g. Juan's Store" />
          <View style={styles.cardDivider} />
          <Field label="Address" value={storeAddress} onChangeText={mark(setStoreAddress)} placeholder="e.g. 123 Rizal St., Makati" />
          <View style={styles.cardDivider} />
          <Field label="Phone / Contact" value={storePhone} onChangeText={mark(setStorePhone)} placeholder="e.g. 0917-123-4567" />
        </View>

        {/* Receipt */}
        <SectionHeader title="Receipt" />
        <View style={styles.card}>
          <Field
            label="Footer Message"
            value={receiptFooter}
            onChangeText={mark(setReceiptFooter)}
            placeholder="Thank you for your purchase!"
            hint="Printed at the bottom of every receipt."
          />
          <View style={styles.cardDivider} />
          <Field
            label="Currency Symbol"
            value={currencySymbol}
            onChangeText={mark(setCurrencySymbol)}
            placeholder="₱"
            hint="Change to $ or other symbol if needed."
          />
        </View>

        {/* Receipt Preview */}
        <SectionHeader title="Receipt Preview" />
        <View style={styles.preview}>
          <Text style={styles.previewName}>{storeName || 'My Store'}</Text>
          {!!storeAddress && <Text style={styles.previewSub}>{storeAddress}</Text>}
          {!!storePhone && <Text style={styles.previewSub}>Tel: {storePhone}</Text>}
          <View style={styles.previewDivider} />
          <Text style={styles.previewItem}>Sample Item  x2  {currencySymbol || '₱'}90.00</Text>
          <View style={styles.previewDivider} />
          <Text style={styles.previewTotal}>TOTAL  {currencySymbol || '₱'}90.00</Text>
          <Text style={styles.previewFooter}>{receiptFooter || 'Thank you for your purchase!'}</Text>
        </View>

        <TouchableOpacity
          style={[styles.saveBtn, !dirty && styles.saveBtnDisabled]}
          onPress={handleSaveSettings}
          disabled={!dirty}
        >
          <Ionicons name="checkmark-circle" size={20} color="#fff" />
          <Text style={styles.saveBtnText}>Save Settings</Text>
        </TouchableOpacity>

        {/* Categories */}
        <View style={styles.catSection}>
          <View style={styles.catSectionHeader}>
            <Text style={styles.sectionTitle}>Categories</Text>
            <TouchableOpacity style={styles.catAddBtn} onPress={openAddCategory}>
              <Ionicons name="add" size={18} color="#fff" />
              <Text style={styles.catAddBtnText}>Add</Text>
            </TouchableOpacity>
          </View>

          <View style={styles.card}>
            {categories.length === 0 ? (
              <Text style={styles.catEmpty}>No categories yet. Tap Add to create one.</Text>
            ) : (
              categories.map((cat, idx) => (
                <View key={cat.id}>
                  {idx > 0 && <View style={styles.cardDivider} />}
                  <View style={styles.catRow}>
                    <View style={[styles.catDot, { backgroundColor: cat.color }]} />
                    <Text style={styles.catName}>{cat.name}</Text>
                    <TouchableOpacity style={styles.catIconBtn} onPress={() => openEditCategory(cat)}>
                      <Ionicons name="pencil-outline" size={18} color="#1a6fb5" />
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={styles.catIconBtn}
                      onPress={() =>
                        Alert.alert('Delete Category?', `Delete "${cat.name}"? This will fail if products use it.`, [
                          { text: 'Cancel', style: 'cancel' },
                          { text: 'Delete', style: 'destructive', onPress: () => handleDeleteCategory(cat) },
                        ])
                      }
                    >
                      <Ionicons name="trash-outline" size={18} color="#e8521a" />
                    </TouchableOpacity>
                  </View>
                </View>
              ))
            )}
          </View>
          <Text style={styles.catHint}>
            Categories appear in the order and product screens. Deleting a category that's in use is blocked.
          </Text>
        </View>

      </ScrollView>

      <CategoryModal
        visible={catModalVisible}
        category={editingCat}
        onSave={handleSaveCategory}
        onClose={() => { setCatModalVisible(false); setEditingCat(null); }}
      />
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#f4f4f4' },
  content: { padding: 16, paddingBottom: 48 },
  sectionTitle: {
    fontSize: 12,
    fontWeight: '700',
    color: '#999',
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    marginTop: 20,
    marginBottom: 8,
    marginLeft: 4,
  },
  card: {
    backgroundColor: '#fff',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 3,
    elevation: 2,
  },
  cardDivider: { height: 1, backgroundColor: '#f5f5f5' },
  field: { paddingVertical: 12 },
  fieldLabel: { fontSize: 13, fontWeight: '600', color: '#444', marginBottom: 4 },
  hint: { fontSize: 11, color: '#aaa', marginBottom: 4 },
  fieldInput: {
    fontSize: 15,
    color: '#222',
    paddingVertical: 4,
    borderBottomWidth: 1.5,
    borderBottomColor: '#eee',
  },
  // Preview
  preview: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 20,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#e8e8e8',
    borderStyle: 'dashed',
  },
  previewName: { fontSize: 18, fontWeight: '700', color: BRAND, marginBottom: 2 },
  previewSub: { fontSize: 11, color: '#888', marginBottom: 1 },
  previewDivider: {
    borderTopWidth: 1, borderStyle: 'dashed', borderColor: '#ddd',
    width: '100%', marginVertical: 10,
  },
  previewItem: { fontSize: 12, color: '#555', alignSelf: 'flex-start', marginBottom: 2 },
  previewTotal: { fontSize: 14, fontWeight: '700', color: '#222', alignSelf: 'flex-end', marginTop: 4 },
  previewFooter: { fontSize: 11, color: '#aaa', marginTop: 14, fontStyle: 'italic' },
  // Save button
  saveBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: BRAND,
    borderRadius: 12,
    paddingVertical: 15,
    marginTop: 20,
    gap: 8,
    shadowColor: BRAND,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 6,
    elevation: 4,
  },
  saveBtnDisabled: { backgroundColor: '#ccc', shadowOpacity: 0, elevation: 0 },
  saveBtnText: { color: '#fff', fontWeight: '700', fontSize: 16 },
  // Categories section
  catSection: { marginTop: 4 },
  catSectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 20,
    marginBottom: 8,
    marginLeft: 4,
  },
  catAddBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: BRAND,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  catAddBtnText: { color: '#fff', fontWeight: '700', fontSize: 13 },
  catRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    gap: 10,
  },
  catDot: {
    width: 18,
    height: 18,
    borderRadius: 9,
  },
  catName: { flex: 1, fontSize: 15, fontWeight: '500', color: '#222' },
  catIconBtn: { padding: 6 },
  catEmpty: { textAlign: 'center', color: '#bbb', paddingVertical: 20, fontSize: 14 },
  catHint: { fontSize: 11, color: '#bbb', marginTop: 6, marginLeft: 4 },
  // Category modal
  catModalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.45)',
    justifyContent: 'center',
    paddingHorizontal: 24,
  },
  catModalCard: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 24,
  },
  catModalTitle: { fontSize: 18, fontWeight: '700', color: '#222', marginBottom: 16 },
  catInput: {
    borderWidth: 1.5,
    borderColor: '#ddd',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 16,
    backgroundColor: '#fafafa',
    marginBottom: 16,
  },
  colorGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    marginBottom: 16,
  },
  colorDot: {
    width: 34,
    height: 34,
    borderRadius: 17,
    justifyContent: 'center',
    alignItems: 'center',
  },
  colorDotSelected: {
    borderWidth: 3,
    borderColor: '#fff',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 3,
    elevation: 4,
  },
  catPreview: {
    borderTopWidth: 4,
    borderRadius: 8,
    backgroundColor: '#f9f9f9',
    padding: 10,
    alignItems: 'center',
    marginBottom: 16,
  },
  catPreviewText: { fontSize: 14, fontWeight: '600', color: '#333' },
  catModalActions: { flexDirection: 'row', gap: 10 },
  catCancelBtn: {
    flex: 1,
    borderWidth: 1.5,
    borderColor: '#ccc',
    borderRadius: 10,
    paddingVertical: 13,
    alignItems: 'center',
  },
  catCancelText: { color: '#666', fontWeight: '600', fontSize: 15 },
  catSaveBtn: {
    flex: 1,
    borderRadius: 10,
    paddingVertical: 13,
    alignItems: 'center',
  },
  catSaveText: { color: '#fff', fontWeight: '700', fontSize: 15 },
});
