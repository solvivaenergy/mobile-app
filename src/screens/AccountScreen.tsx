import React, { useState, useEffect, useCallback } from "react";
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
  RefreshControl,
  Platform,
  Linking,
} from "react-native";
import { Colors, Spacing, FontSizes } from "../config/theme";
import {
  fetchUserProfile,
  fetchSolarSystem,
  formatDate,
} from "../services/dataService";
import { supabase } from "../services/supabase";

export default function AccountScreen() {
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [user, setUser] = useState<any>(null);
  const [system, setSystem] = useState<any>(null);

  const loadData = useCallback(async () => {
    try {
      const [u, s] = await Promise.all([
        fetchUserProfile(),
        fetchSolarSystem(),
      ]);
      setUser(u);
      setSystem(s);
    } catch (err) {
      console.log("AccountScreen loadData error:", err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);
  const onRefresh = () => {
    setRefreshing(true);
    loadData();
  };

  const handleLogout = async () => {
    if (Platform.OS === "web") {
      // Use the standard browser confirmation dialog for the web
      const confirmed = window.confirm("Are you sure you want to log out?");
      if (confirmed) {
        await supabase.auth.signOut();
      }
    } else {
      // Keep the native Alert with custom buttons for iOS/Android
      Alert.alert("Log Out", "Are you sure you want to log out?", [
        { text: "Cancel", style: "cancel" },
        {
          text: "Log Out",
          style: "destructive",
          onPress: async () => {
            await supabase.auth.signOut();
          },
        },
      ]);
    }
  };

  const menuItems = [
    {
      icon: "👤",
      label: "Personal Information",
      onPress: () => Alert.alert("Personal Info", "Edit profile coming soon"),
    },
    {
      icon: "🏠",
      label: "My Solar System",
      onPress: () =>
        Alert.alert(
          "System",
          `${system?.system_name ?? "N/A"}\n${system?.capacity_kwp ?? "N/A"} kWp\nInstalled: ${system?.installation_date ?? "N/A"}`,
        ),
    },
    {
      icon: "📄",
      label: "Documents",
      onPress: () =>
        Alert.alert("Documents", "Document management coming in Phase 2"),
    },
    {
      icon: "💳",
      label: "Payment History",
      onPress: () => Alert.alert("Payments", "Payment history coming soon"),
    },
    {
      icon: "🔔",
      label: "Notifications",
      onPress: () =>
        Alert.alert("Notifications", "Notification settings coming soon"),
    },
    {
      icon: "⚙️",
      label: "Settings",
      onPress: () => Alert.alert("Settings", "App settings coming soon"),
    },
    {
      icon: "📋",
      label: "Terms & Conditions",
      onPress: () =>
        Linking.openURL(
          "http://solvivaenergy.com/standard-terms-and-conditions",
        ),
    },
    {
      icon: "❓",
      label: "FAQ",
      onPress: () => Linking.openURL("https://www.solvivaenergy.com/faq"),
    },
  ];

  if (loading) {
    return (
      <View
        style={{
          flex: 1,
          justifyContent: "center",
          alignItems: "center",
          backgroundColor: Colors.background,
        }}
      >
        <ActivityIndicator size="large" color={Colors.primary} />
      </View>
    );
  }

  return (
    <ScrollView
      style={styles.container}
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
      }
    >
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.avatarCircle}>
          <Text style={styles.avatarText}>
            {(user?.full_name ?? "?")
              .split(" ")
              .map((n: string) => n[0])
              .join("")}
          </Text>
        </View>
        <Text style={styles.userName}>{user?.full_name ?? "—"}</Text>
        <Text style={styles.userEmail}>{user?.email ?? "—"}</Text>
        <Text style={styles.userPhone}>{user?.phone ?? "—"}</Text>
      </View>

      {/* System Status Card */}
      <View style={styles.section}>
        <View style={styles.systemCard}>
          <View style={styles.systemHeader}>
            <Text style={styles.systemIcon}>☀️</Text>
            <View style={styles.systemInfo}>
              <Text style={styles.systemName}>
                {system?.system_name ?? "—"}
              </Text>
              <Text style={styles.systemAddress}>{system?.address ?? "—"}</Text>
            </View>
            <View style={styles.statusDot} />
          </View>
          <View style={styles.systemDetails}>
            <View style={styles.detailItem}>
              <Text style={styles.detailLabel}>Capacity</Text>
              <Text style={styles.detailValue}>
                {system?.capacity_kwp ?? "—"} kWp
              </Text>
            </View>
            <View style={styles.detailItem}>
              <Text style={styles.detailLabel}>Battery</Text>
              <Text style={styles.detailValue}>
                {system?.battery_capacity_kwh ?? "—"} kWh
              </Text>
            </View>
            <View style={styles.detailItem}>
              <Text style={styles.detailLabel}>Since</Text>
              <Text style={styles.detailValue}>
                {system?.installation_date
                  ? formatDate(system.installation_date)
                  : "—"}
              </Text>
            </View>
          </View>
        </View>
      </View>

      {/* Menu Items */}
      <View style={styles.section}>
        <View style={styles.menuCard}>
          {menuItems.map((item, index) => (
            <TouchableOpacity
              key={item.label}
              style={[
                styles.menuItem,
                index < menuItems.length - 1 && styles.menuItemBorder,
              ]}
              onPress={item.onPress}
            >
              <Text style={styles.menuIcon}>{item.icon}</Text>
              <Text style={styles.menuLabel}>{item.label}</Text>
              <Text style={styles.menuArrow}>›</Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>

      {/* App Info */}
      <View style={styles.section}>
        <View style={styles.appInfoCard}>
          <Text style={styles.appName}>Solviva</Text>
          <Text style={styles.appVersion}>Version 1.0.0 (Phase 1 MVP)</Text>
          <Text style={styles.appTagline}>
            Empowering Filipino solar households
          </Text>
        </View>
      </View>

      {/* Logout */}
      <View style={styles.section}>
        <TouchableOpacity style={styles.logoutButton} onPress={handleLogout}>
          <Text style={styles.logoutText}>Log Out</Text>
        </TouchableOpacity>
      </View>

      <View style={{ height: 30 }} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  header: {
    backgroundColor: "#d2ff1e",
    paddingHorizontal: Spacing.lg,
    paddingTop: 60,
    paddingBottom: Spacing.xl,
    alignItems: "center",
  },
  avatarCircle: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: "#1B5E20",
    justifyContent: "center",
    alignItems: "center",
    marginBottom: Spacing.md,
  },
  avatarText: {
    fontSize: FontSizes.xxl,
    fontWeight: "bold",
    color: "#d2ff1e",
  },
  userName: {
    fontSize: FontSizes.xxl,
    fontWeight: "bold",
    color: "#1B5E20",
  },
  userEmail: {
    fontSize: FontSizes.md,
    color: "#2E7D32",
    marginTop: 4,
  },
  userPhone: {
    fontSize: FontSizes.md,
    color: "#2E7D32",
    marginTop: 2,
  },
  section: {
    paddingHorizontal: Spacing.lg,
    marginTop: Spacing.lg,
  },
  systemCard: {
    backgroundColor: Colors.surface,
    borderRadius: 16,
    padding: Spacing.lg,
    elevation: 2,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 3,
  },
  systemHeader: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: Spacing.md,
  },
  systemIcon: { fontSize: 32, marginRight: Spacing.md },
  systemInfo: { flex: 1 },
  systemName: { fontSize: FontSizes.lg, fontWeight: "600", color: Colors.text },
  systemAddress: {
    fontSize: FontSizes.sm,
    color: Colors.textSecondary,
    marginTop: 2,
  },
  statusDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: Colors.success,
  },
  systemDetails: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingTop: Spacing.md,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
  },
  detailItem: { alignItems: "center" },
  detailLabel: { fontSize: FontSizes.sm, color: Colors.textSecondary },
  detailValue: {
    fontSize: FontSizes.md,
    fontWeight: "600",
    color: Colors.text,
    marginTop: 2,
  },
  menuCard: {
    backgroundColor: Colors.surface,
    borderRadius: 16,
    overflow: "hidden",
    elevation: 2,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 3,
  },
  menuItem: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.lg,
  },
  menuItemBorder: {
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  menuIcon: { fontSize: 22, marginRight: Spacing.md },
  menuLabel: { flex: 1, fontSize: FontSizes.lg, color: Colors.text },
  menuArrow: { fontSize: 24, color: Colors.textSecondary },
  appInfoCard: {
    backgroundColor: Colors.accent,
    borderRadius: 16,
    padding: Spacing.lg,
    alignItems: "center",
  },
  appName: {
    fontSize: FontSizes.xxl,
    fontWeight: "bold",
    color: Colors.primary,
  },
  appVersion: { fontSize: FontSizes.sm, color: Colors.primary, marginTop: 4 },
  appTagline: {
    fontSize: FontSizes.md,
    color: Colors.primary,
    marginTop: Spacing.sm,
    textAlign: "center",
  },
  logoutButton: {
    backgroundColor: Colors.surface,
    borderRadius: 16,
    padding: Spacing.md,
    alignItems: "center",
    borderWidth: 1,
    borderColor: Colors.error,
  },
  logoutText: {
    fontSize: FontSizes.lg,
    fontWeight: "600",
    color: Colors.error,
  },
});
