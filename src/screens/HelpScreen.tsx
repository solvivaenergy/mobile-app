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
  (html ?? "")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/p>/gi, "\n")
    .replace(/<[^>]*>/g, "")
    .trim();

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
  const [pmsFirstName, setPmsFirstName] = useState("");
  const [pmsLastName, setPmsLastName] = useState("");
  const [pmsEmail, setPmsEmail] = useState("");
  const [pmsContactNumber, setPmsContactNumber] = useState("");
  const [pmsSiteAddress, setPmsSiteAddress] = useState("");
  const [pmsPrefDate, setPmsPrefDate] = useState("");
  const [pmsPrefTime, setPmsPrefTime] = useState("");
  const [pmsAltDate, setPmsAltDate] = useState("");
  const [pmsPanelLocation, setPmsPanelLocation] = useState("");
  const [pmsAccessEquipment, setPmsAccessEquipment] = useState<string[]>([]);
  const [pmsWorkPermit, setPmsWorkPermit] = useState("");
  const [pmsWorkPermitReqs, setPmsWorkPermitReqs] = useState("");
  const [pmsSiteContactName, setPmsSiteContactName] = useState("");
  const [pmsSiteContactNumber, setPmsSiteContactNumber] = useState("");
  const [pmsAccessInstructions, setPmsAccessInstructions] = useState("");
  const [pmsHasIssues, setPmsHasIssues] = useState("");
  const [pmsIssueDescription, setPmsIssueDescription] = useState("");
  const [pmsOtherRequests, setPmsOtherRequests] = useState("");

  // Success modal
  const [showSuccessModal, setShowSuccessModal] = useState(false);
  const [successMessage, setSuccessMessage] = useState({ title: "", body: "" });

  // Form validation errors
  const [categoryError, setCategoryError] = useState("");
  const [descriptionError, setDescriptionError] = useState("");

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

  const openPmsModal = () => {
    if (user) {
      const parts = (user.full_name ?? "").trim().split(" ");
      setPmsFirstName(parts[0] ?? "");
      setPmsLastName(parts.slice(1).join(" "));
      setPmsEmail(user.email ?? "");
      setPmsContactNumber((user as any).phone ?? "");
      setPmsSiteAddress((user as any).address ?? "");
      setPmsSiteContactName(user.full_name ?? "");
      setPmsSiteContactNumber((user as any).phone ?? "");
    }
    setShowPmsModal(true);
  };

  const toggleAccessEquipment = (item: string) => {
    setPmsAccessEquipment((prev) =>
      prev.includes(item) ? prev.filter((e) => e !== item) : [...prev, item],
    );
  };

  const handleSubmit = async () => {
    setCategoryError("");
    setDescriptionError("");
    let hasError = false;
    if (!category) {
      setCategoryError("Please select a category.");
      hasError = true;
    }
    if (!description.trim()) {
      setDescriptionError("Please describe your concern.");
      hasError = true;
    }
    if (hasError) return;

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
          "X-Submission-Source": "mobile-app",
          "X-Platform": Platform.OS,
          "X-App-Version": "1.0.0",
        },
        body: JSON.stringify(formData),
      });

      if (response.ok) {
        setCategory("");
        setDescription("");
        setContactNumber("");
        setSuccessMessage({
          title: "Ticket Submitted!",
          body: "Your support ticket has been created. We will respond within 24\u201348 hours.",
        });
        setShowSuccessModal(true);
        loadData();
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

  const handleSubmitPms = () => {
    const missing: string[] = [];
    if (!pmsFirstName.trim() || !pmsLastName.trim())
      missing.push("First and Last Name");
    if (!pmsEmail.trim()) missing.push("Email Address");
    if (!pmsContactNumber.trim()) missing.push("Contact Number");
    if (!pmsSiteAddress.trim()) missing.push("Site / Installation Address");
    if (!pmsPrefDate.trim()) missing.push("Preferred PMS Date");
    if (!pmsPrefTime) missing.push("Preferred Time Slot");
    if (!pmsPanelLocation) missing.push("Panel / Array Location");
    if (pmsAccessEquipment.length === 0)
      missing.push("Access Equipment Required");
    if (!pmsWorkPermit) missing.push("Work Permit Required");
    if (!pmsHasIssues) missing.push("System Condition (Section D)");
    if (missing.length > 0) {
      Alert.alert(
        "Required Fields",
        `Please complete:\n\u2022 ${missing.join("\n\u2022 ")}`,
      );
      return;
    }
    // TODO: wire up actual submission once Odoo integration is confirmed
    console.log("[PMS] Questionnaire payload (pending integration):", {
      name: `${pmsFirstName} ${pmsLastName}`,
      email: pmsEmail,
      phone: pmsContactNumber,
      siteAddress: pmsSiteAddress,
      preferredDate: pmsPrefDate,
      preferredTime: pmsPrefTime,
      altDate: pmsAltDate,
      panelLocation: pmsPanelLocation,
      accessEquipment: pmsAccessEquipment,
      workPermit: pmsWorkPermit,
      workPermitReqs: pmsWorkPermitReqs,
      siteContact: `${pmsSiteContactName} / ${pmsSiteContactNumber}`,
      accessInstructions: pmsAccessInstructions,
      hasIssues: pmsHasIssues,
      issueDescription: pmsIssueDescription,
      otherRequests: pmsOtherRequests,
      stationId: (user as any)?.solis_station_id ?? "N/A",
    });
    setShowPmsModal(false);
    setPmsFirstName("");
    setPmsLastName("");
    setPmsEmail("");
    setPmsContactNumber("");
    setPmsSiteAddress("");
    setPmsPrefDate("");
    setPmsPrefTime("");
    setPmsAltDate("");
    setPmsPanelLocation("");
    setPmsAccessEquipment([]);
    setPmsWorkPermit("");
    setPmsWorkPermitReqs("");
    setPmsSiteContactName("");
    setPmsSiteContactNumber("");
    setPmsAccessInstructions("");
    setPmsHasIssues("");
    setPmsIssueDescription("");
    setPmsOtherRequests("");
    setSuccessMessage({
      title: "PMS Request Submitted!",
      body: "Your appointment request has been submitted. Our Aftersales team will reach out within 2 business days to confirm your schedule.",
    });
    setShowSuccessModal(true);
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
              <Text style={styles.contactIcon}>🚨</Text>
              <Text style={styles.contactLabel}>Emergency</Text>
              <Text style={styles.contactSub}>After-hours engineer</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.contactCard, { backgroundColor: "#E8F5E9" }]}
              onPress={openPmsModal}
            >
              <Text style={styles.contactIcon}>🔧</Text>
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
                    border: `1px solid ${categoryError ? "#d32f2f" : Colors.border}`,
                    borderRadius: 12,
                    padding: Spacing.md,
                    fontSize: FontSizes.md,
                    color: Colors.text,
                    backgroundColor: Colors.surface,
                    width: "100%",
                  }}
                  value={category}
                  onChange={(e) => {
                    setCategory(e.target.value);
                    if (e.target.value) setCategoryError("");
                  }}
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
                <View
                  style={[
                    styles.pickerContainer,
                    categoryError ? { borderColor: "#d32f2f" } : null,
                  ]}
                >
                  <Picker
                    selectedValue={category}
                    onValueChange={(v) => {
                      setCategory(v);
                      if (v) setCategoryError("");
                    }}
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
              {categoryError ? (
                <Text style={styles.fieldError}>{categoryError}</Text>
              ) : null}
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
                style={[
                  styles.input,
                  styles.textArea,
                  descriptionError ? styles.inputError : null,
                ]}
                placeholder="Describe your concern in detail..."
                placeholderTextColor={Colors.textSecondary}
                multiline
                numberOfLines={4}
                textAlignVertical="top"
                value={description}
                onChangeText={(t) => {
                  setDescription(t);
                  if (t.trim()) setDescriptionError("");
                }}
              />
              {descriptionError ? (
                <Text style={styles.fieldError}>{descriptionError}</Text>
              ) : null}
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
              // Extract "Concern Name : XYZ" from description if present
              const rawDesc = stripHtml(ticket.description ?? "");
              const concernMatch =
                rawDesc.match(/Concern Name\s*:\s*([^\n]+)/i) ||
                rawDesc.match(/Subject\s*:\s*([^\n]+)/i);
              const concernLabel = concernMatch ? concernMatch[1].trim() : null;
              return (
                <View key={ticket.id} style={styles.ticketCard}>
                  <View style={styles.ticketHeader}>
                    <Text style={styles.ticketSubject} numberOfLines={2}>
                      {ticket.name}
                    </Text>
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
                  {concernLabel && (
                    <Text style={styles.ticketDescription} numberOfLines={1}>
                      {concernLabel}
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
              Please fill in all required fields (*). Your responses help our
              team prepare for a smooth and efficient maintenance visit.
            </Text>

            {/* Section A */}
            <Text style={styles.pmsSectionHeader}>
              Section A: Client &amp; Site Information
            </Text>
            {user && (
              <View
                style={[styles.userInfoBanner, { marginBottom: Spacing.md }]}
              >
                <Text style={styles.userInfoText}>
                  \u2713 Auto-filled from your profile \u2014 edit any field if
                  needed.
                </Text>
              </View>
            )}
            <View style={styles.pmsRow}>
              <View
                style={[styles.inputContainer, { flex: 1, marginRight: 8 }]}
              >
                <Text style={styles.fieldLabel}>First Name *</Text>
                <TextInput
                  style={styles.input}
                  value={pmsFirstName}
                  onChangeText={setPmsFirstName}
                  placeholder="First name"
                  placeholderTextColor={Colors.textSecondary}
                />
              </View>
              <View style={[styles.inputContainer, { flex: 1, marginLeft: 8 }]}>
                <Text style={styles.fieldLabel}>Last Name *</Text>
                <TextInput
                  style={styles.input}
                  value={pmsLastName}
                  onChangeText={setPmsLastName}
                  placeholder="Last name"
                  placeholderTextColor={Colors.textSecondary}
                />
              </View>
            </View>
            <View style={styles.inputContainer}>
              <Text style={styles.fieldLabel}>Email Address *</Text>
              <TextInput
                style={styles.input}
                value={pmsEmail}
                onChangeText={setPmsEmail}
                placeholder="Email address"
                placeholderTextColor={Colors.textSecondary}
                keyboardType="email-address"
                autoCapitalize="none"
              />
            </View>
            <View style={styles.inputContainer}>
              <Text style={styles.fieldLabel}>Contact Number *</Text>
              <TextInput
                style={styles.input}
                value={pmsContactNumber}
                onChangeText={setPmsContactNumber}
                placeholder="+63..."
                placeholderTextColor={Colors.textSecondary}
                keyboardType="phone-pad"
              />
            </View>
            <View style={styles.inputContainer}>
              <Text style={styles.fieldLabel}>
                Site / Installation Address *
              </Text>
              <TextInput
                style={[styles.input, styles.textArea]}
                value={pmsSiteAddress}
                onChangeText={setPmsSiteAddress}
                placeholder="Full address of the solar installation"
                placeholderTextColor={Colors.textSecondary}
                multiline
                numberOfLines={3}
                textAlignVertical="top"
              />
            </View>

            {/* Section B */}
            <Text style={styles.pmsSectionHeader}>
              Section B: Preferred Schedule
            </Text>
            <View style={styles.inputContainer}>
              <Text style={styles.fieldLabel}>
                Preferred PMS Date *{" "}
                <Text style={styles.fieldOptional}>
                  (at least 10 days from today)
                </Text>
              </Text>
              <TextInput
                style={styles.input}
                value={pmsPrefDate}
                onChangeText={setPmsPrefDate}
                placeholder="MM/DD/YYYY"
                placeholderTextColor={Colors.textSecondary}
              />
            </View>
            <View style={styles.inputContainer}>
              <Text style={styles.fieldLabel}>Preferred Time Slot *</Text>
              <View style={styles.pmsOptionRow}>
                {[
                  {
                    label: "Morning\n(8 AM \u2013 12 PM)",
                    val: "Morning (8:00 AM \u2013 12:00 PM)",
                  },
                  {
                    label: "Afternoon\n(1 PM \u2013 5 PM)",
                    val: "Afternoon (1:00 PM \u2013 5:00 PM)",
                  },
                  {
                    label: "Flexible\n(any time)",
                    val: "Flexible \u2014 any time works",
                  },
                ].map(({ label, val }) => (
                  <TouchableOpacity
                    key={val}
                    style={[
                      styles.pmsOptionBtn,
                      pmsPrefTime === val && styles.pmsOptionBtnSelected,
                    ]}
                    onPress={() => setPmsPrefTime(val)}
                  >
                    <Text
                      style={[
                        styles.pmsOptionBtnText,
                        pmsPrefTime === val && styles.pmsOptionBtnTextSelected,
                      ]}
                    >
                      {label}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>
            <View style={styles.inputContainer}>
              <Text style={styles.fieldLabel}>
                Alternative Date{" "}
                <Text style={styles.fieldOptional}>(optional)</Text>
              </Text>
              <TextInput
                style={styles.input}
                value={pmsAltDate}
                onChangeText={setPmsAltDate}
                placeholder="MM/DD/YYYY"
                placeholderTextColor={Colors.textSecondary}
              />
            </View>

            {/* Section C */}
            <Text style={styles.pmsSectionHeader}>Section C: Site Access</Text>
            <View style={styles.inputContainer}>
              <Text style={styles.fieldLabel}>Panel / Array Location *</Text>
              <View style={styles.pmsOptionRow}>
                {[
                  {
                    label: "Rooftop \u2014 single storey\n(\u2264 4 meters)",
                    val: "Rooftop \u2014 single storey (\u2264 4 meters)",
                  },
                  {
                    label: "Rooftop \u2014 multi-storey\n(> 4 meters)",
                    val: "Rooftop \u2014 multi-storey (> 4 meters)",
                  },
                ].map(({ label, val }) => (
                  <TouchableOpacity
                    key={val}
                    style={[
                      styles.pmsOptionBtn,
                      pmsPanelLocation === val && styles.pmsOptionBtnSelected,
                    ]}
                    onPress={() => setPmsPanelLocation(val)}
                  >
                    <Text
                      style={[
                        styles.pmsOptionBtnText,
                        pmsPanelLocation === val &&
                          styles.pmsOptionBtnTextSelected,
                      ]}
                    >
                      {label}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>
            <View style={styles.inputContainer}>
              <Text style={styles.fieldLabel}>
                Access Equipment Required *{" "}
                <Text style={styles.fieldOptional}>
                  (select all that apply)
                </Text>
              </Text>
              <View style={styles.pmsOptionRow}>
                {[
                  "No special equipment needed",
                  "Ladder (client to provide)",
                  "Scaffolding required",
                  "Others",
                ].map((opt) => (
                  <TouchableOpacity
                    key={opt}
                    style={[
                      styles.pmsOptionBtn,
                      pmsAccessEquipment.includes(opt) &&
                        styles.pmsOptionBtnSelected,
                    ]}
                    onPress={() => toggleAccessEquipment(opt)}
                  >
                    <Text
                      style={[
                        styles.pmsOptionBtnText,
                        pmsAccessEquipment.includes(opt) &&
                          styles.pmsOptionBtnTextSelected,
                      ]}
                    >
                      {opt}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>
            <View style={styles.inputContainer}>
              <Text style={styles.fieldLabel}>Work Permit Required? *</Text>
              {[
                "No \u2014 our team can enter freely",
                "Yes \u2014 I will arrange the work permit",
                "Yes \u2014 please coordinate with the HOA",
                "Not sure \u2014 please advise",
              ].map((opt) => (
                <TouchableOpacity
                  key={opt}
                  style={[
                    styles.pmsRadioRow,
                    pmsWorkPermit === opt && styles.pmsRadioRowSelected,
                  ]}
                  onPress={() => setPmsWorkPermit(opt)}
                >
                  <View
                    style={[
                      styles.pmsRadioDot,
                      pmsWorkPermit === opt && styles.pmsRadioDotSelected,
                    ]}
                  />
                  <Text
                    style={[
                      styles.pmsRadioText,
                      pmsWorkPermit === opt && styles.pmsRadioTextSelected,
                    ]}
                  >
                    {opt}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
            {pmsWorkPermit.startsWith("Yes") && (
              <View style={styles.inputContainer}>
                <Text style={styles.fieldLabel}>Work Permit Requirements</Text>
                <TextInput
                  style={[styles.input, styles.textArea]}
                  value={pmsWorkPermitReqs}
                  onChangeText={setPmsWorkPermitReqs}
                  placeholder="Describe the requirements..."
                  placeholderTextColor={Colors.textSecondary}
                  multiline
                  numberOfLines={3}
                  textAlignVertical="top"
                />
              </View>
            )}
            <View style={styles.inputContainer}>
              <Text style={styles.fieldLabel}>
                Site Contact Person{" "}
                <Text style={styles.fieldOptional}>
                  (if different from above)
                </Text>
              </Text>
              <TextInput
                style={[styles.input, { marginBottom: 8 }]}
                value={pmsSiteContactName}
                onChangeText={setPmsSiteContactName}
                placeholder="Last Name, First Name"
                placeholderTextColor={Colors.textSecondary}
              />
              <TextInput
                style={styles.input}
                value={pmsSiteContactNumber}
                onChangeText={setPmsSiteContactNumber}
                placeholder="Contact number"
                placeholderTextColor={Colors.textSecondary}
                keyboardType="phone-pad"
              />
            </View>
            <View style={styles.inputContainer}>
              <Text style={styles.fieldLabel}>
                Additional Access Instructions{" "}
                <Text style={styles.fieldOptional}>(optional)</Text>
              </Text>
              <TextInput
                style={[styles.input, styles.textArea]}
                value={pmsAccessInstructions}
                onChangeText={setPmsAccessInstructions}
                placeholder="e.g., gate code, parking area, HOA requirements..."
                placeholderTextColor={Colors.textSecondary}
                multiline
                numberOfLines={3}
                textAlignVertical="top"
              />
            </View>

            {/* Section D */}
            <Text style={styles.pmsSectionHeader}>
              Section D: System Condition
            </Text>
            <View style={styles.inputContainer}>
              <Text style={styles.fieldLabel}>
                Any issues noticed recently? *
              </Text>
              {[
                "No \u2014 everything seems to be working fine",
                "Yes \u2014 I\u2019ve noticed some issues",
              ].map((opt) => (
                <TouchableOpacity
                  key={opt}
                  style={[
                    styles.pmsRadioRow,
                    pmsHasIssues === opt && styles.pmsRadioRowSelected,
                  ]}
                  onPress={() => setPmsHasIssues(opt)}
                >
                  <View
                    style={[
                      styles.pmsRadioDot,
                      pmsHasIssues === opt && styles.pmsRadioDotSelected,
                    ]}
                  />
                  <Text
                    style={[
                      styles.pmsRadioText,
                      pmsHasIssues === opt && styles.pmsRadioTextSelected,
                    ]}
                  >
                    {opt}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
            {pmsHasIssues.startsWith("Yes") && (
              <View style={styles.inputContainer}>
                <Text style={styles.fieldLabel}>Please describe the issue</Text>
                <TextInput
                  style={[styles.input, styles.textArea]}
                  value={pmsIssueDescription}
                  onChangeText={setPmsIssueDescription}
                  placeholder="e.g., drop in generation, inverter warnings, physical damage..."
                  placeholderTextColor={Colors.textSecondary}
                  multiline
                  numberOfLines={3}
                  textAlignVertical="top"
                />
              </View>
            )}
            <View style={styles.inputContainer}>
              <Text style={styles.fieldLabel}>
                Other questions or requests{" "}
                <Text style={styles.fieldOptional}>(optional)</Text>
              </Text>
              <TextInput
                style={[styles.input, styles.textArea]}
                value={pmsOtherRequests}
                onChangeText={setPmsOtherRequests}
                placeholder="Any other questions or special requests..."
                placeholderTextColor={Colors.textSecondary}
                multiline
                numberOfLines={3}
                textAlignVertical="top"
              />
            </View>

            <View style={styles.pmsConsentBox}>
              <Text style={styles.pmsConsentText}>
                By submitting this form, you authorize Solviva Energy, Inc. to
                access the site for the PMS. An authorized representative must
                be present during the visit. Our Aftersales team will reach out
                within 2 business days to confirm your schedule.
              </Text>
            </View>

            <TouchableOpacity
              style={styles.submitButton}
              onPress={handleSubmitPms}
            >
              <Text style={styles.submitButtonText}>Submit PMS Request</Text>
            </TouchableOpacity>
          </ScrollView>
        </View>
      </Modal>

      {/* Success Modal */}
      <Modal
        visible={showSuccessModal}
        animationType="fade"
        transparent
        onRequestClose={() => setShowSuccessModal(false)}
      >
        <View style={styles.successOverlay}>
          <View style={styles.successCard}>
            <View style={styles.successIconCircle}>
              <Text style={{ fontSize: 36 }}>✅</Text>
            </View>
            <Text style={styles.successTitle}>{successMessage.title}</Text>
            <Text style={styles.successBody}>{successMessage.body}</Text>
            <TouchableOpacity
              style={styles.successButton}
              onPress={() => setShowSuccessModal(false)}
            >
              <Text style={styles.successButtonText}>Got it</Text>
            </TouchableOpacity>
          </View>
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
    marginBottom: Spacing.md,
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
  inputError: {
    borderColor: "#d32f2f",
  },
  fieldError: {
    fontSize: FontSizes.sm,
    color: "#d32f2f",
    marginTop: 4,
  },
  submitButton: {
    backgroundColor: "#006ac6",
    borderRadius: 12,
    padding: Spacing.md,
    alignItems: "center",
    marginTop: Spacing.md,
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
  successOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.5)",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: Spacing.lg,
  },
  successCard: {
    backgroundColor: Colors.surface,
    borderRadius: 20,
    padding: 32,
    alignItems: "center",
    width: "100%",
    maxWidth: 380,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
    elevation: 8,
  },
  successIconCircle: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: "#f0fdf4",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: Spacing.lg,
  },
  successTitle: {
    fontSize: FontSizes.xl,
    fontWeight: "700",
    color: Colors.text,
    textAlign: "center",
    marginBottom: Spacing.sm,
  },
  successBody: {
    fontSize: FontSizes.md,
    color: Colors.textSecondary,
    textAlign: "center",
    lineHeight: 22,
    marginBottom: Spacing.xl,
  },
  successButton: {
    backgroundColor: "#1f522b",
    borderRadius: 12,
    paddingVertical: 14,
    paddingHorizontal: 48,
    alignItems: "center",
  },
  successButtonText: {
    color: "#fff",
    fontSize: FontSizes.md,
    fontWeight: "700",
  },
  // PMS questionnaire styles
  pmsSectionHeader: {
    fontSize: FontSizes.md,
    fontWeight: "700",
    color: "#1f522b",
    backgroundColor: "#E8F5E9",
    paddingHorizontal: Spacing.sm,
    paddingVertical: Spacing.xs,
    borderRadius: 6,
    marginTop: Spacing.lg,
    marginBottom: Spacing.md,
  },
  pmsRow: {
    flexDirection: "row",
  },
  pmsOptionRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  pmsOptionBtn: {
    borderWidth: 1.5,
    borderColor: Colors.border,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 8,
    backgroundColor: Colors.surface,
    minWidth: 90,
    alignItems: "center",
  },
  pmsOptionBtnSelected: {
    borderColor: "#1f522b",
    backgroundColor: "#E8F5E9",
  },
  pmsOptionBtnText: {
    fontSize: FontSizes.sm,
    color: Colors.text,
    textAlign: "center",
    lineHeight: 16,
  },
  pmsOptionBtnTextSelected: {
    color: "#1f522b",
    fontWeight: "600",
  },
  pmsRadioRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 10,
    paddingHorizontal: Spacing.sm,
    borderRadius: 8,
    marginBottom: 4,
    backgroundColor: Colors.background,
  },
  pmsRadioRowSelected: {
    backgroundColor: "#E8F5E9",
  },
  pmsRadioDot: {
    width: 18,
    height: 18,
    borderRadius: 9,
    borderWidth: 2,
    borderColor: Colors.border,
    marginRight: 10,
  },
  pmsRadioDotSelected: {
    borderColor: "#1f522b",
    backgroundColor: "#1f522b",
  },
  pmsRadioText: {
    fontSize: FontSizes.md,
    color: Colors.text,
    flex: 1,
  },
  pmsRadioTextSelected: {
    color: "#1f522b",
    fontWeight: "500",
  },
  pmsConsentBox: {
    backgroundColor: "#F5F5F5",
    borderRadius: 8,
    padding: Spacing.sm,
    marginBottom: Spacing.md,
    borderLeftWidth: 3,
    borderLeftColor: Colors.border,
  },
  pmsConsentText: {
    fontSize: FontSizes.sm,
    color: Colors.textSecondary,
    lineHeight: 18,
  },
});
