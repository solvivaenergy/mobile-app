import React, { useState, useEffect, useCallback } from "react";
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  Alert,
  Share,
  ActivityIndicator,
  RefreshControl,
} from "react-native";
import { Colors, Spacing, FontSizes } from "../config/theme";
import {
  fetchUserProfile,
  fetchReferrals,
  createReferral,
  formatPeso,
  formatDate,
} from "../services/dataService";

export default function ReferralsScreen() {
  const [refereeName, setRefereeName] = useState("");
  const [refereePhone, setRefereePhone] = useState("");
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [referralCode, setReferralCode] = useState("");
  const [referrals, setReferrals] = useState<any[]>([]);

  const loadData = useCallback(async () => {
    try {
      const [profile, refs] = await Promise.all([
        fetchUserProfile(),
        fetchReferrals(),
      ]);
      setReferralCode(profile?.referral_code ?? "");
      setReferrals(refs);
    } catch (err) {
      console.log("ReferralsScreen loadData error:", err);
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

  const totalEarned = referrals
    .filter((r: any) => r.status === "installed" || r.status === "paid")
    .reduce((sum: number, r: any) => sum + Number(r.estimated_earnings), 0);

  const totalPending = referrals
    .filter((r: any) => r.status === "pending" || r.status === "contacted")
    .reduce((sum: number, r: any) => sum + Number(r.estimated_earnings), 0);

  const handleShareCode = async () => {
    try {
      await Share.share({
        message: `Join Solviva Solar! Use my referral code ${referralCode} when you sign up. Save on electricity with solar energy! 🌞`,
      });
    } catch (error) {
      // Share cancelled
    }
  };

  const handleSubmitReferral = async () => {
    if (!refereeName || !refereePhone) {
      Alert.alert("Please fill in all fields");
      return;
    }
    const result = await createReferral(
      refereeName,
      refereePhone,
      referralCode,
    );
    if (result) {
      Alert.alert(
        "Referral Submitted! 🎉",
        `Thank you for referring ${refereeName}. You'll earn ₱10,000 when they install their solar system!`,
        [{ text: "OK" }],
      );
      setRefereeName("");
      setRefereePhone("");
      loadData(); // refresh list
    } else {
      Alert.alert("Error", "Failed to submit referral. Please try again.");
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "pending":
        return Colors.warning;
      case "contacted":
        return "#2196F3";
      case "installed":
        return Colors.success;
      case "paid":
        return Colors.primary;
      default:
        return Colors.textSecondary;
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case "pending":
        return "⏳";
      case "contacted":
        return "📞";
      case "installed":
        return "☀️";
      case "paid":
        return "✅";
      default:
        return "";
    }
  };

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
        <Text style={styles.headerTitle}>Referral Program</Text>
        <Text style={styles.headerSubtitle}>Earn ₱10,000 per referral</Text>
      </View>

      {/* Earnings Summary */}
      <View style={styles.earningsSection}>
        <View style={styles.earningsCards}>
          <View style={[styles.earningsCard, { backgroundColor: "#E8F5E9" }]}>
            <Text style={styles.earningsIcon}>💰</Text>
            <Text style={styles.earningsCardValue}>
              {formatPeso(totalEarned)}
            </Text>
            <Text style={styles.earningsCardLabel}>Total Earned</Text>
          </View>
          <View style={[styles.earningsCard, { backgroundColor: "#FFF3E0" }]}>
            <Text style={styles.earningsIcon}>⏳</Text>
            <Text style={styles.earningsCardValue}>
              {formatPeso(totalPending)}
            </Text>
            <Text style={styles.earningsCardLabel}>Pending</Text>
          </View>
        </View>
      </View>

      {/* Share Referral Code */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Your Referral Code</Text>
        <View style={styles.codeCard}>
          <Text style={styles.referralCode}>{referralCode || "—"}</Text>
          <TouchableOpacity
            style={styles.shareButton}
            onPress={handleShareCode}
          >
            <Text style={styles.shareButtonText}>📤 Share Link</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Submit New Referral */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Refer a Friend</Text>
        <View style={styles.formCard}>
          <TextInput
            style={styles.input}
            placeholder="Friend's Name"
            placeholderTextColor={Colors.textSecondary}
            value={refereeName}
            onChangeText={setRefereeName}
          />
          <TextInput
            style={styles.input}
            placeholder="Friend's Phone Number"
            placeholderTextColor={Colors.textSecondary}
            keyboardType="phone-pad"
            value={refereePhone}
            onChangeText={setRefereePhone}
          />
          <TouchableOpacity
            style={styles.submitButton}
            onPress={handleSubmitReferral}
          >
            <Text style={styles.submitButtonText}>Submit Referral</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Referral Tracking */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>My Referrals</Text>
        {referrals.map((referral: any) => (
          <View key={referral.id} style={styles.referralCard}>
            <View style={styles.referralHeader}>
              <View style={styles.referralInfo}>
                <Text style={styles.referralName}>{referral.referee_name}</Text>
                <Text style={styles.referralPhone}>
                  {referral.referee_phone}
                </Text>
              </View>
              <View
                style={[
                  styles.statusBadge,
                  { backgroundColor: getStatusColor(referral.status) + "20" },
                ]}
              >
                <Text
                  style={[
                    styles.statusText,
                    { color: getStatusColor(referral.status) },
                  ]}
                >
                  {getStatusIcon(referral.status)}{" "}
                  {referral.status.charAt(0).toUpperCase() +
                    referral.status.slice(1)}
                </Text>
              </View>
            </View>
            <View style={styles.referralFooter}>
              <Text style={styles.referralDate}>
                Referred: {formatDate(referral.created_at)}
              </Text>
              <Text style={styles.referralEarning}>
                {formatPeso(referral.estimated_earnings)}
              </Text>
            </View>
          </View>
        ))}
      </View>

      {/* How it Works */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>How It Works</Text>
        <View style={styles.stepsCard}>
          {[
            {
              step: "1",
              title: "Share your code",
              desc: "Share your unique referral code with friends and family",
            },
            {
              step: "2",
              title: "They sign up",
              desc: "Your referral signs up for Solviva solar installation",
            },
            {
              step: "3",
              title: "Installation complete",
              desc: "Once their system is installed and energized",
            },
            {
              step: "4",
              title: "You earn ₱10,000",
              desc: "Referral bonus is credited to your account",
            },
          ].map((item) => (
            <View key={item.step} style={styles.stepRow}>
              <View style={styles.stepCircle}>
                <Text style={styles.stepNumber}>{item.step}</Text>
              </View>
              <View style={styles.stepContent}>
                <Text style={styles.stepTitle}>{item.title}</Text>
                <Text style={styles.stepDesc}>{item.desc}</Text>
              </View>
            </View>
          ))}
        </View>
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
    paddingBottom: Spacing.lg,
  },
  headerTitle: {
    fontSize: FontSizes.xxl,
    fontWeight: "bold",
    color: "#1B5E20",
  },
  headerSubtitle: {
    fontSize: FontSizes.md,
    color: "#2E7D32",
    marginTop: 4,
    fontWeight: "600",
  },
  earningsSection: { paddingHorizontal: Spacing.lg, marginTop: Spacing.lg },
  earningsCards: { flexDirection: "row", justifyContent: "space-between" },
  earningsCard: {
    width: "48%",
    borderRadius: 16,
    padding: Spacing.lg,
    alignItems: "center",
  },
  earningsIcon: { fontSize: 28, marginBottom: 8 },
  earningsCardValue: {
    fontSize: FontSizes.xl,
    fontWeight: "700",
    color: Colors.text,
  },
  earningsCardLabel: {
    fontSize: FontSizes.sm,
    color: Colors.textSecondary,
    marginTop: 4,
  },
  section: { paddingHorizontal: Spacing.lg, marginTop: Spacing.lg },
  sectionTitle: {
    fontSize: FontSizes.xl,
    fontWeight: "700",
    color: Colors.text,
    marginBottom: Spacing.sm,
  },
  codeCard: {
    backgroundColor: Colors.surface,
    borderRadius: 16,
    paddingVertical: Spacing.lg,
    paddingHorizontal: Spacing.lg,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    overflow: "hidden",
    elevation: 2,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 3,
  },
  referralCode: {
    fontSize: FontSizes.lg,
    fontWeight: "700",
    color: Colors.primary,
    letterSpacing: 1,
    flexShrink: 1,
    marginRight: Spacing.md,
  },
  shareButton: {
    backgroundColor: Colors.accent,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderRadius: 12,
    flexShrink: 0,
  },
  shareButtonText: {
    fontSize: FontSizes.md,
    fontWeight: "600",
    color: Colors.primary,
  },
  formCard: {
    backgroundColor: Colors.surface,
    borderRadius: 16,
    padding: Spacing.lg,
    elevation: 2,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 3,
  },
  input: {
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 12,
    padding: Spacing.md,
    fontSize: FontSizes.md,
    color: Colors.text,
    marginBottom: Spacing.sm,
  },
  submitButton: {
    backgroundColor: Colors.primary,
    borderRadius: 12,
    padding: Spacing.md,
    alignItems: "center",
    marginTop: Spacing.sm,
  },
  submitButtonText: {
    color: Colors.textLight,
    fontSize: FontSizes.lg,
    fontWeight: "700",
  },
  referralCard: {
    backgroundColor: Colors.surface,
    borderRadius: 16,
    padding: Spacing.lg,
    marginBottom: Spacing.sm,
    elevation: 2,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 3,
  },
  referralHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  referralInfo: { flex: 1 },
  referralName: {
    fontSize: FontSizes.lg,
    fontWeight: "600",
    color: Colors.text,
  },
  referralPhone: {
    fontSize: FontSizes.sm,
    color: Colors.textSecondary,
    marginTop: 2,
  },
  statusBadge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8 },
  statusText: { fontSize: FontSizes.sm, fontWeight: "600" },
  referralFooter: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: Spacing.sm,
    paddingTop: Spacing.sm,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
  },
  referralDate: { fontSize: FontSizes.sm, color: Colors.textSecondary },
  referralEarning: {
    fontSize: FontSizes.md,
    fontWeight: "700",
    color: Colors.primary,
  },
  stepsCard: {
    backgroundColor: Colors.surface,
    borderRadius: 16,
    padding: Spacing.lg,
    elevation: 2,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 3,
  },
  stepRow: { flexDirection: "row", marginBottom: Spacing.lg },
  stepCircle: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: Colors.primary,
    justifyContent: "center",
    alignItems: "center",
    marginRight: Spacing.md,
  },
  stepNumber: {
    fontSize: FontSizes.md,
    fontWeight: "700",
    color: Colors.textLight,
  },
  stepContent: { flex: 1 },
  stepTitle: { fontSize: FontSizes.lg, fontWeight: "600", color: Colors.text },
  stepDesc: {
    fontSize: FontSizes.md,
    color: Colors.textSecondary,
    marginTop: 2,
  },
});
