import React, { useState } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
  Alert,
  Image,
} from "react-native";
import { Colors, Spacing, FontSizes } from "../config/theme";
import { supabase } from "../services/supabase";

export default function LoginScreen() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [isSignUp, setIsSignUp] = useState(false);

  const handleLogin = async () => {
    if (!email || !password) {
      Alert.alert("Error", "Please enter both email and password.");
      return;
    }

    setLoading(true);
    try {
      const { error } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password,
      });

      if (error) {
        Alert.alert("Login Failed", error.message);
      }
    } catch (err: any) {
      Alert.alert("Error", err.message || "Something went wrong.");
    } finally {
      setLoading(false);
    }
  };

  const handleSignUp = async () => {
    if (!email || !password) {
      Alert.alert("Error", "Please enter both email and password.");
      return;
    }

    if (password.length < 6) {
      Alert.alert("Error", "Password must be at least 6 characters.");
      return;
    }

    setLoading(true);
    try {
      const { error } = await supabase.auth.signUp({
        email: email.trim(),
        password,
      });

      if (error) {
        Alert.alert("Sign Up Failed", error.message);
      } else {
        Alert.alert(
          "Account Created",
          "Check your email for a confirmation link, then log in.",
        );
        setIsSignUp(false);
      }
    } catch (err: any) {
      Alert.alert("Error", err.message || "Something went wrong.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === "ios" ? "padding" : "height"}
    >
      <View style={styles.inner}>
        {/* Logo / Brand */}
        <View style={styles.brandContainer}>
          <Image
            source={{
              uri: "https://cdn.prod.website-files.com/64a21c09e7f60775e314653f/67e0fcca9b9826056a9e8b2f_Group%2061.png",
            }}
            style={styles.logo}
            resizeMode="contain"
          />
          <Text style={styles.brandTagline}>Smart Solar Energy Management</Text>
        </View>

        {/* Form */}
        <View style={styles.formContainer}>
          <Text style={styles.formTitle}>
            {isSignUp ? "Create Account" : "Welcome Back"}
          </Text>

          <View style={styles.inputContainer}>
            <Text style={styles.inputLabel}>Email</Text>
            <TextInput
              style={styles.input}
              placeholder="Enter your Email"
              placeholderTextColor="#999"
              value={email}
              onChangeText={setEmail}
              keyboardType="email-address"
              autoCapitalize="none"
              autoCorrect={false}
              returnKeyType="next"
            />
          </View>

          <View style={styles.inputContainer}>
            <Text style={styles.inputLabel}>Password</Text>
            <TextInput
              style={styles.input}
              placeholder="Enter your password"
              placeholderTextColor="#999"
              value={password}
              onChangeText={setPassword}
              secureTextEntry
              returnKeyType="go"
              onSubmitEditing={isSignUp ? handleSignUp : handleLogin}
            />
          </View>

          <TouchableOpacity
            style={[styles.primaryButton, loading && styles.buttonDisabled]}
            onPress={isSignUp ? handleSignUp : handleLogin}
            disabled={loading}
          >
            {loading ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={styles.primaryButtonText}>
                {isSignUp ? "Sign Up" : "Log In"}
              </Text>
            )}
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.secondaryButton}
            onPress={() => setIsSignUp(!isSignUp)}
          >
            <Text style={styles.secondaryButtonText}>
              {isSignUp
                ? "Already have an account? Log In"
                : "Don't have an account? Sign Up"}
            </Text>
          </TouchableOpacity>
        </View>

        {/* Footer */}
        <Text style={styles.footer}>Powered by Solviva Energy</Text>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#d2ff1e",
  },
  inner: {
    flex: 1,
    justifyContent: "center",
    paddingHorizontal: Spacing.lg,
  },
  brandContainer: {
    alignItems: "center",
    marginBottom: 40,
  },
  logo: {
    width: 220,
    height: 80,
    marginBottom: Spacing.sm,
  },
  brandTagline: {
    fontSize: FontSizes.md,
    color: Colors.primary,
    marginTop: Spacing.sm,
    fontWeight: "600",
  },
  formContainer: {
    backgroundColor: Colors.surface,
    borderRadius: 20,
    padding: Spacing.lg,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
    elevation: 8,
  },
  formTitle: {
    fontSize: FontSizes.xl,
    fontWeight: "700",
    color: Colors.text,
    textAlign: "center",
    marginBottom: Spacing.lg,
  },
  inputContainer: {
    marginBottom: Spacing.md,
  },
  inputLabel: {
    fontSize: FontSizes.sm,
    fontWeight: "600",
    color: Colors.textSecondary,
    marginBottom: Spacing.xs,
  },
  input: {
    backgroundColor: "#F5F5F5",
    borderRadius: 12,
    paddingHorizontal: Spacing.md,
    paddingVertical: 14,
    fontSize: FontSizes.lg,
    color: Colors.text,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  primaryButton: {
    backgroundColor: "#d2ff1e",
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: "center",
    marginTop: Spacing.md,
  },
  buttonDisabled: {
    opacity: 0.7,
  },
  primaryButtonText: {
    color: "#1B5E20",
    fontSize: FontSizes.lg,
    fontWeight: "700",
  },
  secondaryButton: {
    paddingVertical: Spacing.md,
    alignItems: "center",
  },
  secondaryButtonText: {
    color: Colors.primary,
    fontSize: FontSizes.md,
    fontWeight: "600",
  },
  footer: {
    textAlign: "center",
    color: "rgba(0,0,0,0.4)",
    fontSize: FontSizes.sm,
    marginTop: 40,
  },
});
