import React, { useState, useEffect, useCallback } from "react";
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  Dimensions,
  ActivityIndicator,
  RefreshControl,
  Platform,
} from "react-native";
import { Colors, Spacing, FontSizes } from "../config/theme";
import {
  fetchSolarSystem,
  fetchWeeklyReadings,
  fetchMonthlyReadings,
  formatPeso,
  getDaysAgoInGmt8,
  getFourWeekMondays,
} from "../services/dataService";
import { fetchLiveData, LiveData } from "../services/apiService";

const { width } = Dimensions.get("window");
const PESO_PER_KWH = 11.5;

export default function EnergyScreen() {
  const [timeRange, setTimeRange] = useState<"today" | "7days" | "4weeks">(
    "7days",
  );
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [system, setSystem] = useState<any>(null);
  const [weeklyData, setWeeklyData] = useState<any[]>([]);
  const [monthlyData, setMonthlyData] = useState<any[]>([]);
  const [liveData, setLiveData] = useState<LiveData | null>(null);

  const loadData = useCallback(async () => {
    try {
      const [sys, weekly, monthly] = await Promise.all([
        fetchSolarSystem(),
        fetchWeeklyReadings(),
        fetchMonthlyReadings(),
      ]);
      setSystem(sys);
      setWeeklyData(weekly);
      setMonthlyData(monthly);

      // Fetch today's five-minute readings for the Today chart and list.
      const live = await fetchLiveData();
      setLiveData(live);
    } catch (err) {
      console.log("EnergyScreen loadData error:", err);
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

  const formatHour = (h: number) => {
    const suffix = h < 12 ? "AM" : "PM";
    const h12 = h % 12 === 0 ? 12 : h % 12;
    return `${h12} ${suffix}`;
  };

  // const formatReadingTime = (ts: string) => {
  //   const d = new Date(ts);
  //   const utcMs = d.getTime() + d.getTimezoneOffset() * 60 * 1000;
  //   const gmt8 = new Date(utcMs + 8 * 60 * 60 * 1000);
  //   const hour = gmt8.getUTCHours();
  //   const min = gmt8.getUTCMinutes();
  //   const suffix = hour >= 12 ? "PM" : "AM";
  //   const h12 = hour % 12 || 12;
  //   return `${h12}:${String(min).padStart(2, "0")} ${suffix}`;
  // };

  const formatReadingTime = (ts: string) => {
    const d = new Date(ts);

    // Removed the manual +8 hours logic. It now reads local system time.
    const hour = d.getHours();
    const min = d.getMinutes();
    const suffix = hour >= 12 ? "PM" : "AM";
    const h12 = hour % 12 || 12;

    return `${h12}:${String(min).padStart(2, "0")} ${suffix}`;
  };
  // ---- Compute chart data based on selected timeRange ----

  const getDisplayData = () => {
    if (timeRange === "today") {
      if (liveData?.today_hourly && liveData.today_hourly.length > 0) {
        // 1. Define the 6 intervals (4 hours each)
        const bucketLabels = [
          "12MN-4AM",
          "4AM-8AM",
          "8AM-12PM",
          "12PM-4PM",
          "4PM-8PM",
          "8PM-12MN",
        ];
        const bucketProd = [0, 0, 0, 0, 0, 0];
        const bucketCons = [0, 0, 0, 0, 0, 0];

        // 2. Sum up the hourly data into their respective 4-hour buckets
        liveData.today_hourly.forEach((b) => {
          const bucketIndex = Math.floor(b.hour / 4);

          // Safety check to ensure we only map to the 6 buckets (index 0-5)
          if (bucketIndex >= 0 && bucketIndex < 6) {
            bucketProd[bucketIndex] += Number(b.production_kwh) || 0;
            bucketCons[bucketIndex] += Number(b.consumption_kwh) || 0;
          }
        });

        // 3. Return the full array without slicing so it always shows up to 8 PM
        return {
          labels: bucketLabels,
          production: bucketProd.map((v) => Math.round(v * 100) / 100),
          consumption: bucketCons.map((v) => Math.round(v * 100) / 100),
        };
      }
      return { labels: ["No data"], production: [0], consumption: [0] };
    }

    // --- RESTORED 4 WEEKS LOGIC ---
    if (timeRange === "4weeks") {
      const { labels, mondayEpochs } = getFourWeekMondays();
      const prod = [0, 0, 0, 0];
      const cons = [0, 0, 0, 0];
      const WEEK_MS = 7 * 86400000;

      if (monthlyData.length > 0) {
        monthlyData.forEach((r: any) => {
          const rTime = new Date(r.timestamp).getTime();
          for (let i = 0; i < 4; i++) {
            if (rTime >= mondayEpochs[i] && rTime < mondayEpochs[i] + WEEK_MS) {
              prod[i] += Number(r.production_kwh);
              cons[i] += Number(r.consumption_kwh);
              break;
            }
          }
        });
        prod.forEach((_, i) => {
          prod[i] = Math.round(prod[i] * 10) / 10;
        });
        cons.forEach((_, i) => {
          cons[i] = Math.round(cons[i] * 10) / 10;
        });
      }

      return { labels, production: prod, consumption: cons };
    }
    // ------------------------------

    // Default: 7 complete days — yesterday back to 7 days ago
    const dayLabels: string[] = [];
    const prod: number[] = [];
    const cons: number[] = [];
    for (let i = 7; i >= 1; i--) {
      const d = new Date(Date.now() - i * 86400000);

      // Removed manual +8 offset; directly grabbing local Month/Date
      const mm = String(d.getMonth() + 1).padStart(2, "0");
      const dd = String(d.getDate()).padStart(2, "0");

      dayLabels.push(`${mm}/${dd}`);
      prod.push(0);
      cons.push(0);
    }
    if (weeklyData.length > 0) {
      weeklyData.forEach((r: any) => {
        const daysAgo = getDaysAgoInGmt8(r.timestamp);
        const idx = 7 - daysAgo; // 7 days ago → index 0, yesterday → index 6
        if (idx >= 0 && idx < 7) {
          prod[idx] += Number(r.production_kwh);
          cons[idx] += Number(r.consumption_kwh);
        }
      });
    }

    return { labels: dayLabels, production: prod, consumption: cons };
  };

  const {
    labels: chartLabels,
    production: chartProduction,
    consumption: chartConsumption,
  } = getDisplayData();

  const totalProduction = chartProduction.reduce((a, b) => a + b, 0);
  const totalConsumption = chartConsumption.reduce((a, b) => a + b, 0);
  const hasConsumption = totalConsumption > 0;
  const totalSavings = totalProduction * PESO_PER_KWH;
  const selfConsumptionRate =
    totalConsumption > 0
      ? Math.round(
          (Math.min(totalProduction, totalConsumption) / totalConsumption) *
            100,
        )
      : 0;
  const totalGridExport = (() => {
    if (timeRange === "today") {
      return liveData?.today_grid_export_kwh ?? 0;
    }
    const data = timeRange === "7days" ? weeklyData : monthlyData;
    return data.reduce(
      (sum: number, r: any) => sum + Number(r.grid_export_kwh || 0),
      0,
    );
  })();
  const hasGridExport = totalGridExport > 0;
  const showConsumption = hasConsumption || timeRange === "today";

  // Five-minute readings from the table for Today's Readings.
  const liveReadings = liveData?.today_readings ?? [];

  // Check if any reading has battery data
  const hasBattery = liveReadings.some(
    (r) => r.battery_level != null && r.battery_level > 0,
  );

  // Determine period label for the finance section
  const periodLabel =
    timeRange === "today"
      ? "Today"
      : timeRange === "4weeks"
        ? "4-Week"
        : "7-Day";

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
        <Text style={styles.headerTitle}>Energy Overview</Text>
        <Text style={styles.headerSubtitle}>
          {system?.system_name ?? "Solar System"}
        </Text>
      </View>

      {/* Time Range Selector */}
      <View style={styles.timeSelector}>
        {(
          [
            { key: "today", label: "Today" },
            { key: "7days", label: "7 Days" },
            { key: "4weeks", label: "4 Weeks" },
          ] as const
        ).map(({ key, label }) => (
          <TouchableOpacity
            key={key}
            style={[
              styles.timeButton,
              timeRange === key && styles.timeButtonActive,
            ]}
            onPress={() => setTimeRange(key)}
          >
            <Text
              style={[
                styles.timeButtonText,
                timeRange === key && styles.timeButtonTextActive,
              ]}
            >
              {label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Production vs Consumption Chart Placeholder */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>
          {showConsumption ? "Production vs Consumption" : "Production"}
        </Text>
        <View style={styles.chartCard}>
          {/* <View style={styles.chartPlaceholder}> */}
          <View
            style={[
              styles.chartPlaceholder,
              timeRange === "today" &&
                Platform.OS !== "web" && {
                  height: 140,
                  paddingBottom: Spacing.md,
                  overflow: "visible",
                },
            ]}
          >
            {(() => {
              const maxVal = Math.max(
                ...chartProduction,
                ...(showConsumption ? chartConsumption : []),
                1,
              );
              const maxBarHeight = 100; // px budget for bars
              const scale = maxBarHeight / maxVal;
              return chartLabels.map((label, index) => (
                <View key={label} style={styles.barGroup}>
                  <View style={styles.barContainer}>
                    <View
                      style={[
                        styles.barProduction,
                        {
                          height: Math.max(2, chartProduction[index] * scale),
                        },
                      ]}
                    />
                    {showConsumption && (
                      <View
                        style={[
                          styles.barConsumption,
                          {
                            height: Math.max(
                              2,
                              chartConsumption[index] * scale,
                            ),
                          },
                        ]}
                      />
                    )}
                  </View>
                  {/* <Text style={styles.barLabel}>{label}</Text> */}
                  <Text
                    style={[
                      styles.barLabel,
                      timeRange === "today" &&
                        Platform.OS !== "web" && {
                          marginTop: 12,
                          fontSize: 9,
                          textAlign: "center",
                          width: 48,
                          transform: [
                            { translateX: 0 }, // Shifts the text left to align with the bar
                            { rotate: "-45deg" },
                          ],
                        },
                    ]}
                  >
                    {label}
                  </Text>
                </View>
              ));
            })()}
          </View>
          <View style={styles.chartLegend}>
            <View style={styles.legendItem}>
              <View
                style={[
                  styles.legendDot,
                  { backgroundColor: Colors.primaryLight },
                ]}
              />
              <Text style={styles.legendText}>Production</Text>
            </View>
            {showConsumption && (
              <View style={styles.legendItem}>
                <View
                  style={[
                    styles.legendDot,
                    { backgroundColor: Colors.warning },
                  ]}
                />
                <Text style={styles.legendText}>Consumption</Text>
              </View>
            )}
          </View>
        </View>
      </View>

      {/* Summary Cards */}
      <View style={styles.section}>
        <View style={styles.summaryGrid}>
          <View style={[styles.summaryCard, { backgroundColor: "#E8F5E9" }]}>
            <Text style={styles.summaryIcon}>☀️</Text>
            <Text style={styles.summaryValue}>
              {totalProduction.toFixed(1)} kWh
            </Text>
            <Text style={styles.summaryLabel}>Total Production</Text>
          </View>
          {hasConsumption && (
            <View style={[styles.summaryCard, { backgroundColor: "#FFF3E0" }]}>
              <Text style={styles.summaryIcon}>⚡</Text>
              <Text style={styles.summaryValue}>
                {totalConsumption.toFixed(1)} kWh
              </Text>
              <Text style={styles.summaryLabel}>Total Consumption</Text>
            </View>
          )}
          <View style={[styles.summaryCard, { backgroundColor: "#E8F5E9" }]}>
            <Text style={styles.summaryIcon}>💰</Text>
            <Text style={styles.summaryValue}>{formatPeso(totalSavings)}</Text>
            <Text style={styles.summaryLabel}>Total Savings</Text>
          </View>
          {hasConsumption && (
            <View style={[styles.summaryCard, { backgroundColor: "#E3F2FD" }]}>
              <Text style={styles.summaryIcon}>📊</Text>
              <Text style={styles.summaryValue}>{selfConsumptionRate}%</Text>
              <Text style={styles.summaryLabel}>Self-Consumption</Text>
            </View>
          )}
        </View>
      </View>

      {/* Readings Section */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>
          {timeRange === "today"
            ? "Today's Readings"
            : timeRange === "4weeks"
              ? "Weekly Readings"
              : "Daily Readings"}
        </Text>

        {/* Today tab: 5-min live readings */}
        {timeRange === "today" && liveReadings.length === 0 && (
          <Text style={{ color: Colors.textSecondary, fontSize: FontSizes.md }}>
            No readings yet today.
          </Text>
        )}
        {timeRange === "today" && liveReadings.length > 0 && (
          <View style={styles.readingsContainer}>
            <ScrollView nestedScrollEnabled showsVerticalScrollIndicator>
              {liveReadings.map((reading, index) => {
                const time = formatReadingTime(reading.timestamp);
                return (
                  <View key={index} style={styles.readingRow}>
                    <Text style={styles.readingTime}>{time}</Text>
                    <View style={styles.readingValues}>
                      <Text style={styles.readingProduction}>
                        ☀️ {reading.production_kw} kW
                      </Text>
                      {showConsumption && (
                        <Text style={styles.readingConsumption}>
                          ⚡ {reading.consumption_kw} kW
                        </Text>
                      )}
                    </View>
                    {hasBattery && (
                      <Text style={styles.readingBattery}>
                        🔋 {reading.battery_level}%
                      </Text>
                    )}
                  </View>
                );
              })}
            </ScrollView>
          </View>
        )}

        {/* 7 Days / 4 Weeks tab: daily summary readings */}
        {timeRange !== "today" &&
          (() => {
            const data = timeRange === "7days" ? weeklyData : monthlyData;
            // Group by date label
            const dailyMap = new Map<string, { prod: number; cons: number }>();
            // Initialize with chart labels so order is preserved
            chartLabels.forEach((label) => {
              dailyMap.set(label, { prod: 0, cons: 0 });
            });
            if (timeRange === "7days") {
              data.forEach((r: any) => {
                const daysAgo = getDaysAgoInGmt8(r.timestamp);
                const idx = 7 - daysAgo;
                if (idx >= 0 && idx < 7) {
                  const label = chartLabels[idx];
                  const entry = dailyMap.get(label)!;
                  entry.prod += Number(r.production_kwh);
                  entry.cons += Number(r.consumption_kwh);
                }
              });
            } else {
              // 4 weeks — group by ISO week (Monday date labels)
              const { mondayEpochs } = getFourWeekMondays();
              const WEEK_MS = 7 * 86400000;
              data.forEach((r: any) => {
                const rTime = new Date(r.timestamp).getTime();
                for (let i = 0; i < 4; i++) {
                  if (
                    rTime >= mondayEpochs[i] &&
                    rTime < mondayEpochs[i] + WEEK_MS
                  ) {
                    const label = chartLabels[i];
                    if (label) {
                      const entry = dailyMap.get(label)!;
                      entry.prod += Number(r.production_kwh);
                      entry.cons += Number(r.consumption_kwh);
                    }
                    break;
                  }
                }
              });
            }
            const entries = Array.from(dailyMap.entries());
            return (
              <View style={styles.readingsContainer}>
                <ScrollView nestedScrollEnabled showsVerticalScrollIndicator>
                  {entries.map(([label, vals]) => (
                    <View key={label} style={styles.readingRow}>
                      <Text style={styles.readingTime}>{label}</Text>
                      <View style={styles.readingValues}>
                        <Text style={styles.readingProduction}>
                          ☀️ {vals.prod.toFixed(1)} kWh
                        </Text>
                        {hasConsumption && (
                          <Text style={styles.readingConsumption}>
                            ⚡ {vals.cons.toFixed(1)} kWh
                          </Text>
                        )}
                      </View>
                    </View>
                  ))}
                </ScrollView>
              </View>
            );
          })()}
      </View>

      {/* Financial Tracking */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Peso Savings Calculator</Text>
        <View style={styles.financeCard}>
          <View style={styles.financeRow}>
            <Text style={styles.financeLabel}>Electricity Rate</Text>
            <Text style={styles.financeValue}>₱{PESO_PER_KWH}/kWh</Text>
          </View>
          <View style={styles.financeRow}>
            <Text style={styles.financeLabel}>
              Energy Produced ({periodLabel})
            </Text>
            <Text style={styles.financeValue}>
              {totalProduction.toFixed(1)} kWh
            </Text>
          </View>
          {hasGridExport && (
            <View style={styles.financeRow}>
              <Text style={styles.financeLabel}>
                Grid Export ({periodLabel})
              </Text>
              <Text style={styles.financeValue}>
                {totalGridExport.toFixed(1)} kWh
              </Text>
            </View>
          )}
          <View style={[styles.financeRow, styles.financeTotal]}>
            <Text style={styles.financeTotalLabel}>
              Estimated Savings ({periodLabel})
            </Text>
            <Text style={styles.financeTotalValue}>
              {formatPeso(totalProduction * PESO_PER_KWH)}
            </Text>
          </View>
        </View>
      </View>

      {/* System Info */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>System Details</Text>
        <View style={styles.systemCard}>
          <View style={styles.systemRow}>
            <Text style={styles.systemLabel}>System</Text>
            <Text style={styles.systemValue}>{system?.system_name ?? "—"}</Text>
          </View>
          <View style={styles.systemRow}>
            <Text style={styles.systemLabel}>Capacity</Text>
            <Text style={styles.systemValue}>
              {system?.capacity_kwp ?? "—"} kWp
            </Text>
          </View>
          {system?.battery_capacity_kwh != null &&
            system.battery_capacity_kwh > 0 && (
              <View style={styles.systemRow}>
                <Text style={styles.systemLabel}>Battery</Text>
                <Text style={styles.systemValue}>
                  {system.battery_capacity_kwh} kWh
                </Text>
              </View>
            )}
          <View style={styles.systemRow}>
            <Text style={styles.systemLabel}>Installed</Text>
            <Text style={styles.systemValue}>
              {system?.installation_date ?? "—"}
            </Text>
          </View>
          <View style={styles.systemRow}>
            <Text style={styles.systemLabel}>Status</Text>
            <Text style={[styles.systemValue, { color: Colors.success }]}>
              ● Active
            </Text>
          </View>
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
  },
  timeSelector: {
    flexDirection: "row",
    margin: Spacing.lg,
    backgroundColor: Colors.surface,
    borderRadius: 12,
    padding: 4,
  },
  timeButton: {
    flex: 1,
    paddingVertical: 10,
    alignItems: "center",
    borderRadius: 10,
  },
  timeButtonActive: {
    backgroundColor: Colors.primary,
  },
  timeButtonText: {
    fontSize: FontSizes.md,
    color: Colors.textSecondary,
    fontWeight: "500",
  },
  timeButtonTextActive: {
    color: Colors.textLight,
    fontWeight: "700",
  },
  section: { paddingHorizontal: Spacing.lg, marginTop: Spacing.md },
  sectionTitle: {
    fontSize: FontSizes.xl,
    fontWeight: "700",
    color: Colors.text,
    marginBottom: Spacing.sm,
  },
  chartCard: {
    backgroundColor: Colors.surface,
    borderRadius: 16,
    padding: Spacing.lg,
    elevation: 2,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 3,
  },
  chartPlaceholder: {
    flexDirection: "row",
    justifyContent: "space-around",
    alignItems: "flex-end",
    height: 130,
    paddingBottom: Spacing.sm,
    overflow: "hidden",
  },
  barGroup: { alignItems: "center" },
  barContainer: {
    flexDirection: "row",
    alignItems: "flex-end",
    gap: 2,
  },
  barProduction: {
    width: 14,
    backgroundColor: Colors.primaryLight,
    borderTopLeftRadius: 3,
    borderTopRightRadius: 3,
    minHeight: 4,
  },
  barConsumption: {
    width: 14,
    backgroundColor: Colors.warning,
    borderTopLeftRadius: 3,
    borderTopRightRadius: 3,
    minHeight: 4,
  },
  barLabel: {
    fontSize: FontSizes.xs,
    color: Colors.textSecondary,
    marginTop: 4,
  },
  chartLegend: {
    flexDirection: "row",
    justifyContent: "center",
    gap: 24,
    marginTop: Spacing.md,
  },
  legendItem: { flexDirection: "row", alignItems: "center" },
  legendDot: { width: 10, height: 10, borderRadius: 5, marginRight: 6 },
  legendText: { fontSize: FontSizes.sm, color: Colors.textSecondary },
  summaryGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "space-between",
  },
  summaryCard: {
    width: "48%",
    padding: Spacing.md,
    borderRadius: 16,
    marginBottom: Spacing.sm,
    alignItems: "center",
  },
  summaryIcon: { fontSize: 28, marginBottom: 4 },
  summaryValue: {
    fontSize: FontSizes.lg,
    fontWeight: "700",
    color: Colors.text,
  },
  summaryLabel: {
    fontSize: FontSizes.xs,
    color: Colors.textSecondary,
    marginTop: 2,
    textAlign: "center",
  },
  readingsContainer: {
    maxHeight: 260,
    backgroundColor: Colors.surface,
    borderRadius: 12,
    padding: Spacing.xs,
  },
  readingRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    backgroundColor: Colors.background,
    padding: Spacing.md,
    borderRadius: 12,
    marginBottom: Spacing.xs,
  },
  readingTime: {
    fontSize: FontSizes.md,
    fontWeight: "600",
    color: Colors.text,
    width: 70,
  },
  readingValues: { flex: 1 },
  readingProduction: { fontSize: FontSizes.sm, color: Colors.primaryLight },
  readingConsumption: { fontSize: FontSizes.sm, color: Colors.warning },
  readingBattery: { fontSize: FontSizes.md, color: Colors.text },
  financeCard: {
    backgroundColor: Colors.surface,
    borderRadius: 16,
    padding: Spacing.lg,
    elevation: 2,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 3,
  },
  financeRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingVertical: Spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  financeLabel: { fontSize: FontSizes.md, color: Colors.textSecondary },
  financeValue: {
    fontSize: FontSizes.md,
    fontWeight: "600",
    color: Colors.text,
  },
  financeTotal: {
    borderBottomWidth: 0,
    marginTop: Spacing.sm,
    paddingTop: Spacing.md,
    borderTopWidth: 2,
    borderTopColor: Colors.primary,
  },
  financeTotalLabel: {
    fontSize: FontSizes.lg,
    fontWeight: "700",
    color: Colors.primary,
  },
  financeTotalValue: {
    fontSize: FontSizes.lg,
    fontWeight: "700",
    color: Colors.primary,
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
  systemRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingVertical: Spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  systemLabel: { fontSize: FontSizes.md, color: Colors.textSecondary },
  systemValue: {
    fontSize: FontSizes.md,
    fontWeight: "600",
    color: Colors.text,
  },
});
