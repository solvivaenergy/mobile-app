import React, { useState, useEffect, useCallback } from "react";
import {
  View,
  Text,
  ScrollView,
  Modal,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  Alert,
  Linking,
  ActivityIndicator,
  RefreshControl,
  Platform,
} from "react-native";
import { Picker } from "@react-native-picker/picker";
import { Colors, Spacing, FontSizes } from "../config/theme";
import {
  fetchSupportContacts,
  SupportContacts,
  fetchOdooSupportTickets,
  fetchEnergyTips,
  fetchUserProfile,
  formatDate,
  formatPeso,
} from "../services/dataService";
import { supabase } from "../services/supabase";

const DEFAULT_SUPPORT_CONTACTS: SupportContacts = {
  phone: "+639178412254",
  email: "tech.support@solvivaenergy.com",
  helpdesk: "https://helpdesk.solviva.ph",
  emergencyEngineer: "+639178412254",
  operatingHours: "8:00 AM - 6:00 PM, Mon-Sat",
};

type CategoryEntry = {
  label: string;
  value: string;
  type: "general" | "technical";
};

const TICKET_CATEGORIES: CategoryEntry[] = [
  // General (non-technical)
  { label: "General Inquiry", value: "General Inquiry", type: "general" },
  {
    label: "Service Availability",
    value: "Service Availability",
    type: "general",
  },
  { label: "Payment Options", value: "Payment Options", type: "general" },
  // Technical — System Performance
  {
    label: "Low energy output",
    value: "Low energy output",
    type: "technical",
  },
  {
    label: "Online monitoring is not working",
    value: "Online monitoring is not working",
    type: "technical",
  },
  // Technical — Safety Issues
  {
    label:
      "Unusual signs on inverter and components (heat, smoke, discoloration, sparks)",
    value:
      "Unusual signs on inverter and components (heat, smoke, discoloration, sparks)",
    type: "technical",
  },
  { label: "Electrical shocks", value: "Electrical shocks", type: "technical" },
  {
    label: "Structural or roof damage / leak",
    value: "Structural or roof damage / leak",
    type: "technical",
  },
  {
    label: "Wiring or connection faults / loose connections",
    value: "Wiring or connection faults / loose connections",
    type: "technical",
  },
  // Technical — Warranty Claims
  {
    label: "Panel damage – Warranty Claim",
    value: "Panel damage – Warranty Claim",
    type: "technical",
  },
  {
    label: "Inverter issues – Warranty Claim",
    value: "Inverter issues – Warranty Claim",
    type: "technical",
  },
  {
    label: "Battery problems – Warranty Claim",
    value: "Battery problems – Warranty Claim",
    type: "technical",
  },
  {
    label: "Other workmanship issues – Warranty Claim",
    value: "Other workmanship issues – Warranty Claim",
    type: "technical",
  },
];

const getGmt8Timestamp = (): string => {
  const now = new Date();
  const gmt8Time = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Asia/Manila",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  }).format(now);
  const [datePart, timePart] = gmt8Time.split(", ");
  const [day, month, year] = datePart.split("/");
  return `${year}-${month}-${day} ${timePart}`;
};

const N8N_WEBHOOK =
  "https://solviva.app.n8n.cloud/webhook/webflow-customer-support";

const stripHtml = (html: string): string =>
  (html ?? "").replace(/<[^>]*>/g, "").trim();

const getOdooStageColor = (stageName: string): string => {
  const s = (stageName ?? "").toLowerCase();
  if (s.includes("solved") || s.includes("done") || s.includes("closed"))
    return Colors.success;
  if (s.includes("progress") || s.includes("process")) return "#2196F3";
  if (s.includes("cancel")) return Colors.textSecondary;
  return Colors.warning;
};

const getOdooPriorityLabel = (priority: string): string => {
  switch (priority) {
    case "1":
      return "Low";
    case "2":
      return "High";
    case "3":
      return "Urgent";
    default:
      return "Normal";
  }
};

export default function HelpScreen() {
  // User profile (auto-filled into forms)
  const [user, setUser] = useState<any>(null);

  // Unified ticket form fields
  const [category, setCategory] = useState("");
  const [description, setDescription] = useState("");
  const [contactNumber, setContactNumber] = useState("");

  // PMS modal
  const [showPmsModal, setShowPmsModal] = useState(false);
  const [pmsContactNumber, setPmsContactNumber] = useState("");
  const [pmsNotes, setPmsNotes] = useState("");
  const [pmsSubmitting, setPmsSubmitting] = useState(false);

  // Screen state
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [tickets, setTickets] = useState<any[]>([]);
  const [tips, setTips] = useState<any[]>([]);
  const [supportContacts, setSupportContacts] = useState<SupportContacts>(
    DEFAULT_SUPPORT_CONTACTS,
  );

  const loadData = useCallback(async () => {
    try {
      const [profile, contactData, tipsData] = await Promise.all([
        fetchUserProfile(),
        fetchSupportContacts(),
        fetchEnergyTips(),
      ]);
      setUser(profile);
      if (contactData) setSupportContacts(contactData);
      setTips(tipsData);

      // Fetch tickets from Odoo using the authenticated user's email
      const {
        data: { user: authUser },
      } = await supabase.auth.getUser();
      if (authUser?.email) {
        const odooTickets = await fetchOdooSupportTickets(authUser.email);
        setTickets(odooTickets);
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

  const handleSubmit = async () => {
    if (!category) {
      Alert.alert("Required Field", "Please select a category.");
      return;
    }
    if (!description.trim()) {
      Alert.alert("Required Field", "Please describe your concern.");
      return;
    }

    setSubmitting(true);
    try {
      const timestamp = getGmt8Timestamp();
      const selectedCat = TICKET_CATEGORIES.find((c) => c.value === category);
      const ticketType = selectedCat?.type ?? "general";
      const userName = user?.full_name ?? "";
      const userEmail = user?.email ?? "";

      const solisId = (user as any)?.solis_station_id ?? "N/A";
      let formData: Record<string, string>;
      if (ticketType === "technical") {
        formData = {
          "Plant-Reference-Number": solisId,
          "PV-Owner-Name": userName,
          Email: userEmail,
          Phone: contactNumber.trim() || "N/A",
          "Service-Type": "Issue with Solar PV System",
          "Detailed-Concern": category,
          "Concern-Description": description.trim(),
          form_name: "solviva-support-technical-20260512",
          "ticket-type": "technical",
          "submission-timestamp": timestamp,
        };
      } else {
        formData = {
          "Full-Name": userName,
          Email: userEmail,
          Subject: category,
          "Concern-Description": description.trim(),
          form_name: "solviva-support-general-20260512",
          "ticket-type": "general",
          "submission-timestamp": timestamp,
        };
      }

      const response = await fetch(N8N_WEBHOOK, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Submission-Source": Platform.OS === "web" ? "web" : "mobile-app",
          "X-Platform": Platform.OS,
          "X-App-Version": "1.0.0",
        },
        body: JSON.stringify(formData),
      });

      if (response.ok) {
        Alert.alert(
          "Ticket Submitted",
          "Your support ticket has been created. We will respond within 24-48 hours.",
          [{ text: "OK", onPress: () => loadData() }],
        );
        setCategory("");
        setDescription("");
        setContactNumber("");
      } else {
        Alert.alert(
          "Submission Error",
          "There was a problem submitting the form. Please try again.",
        );
      }
    } catch (error) {
      console.error("Submit error:", error);
      Alert.alert(
        "Error",
        "Something went wrong. Please try again later or contact us directly.",
      );
    } finally {
      setSubmitting(false);
    }
  };

  const handleSubmitPms = async () => {
    setPmsSubmitting(true);
    try {
      const timestamp = getGmt8Timestamp();
      const formData: Record<string, string> = {
        "Plant-Reference-Number": (user as any)?.solis_station_id ?? "N/A",
        "PV-Owner-Name": user?.full_name ?? "",
        Email: user?.email ?? "",
        Phone: pmsContactNumber.trim() || "N/A",
        "Service-Type": "Schedule a PMS / Cleaning Appointment",
        "Concern-Description": pmsNotes.trim() || "PMS Appointment Request",
        form_name: "solviva-support-technical-20260512",
        "ticket-type": "technical",
        "submission-timestamp": timestamp,
      };

      const response = await fetch(N8N_WEBHOOK, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Submission-Source": Platform.OS === "web" ? "web" : "mobile-app",
          "X-Platform": Platform.OS,
          "X-App-Version": "1.0.0",
        },
        body: JSON.stringify(formData),
      });

      if (response.ok) {
        setShowPmsModal(false);
        setPmsContactNumber("");
        setPmsNotes("");
        Alert.alert(
          "PMS Request Submitted",
          "Your PMS appointment request has been submitted. Our team will contact you to confirm your schedule.",
          [{ text: "OK", onPress: () => loadData() }],
        );
      } else {
        Alert.alert(
          "Submission Error",
          "There was a problem submitting the request. Please try again.",
        );
      }
    } catch (error) {
      console.error("PMS submit error:", error);
      Alert.alert("Error", "Something went wrong. Please try again later.");
    } finally {
      setPmsSubmitting(false);
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
    <>
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
              onPress={() => setShowPmsModal(true)}
            >
              <Text style={styles.contactIcon}>🔬</Text>
              <Text style={styles.contactLabel}>PMS</Text>
              <Text style={styles.contactSub}>Schedule a service</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Submit New Ticket */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Customer Care</Text>
          <Text style={styles.sectionSubtitle}>
            Got a question or need support? Submit a ticket to our support team
            and we'll review your request right away to ensure you get the help
            you need.
          </Text>

          <View style={styles.formCard}>
            {/* Auto-filled user info banner */}
            {user && (
              <View style={styles.userInfoBanner}>
                <Text style={styles.userInfoText}>
                  Submitting as{" "}
                  <Text style={styles.userInfoBold}>{user.full_name}</Text>
                  {" \u2022 "}
                  {user.email}
                </Text>
                {(user as any)?.solis_station_id && (
                  <Text style={[styles.userInfoText, { marginTop: 2 }]}>
                    Station ID:{" "}
                    <Text style={styles.userInfoBold}>
                      {(user as any).solis_station_id}
                    </Text>
                  </Text>
                )}
              </View>
            )}

            <View style={styles.inputContainer}>
              <Text style={styles.fieldLabel}>Category</Text>
              {Platform.OS === "web" ? (
                <select
                  style={{
                    border: `1px solid ${Colors.border}`,
                    borderRadius: 12,
                    padding: Spacing.md,
                    fontSize: FontSizes.md,
                    color: Colors.text,
                    backgroundColor: Colors.surface,
                    width: "100%",
                  }}
                  value={category}
                  onChange={(e) => setCategory(e.target.value)}
                >
                  <option value="">Select a category...</option>
                  <optgroup label="── General ──">
                    <option value="General Inquiry">General Inquiry</option>
                    <option value="Service Availability">
                      Service Availability
                    </option>
                    <option value="Payment Options">Payment Options</option>
                  </optgroup>
                  <optgroup label="── System Performance ──">
                    <option value="Low energy output">Low energy output</option>
                    <option value="Online monitoring is not working">
                      Online monitoring is not working
                    </option>
                  </optgroup>
                  <optgroup label="── Safety Issues (Call Immediately) ──">
                    <option value="Unusual signs on inverter and components (heat, smoke, discoloration, sparks)">
                      Unusual signs on inverter and components (heat, smoke,
                      discoloration, sparks)
                    </option>
                    <option value="Electrical shocks">Electrical shocks</option>
                    <option value="Structural or roof damage / leak">
                      Structural or roof damage / leak
                    </option>
                    <option value="Wiring or connection faults / loose connections">
                      Wiring or connection faults / loose connections
                    </option>
                  </optgroup>
                  <optgroup label="── Warranty Claims ──">
                    <option value="Panel damage – Warranty Claim">
                      Panel damage – Warranty Claim
                    </option>
                    <option value="Inverter issues – Warranty Claim">
                      Inverter issues – Warranty Claim
                    </option>
                    <option value="Battery problems – Warranty Claim">
                      Battery problems – Warranty Claim
                    </option>
                    <option value="Other workmanship issues – Warranty Claim">
                      Other workmanship issues – Warranty Claim
                    </option>
                  </optgroup>
                </select>
              ) : (
                <View style={styles.pickerContainer}>
                  <Picker
                    selectedValue={category}
                    onValueChange={(v) => setCategory(v)}
                    style={styles.picker}
                  >
                    <Picker.Item label="Select a category..." value="" />
                    <Picker.Item
                      label="\u2500\u2500 General \u2500\u2500"
                      value=""
                      enabled={false}
                    />
                    <Picker.Item
                      label="General Inquiry"
                      value="General Inquiry"
                    />
                    <Picker.Item
                      label="Service Availability"
                      value="Service Availability"
                    />
                    <Picker.Item
                      label="Payment Options"
                      value="Payment Options"
                    />
                    <Picker.Item
                      label="\u2500\u2500 System Performance \u2500\u2500"
                      value=""
                      enabled={false}
                    />
                    <Picker.Item
                      label="Low energy output"
                      value="Low energy output"
                    />
                    <Picker.Item
                      label="Online monitoring is not working"
                      value="Online monitoring is not working"
                    />
                    <Picker.Item
                      label="\u2500\u2500 Safety Issues \u2500\u2500"
                      value=""
                      enabled={false}
                    />
                    <Picker.Item
                      label="Unusual signs on inverter and components"
                      value="Unusual signs on inverter and components (heat, smoke, discoloration, sparks)"
                    />
                    <Picker.Item
                      label="Electrical shocks"
                      value="Electrical shocks"
                    />
                    <Picker.Item
                      label="Structural or roof damage / leak"
                      value="Structural or roof damage / leak"
                    />
                    <Picker.Item
                      label="Wiring or connection faults / loose connections"
                      value="Wiring or connection faults / loose connections"
                    />
                    <Picker.Item
                      label="\u2500\u2500 Warranty Claims \u2500\u2500"
                      value=""
                      enabled={false}
                    />
                    <Picker.Item
                      label="Panel damage \u2013 Warranty Claim"
                      value="Panel damage \u2013 Warranty Claim"
                    />
                    <Picker.Item
                      label="Inverter issues \u2013 Warranty Claim"
                      value="Inverter issues \u2013 Warranty Claim"
                    />
                    <Picker.Item
                      label="Battery problems \u2013 Warranty Claim"
                      value="Battery problems \u2013 Warranty Claim"
                    />
                    <Picker.Item
                      label="Other workmanship issues \u2013 Warranty Claim"
                      value="Other workmanship issues \u2013 Warranty Claim"
                    />
                  </Picker>
                </View>
              )}
            </View>

            <View style={styles.inputContainer}>
              <Text style={styles.fieldLabel}>
                Phone Number{" "}
                <Text style={styles.fieldOptional}>(optional)</Text>
              </Text>
              <TextInput
                style={styles.input}
                placeholder="Enter your contact number"
                placeholderTextColor={Colors.textSecondary}
                keyboardType="phone-pad"
                value={contactNumber}
                onChangeText={setContactNumber}
              />
            </View>

            <View style={styles.inputContainer}>
              <Text style={styles.fieldLabel}>Description</Text>
              <TextInput
                style={[styles.input, styles.textArea]}
                placeholder="Describe your concern in detail..."
                placeholderTextColor={Colors.textSecondary}
                multiline
                numberOfLines={4}
                textAlignVertical="top"
                value={description}
                onChangeText={setDescription}
              />
            </View>

            <TouchableOpacity
              style={[styles.submitButton, submitting && styles.buttonDisabled]}
              onPress={handleSubmit}
              disabled={submitting}
            >
              {submitting ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text style={styles.submitButtonText}>Submit Ticket</Text>
              )}
            </TouchableOpacity>
          </View>
        </View>

        {/* My Tickets */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>My Tickets</Text>
          {tickets.length === 0 ? (
            <Text style={styles.emptyText}>No tickets found.</Text>
          ) : (
            tickets.map((ticket: any) => {
              const stageName = Array.isArray(ticket.stage_id)
                ? ticket.stage_id[1]
                : "New";
              const stageColor = getOdooStageColor(stageName);
              const plainDesc = stripHtml(ticket.description ?? "");
              return (
                <View key={ticket.id} style={styles.ticketCard}>
                  <View style={styles.ticketHeader}>
                    <Text style={styles.ticketSubject}>{ticket.name}</Text>
                    <View
                      style={[
                        styles.statusBadge,
                        { backgroundColor: stageColor + "20" },
                      ]}
                    >
                      <Text style={[styles.statusText, { color: stageColor }]}>
                        {stageName}
                      </Text>
                    </View>
                  </View>
                  {plainDesc.length > 0 && (
                    <Text style={styles.ticketDescription} numberOfLines={2}>
                      {plainDesc}
                    </Text>
                  )}
                  <View style={styles.ticketFooter}>
                    <Text style={styles.ticketDate}>
                      {ticket.create_date
                        ? formatDate(ticket.create_date)
                        : "\u2014"}
                    </Text>
                    <Text style={styles.ticketPriority}>
                      Priority: {getOdooPriorityLabel(ticket.priority)}
                    </Text>
                  </View>
                </View>
              );
            })
          )}
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

      {/* PMS Modal */}
      <Modal
        visible={showPmsModal}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setShowPmsModal(false)}
      >
        <View style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>
              Preventive Maintenance Service
            </Text>
            <TouchableOpacity
              style={styles.modalClose}
              onPress={() => setShowPmsModal(false)}
            >
              <Text style={styles.modalCloseText}>\u2715</Text>
            </TouchableOpacity>
          </View>
          <ScrollView
            style={styles.modalBody}
            contentContainerStyle={{ paddingBottom: 40 }}
          >
            <Text style={styles.pmsTitle}>
              Thank you for considering our Preventive Maintenance Service (PMS)
              for your Solar PV System.
            </Text>
            <View style={styles.pmsPriceCard}>
              <Text style={styles.pmsPriceLabel}>Pricing</Text>
              <Text style={styles.pmsPriceItem}>
                {"\u2022"} Up to 10 kWp \u2014 starting at \u20b110,000 VAT
                inclusive
              </Text>
              <Text style={styles.pmsPriceItem}>
                {"\u2022"} Above 10 kWp (up to 100 kWp) \u2014 \u20b1900 per kWp
              </Text>
              <Text style={styles.pmsNote}>
                Prices are estimates and may vary based on location, system
                size, and specific requirements.
              </Text>
            </View>

            <Text style={styles.pmsSectionLabel}>What PMS Includes:</Text>
            {[
              "Solar module cleaning and inspection",
              "Thermal scanning",
              "Inverter and panel board checks",
              "Grounding system assessment",
              "Monitoring device inspection",
              "System safety and structural integrity check",
            ].map((item) => (
              <Text key={item} style={styles.pmsListItem}>
                \u2713 {item}
              </Text>
            ))}

            <View style={[styles.inputContainer, { marginTop: Spacing.lg }]}>
              <Text style={styles.fieldLabel}>
                Contact Number{" "}
                <Text style={styles.fieldOptional}>(optional)</Text>
              </Text>
              <TextInput
                style={styles.input}
                placeholder="Enter your contact number"
                placeholderTextColor={Colors.textSecondary}
                keyboardType="phone-pad"
                value={pmsContactNumber}
                onChangeText={setPmsContactNumber}
              />
            </View>

            <View style={styles.inputContainer}>
              <Text style={styles.fieldLabel}>
                Additional Notes{" "}
                <Text style={styles.fieldOptional}>(optional)</Text>
              </Text>
              <TextInput
                style={[styles.input, styles.textArea]}
                placeholder="Any specific concerns or preferred schedule..."
                placeholderTextColor={Colors.textSecondary}
                multiline
                numberOfLines={3}
                textAlignVertical="top"
                value={pmsNotes}
                onChangeText={setPmsNotes}
              />
            </View>

            <TouchableOpacity
              style={[
                styles.submitButton,
                pmsSubmitting && styles.buttonDisabled,
              ]}
              onPress={handleSubmitPms}
              disabled={pmsSubmitting}
            >
              {pmsSubmitting ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text style={styles.submitButtonText}>Submit PMS Request</Text>
              )}
            </TouchableOpacity>
          </ScrollView>
        </View>
      </Modal>
    </>
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
  sectionSubtitle: {
    fontSize: FontSizes.md,
    color: Colors.textSecondary,
    marginBottom: Spacing.md,
    lineHeight: 20,
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
  userInfoBanner: {
    backgroundColor: "#E8F5E9",
    borderRadius: 8,
    padding: Spacing.sm,
    marginBottom: Spacing.md,
  },
  userInfoText: {
    fontSize: FontSizes.sm,
    color: "#2E7D32",
  },
  userInfoBold: {
    fontWeight: "700",
  },
  inputContainer: {
    marginBottom: Spacing.md,
  },
  fieldLabel: {
    fontSize: FontSizes.md,
    fontWeight: "600",
    color: Colors.text,
    marginBottom: Spacing.xs,
  },
  fieldOptional: {
    fontWeight: "400",
    color: Colors.textSecondary,
    fontSize: FontSizes.sm,
  },
  input: {
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 12,
    padding: Spacing.md,
    fontSize: FontSizes.md,
    color: Colors.text,
    backgroundColor: Colors.surface,
  },
  pickerContainer: {
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 12,
    overflow: "hidden",
    backgroundColor: Colors.surface,
  },
  picker: {
    height: 50,
    color: Colors.text,
  },
  textArea: {
    height: 100,
    paddingTop: Spacing.md,
  },
  submitButton: {
    backgroundColor: "#006ac6",
    borderRadius: 12,
    padding: Spacing.md,
    alignItems: "center",
    marginTop: Spacing.sm,
    minHeight: 48,
    justifyContent: "center",
  },
  buttonDisabled: {
    opacity: 0.7,
  },
  submitButtonText: {
    color: "#ffffff",
    fontSize: FontSizes.lg,
    fontWeight: "700",
  },
  emptyText: {
    fontSize: FontSizes.md,
    color: Colors.textSecondary,
    textAlign: "center",
    paddingVertical: Spacing.lg,
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
  // Modal styles
  modalContainer: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  modalHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: Spacing.lg,
    paddingTop: 60,
    paddingBottom: Spacing.md,
    backgroundColor: "#d2ff1e",
  },
  modalTitle: {
    fontSize: FontSizes.xl,
    fontWeight: "700",
    color: "#1B5E20",
    flex: 1,
  },
  modalClose: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: "rgba(0,0,0,0.1)",
    alignItems: "center",
    justifyContent: "center",
  },
  modalCloseText: {
    fontSize: FontSizes.lg,
    color: "#1B5E20",
    fontWeight: "700",
  },
  modalBody: {
    flex: 1,
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.lg,
  },
  pmsTitle: {
    fontSize: FontSizes.lg,
    fontWeight: "600",
    color: Colors.text,
    marginBottom: Spacing.md,
    lineHeight: 24,
  },
  pmsPriceCard: {
    backgroundColor: "#E8F5E9",
    borderRadius: 12,
    padding: Spacing.md,
    marginBottom: Spacing.md,
    borderLeftWidth: 4,
    borderLeftColor: "#1f522b",
  },
  pmsPriceLabel: {
    fontSize: FontSizes.md,
    fontWeight: "700",
    color: "#1f522b",
    marginBottom: Spacing.xs,
  },
  pmsPriceItem: {
    fontSize: FontSizes.md,
    color: Colors.text,
    marginBottom: 4,
    lineHeight: 20,
  },
  pmsNote: {
    fontSize: FontSizes.sm,
    color: Colors.textSecondary,
    marginTop: Spacing.xs,
    lineHeight: 18,
  },
  pmsSectionLabel: {
    fontSize: FontSizes.md,
    fontWeight: "700",
    color: Colors.text,
    marginBottom: Spacing.sm,
  },
  pmsListItem: {
    fontSize: FontSizes.md,
    color: Colors.text,
    lineHeight: 22,
    marginBottom: 4,
  },
});
