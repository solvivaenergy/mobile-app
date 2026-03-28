import React, { useState, useEffect, useCallback } from "react";
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  Alert,
  Linking,
  ActivityIndicator,
  RefreshControl,
} from "react-native";
import { Colors, Spacing, FontSizes } from "../config/theme";
import {
  fetchSupportContacts,
  SupportContacts,
  fetchSupportTickets,
  fetchEnergyTips,
  createSupportTicket,
  formatDate,
  formatPeso,
} from "../services/dataService";

const DEFAULT_SUPPORT_CONTACTS: SupportContacts = {
  phone: "+639178412254",
  email: "tech.support@solvivaenergy.com",
  helpdesk: "https://helpdesk.solviva.ph",
  emergencyEngineer: "+639178412254",
  operatingHours: "8:00 AM - 6:00 PM, Mon-Sat",
};

export default function HelpScreen() {
  const [newTicketSubject, setNewTicketSubject] = useState("");
  const [newTicketDescription, setNewTicketDescription] = useState("");
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [tickets, setTickets] = useState<any[]>([]);
  const [tips, setTips] = useState<any[]>([]);
  const [supportContacts, setSupportContacts] = useState<SupportContacts>(
    DEFAULT_SUPPORT_CONTACTS,
  );

  const loadData = useCallback(async () => {
    try {
      const [t, tp] = await Promise.all([
        fetchSupportTickets(),
        fetchEnergyTips(),
      ]);
      setTickets(t);
      setTips(tp);

      const contacts = await fetchSupportContacts();
      if (contacts) {
        setSupportContacts(contacts);
      }
    } catch (err) {
      console.log("HelpScreen loadData error:", err);
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

  const handleCall = (number: string) => {
    Linking.openURL(`tel:${number}`);
  };

  const handleEmail = () => {
    Linking.openURL(`mailto:${supportContacts.email}`);
  };

  const handleSubmitTicket = async () => {
    if (!newTicketSubject || !newTicketDescription) {
      Alert.alert("Please fill in all fields");
      return;
    }
    const result = await createSupportTicket(
      newTicketSubject,
      newTicketDescription,
    );
    if (result) {
      Alert.alert(
        "Ticket Submitted",
        "Your support ticket has been created. We will respond within 24-48 hours.",
        [{ text: "OK" }],
      );
      setNewTicketSubject("");
      setNewTicketDescription("");
      loadData();
    } else {
      Alert.alert("Error", "Failed to submit ticket. Please try again.");
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "open":
        return Colors.warning;
      case "in_progress":
        return "#2196F3";
      case "resolved":
        return Colors.success;
      case "closed":
        return Colors.textSecondary;
      default:
        return Colors.textSecondary;
    }
  };

  const getStatusLabel = (status: string) => {
    return status.replace("_", " ").replace(/\b\w/g, (l) => l.toUpperCase());
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
        <Text style={styles.headerTitle}>Help & Support</Text>
        <Text style={styles.headerSubtitle}>We're here for you</Text>
      </View>

      {/* Quick Contact */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Quick Contact</Text>
        <View style={styles.contactGrid}>
          <TouchableOpacity
            style={styles.contactCard}
            onPress={() => handleCall(supportContacts.phone)}
          >
            <Text style={styles.contactIcon}>📞</Text>
            <Text style={styles.contactLabel}>Call Support</Text>
            <Text style={styles.contactSub}>{supportContacts.phone}</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.contactCard} onPress={handleEmail}>
            <Text style={styles.contactIcon}>✉️</Text>
            <Text style={styles.contactLabel}>Email Us</Text>
            <Text style={styles.contactSub}>{supportContacts.email}</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.contactCard, { backgroundColor: "#FFF3E0" }]}
            onPress={() =>
              handleCall(
                supportContacts.emergencyEngineer ?? supportContacts.phone,
              )
            }
          >
            <Text style={styles.contactIcon}>🔧</Text>
            <Text style={styles.contactLabel}>Emergency</Text>
            <Text style={styles.contactSub}>After-hours engineer</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.contactCard, { backgroundColor: "#E8F5E9" }]}
            onPress={() =>
              Alert.alert("Live Chat", "Live chat feature coming soon!")
            }
          >
            <Text style={styles.contactIcon}>💬</Text>
            <Text style={styles.contactLabel}>Live Chat</Text>
            <Text style={styles.contactSub}>AI-powered support</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Submit New Ticket */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Submit a Ticket</Text>
        <View style={styles.formCard}>
          <TextInput
            style={styles.input}
            placeholder="Subject"
            placeholderTextColor={Colors.textSecondary}
            value={newTicketSubject}
            onChangeText={setNewTicketSubject}
          />
          <TextInput
            style={[styles.input, styles.textArea]}
            placeholder="Describe your issue..."
            placeholderTextColor={Colors.textSecondary}
            multiline
            numberOfLines={4}
            textAlignVertical="top"
            value={newTicketDescription}
            onChangeText={setNewTicketDescription}
          />
          <TouchableOpacity
            style={styles.submitButton}
            onPress={handleSubmitTicket}
          >
            <Text style={styles.submitButtonText}>Submit Ticket</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* My Tickets */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>My Tickets</Text>
        {tickets.map((ticket: any) => (
          <View key={ticket.id} style={styles.ticketCard}>
            <View style={styles.ticketHeader}>
              <Text style={styles.ticketSubject}>{ticket.subject}</Text>
              <View
                style={[
                  styles.statusBadge,
                  { backgroundColor: getStatusColor(ticket.status) + "20" },
                ]}
              >
                <Text
                  style={[
                    styles.statusText,
                    { color: getStatusColor(ticket.status) },
                  ]}
                >
                  {getStatusLabel(ticket.status)}
                </Text>
              </View>
            </View>
            <Text style={styles.ticketDescription} numberOfLines={2}>
              {ticket.description}
            </Text>
            <View style={styles.ticketFooter}>
              <Text style={styles.ticketDate}>
                Created: {formatDate(ticket.created_at)}
              </Text>
              <Text style={styles.ticketPriority}>
                Priority: {ticket.priority}
              </Text>
            </View>
          </View>
        ))}
      </View>

      {/* AI Energy Tips */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>💡 AI Energy Tips</Text>
        {tips.map((tip: any) => (
          <View key={tip.id} style={styles.tipCard}>
            <Text style={styles.tipTitle}>{tip.title}</Text>
            <Text style={styles.tipDescription}>{tip.description}</Text>
            <Text style={styles.tipSavings}>
              Potential savings:{" "}
              {formatPeso(Number(tip.potential_savings_php) || 0)}/month
            </Text>
          </View>
        ))}
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
  },
  section: {
    paddingHorizontal: Spacing.lg,
    marginTop: Spacing.lg,
  },
  sectionTitle: {
    fontSize: FontSizes.xl,
    fontWeight: "700",
    color: Colors.text,
    marginBottom: Spacing.sm,
  },
  contactGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "space-between",
  },
  contactCard: {
    width: "48%",
    backgroundColor: Colors.surface,
    borderRadius: 16,
    padding: Spacing.md,
    marginBottom: Spacing.sm,
    alignItems: "center",
    elevation: 2,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 3,
  },
  contactIcon: { fontSize: 28, marginBottom: 8 },
  contactLabel: {
    fontSize: FontSizes.md,
    fontWeight: "600",
    color: Colors.text,
  },
  contactSub: {
    fontSize: FontSizes.xs,
    color: Colors.textSecondary,
    marginTop: 4,
    textAlign: "center",
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
  textArea: {
    height: 100,
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
  ticketCard: {
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
  ticketHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: Spacing.sm,
  },
  ticketSubject: {
    fontSize: FontSizes.lg,
    fontWeight: "600",
    color: Colors.text,
    flex: 1,
    marginRight: Spacing.sm,
  },
  statusBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
  },
  statusText: {
    fontSize: FontSizes.sm,
    fontWeight: "600",
  },
  ticketDescription: {
    fontSize: FontSizes.md,
    color: Colors.textSecondary,
    marginBottom: Spacing.sm,
  },
  ticketFooter: {
    flexDirection: "row",
    justifyContent: "space-between",
  },
  ticketDate: { fontSize: FontSizes.sm, color: Colors.textSecondary },
  ticketPriority: { fontSize: FontSizes.sm, color: Colors.textSecondary },
  tipCard: {
    backgroundColor: "#E8F5E9",
    borderRadius: 16,
    padding: Spacing.lg,
    marginBottom: Spacing.sm,
    borderLeftWidth: 4,
    borderLeftColor: Colors.primaryLight,
  },
  tipTitle: {
    fontSize: FontSizes.lg,
    fontWeight: "700",
    color: Colors.primary,
    marginBottom: Spacing.xs,
  },
  tipDescription: {
    fontSize: FontSizes.md,
    color: Colors.text,
    lineHeight: 20,
  },
  tipSavings: {
    fontSize: FontSizes.sm,
    color: Colors.primaryLight,
    fontWeight: "600",
    marginTop: Spacing.sm,
  },
});
