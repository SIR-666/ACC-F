import { StatusBar } from "expo-status-bar";
import React, { useState, useEffect, useRef } from "react";
import {
  StyleSheet,
  Text,
  View,
  TextInput,
  TouchableOpacity,
  FlatList,
  Pressable,
  ActivityIndicator,
  Alert,
  Modal,
  Animated,
  KeyboardAvoidingView,
  Platform,
  TouchableWithoutFeedback,
  Keyboard,
} from "react-native";
import { Picker } from "@react-native-picker/picker";
import { Ionicons } from "@expo/vector-icons";
import axios from "axios";
import Constants from "expo-constants";

export default function Home({ navigation }) {
  const [data, setData] = useState([]);

  const [typeOptions, setTypeOptions] = useState([]);
  const [typesLoading, setTypesLoading] = useState(true);
  const [historyLoading, setHistoryLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const apiUrl = Constants.expoConfig?.extra?.API_URL;
  const mounted = useRef(true);
  const [modalVisible, setModalVisible] = useState(false);
  const [modalJenis, setModalJenis] = useState("masuk");
  const [modalJumlah, setModalJumlah] = useState("");
  const [modalKeterangan, setModalKeterangan] = useState("");
  const [modalProyek, setModalProyek] = useState(null);
  const scaleAnim = useRef(new Animated.Value(0.95)).current;
  const inputRef = useRef(null);


  useEffect(() => {
    mounted.current = true;

    const init = async () => {
      await Promise.all([fetchTypes(), fetchTransactions()]);
    };

    init();

    return () => {
      mounted.current = false;
    };
  }, []);

  const fetchTypes = async () => {
    setTypesLoading(true);
    try {
      const res = await axios.get(`${apiUrl}/types`, { timeout: 10000 });
      const list = res.data?.data ?? [];
      if (mounted.current) {
        setTypeOptions(list);
        if (!modalProyek && list.length > 0) setModalProyek(String(list[0].id));
      }
    } catch (err) {
      console.warn("fetch types failed:", err?.message ?? err);
      if (!modalProyek) setModalProyek(null);
    } finally {
      if (mounted.current) setTypesLoading(false);
    }
  };

  const fetchTransactions = async () => {
    setHistoryLoading(true);
    try {
      const res = await axios.get(`${apiUrl}/acc`, { timeout: 10000 });
      const list = res.data?.data ?? [];
      if (mounted.current) setData(list);
    } catch (err) {
      console.warn("fetch acc failed:", err?.message ?? err);
    } finally {
      if (mounted.current) setHistoryLoading(false);
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await fetchTransactions();
    setRefreshing(false);
  };

  useEffect(() => {
    if (modalVisible) {
      Animated.spring(scaleAnim, {
        toValue: 1,
        useNativeDriver: false,
        friction: 8,
        tension: 80,
      }).start();
      const t = setTimeout(() => inputRef.current?.focus?.(), 250);
      return () => clearTimeout(t);
    } else {
      Animated.timing(scaleAnim, {
        toValue: 0.95,
        duration: 120,
        useNativeDriver: false,
      }).start();
    }
  }, [modalVisible, scaleAnim]);

  const tambahData = async ({
    jenis: j,
    jumlah: jumlahVal,
    proyek: p,
    keterangan: k,
  }) => {
    if (!jumlahVal) return Alert.alert("Validasi", "Masukkan jumlah.");
    if (!p) return Alert.alert("Validasi", "Pilih tipe/proyek.");

    const nilai =
      parseFloat(jumlahVal.toString().replace(/[^0-9.-]+/g, "")) || 0;
    const now = new Date().toISOString();

    const payload = {
      uang_masuk: j === "masuk" ? nilai : null,
      uang_keluar: j === "keluar" ? nilai : null,
      tanggal_uang_masuk: j === "masuk" ? now : null,
      tanggal_uang_keluar: j === "keluar" ? now : null,
      tipe_keuangan: p,
      keterangan: k || null,
    };

    setSubmitting(true);
    try {
      await axios.post(`${apiUrl}/acc`, payload, {
        headers: { "Content-Type": "application/json" },
        timeout: 10000,
      });

      await fetchTransactions();

      setModalVisible(false);
      setModalJumlah("");
      setModalKeterangan("");
      Alert.alert("Sukses", "Data berhasil disimpan.");
    } catch (err) {
      console.warn("POST /acc failed:", err?.message ?? err);
      Alert.alert("Gagal", "Saldo lebih kecil dari jumlah yang dikeluarkan.");
    } finally {
      if (mounted.current) setSubmitting(false);
    }
  };

  const formatDate = (item) => {
    const t =
      item.created_at ??
      item.tanggal_uang_masuk ??
      item.tanggal_uang_keluar ??
      item.tanggal ??
      null;
    if (!t) return "";
    try {
      const d = new Date(t);
      return d.toLocaleString();
    } catch {
      return String(t);
    }
  };

  const formatCurrency = (v) => {
    try {
      return Number(v).toLocaleString();
    } catch {
      return String(v);
    }
  };

  const renderItem = ({ item }) => {
    const masukValue = Number(item.uang_masuk ?? 0);
    const keluarValue = Number(item.uang_keluar ?? 0);
    const jumlahValue = Number(item.jumlah ?? 0);

    const isIn = masukValue > 0 || item.jenis === "masuk";
    const amount = isIn
      ? masukValue
      : keluarValue > 0
      ? keluarValue
      : jumlahValue;
    const color = isIn ? "#10B981" : "#EF4444";

    const typeKey = item.tipe_keuangan ?? item.tipe ?? item.proyek;
    const typeObj = typeOptions.find(
      (t) =>
        String(t.id) === String(typeKey) || String(t.tipe) === String(typeKey)
    );
    const typeLabel = typeObj ? typeObj.tipe : typeKey ?? "—";

    return (
      <View style={[styles.historyCard]}>
        <View style={styles.historyBody}>
          <View style={styles.historyTop}>
            <Text numberOfLines={1} style={styles.historyTitle}>
              {typeLabel}
            </Text>

            <Text style={[styles.historyAmount, { color }]}>
              {`${isIn ? "+" : "-"} Rp ${formatCurrency(amount)}`}
            </Text>
          </View>

          {item.keterangan ? (
            <Text style={styles.historyNote} numberOfLines={2}>
              {item.keterangan}
            </Text>
          ) : (
            <Text style={styles.historyNoteMuted}>—</Text>
          )}

          <View style={styles.historyFooter}>
            <Text style={styles.historyDate}>{formatDate(item)}</Text>
            <View
              style={[
                styles.badge,
                { backgroundColor: isIn ? "#10B981" : "#EF4444" },
              ]}
            >
              <Text style={styles.badgeText}>
                {isIn ? "Uang Masuk" : "Uang Keluar"}
              </Text>
            </View>
          </View>
        </View>
      </View>
    );
  };

  return (
    <View style={styles.container}>
      <View style={styles.headerRow}>
        <Pressable
          style={styles.iconButton}
          onPress={() => navigation.goBack()}
          android_ripple={{ color: "#e6e9ff", radius: 30 }}
        >
          <Ionicons name="chevron-back" size={22} color="#1a1a2e" />
        </Pressable>

        <View style={styles.titleWrapper}>
          <Text style={styles.title}>Catatan Keuangan</Text>
        </View>

        <Pressable
          style={[styles.iconButton, styles.addButton]}
          onPress={() => {
            setModalJenis("masuk");
            setModalJumlah("");
            setModalKeterangan("");
            if (typeOptions.length > 0)
              setModalProyek(String(typeOptions[0].id));
            setModalVisible(true);
          }}
        >
          <Ionicons name="add" size={22} color="#fff" />
        </Pressable>
      </View>

      <Text style={styles.subTitle}>Riwayat</Text>

      {historyLoading ? (
        <View style={{ width: "100%", padding: 24, alignItems: "center" }}>
          <ActivityIndicator size="large" color="#1e75ff" />
          <Text style={{ marginTop: 10 }}>Memuat riwayat...</Text>
        </View>
      ) : data.length === 0 ? (
        <View style={styles.empty}>
          <Ionicons name="time" size={40} color="#c7c7d6" />
          <Text style={styles.emptyText}>Belum ada data riwayat</Text>
          <Text style={styles.emptySub}>
            Tekan tombol + untuk menambah catatan
          </Text>
        </View>
      ) : (
        <FlatList
          data={data}
          renderItem={renderItem}
          keyExtractor={(item) => String(item.id ?? Math.random())}
          showsVerticalScrollIndicator={false}
          refreshing={refreshing}
          onRefresh={onRefresh}
          contentContainerStyle={{ paddingBottom: 36 }}
        />
      )}

      {/* Modal Add */}
      <Modal
        visible={modalVisible}
        animationType="fade"
        transparent
        statusBarTranslucent
        onRequestClose={() => !submitting && setModalVisible(false)}
      >
        <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
          <View style={styles.modalOverlay}>
            <KeyboardAvoidingView
              behavior={Platform.OS === "ios" ? "padding" : "height"}
              style={{ width: "100%" }}
              keyboardVerticalOffset={Platform.OS === "ios" ? 80 : 0}
            >
              <Animated.View
                style={[
                  styles.modalContent,
                  { transform: [{ scale: scaleAnim }] },
                ]}
              >
                <Text style={styles.modalTitle}>Tambah Catatan</Text>

                <View style={styles.segment}>
                  <TouchableOpacity
                    style={[
                      styles.segmentBtn,
                      modalJenis === "masuk" && styles.segmentActiveMasuk,
                    ]}
                    onPress={() => setModalJenis("masuk")}
                  >
                    <Text
                      style={[
                        styles.segmentText,
                        modalJenis === "masuk" && styles.segmentTextActive,
                      ]}
                    >
                      Uang Masuk
                    </Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={[
                      styles.segmentBtn,
                      modalJenis === "keluar" && styles.segmentActiveKeluar,
                    ]}
                    onPress={() => setModalJenis("keluar")}
                  >
                    <Text
                      style={[
                        styles.segmentText,
                        modalJenis === "keluar" && styles.segmentTextActive,
                      ]}
                    >
                      Uang Keluar
                    </Text>
                  </TouchableOpacity>
                </View>

                <Text style={styles.label}>Pilih Proyek</Text>
                <View style={styles.pickerWrapper}>
                  {typesLoading ? (
                    <View style={{ padding: 12, alignItems: "center" }}>
                      <ActivityIndicator size="small" color="#1e75ff" />
                    </View>
                  ) : (
                    <Picker
                      selectedValue={modalProyek}
                      onValueChange={setModalProyek}
                      style={styles.picker}
                    >
                      {typeOptions.length > 0 ? (
                        typeOptions.map((t, idx) => (
                          <Picker.Item
                            key={t.id ?? `${t.tipe}-${idx}`}
                            label={t.tipe}
                            value={String(t.id)}
                          />
                        ))
                      ) : (
                        <>
                          <Picker.Item label="Gaji Karyawan" value="gaji" />
                          <Picker.Item label="Pembayaran Umrah" value="umrah" />
                          <Picker.Item
                            label="Pembayaran Perumahan"
                            value="perumahan"
                          />
                        </>
                      )}
                    </Picker>
                  )}
                </View>

                <TextInput
                  ref={inputRef}
                  style={styles.input}
                  placeholder={
                    modalJenis === "masuk"
                      ? "Jumlah (Uang Masuk)"
                      : "Jumlah (Uang Keluar)"
                  }
                  keyboardType="numeric"
                  value={modalJumlah}
                  onChangeText={setModalJumlah}
                  editable={!submitting}
                  returnKeyType="done"
                />

                <TextInput
                  style={styles.input}
                  placeholder="Keterangan (opsional)"
                  value={modalKeterangan}
                  onChangeText={setModalKeterangan}
                  editable={!submitting}
                />

                <View
                  style={{
                    flexDirection: "row",
                    justifyContent: "flex-end",
                    gap: 8,
                  }}
                >
                  <TouchableOpacity
                    style={[styles.modalBtn, { backgroundColor: "#e6e9ff" }]}
                    onPress={() => !submitting && setModalVisible(false)}
                    disabled={submitting}
                  >
                    <Text style={styles.modalBtnText}>Batal</Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={[styles.modalBtn, { backgroundColor: "#1e75ff" }]}
                    onPress={() =>
                      tambahData({
                        jenis: modalJenis,
                        jumlah: modalJumlah,
                        proyek: modalProyek,
                        keterangan: modalKeterangan,
                      })
                    }
                    disabled={submitting}
                  >
                    <Text style={[styles.modalBtnText, { color: "#fff" }]}>
                      {submitting ? "Menyimpan..." : "Simpan"}
                    </Text>
                  </TouchableOpacity>
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
    backgroundColor: "#f5f7ff",
    padding: 20,
    paddingTop: 45,
  },
  headerRow: { flexDirection: "row", alignItems: "center", marginBottom: 18 },
  iconButton: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: "#fff",
    alignItems: "center",
    justifyContent: "center",
    elevation: 2,
    shadowColor: "#000",
    shadowOpacity: 0.06,
    shadowRadius: 4,
  },
  addButton: { backgroundColor: "#1e75ff" },
  titleWrapper: { flex: 1, alignItems: "center", justifyContent: "center" },
  title: { fontSize: 20, fontWeight: "700", color: "#1a1a2e" },

  subTitle: { fontSize: 18, fontWeight: "700", marginBottom: 12 },

  historyCard: {
    flexDirection: "row",
    padding: 14,
    backgroundColor: "#fff",
    borderRadius: 12,
    marginBottom: 12,
    alignItems: "flex-start",
    elevation: 2,
    shadowColor: "#000",
    shadowOpacity: 0.06,
    shadowRadius: 6,
  },
  cardIn: {
    backgroundColor: "#ecfdf5",
    borderColor: "rgba(16,185,129,0.12)",
    borderWidth: 1,
  },
  cardOut: {
    backgroundColor: "#fff1f2",
    borderColor: "rgba(239,68,68,0.08)",
    borderWidth: 1,
  },
  indicator: {
    width: 44,
    height: 44,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
    marginRight: 12,
  },
  indicatorText: { color: "#fff", fontWeight: "700", fontSize: 20 },

  historyBody: { flex: 1 },
  historyTop: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 6,
  },
  historyTitle: {
    fontSize: 16,
    fontWeight: "700",
    color: "#0f172a",
    flex: 1,
    marginRight: 8,
  },
  historyAmount: { fontSize: 16, fontWeight: "800" },

  historyNote: { color: "#374151", marginBottom: 8 },
  historyNoteMuted: { color: "#9CA3AF", marginBottom: 8 },

  historyFooter: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  historyDate: { fontSize: 12, color: "#6B7280" },

  badge: { paddingVertical: 4, paddingHorizontal: 8, borderRadius: 8 },
  badgeText: { fontSize: 12, color: "#ffff", fontWeight: "700" },

  empty: {
    width: "100%",
    alignItems: "center",
    padding: 30,
    backgroundColor: "#fff",
    borderRadius: 12,
  },
  emptyText: {
    marginTop: 12,
    fontSize: 16,
    fontWeight: "700",
    color: "#374151",
  },
  emptySub: { marginTop: 6, color: "#6B7280" },

  /* modal & inputs (kept modern) */
  segment: {
    flexDirection: "row",
    backgroundColor: "#e6e9ff",
    padding: 5,
    borderRadius: 14,
    marginVertical: 12,
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

  label: { fontSize: 15, fontWeight: "600", marginBottom: 6 },
  pickerWrapper: {
    borderWidth: 1,
    borderColor: "#d7d7e8",
    borderRadius: 10,
    marginBottom: 12,
    overflow: "hidden",
  },
  picker: { width: "100%" },

  input: {
    borderWidth: 1,
    borderColor: "#e6e9ef",
    padding: 12,
    borderRadius: 10,
    marginBottom: 12,
    backgroundColor: "#fff",
  },

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
    maxWidth: 1300,
    backgroundColor: "#fff",
    borderRadius: 12,
    padding: 18,
    elevation: 8,
    shadowColor: "#000",
    shadowOpacity: 0.12,
    shadowRadius: 8,
  },
  modalTitle: { fontSize: 18, fontWeight: "700", marginBottom: 12 },
  modalBtn: {
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: 10,
    marginLeft: 8,
  },
  modalBtnText: { fontWeight: "700", color: "#1a1a2e" },
});
