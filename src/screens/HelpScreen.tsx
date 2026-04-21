import React, { useState, useEffect, useCallback, useRef } from "react";
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
  Platform,
} from "react-native";
import { Picker } from "@react-native-picker/picker";
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
  // Ticket type selector
  const [ticketType, setTicketType] = useState<"non-technical" | "technical">(
    "non-technical",
  );

  // Non-Technical form fields
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [subject, setSubject] = useState("");
  const [description, setDescription] = useState("");

  // Technical form fields
  const [techEmail, setTechEmail] = useState("");
  const [plantRefNumber, setPlantRefNumber] = useState("");
  const [pvOwnerName, setPvOwnerName] = useState("");
  const [contactNumber, setContactNumber] = useState("");
  const [serviceType, setServiceType] = useState<"issue" | "pms" | "">("");
  const [concernCategory, setConcernCategory] = useState("");
  const [concernDescription, setConcernDescription] = useState("");
  const [techStep, setTechStep] = useState(1); // For multi-step technical form

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [recaptchaReady, setRecaptchaReady] = useState(false);
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

  // Load reCAPTCHA v3 script only on web platform
  useEffect(() => {
    if (Platform.OS === "web") {
      // Check if script already exists
      if (document.getElementById("recaptcha-script")) {
        setRecaptchaReady(true);
        return;
      }

      const script = document.createElement("script");
      script.id = "recaptcha-script";
      script.src =
        "https://www.google.com/recaptcha/api.js?render=6Ld6LikrAAAAAJg5XHJs4lNWa0xxwS7H5Noi_ozA";
      script.async = true;
      script.onload = () => {
        setRecaptchaReady(true);
      };
      document.head.appendChild(script);

      return () => {
        // Cleanup on unmount
        const scriptElement = document.getElementById("recaptcha-script");
        if (scriptElement) {
          document.head.removeChild(scriptElement);
        }
      };
    } else {
      // Mobile: reCAPTCHA handled by WebView component
      setRecaptchaReady(true);
    }
  }, []);
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

  // Execute reCAPTCHA v3 on web only, skip on mobile
  const executeRecaptcha = async (): Promise<string> => {
    return new Promise((resolve) => {
      if (Platform.OS === "web" && recaptchaReady) {
        try {
          // @ts-ignore - grecaptcha is loaded dynamically
          if (typeof grecaptcha !== "undefined") {
            // @ts-ignore
            grecaptcha
              .execute("6Ld6LikrAAAAAJg5XHJs4lNWa0xxwS7H5Noi_ozA", {
                action: "submit",
              })
              .then((token: string) => resolve(token))
              .catch((error: any) => {
                console.error("Web reCAPTCHA error:", error);
                resolve("");
              });
          } else {
            resolve("");
          }
        } catch (error) {
          console.error("reCAPTCHA error:", error);
          resolve("");
        }
      } else {
        // Mobile: Skip reCAPTCHA (will be validated differently on server)
        console.log("Mobile submission - skipping reCAPTCHA");
        resolve("");
      }
    });
  };

  const handleNextStep = () => {
    if (techStep === 1) {
      // Validate step 1
      if (!techEmail.trim()) {
        Alert.alert("Required Field", "Please enter your email address.");
        return;
      }
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(techEmail.trim())) {
        Alert.alert("Invalid Email", "Please enter a valid email address.");
        return;
      }
      if (!plantRefNumber.trim()) {
        Alert.alert(
          "Required Field",
          "Please enter the plant reference number.",
        );
        return;
      }
      setTechStep(2);
    } else if (techStep === 2) {
      // Validate step 2
      if (!pvOwnerName.trim()) {
        Alert.alert("Required Field", "Please enter the PV owner name.");
        return;
      }
      if (!contactNumber.trim()) {
        Alert.alert("Required Field", "Please enter a contact number.");
        return;
      }
      if (!serviceType) {
        Alert.alert("Required Field", "Please select a service type.");
        return;
      }
      setTechStep(3);
    }
  };

  const handleBackStep = () => {
    if (techStep > 1) {
      setTechStep(techStep - 1);
    }
  };

  const handleSubmitNonTechnical = async () => {
    // Validate all required fields
    if (!fullName.trim()) {
      Alert.alert("Required Field", "Please enter your full name.");
      return;
    }
    if (!email.trim()) {
      Alert.alert("Required Field", "Please enter your email address.");
      return;
    }
    if (!subject) {
      Alert.alert("Required Field", "Please select a subject.");
      return;
    }
    if (!description.trim()) {
      Alert.alert("Required Field", "Please describe your concern.");
      return;
    }

    // Email validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email.trim())) {
      Alert.alert("Invalid Email", "Please enter a valid email address.");
      return;
    }

    setSubmitting(true);

    try {
      // Get GMT+8 timestamp
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

      // Format timestamp as YYYY-MM-DD HH:mm:ss
      const [datePart, timePart] = gmt8Time.split(", ");
      const [day, month, year] = datePart.split("/");
      const formattedTimestamp = `${year}-${month}-${day} ${timePart}`;

      // Get reCAPTCHA token (web only)
      const recaptchaToken = await executeRecaptcha();

      // Prepare form data
      const formData: any = {
        "Full-Name": fullName.trim(),
        Email: email.trim(),
        Subject: subject,
        "Concern-Description": description.trim(),
        form_name: "solviva-support-general-20250506",
        "ticket-type": "general",
        "submission-timestamp": formattedTimestamp,
      };

      // Add reCAPTCHA token if on web
      if (recaptchaToken) {
        formData["g-recaptcha-response"] = recaptchaToken;
      }

      // Submit to n8n webhook
      const response = await fetch(
        "https://solviva.app.n8n.cloud/webhook/webflow-customer-support",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "X-Submission-Source": Platform.OS === "web" ? "web" : "mobile-app",
            "X-Platform": Platform.OS,
            "X-App-Version": "1.0.0",
          },
          body: JSON.stringify(formData),
        },
      );

      if (response.ok) {
        Alert.alert(
          "Ticket Submitted",
          "Your support ticket has been created. We will respond within 24-48 hours.",
          [{ text: "OK" }],
        );
        // Clear form
        setFullName("");
        setEmail("");
        setSubject("");
        setDescription("");
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

  const handleSubmitTechnical = async () => {
    // Validate based on service type
    if (serviceType === "issue") {
      if (!concernCategory) {
        Alert.alert("Required Field", "Please select a concern category.");
        return;
      }
      if (!concernDescription.trim()) {
        Alert.alert("Required Field", "Please describe your concern.");
        return;
      }
    }

    setSubmitting(true);

    try {
      // Get GMT+8 timestamp
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
      const formattedTimestamp = `${year}-${month}-${day} ${timePart}`;

      // Get reCAPTCHA token (web only)
      const recaptchaToken = await executeRecaptcha();

      // Prepare form data
      const formData: any = {
        Email: techEmail.trim(),
        "Plant-Reference-Number": plantRefNumber.trim(),
        "PV-Owner-Name": pvOwnerName.trim(),
        Phone: contactNumber.trim(),
        "Service-Type":
          serviceType === "issue"
            ? "Issue with Solar PV System"
            : "Schedule a PMS / Cleaning Appointment",
        form_name: "solviva-support-technical-20250506",
        "ticket-type": "technical",
        "submission-timestamp": formattedTimestamp,
      };

      if (serviceType === "issue") {
        formData["Detailed-Concern"] = concernCategory;
        formData["Concern-Description"] = concernDescription.trim();
      }

      // Add reCAPTCHA token if on web
      if (recaptchaToken) {
        formData["g-recaptcha-response"] = recaptchaToken;
      }

      // Submit to n8n webhook
      const response = await fetch(
        "https://solviva.app.n8n.cloud/webhook/webflow-customer-support",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "X-Submission-Source": Platform.OS === "web" ? "web" : "mobile-app",
            "X-Platform": Platform.OS,
            "X-App-Version": "1.0.0",
          },
          body: JSON.stringify(formData),
        },
      );

      if (response.ok) {
        Alert.alert(
          "Ticket Submitted",
          "Your technical support ticket has been created. We will respond within 24-48 hours.",
          [{ text: "OK" }],
        );
        // Clear form and reset to step 1
        setTechEmail("");
        setPlantRefNumber("");
        setPvOwnerName("");
        setContactNumber("");
        setServiceType("");
        setConcernCategory("");
        setConcernDescription("");
        setTechStep(1);
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
        <Text style={styles.sectionTitle}>Customer Care</Text>
        <Text style={styles.sectionSubtitle}>
          Got a question or need support? Submit a ticket to our support team
          and we'll review your request right away to ensure you get the help
          you need.
        </Text>

        {/* Ticket Type Selector */}
        <View style={styles.ticketTypeSelector}>
          <TouchableOpacity
            style={[
              styles.ticketTypeButton,
              ticketType === "non-technical" && styles.ticketTypeButtonActive,
            ]}
            onPress={() => {
              setTicketType("non-technical");
              setTechStep(1);
            }}
          >
            <Text
              style={[
                styles.ticketTypeText,
                ticketType === "non-technical" && styles.ticketTypeTextActive,
              ]}
            >
              Non-Technical
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[
              styles.ticketTypeButton,
              ticketType === "technical" && styles.ticketTypeButtonActive,
            ]}
            onPress={() => {
              setTicketType("technical");
              setTechStep(1);
            }}
          >
            <Text
              style={[
                styles.ticketTypeText,
                ticketType === "technical" && styles.ticketTypeTextActive,
              ]}
            >
              Technical
            </Text>
          </TouchableOpacity>
        </View>

        {/* Non-Technical Form */}
        {ticketType === "non-technical" && (
          <View style={styles.formCard}>
            <View style={styles.inputContainer}>
              <Text style={styles.fieldLabel}>Full Name</Text>
              <TextInput
                style={styles.input}
                placeholder="Enter your full name"
                placeholderTextColor={Colors.textSecondary}
                value={fullName}
                onChangeText={setFullName}
              />
            </View>

            <View style={styles.inputContainer}>
              <Text style={styles.fieldLabel}>Email Address</Text>
              <TextInput
                style={styles.input}
                placeholder="Enter your email"
                placeholderTextColor={Colors.textSecondary}
                keyboardType="email-address"
                autoCapitalize="none"
                value={email}
                onChangeText={setEmail}
              />
            </View>

            <View style={styles.inputContainer}>
              <Text style={styles.fieldLabel}>Subject</Text>
              {Platform.OS === "web" ? (
                <select
                  style={{
                    borderWidth: 1,
                    borderColor: Colors.border,
                    borderRadius: 12,
                    padding: Spacing.md,
                    fontSize: FontSizes.md,
                    color: Colors.text,
                    backgroundColor: Colors.surface,
                  }}
                  value={subject}
                  onChange={(e) => setSubject(e.target.value)}
                >
                  <option value=""></option>
                  <option value="General Inquiry">General Inquiry</option>
                  <option value="Service Availability">
                    Service Availability
                  </option>
                  <option value="Payment Options">Payment Options</option>
                </select>
              ) : (
                <View style={styles.pickerContainer}>
                  <Picker
                    selectedValue={subject}
                    onValueChange={(itemValue) => setSubject(itemValue)}
                    style={styles.picker}
                  >
                    <Picker.Item label="Select a subject" value="" />
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
                  </Picker>
                </View>
              )}
            </View>

            <View style={styles.inputContainer}>
              <Text style={styles.fieldLabel}>Description</Text>
              <TextInput
                style={[styles.input, styles.textArea]}
                placeholder="Describe your concern..."
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
              onPress={handleSubmitNonTechnical}
              disabled={submitting}
            >
              {submitting ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text style={styles.submitButtonText}>Submit</Text>
              )}
            </TouchableOpacity>
          </View>
        )}

        {/* Technical Form - Multi-step */}
        {ticketType === "technical" && (
          <View style={styles.formCard}>
            {/* Step 1: Customer Verification */}
            {techStep === 1 && (
              <>
                <Text style={styles.stepTitle}>Customer Verification</Text>
                <View style={styles.inputContainer}>
                  <Text style={styles.fieldLabel}>Email Address</Text>
                  <TextInput
                    style={styles.input}
                    placeholder="Enter your email"
                    placeholderTextColor={Colors.textSecondary}
                    keyboardType="email-address"
                    autoCapitalize="none"
                    value={techEmail}
                    onChangeText={setTechEmail}
                  />
                </View>

                <View style={styles.inputContainer}>
                  <Text style={styles.fieldLabel}>Plant Reference Number</Text>
                  <Text style={styles.fieldSublabel}>
                    The Plant Reference Number can be found on the turnover
                    document files that were submitted, as well as on the
                    sticker attached to the inverter. If it is not found, please
                    write "N/A."
                  </Text>
                  <TextInput
                    style={styles.input}
                    placeholder="Enter plant reference number"
                    placeholderTextColor={Colors.textSecondary}
                    value={plantRefNumber}
                    onChangeText={setPlantRefNumber}
                  />
                </View>

                <TouchableOpacity
                  style={styles.nextButton}
                  onPress={handleNextStep}
                >
                  <Text style={styles.nextButtonText}>Next</Text>
                </TouchableOpacity>
              </>
            )}

            {/* Step 2: Detailed Information */}
            {techStep === 2 && (
              <>
                <Text style={styles.stepTitle}>
                  Detailed information about the concern
                </Text>
                <View style={styles.inputContainer}>
                  <Text style={styles.fieldLabel}>
                    Complete Name of Solar PV System Owner
                  </Text>
                  <TextInput
                    style={styles.input}
                    placeholder="Enter owner name"
                    placeholderTextColor={Colors.textSecondary}
                    value={pvOwnerName}
                    onChangeText={setPvOwnerName}
                  />
                </View>

                <View style={styles.inputContainer}>
                  <Text style={styles.fieldLabel}>Contact Number</Text>
                  <TextInput
                    style={styles.input}
                    placeholder="Enter contact number"
                    placeholderTextColor={Colors.textSecondary}
                    keyboardType="phone-pad"
                    value={contactNumber}
                    onChangeText={setContactNumber}
                  />
                </View>

                <View style={styles.inputContainer}>
                  <Text style={styles.fieldLabel}>What is this about?</Text>
                  <TouchableOpacity
                    style={styles.radioOption}
                    onPress={() => setServiceType("issue")}
                  >
                    <View style={styles.radioButton}>
                      {serviceType === "issue" && (
                        <View style={styles.radioButtonSelected} />
                      )}
                    </View>
                    <Text style={styles.radioLabel}>
                      Issue with Solar PV System
                    </Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={styles.radioOption}
                    onPress={() => setServiceType("pms")}
                  >
                    <View style={styles.radioButton}>
                      {serviceType === "pms" && (
                        <View style={styles.radioButtonSelected} />
                      )}
                    </View>
                    <Text style={styles.radioLabel}>
                      Schedule a PMS / Cleaning Appointment
                    </Text>
                  </TouchableOpacity>
                </View>

                <View style={styles.buttonRow}>
                  <TouchableOpacity
                    style={styles.backButton}
                    onPress={handleBackStep}
                  >
                    <Text style={styles.backButtonText}>Back</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={styles.nextButton}
                    onPress={handleNextStep}
                  >
                    <Text style={styles.nextButtonText}>Next</Text>
                  </TouchableOpacity>
                </View>
              </>
            )}

            {/* Step 3: Issue Details */}
            {techStep === 3 && serviceType === "issue" && (
              <>
                <Text style={styles.stepTitle}>Issue with Solar PV System</Text>
                <View style={styles.inputContainer}>
                  <Text style={styles.fieldLabel}>
                    Concern Category (Detailed)
                  </Text>
                  {Platform.OS === "web" ? (
                    <select
                      style={{
                        borderWidth: 1,
                        borderColor: Colors.border,
                        borderRadius: 12,
                        padding: Spacing.md,
                        fontSize: FontSizes.md,
                        color: Colors.text,
                        backgroundColor: Colors.surface,
                      }}
                      value={concernCategory}
                      onChange={(e) => setConcernCategory(e.target.value)}
                    >
                      <option value="">Select one...</option>
                      <option value="Higher Electricity Bill after Solar Installation">
                        Higher Electricity Bill after Solar Installation
                      </option>
                      <option value="Low Energy Output / No savings in Electricity Bill">
                        Low Energy Output / No savings in Electricity Bill
                      </option>
                      <option value="Roof leak">Roof leak</option>
                      <option value="Online monitoring is not working">
                        Online monitoring is not working
                      </option>
                      <option value="Unusual signs on the inverter (heat, smoke, discoloration, or abnormal light indicators)">
                        Unusual signs on the inverter (heat, smoke,
                        discoloration, or abnormal light indicators)
                      </option>
                      <option value="Panel Damage - Warranty Claim">
                        Panel Damage - Warranty Claim
                      </option>
                      <option value="Inverter Issues - Warranty Claim">
                        Inverter Issues - Warranty Claim
                      </option>
                      <option value="Battery Problems - Warranty Claim">
                        Battery Problems - Warranty Claim
                      </option>
                      <option value="Wiring or Connection Faults / Loose or faulty connections">
                        Wiring or Connection Faults / Loose or faulty
                        connections
                      </option>
                      <option value="Structural / Roof Damage">
                        Structural / Roof Damage
                      </option>
                      <option value="Other Workmanship Warranty Claim">
                        Other Workmanship Warranty Claim
                      </option>
                      <option value="Overheating Components">
                        Overheating Components
                      </option>
                      <option value="Electrical Shocks">
                        Electrical Shocks
                      </option>
                    </select>
                  ) : (
                    <View style={styles.pickerContainer}>
                      <Picker
                        selectedValue={concernCategory}
                        onValueChange={(itemValue) =>
                          setConcernCategory(itemValue)
                        }
                        style={styles.picker}
                      >
                        <Picker.Item label="Select one..." value="" />
                        <Picker.Item
                          label="Higher Electricity Bill after Solar Installation"
                          value="Higher Electricity Bill after Solar Installation"
                        />
                        <Picker.Item
                          label="Low Energy Output / No savings in Electricity Bill"
                          value="Low Energy Output / No savings in Electricity Bill"
                        />
                        <Picker.Item label="Roof leak" value="Roof leak" />
                        <Picker.Item
                          label="Online monitoring is not working"
                          value="Online monitoring is not working"
                        />
                        <Picker.Item
                          label="Unusual signs on the inverter"
                          value="Unusual signs on the inverter (heat, smoke, discoloration, or abnormal light indicators)"
                        />
                        <Picker.Item
                          label="Panel Damage - Warranty Claim"
                          value="Panel Damage - Warranty Claim"
                        />
                        <Picker.Item
                          label="Inverter Issues - Warranty Claim"
                          value="Inverter Issues - Warranty Claim"
                        />
                        <Picker.Item
                          label="Battery Problems - Warranty Claim"
                          value="Battery Problems - Warranty Claim"
                        />
                        <Picker.Item
                          label="Wiring or Connection Faults"
                          value="Wiring or Connection Faults / Loose or faulty connections"
                        />
                        <Picker.Item
                          label="Structural / Roof Damage"
                          value="Structural / Roof Damage"
                        />
                        <Picker.Item
                          label="Other Workmanship Warranty Claim"
                          value="Other Workmanship Warranty Claim"
                        />
                        <Picker.Item
                          label="Overheating Components"
                          value="Overheating Components"
                        />
                        <Picker.Item
                          label="Electrical Shocks"
                          value="Electrical Shocks"
                        />
                      </Picker>
                    </View>
                  )}
                </View>

                <View style={styles.inputContainer}>
                  <Text style={styles.fieldLabel}>
                    Detailed Description of Concern
                  </Text>
                  <TextInput
                    style={[styles.input, styles.textArea]}
                    placeholder="Describe your concern in detail..."
                    placeholderTextColor={Colors.textSecondary}
                    multiline
                    numberOfLines={4}
                    textAlignVertical="top"
                    value={concernDescription}
                    onChangeText={setConcernDescription}
                  />
                </View>

                <View style={styles.buttonRow}>
                  <TouchableOpacity
                    style={styles.backButton}
                    onPress={handleBackStep}
                  >
                    <Text style={styles.backButtonText}>Back</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[
                      styles.submitButton,
                      submitting && styles.buttonDisabled,
                    ]}
                    onPress={handleSubmitTechnical}
                    disabled={submitting}
                  >
                    {submitting ? (
                      <ActivityIndicator color="#fff" />
                    ) : (
                      <Text style={styles.submitButtonText}>Submit</Text>
                    )}
                  </TouchableOpacity>
                </View>
              </>
            )}

            {/* Step 3: PMS Information */}
            {techStep === 3 && serviceType === "pms" && (
              <>
                <Text style={styles.pmsTitle}>
                  Thank you for considering our Preventive Maintenance Service
                  (PMS) for your Solar PV System.
                </Text>
                <Text style={styles.pmsText}>
                  • Starting cost: ₱10,000 VAT inclusive for systems up to 10kW.
                  {"\n"}• For larger systems: ₱900 per kWp for systems above
                  10kW, up to 100kWp.
                </Text>
                <Text style={styles.pmsText}>
                  Our PMS includes solar module cleaning and inspection, thermal
                  scanning, inverter and panel board checks, grounding system
                  assessment, monitoring device inspection, and ensuring system
                  safety and structural integrity.
                </Text>
                <Text style={styles.pmsText}>
                  Please note that the cost is an estimate and may vary based on
                  location, system size, type, and specific requirements.
                </Text>
                <Text style={styles.pmsText}>
                  We look forward to helping you keep your Solar PV System in
                  peak condition!
                </Text>

                <View style={styles.buttonRow}>
                  <TouchableOpacity
                    style={styles.backButton}
                    onPress={handleBackStep}
                  >
                    <Text style={styles.backButtonText}>Back</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[
                      styles.submitButton,
                      submitting && styles.buttonDisabled,
                    ]}
                    onPress={handleSubmitTechnical}
                    disabled={submitting}
                  >
                    {submitting ? (
                      <ActivityIndicator color="#fff" />
                    ) : (
                      <Text style={styles.submitButtonText}>Submit</Text>
                    )}
                  </TouchableOpacity>
                </View>
              </>
            )}
          </View>
        )}
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
  inputContainer: {
    marginBottom: Spacing.md,
  },
  fieldLabel: {
    fontSize: FontSizes.md,
    fontWeight: "600",
    color: Colors.text,
    marginBottom: Spacing.xs,
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
  ticketTypeSelector: {
    flexDirection: "row",
    marginBottom: Spacing.md,
    backgroundColor: Colors.border,
    borderRadius: 12,
    padding: 4,
  },
  ticketTypeButton: {
    flex: 1,
    paddingVertical: Spacing.sm,
    borderRadius: 8,
    alignItems: "center",
  },
  ticketTypeButtonActive: {
    backgroundColor: "#006ac6",
  },
  ticketTypeText: {
    fontSize: FontSizes.md,
    fontWeight: "600",
    color: Colors.textSecondary,
  },
  ticketTypeTextActive: {
    color: "#ffffff",
  },
  stepTitle: {
    fontSize: FontSizes.lg,
    fontWeight: "600",
    color: Colors.text,
    marginBottom: Spacing.md,
  },
  fieldSublabel: {
    fontSize: FontSizes.sm,
    color: Colors.textSecondary,
    marginBottom: Spacing.xs,
    lineHeight: 18,
  },
  radioOption: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: Spacing.sm,
  },
  radioButton: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 2,
    borderColor: "#006ac6",
    alignItems: "center",
    justifyContent: "center",
    marginRight: Spacing.sm,
  },
  radioButtonSelected: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: "#006ac6",
  },
  radioLabel: {
    fontSize: FontSizes.md,
    color: Colors.text,
    flex: 1,
  },
  buttonRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: Spacing.md,
    gap: Spacing.sm,
  },
  backButton: {
    flex: 1,
    backgroundColor: "#ffffff",
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 12,
    padding: Spacing.md,
    alignItems: "center",
    minHeight: 48,
    justifyContent: "center",
  },
  backButtonText: {
    color: Colors.textSecondary,
    fontSize: FontSizes.lg,
    fontWeight: "600",
  },
  nextButton: {
    flex: 1,
    backgroundColor: "#006ac6",
    borderRadius: 12,
    padding: Spacing.md,
    alignItems: "center",
    minHeight: 48,
    justifyContent: "center",
  },
  nextButtonText: {
    color: "#ffffff",
    fontSize: FontSizes.lg,
    fontWeight: "700",
  },
  pmsTitle: {
    fontSize: FontSizes.lg,
    fontWeight: "700",
    color: Colors.text,
    marginBottom: Spacing.md,
  },
  pmsText: {
    fontSize: FontSizes.md,
    color: Colors.text,
    lineHeight: 22,
    marginBottom: Spacing.md,
  },
});
