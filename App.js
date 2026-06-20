import React, { useState, useEffect } from 'react';
import { StatusBar } from 'expo-status-bar';
import { NavigationContainer } from '@react-navigation/native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { Ionicons } from '@expo/vector-icons';

import { initDatabase } from './src/database/db';
import { startSync, stopSync } from './src/services/syncService';
import { AdminProvider, useAdmin } from './src/context/AdminContext';
import OrderScreen from './src/screens/OrderScreen';
import MenuScreen from './src/screens/MenuScreen';
import InventoryScreen from './src/screens/InventoryScreen';
import SummaryScreen from './src/screens/SummaryScreen';
import SettingsScreen from './src/screens/SettingsScreen';
import AdminScreen from './src/screens/AdminScreen';

const Tab = createBottomTabNavigator();
const BRAND = '#e8521a';

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
      <Tab.Screen name="Menu"     component={MenuScreen}      options={{ title: 'Menu / Products',  tabBarLabel: 'Products' }} />
      {isAdminUnlocked && (
        <Tab.Screen name="Inventory" component={InventoryScreen} options={{ title: 'Inventory', tabBarLabel: 'Inventory' }} />
      )}
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
        <Tabs />
      </NavigationContainer>
    </AdminProvider>
  );
}
