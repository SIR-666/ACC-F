import React, {
  useEffect,
  useRef,
  useState,
  useCallback,
  useMemo,
} from "react";
import { StatusBar } from "expo-status-bar";
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  ActivityIndicator,
  FlatList,
  Dimensions,
  Alert,
  RefreshControl,
  TouchableOpacity,
  Modal,
  TextInput,
  KeyboardAvoidingView,
  Platform,
  TouchableWithoutFeedback,
  Keyboard,
  Animated,
  Share,
} from "react-native";
import { Picker } from "@react-native-picker/picker";
import { Ionicons } from "@expo/vector-icons";
import axios from "axios";
import Constants from "expo-constants";
import * as FileSystem from "expo-file-system/legacy";

const apiUrl = Constants.expoConfig?.extra?.API_URL;
const screenWidth = Dimensions.get("window").width;

export default function History({ navigation }) {
  const mounted = useRef(false);

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const [types, setTypes] = useState([]);
  const [selectedType, setSelectedType] = useState("all");

  const [totals, setTotals] = useState({
    total_masuk: 0,
    total_keluar: 0,
    balance: 0,
  });

  const [transactions, setTransactions] = useState([]);
  const [sortedTransactions, setSortedTransactions] = useState([]);
  const txCache = useRef(null);
  const [editModalVisible, setEditModalVisible] = useState(false);
  const [editSubmitting, setEditSubmitting] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [editId, setEditId] = useState(null);
  const [editJenis, setEditJenis] = useState("masuk");
  const [editJumlah, setEditJumlah] = useState("");
  const [editKeterangan, setEditKeterangan] = useState("");
  const [editProyek, setEditProyek] = useState("");
  const editScale = useRef(new Animated.Value(0.95)).current;
  const editInputRef = useRef(null);

  const formatCurrency = useCallback((v) => {
    try {
      return Number(v).toLocaleString();
    } catch {
      return String(v);
    }
  }, []);

  const loadTypes = useCallback(async () => {
    try {
      const res = await axios.get(`${apiUrl}/types`, { timeout: 10000 });
      if (mounted.current) setTypes(res.data?.data ?? []);
    } catch (e) {
      console.warn("loadTypes:", e?.message ?? e);
    }
  }, []);

  const loadTransactions = useCallback(async (forceReload = false) => {
    try {
      if (!forceReload && txCache.current) {
        if (mounted.current) setTransactions(txCache.current);
        return;
      }

      const res = await axios.get(`${apiUrl}/acc`, { timeout: 15000 });
      const rows = res.data?.data ?? [];
      txCache.current = rows;
      if (mounted.current) setTransactions(rows);
    } catch (e) {
      console.warn("loadTransactions:", e?.message ?? e);
      if (mounted.current) {
        Alert.alert("Error", "Gagal memuat transaksi");
      }
    }
  }, []);

  const loadTotals = useCallback(async (typeKey = "all") => {
    try {
      const url =
        typeKey === "all"
          ? `${apiUrl}/acc/totals`
          : `${apiUrl}/acc/totals/${encodeURIComponent(typeKey)}`;
      const res = await axios.get(url, { timeout: 10000 });
      if (mounted.current)
        setTotals(
          res.data?.data ?? { total_masuk: 0, total_keluar: 0, balance: 0 }
        );
    } catch (e) {
      console.warn("loadTotals:", e?.message ?? e);
      if (mounted.current)
        setTotals({ total_masuk: 0, total_keluar: 0, balance: 0 });
    }
  }, []);

  useEffect(() => {
    mounted.current = true;

    (async () => {
      await loadTypes();
      await loadTotals("all");
      loadTransactions();
      if (mounted.current) setLoading(false);
    })();

    return () => {
      mounted.current = false;
    };
  }, [loadTypes, loadTotals, loadTransactions]);

  useEffect(() => {
    loadTotals(selectedType);
  }, [selectedType, loadTotals]);

  useEffect(() => {
    if (!transactions || transactions.length === 0) {
      setSortedTransactions([]);
      return;
    }

    const sorted = [...transactions].sort(
      (a, b) =>
        new Date(b.created_at ?? b.tanggal ?? 0) -
        new Date(a.created_at ?? a.tanggal ?? 0)
    );
    setSortedTransactions(sorted);
  }, [transactions]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      txCache.current = null;
      await Promise.all([
        loadTypes(),
        loadTransactions(true),
        loadTotals(selectedType),
      ]);
    } catch (e) {
      console.warn("onRefresh:", e?.message ?? e);
    } finally {
      if (mounted.current) setRefreshing(false);
    }
  }, [loadTypes, loadTransactions, loadTotals, selectedType]);

  const openEditModal = useCallback(
    (item) => {
      const masuk = item.uang_masuk ?? item.jumlah ?? 0;
      const keluar = item.uang_keluar ?? 0;
      const jenis = Number(masuk) > 0 ? "masuk" : "keluar";
      setEditId(item.id ?? item._id ?? null);
      setEditJenis(jenis);
      setEditJumlah(String(masuk || keluar || ""));
      setEditKeterangan(item.keterangan ?? "");
      const rawProyek =
        item.tipe_keuangan ?? item.tipe ?? item.proyek ?? types[0]?.id ?? "";
      setEditProyek(rawProyek == null ? "" : String(rawProyek));
      setEditModalVisible(true);
      setTimeout(() => {
        Animated.spring(editScale, {
          toValue: 1,
          useNativeDriver: false,
          friction: 8,
          tension: 80,
        }).start();
        editInputRef.current?.focus?.();
      }, 80);
    },
    [types, editScale]
  );

  const closeEditModal = useCallback(() => {
    Animated.timing(editScale, {
      toValue: 0.95,
      duration: 120,
      useNativeDriver: false,
    }).start();
    setEditModalVisible(false);
  }, [editScale]);

  const updateTransaction = useCallback(async () => {
    if (!editId) return Alert.alert("Error", "ID transaksi tidak ditemukan.");
    if (!editJumlah || editJumlah.trim() === "")
      return Alert.alert("Validasi", "Masukkan jumlah.");
    if (!editProyek) return Alert.alert("Validasi", "Pilih proyek/tipe.");

    setEditSubmitting(true);
    try {
      const cleaned = String(editJumlah)
        .replace(/[^0-9.,-]+/g, "")
        .replace(/,/g, ".");
      const payload = {
        uang_masuk: editJenis === "masuk" ? cleaned : null,
        uang_keluar: editJenis === "keluar" ? cleaned : null,
        tanggal_uang_masuk:
          editJenis === "masuk" ? new Date().toISOString() : null,
        tanggal_uang_keluar:
          editJenis === "keluar" ? new Date().toISOString() : null,
        tipe_keuangan: editProyek,
        keterangan: editKeterangan || null,
      };

      await axios.put(`${apiUrl}/acc/${encodeURIComponent(editId)}`, payload, {
        headers: { "Content-Type": "application/json" },
        timeout: 10000,
      });

      await loadTransactions(true);
      await loadTotals(selectedType);

      closeEditModal();
      Alert.alert("Sukses", "Transaksi berhasil diupdate.");
    } catch (err) {
      console.warn("update /acc failed:", err?.message ?? err);
      Alert.alert("Gagal", "Terjadi kesalahan saat memperbarui transaksi.");
    } finally {
      if (mounted.current) setEditSubmitting(false);
    }
  }, [
    editId,
    editJenis,
    editJumlah,
    editKeterangan,
    editProyek,
    loadTransactions,
    loadTotals,
    selectedType,
    closeEditModal,
  ]);

  const exportData = useCallback(async () => {
    if (exporting) return;
    setExporting(true);
    try {
      const rows =
        filteredTransactions && filteredTransactions.length > 0
          ? filteredTransactions
          : transactions;
      if (!rows || rows.length === 0) {
        Alert.alert("Export", "Tidak ada data untuk diekspor.");
        return;
      }

      const fmt = (v) => {
        if (!v) return "";
        const d = new Date(v);
        if (isNaN(d.getTime())) return String(v);
        const pad = (n) => String(n).padStart(2, "0");
        return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(
          d.getDate()
        )}`;
      };

      const dataForSheet = rows.map((r) => {
        const tanggalRaw =
          r.tanggal_uang_masuk ?? r.tanggal_uang_keluar ?? r.created_at ?? "";
        return {
          Proyek: r.tipe_label ?? r.tipe ?? "",
          "Uang Masuk": r.uang_masuk ?? "",
          "Uang Keluar": r.uang_keluar ?? "",
          Tanggal: fmt(tanggalRaw),
          Keterangan: r.keterangan ?? "",
          Tipe: r.tipe_keuangan ?? "",
          CreatedAt: fmt(r.created_at ?? ""),
          ID: r.id ?? r._id ?? "",
        };
      });

      let XLSX;
      try {
        XLSX = require("xlsx");
      } catch (err) {
        Alert.alert(
          "Export XLSX",
          "Library 'xlsx' belum terpasang. Instal: npm install xlsx"
        );
        return;
      }

      const wb = XLSX.utils.book_new();
      const headers = [
        "Proyek",
        "Uang Masuk",
        "Uang Keluar",
        "Tanggal",
        "Keterangan",
      ];

      const aoa = [
        headers,
        ...dataForSheet.map((r) =>
          headers.map((h) => {
            if (h === "Uang Masuk" || h === "Uang Keluar") {
              const val = r[h] ?? "";
              return val !== "" ? String(val) : "";
            }
            return r[h] ?? "";
          })
        ),
      ];

      const ws = XLSX.utils.aoa_to_sheet(aoa);
      XLSX.utils.book_append_sheet(wb, ws, "Sheet1");

      const wbout = XLSX.write(wb, { type: "base64", bookType: "xlsx" });

      const name = `ACC_export_${selectedType}_${Date.now()}.xlsx`;
      const path = FileSystem.documentDirectory + name;

      try {
        await FileSystem.writeAsStringAsync(path, wbout, {
          encoding: FileSystem.EncodingType.Base64,
        });
      } catch (err) {
        console.warn("writeAsStringAsync base64 failed:", err?.message ?? err);
        await FileSystem.writeAsStringAsync(path, wbout);
      }

      let shared = false;
      try {
        const ExpoSharing = require("expo-sharing");
        if (ExpoSharing && ExpoSharing.isAvailableAsync) {
          const avail = await ExpoSharing.isAvailableAsync();
          if (avail) {
            await ExpoSharing.shareAsync(path, {
              mimeType:
                "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
              dialogTitle: "Export XLSX",
            });
            shared = true;
          }
        }
      } catch (e) {
        console.warn("expo-sharing not available:", e?.message ?? e);
      }

      if (!shared) {
        try {
          const sharePath = path.startsWith("file://")
            ? path
            : `file://${path}`;
          await Share.share({
            url: sharePath,
            title: "Export XLSX",
            message: "Exported XLSX file",
          });
          shared = true;
        } catch (e) {
          console.warn("Share fallback failed:", e?.message ?? e);
        }
      }

      if (!shared) {
        Alert.alert(
          "Export XLSX",
          `File disimpan: ${path}\n\nUntuk membagikan, pasang 'expo-sharing' atau buka file di file manager.`
        );
      }
    } catch (e) {
      console.warn("exportData xlsx failed:", e);
      Alert.alert("Export", "Gagal mengekspor data ke XLSX.");
    } finally {
      setExporting(false);
    }
  }, [filteredTransactions, transactions, selectedType, exporting]);

  const deleteTransaction = useCallback(() => {
    if (!editId) return Alert.alert("Error", "ID transaksi tidak ditemukan.");

    Alert.alert("Konfirmasi", "Hapus transaksi ini?", [
      { text: "Batal", style: "cancel" },
      {
        text: "Hapus",
        style: "destructive",
        onPress: async () => {
          setEditSubmitting(true);
          try {
            await axios.delete(`${apiUrl}/acc/${encodeURIComponent(editId)}`, {
              timeout: 10000,
            });
            await loadTransactions(true);
            await loadTotals(selectedType);
            closeEditModal();
            Alert.alert("Sukses", "Transaksi berhasil dihapus.");
          } catch (err) {
            console.warn("delete /acc failed:", err?.message ?? err);
            Alert.alert("Gagal", "Terjadi kesalahan saat menghapus transaksi.");
          } finally {
            if (mounted.current) setEditSubmitting(false);
          }
        },
      },
    ]);
  }, [editId, loadTransactions, loadTotals, selectedType, closeEditModal]);

  const filteredTransactions = useMemo(() => {
    if (!sortedTransactions || sortedTransactions.length === 0) return [];

    if (selectedType === "all") return sortedTransactions;

    return sortedTransactions.filter((it) => {
      const tId = it.tipe_keuangan ?? it.tipe ?? it.proyek ?? "";
      return String(tId) === String(selectedType);
    });
  }, [sortedTransactions, selectedType]);

  const selectedTypeLabel = useMemo(() => {
    return selectedType === "all"
      ? "Semua"
      : types.find((t) => String(t.id) === String(selectedType))?.tipe ??
          selectedType;
  }, [selectedType, types]);

  const renderTx = useCallback(
    ({ item }) => {
      const masuk = Number(item.uang_masuk ?? 0);
      const keluar = Number(item.uang_keluar ?? 0);
      const isIn = masuk > 0;
      const amount = isIn ? masuk : keluar;
      const color = isIn ? "#059669" : "#dc2626";
      const title =
        item.tipe_label ??
        types.find((tt) => String(tt.id) === String(item.tipe_keuangan))
          ?.tipe ??
        item.tipe ??
        item.proyek ??
        "Lainnya";
      const date = new Date(
        item.created_at ??
          item.tanggal_uang_masuk ??
          item.tanggal_uang_keluar ??
          item.tanggal ??
          Date.now()
      ).toLocaleString();

      return (
        <TouchableOpacity
          activeOpacity={0.9}
          style={[styles.txRow, isIn ? styles.txIn : styles.txOut]}
          onPress={() => openEditModal(item)}
        >
          <View style={styles.txLeft}>
            <Text style={styles.txTitle} numberOfLines={1}>
              {title}
            </Text>
            <Text style={styles.txNote} numberOfLines={1}>
              {item.keterangan ?? "—"}
            </Text>
          </View>

          <View style={styles.txRight}>
            <Text style={[styles.txAmount, { color }]}>
              {(isIn ? "+" : "-") + " Rp " + formatCurrency(amount)}
            </Text>
            <Text style={styles.txDate}>{date}</Text>
          </View>
        </TouchableOpacity>
      );
    },
    [types, formatCurrency, openEditModal]
  );

  const keyExtractor = useCallback(
    (it) => String(it.id ?? it._id ?? Math.random()),
    []
  );

  if (loading) {
    return (
      <View style={[styles.container, styles.center]}>
        <ActivityIndicator size="large" color="#1e75ff" />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.headerRow}>
        <Pressable
          style={styles.iconButton}
          onPress={() => navigation.navigate("Dashboard")}
          android_ripple={{ color: "#e6eff", radius: 30 }}
        >
          <Ionicons name="chevron-back" size={22} color="#1a1a2e" />
        </Pressable>

        <View style={styles.titleWrapper}>
          <Text style={styles.title}>History</Text>
        </View>
        <Pressable style={styles.refreshBtn} onPress={onRefresh}>
          <Ionicons name="refresh" size={18} color="#1e75ff" />
        </Pressable>
      </View>

      <View style={styles.controlsRow}>
        <View style={{ flex: 1, flexDirection: "row", alignItems: "center" }}>
          <View style={styles.pickerWrapper}>
            <Picker
              selectedValue={selectedType}
              onValueChange={(v) => setSelectedType(v)}
              style={styles.picker}
              mode={Platform.OS === "android" ? "dialog" : "dropdown"}
            >
              <Picker.Item label="All (totals)" value="all" />
              {types.map((t) => (
                <Picker.Item
                  key={String(t.id)}
                  label={t.tipe}
                  value={String(t.id)}
                />
              ))}
            </Picker>
          </View>
          <Pressable
            style={[styles.exportBtn, exporting && { opacity: 0.8 }]}
            onPress={exportData}
            android_ripple={{ color: "#e6e9ff", radius: 20 }}
            disabled={exporting}
          >
            {exporting ? (
              <ActivityIndicator size="small" color="#fff" />
            ) : (
              <Ionicons name="download-outline" size={22} color="#fff" />
            )}
          </Pressable>
        </View>
      </View>

      <View style={styles.balanceRow}>
        <View style={styles.balanceCard}>
          <View style={styles.balanceTop}>
            <Text style={styles.balanceLabel}>Saldo Saat Ini</Text>
            <Text style={styles.balanceAmount}>
              Rp {formatCurrency(totals.balance)}
            </Text>
          </View>

          <View style={styles.balanceBottom}>
            <View style={styles.subItem}>
              <Text style={styles.subLabel}>Total Masuk</Text>
              <Text style={[styles.subValue, { color: "#059669" }]}>
                Rp {formatCurrency(totals.total_masuk)}
              </Text>
            </View>
            <View style={styles.subItem}>
              <Text style={styles.subLabel}>Total Keluar</Text>
              <Text style={[styles.subValue, { color: "#dc2626" }]}>
                Rp {formatCurrency(totals.total_keluar)}
              </Text>
            </View>
          </View>
        </View>
      </View>

      <Text style={styles.sectionTitle}>Riwayat ({selectedTypeLabel})</Text>

      <FlatList
        data={filteredTransactions}
        keyExtractor={keyExtractor}
        renderItem={renderTx}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
        contentContainerStyle={{ paddingBottom: 48 }}
        initialNumToRender={10}
        maxToRenderPerBatch={10}
        windowSize={10}
        removeClippedSubviews={true}
      />

      {/* Edit Modal */}
      <Modal
        visible={editModalVisible}
        animationType="fade"
        transparent={true}
        statusBarTranslucent
        onRequestClose={() => !editSubmitting && closeEditModal()}
      >
        <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
          <View style={styles.modalOverlay}>
            <KeyboardAvoidingView
              behavior={Platform.OS === "ios" ? "padding" : "height"}
              style={{ width: "100%", alignItems: "center" }}
              keyboardVerticalOffset={Platform.OS === "ios" ? 80 : 0}
            >
              <Animated.View
                style={[
                  styles.modalContent,
                  { transform: [{ scale: editScale }] },
                ]}
              >
                <Text style={styles.modalTitle}>Edit Transaksi</Text>

                <View style={styles.segment}>
                  <TouchableOpacity
                    style={[
                      styles.segmentBtn,
                      editJenis === "masuk" && styles.segmentActiveMasuk,
                    ]}
                    onPress={() => setEditJenis("masuk")}
                    disabled={editSubmitting}
                  >
                    <Text
                      style={[
                        styles.segmentText,
                        editJenis === "masuk" && styles.segmentTextActive,
                      ]}
                    >
                      Uang Masuk
                    </Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={[
                      styles.segmentBtn,
                      editJenis === "keluar" && styles.segmentActiveKeluar,
                    ]}
                    onPress={() => setEditJenis("keluar")}
                    disabled={editSubmitting}
                  >
                    <Text
                      style={[
                        styles.segmentText,
                        editJenis === "keluar" && styles.segmentTextActive,
                      ]}
                    >
                      Uang Keluar
                    </Text>
                  </TouchableOpacity>
                </View>

                <Text style={styles.label}>Pilih Proyek</Text>

                <View style={styles.pickerOuter}>
                  <View style={styles.modalPickerInner}>
                    <Picker
                      selectedValue={editProyek}
                      onValueChange={(v) => setEditProyek(v)}
                      style={styles.pickerM}
                      mode={Platform.OS === "android" ? "dialog" : "dropdown"}
                      prompt="Pilih proyek..."
                    >
                      <Picker.Item label="Pilih proyek..." value={""} />
                      {types.map((t) => (
                        <Picker.Item
                          key={String(t.id)}
                          label={t.tipe}
                          value={String(t.id)}
                        />
                      ))}
                    </Picker>
                  </View>
                </View>

                <Text style={styles.label}>
                  {editJenis === "masuk"
                    ? "Jumlah (Uang Masuk)"
                    : "Jumlah (Uang Keluar)"}
                </Text>
                <TextInput
                  ref={editInputRef}
                  style={styles.input}
                  keyboardType="numeric"
                  value={editJumlah}
                  onChangeText={setEditJumlah}
                  editable={!editSubmitting}
                  returnKeyType="done"
                />

                <Text style={styles.label}>Keterangan (opsional)</Text>
                <TextInput
                  style={[styles.input, { height: 80 }]}
                  value={editKeterangan}
                  onChangeText={setEditKeterangan}
                  editable={!editSubmitting}
                  multiline
                />

                <View style={styles.modalActions}>
                  <TouchableOpacity
                    style={[styles.modalBtn, styles.modalDelete]}
                    onPress={deleteTransaction}
                    disabled={editSubmitting}
                  >
                    {editSubmitting ? (
                      <ActivityIndicator size="small" color="#fff" />
                    ) : (
                      <Text style={styles.modalDeleteText}>Hapus</Text>
                    )}
                  </TouchableOpacity>

                  <View style={{ flexDirection: "row" }}>
                    <TouchableOpacity
                      style={[styles.modalBtn, styles.modalCancel]}
                      onPress={() => !editSubmitting && closeEditModal()}
                      disabled={editSubmitting}
                    >
                      <Text style={styles.modalCancelText}>Batal</Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                      style={[styles.modalBtn, styles.modalSave]}
                      onPress={updateTransaction}
                      disabled={editSubmitting}
                    >
                      {editSubmitting ? (
                        <ActivityIndicator size="small" color="#fff" />
                      ) : (
                        <Text style={styles.modalSaveText}>Simpan</Text>
                      )}
                    </TouchableOpacity>
                  </View>
                </View>
              </Animated.View>
            </KeyboardAvoidingView>
          </View>
        </TouchableWithoutFeedback>
      </Modal>

      <StatusBar style="dark" />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 20,
    paddingTop: 45,
    backgroundColor: "#f6f8fb",
  },
  center: { alignItems: "center", justifyContent: "center" },

  headerRow: { flexDirection: "row", alignItems: "center", marginBottom: 12 },
  iconButton: {
    width: 40,
    height: 40,
    borderRadius: 10,
    backgroundColor: "#fff",
    alignItems: "center",
    justifyContent: "center",
    elevation: 2,
  },
  titleWrapper: { flex: 1, alignItems: "center" },
  title: { fontSize: 18, fontWeight: "700", color: "#0f172a" },

  controlsRow: { flexDirection: "row", alignItems: "center", marginBottom: 12 },
  pickerWrapper: {
    flex: 1,
    borderRadius: 10,
    overflow: "visible",
    backgroundColor: "#fff",
    borderWidth: 1,
    borderColor: "#e6e9ef",
    minHeight: 48,
    justifyContent: "center",
    zIndex: 20,
    elevation: 20,
  },

  pickerOuter: {
    width: "100%",
    borderRadius: 10,
    overflow: "visible",
    minHeight: 48,
  },

  modalPickerInner: {
    backgroundColor: "#fff",
    borderWidth: 1,
    borderColor: "#e6e9ef",
    borderRadius: 10,
    paddingHorizontal: 10,
    minHeight: 48,
    justifyContent: "center",
  },

  picker: {
    width: "100%",
    height: Platform.OS === "android" ? 48 : 44,
    backgroundColor: "transparent",
    color: "#111",
  },
  pickerM: {
    width: "100%",
    height: Platform.OS === "android" ? 48 : 44,
    backgroundColor: "transparent",
    color: "#111",
    paddingLeft: 4,
    marginLeft: -6,
  },

  refreshBtn: {
    width: 40,
    height: 40,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#fff",
    marginLeft: 8,
    elevation: 1,
  },

  exportBtn: {
    width: 48,
    height: 48,
    borderRadius: 10,
    backgroundColor: "#1e75ff",
    alignItems: "center",
    justifyContent: "center",
    marginLeft: 8,
    elevation: 2,
  },

  balanceRow: { marginBottom: 12 },
  balanceCard: {
    width: "100%",
    backgroundColor: "#fff",
    borderRadius: 12,
    padding: 14,
    elevation: 2,
  },
  balanceTop: { alignItems: "center", marginBottom: 8 },
  balanceLabel: { color: "#6b7280", fontSize: 13 },
  balanceAmount: {
    fontSize: 22,
    fontWeight: "900",
    marginTop: 6,
    color: "#0f172a",
  },
  balanceBottom: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: 6,
  },
  subItem: { alignItems: "center", flex: 1 },
  subLabel: { fontSize: 12, color: "#6b7280" },
  subValue: { fontSize: 14, fontWeight: "800", marginTop: 4 },

  sectionTitle: { fontSize: 16, fontWeight: "700", marginBottom: 8 },

  txRow: {
    flexDirection: "row",
    padding: 12,
    backgroundColor: "#fff",
    borderRadius: 12,
    marginBottom: 10,
    alignItems: "center",
    elevation: 1,
  },
  txLeft: { flex: 1 },
  txTitle: { fontWeight: "700", fontSize: 14, color: "#0f172a" },
  txNote: { color: "#6b7280", marginTop: 4, fontSize: 13 },
  txRight: { alignItems: "flex-end", marginLeft: 12 },
  txAmount: { fontWeight: "800", fontSize: 14 },
  txDate: { fontSize: 11, color: "#6b7280", marginTop: 6 },

  txIn: { borderLeftWidth: 4, borderLeftColor: "#059669" },
  txOut: { borderLeftWidth: 4, borderLeftColor: "#dc2626" },

  modalOverlay: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: "rgba(0,0,0,0.6)",
    justifyContent: "center",
    alignItems: "center",
    padding: 20,
  },

  modalContent: {
    width: "100%",
    maxWidth: 900,
    backgroundColor: "#fff",
    borderRadius: 12,
    padding: 16,
    elevation: 8,
  },

  modalTitle: { fontSize: 18, fontWeight: "700", marginBottom: 12 },
  segment: {
    flexDirection: "row",
    backgroundColor: "#e6e9ff",
    padding: 5,
    borderRadius: 14,
    marginVertical: 8,
  },
  segmentBtn: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 10,
    alignItems: "center",
  },
  segmentActiveMasuk: { backgroundColor: "#10B981" },
  segmentActiveKeluar: { backgroundColor: "#EF4444" },
  segmentText: { fontSize: 15, fontWeight: "600", color: "#6b6b7c" },
  segmentTextActive: { color: "#fff" },

  label: { fontSize: 15, fontWeight: "600", marginBottom: 6, marginTop: 8 },
  input: {
    borderWidth: 1,
    borderColor: "#e6e9ef",
    padding: 12,
    borderRadius: 10,
    marginBottom: 12,
    backgroundColor: "#fff",
  },

  modalActions: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: 12,
  },
  modalBtn: {
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: 10,
    marginLeft: 8,
  },
  modalDelete: {
    backgroundColor: "#ef4444",
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: 10,
  },
  modalDeleteText: { color: "#fff", fontWeight: "700" },
  modalCancel: { backgroundColor: "#e6e9ff" },
  modalSave: { backgroundColor: "#1e75ff" },
  modalCancelText: { color: "#1a1a2e", fontWeight: "700" },
  modalSaveText: { color: "#fff", fontWeight: "700" },
});
