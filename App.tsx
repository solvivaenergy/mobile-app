import React, { useEffect, useState } from "react";
import { NavigationContainer } from "@react-navigation/native";
import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import { StatusBar } from "expo-status-bar";
import {
  Text,
  View,
  StyleSheet,
  ActivityIndicator,
  Platform,
} from "react-native";
import { Session } from "@supabase/supabase-js";
import { supabase } from "./src/services/supabase";

import LoginScreen from "./src/screens/LoginScreen";
import HomeScreen from "./src/screens/HomeScreen";
import EnergyScreen from "./src/screens/EnergyScreen";
import HelpScreen from "./src/screens/HelpScreen";
import ReferralsScreen from "./src/screens/ReferralsScreen";
import AccountScreen from "./src/screens/AccountScreen";

const Tab = createBottomTabNavigator();

// Simple tab icon component using emoji (no external icon library needed)
function TabIcon({ icon, focused }: { icon: string; focused: boolean }) {
  return (
    <View style={[styles.tabIcon, focused && styles.tabIconFocused]}>
      <Text style={{ fontSize: 22 }}>{icon}</Text>
    </View>
  );
}

export default function App() {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Check for existing session
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setLoading(false);
    });

    // Listen for auth state changes
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
    });

    return () => subscription.unsubscribe();
  }, []);

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#1B5E20" />
      </View>
    );
  }

  if (!session) {
    return (
      <>
        <StatusBar style="light" />
        <LoginScreen />
      </>
    );
  }

  return (
    <>
      <StatusBar style="light" />
      <NavigationContainer>
        <Tab.Navigator
          screenOptions={{
            headerShown: false,
            tabBarStyle: {
              backgroundColor: "#FFFFFF",
              borderTopWidth: 1,
              borderTopColor: "#E0E0E0",
              height: Platform.OS === "web" ? 60 : 80,
              paddingBottom: Platform.OS === "web" ? 8 : 16,
              paddingTop: 8,
              elevation: 10,
              shadowColor: "#000",
              shadowOffset: { width: 0, height: -2 },
              shadowOpacity: 0.1,
              shadowRadius: 8,
            },
            tabBarActiveTintColor: "#1B5E20",
            tabBarInactiveTintColor: "#757575",
            tabBarLabelStyle: {
              fontSize: 11,
              fontWeight: "600",
            },
          }}
        >
          <Tab.Screen
            name="Home"
            component={HomeScreen}
            options={{
              tabBarIcon: ({ focused }) => (
                <TabIcon icon="🏠" focused={focused} />
              ),
            }}
          />
          <Tab.Screen
            name="Energy"
            component={EnergyScreen}
            options={{
              tabBarLabel: "Energy Overview",
              tabBarIcon: ({ focused }) => (
                <TabIcon icon="☀️" focused={focused} />
              ),
            }}
          />
          <Tab.Screen
            name="Referrals"
            component={ReferralsScreen}
            options={{
              tabBarIcon: ({ focused }) => (
                <TabIcon icon="🤝" focused={focused} />
              ),
            }}
          />
          <Tab.Screen
            name="Help"
            component={HelpScreen}
            options={{
              tabBarIcon: ({ focused }) => (
                <TabIcon icon="💬" focused={focused} />
              ),
            }}
          />
          <Tab.Screen
            name="My Account"
            component={AccountScreen}
            options={{
              tabBarIcon: ({ focused }) => (
                <TabIcon icon="👤" focused={focused} />
              ),
            }}
          />
        </Tab.Navigator>
      </NavigationContainer>
    </>
  );
}

const styles = StyleSheet.create({
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#F5F5F5",
  },
  tabIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: "center",
    alignItems: "center",
  },
  tabIconFocused: {
    backgroundColor: "rgba(27, 94, 32, 0.1)",
  },
});
