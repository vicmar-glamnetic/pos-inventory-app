import React, { useState, useEffect, useRef } from 'react';
import { StatusBar } from 'expo-status-bar';
import { View, TouchableOpacity, StyleSheet, Animated, Easing } from 'react-native';
import { NavigationContainer } from '@react-navigation/native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { Ionicons } from '@expo/vector-icons';

import { initDatabase } from './src/database/db';
import { startSync, stopSync, syncPending } from './src/services/syncService';
import { isSupabaseConfigured } from './src/config/supabase';
import { AdminProvider, useAdmin } from './src/context/AdminContext';
import OrderScreen from './src/screens/OrderScreen';
import MenuScreen from './src/screens/MenuScreen';
import InventoryScreen from './src/screens/InventoryScreen';
import SummaryScreen from './src/screens/SummaryScreen';
import SettingsScreen from './src/screens/SettingsScreen';
import AdminScreen from './src/screens/AdminScreen';

const Tab = createBottomTabNavigator();
const BRAND = '#e8521a';

function SyncFAB() {
  const { incrementSyncTick } = useAdmin();
  const [syncing, setSyncing] = useState(false);
  const spin = useRef(new Animated.Value(0)).current;
  const anim = useRef(null);

  useEffect(() => {
    if (syncing) {
      anim.current = Animated.loop(
        Animated.timing(spin, { toValue: 1, duration: 900, easing: Easing.linear, useNativeDriver: true })
      );
      anim.current.start();
    } else {
      anim.current?.stop();
      spin.setValue(0);
    }
  }, [syncing]);

  if (!isSupabaseConfigured) return null;

  async function handleSync() {
    if (syncing) return;
    setSyncing(true);
    await syncPending();
    setSyncing(false);
    incrementSyncTick(); // triggers reload on all screens
  }

  const rotate = spin.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '360deg'] });

  return (
    <TouchableOpacity style={fabStyles.fab} onPress={handleSync} activeOpacity={0.85}>
      <Animated.View style={syncing ? { transform: [{ rotate }] } : undefined}>
        <Ionicons name="sync-outline" size={22} color="#fff" />
      </Animated.View>
    </TouchableOpacity>
  );
}

const TAB_ICONS = {
  Order:     ['fast-food',            'fast-food-outline'],
  Menu:      ['restaurant',           'restaurant-outline'],
  Inventory: ['cube',                 'cube-outline'],
  Summary:   ['bar-chart',            'bar-chart-outline'],
  Settings:  ['settings',             'settings-outline'],
  Admin:     ['shield-checkmark',     'shield-checkmark-outline'],
};

function Tabs() {
  const { isAdminUnlocked } = useAdmin();

  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        headerStyle: { backgroundColor: BRAND },
        headerTintColor: '#fff',
        headerTitleStyle: { fontWeight: '700' },
        tabBarActiveTintColor: BRAND,
        tabBarInactiveTintColor: '#aaa',
        tabBarStyle: { height: 60, paddingBottom: 6 },
        tabBarLabelStyle: { fontSize: 10, fontWeight: '600' },
        tabBarIcon: ({ color, size, focused }) => {
          const [active, inactive] = TAB_ICONS[route.name] || ['apps', 'apps-outline'];
          return <Ionicons name={focused ? active : inactive} size={size} color={color} />;
        },
      })}
    >
      <Tab.Screen name="Order"    component={OrderScreen}     options={{ title: 'Place Order',      tabBarLabel: 'Order' }} />
      {isAdminUnlocked && (
        <Tab.Screen name="Menu"      component={MenuScreen}      options={{ title: 'Menu / Products',  tabBarLabel: 'Products' }} />
      )}
      <Tab.Screen name="Inventory" component={InventoryScreen} options={{ title: 'Inventory', tabBarLabel: 'Inventory' }} />
      <Tab.Screen name="Summary"  component={SummaryScreen}   options={{ title: 'Sales Summary',    tabBarLabel: 'Summary' }} />
      <Tab.Screen name="Settings" component={SettingsScreen}  options={{ title: 'Store Settings',   tabBarLabel: 'Settings' }} />
      <Tab.Screen name="Admin"    component={AdminScreen}     options={{ title: 'Admin Dashboard',  tabBarLabel: 'Admin' }} />
    </Tab.Navigator>
  );
}

export default function App() {
  useState(() => { initDatabase(); });

  useEffect(() => {
    startSync();
    return () => stopSync();
  }, []);

  return (
    <AdminProvider>
      <NavigationContainer>
        <StatusBar style="dark" />
        <View style={{ flex: 1 }}>
          <Tabs />
          <SyncFAB />
        </View>
      </NavigationContainer>
    </AdminProvider>
  );
}

const fabStyles = StyleSheet.create({
  fab: {
    position: 'absolute',
    bottom: 74,
    left: 16,
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: BRAND,
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 6,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    zIndex: 999,
  },
});
