import React, { useEffect, useState, useRef } from "react";
import { StatusBar } from "expo-status-bar";
import {
  View,
  Text,
  ActivityIndicator,
  FlatList,
  StyleSheet,
  Pressable,
  Alert,
  Modal,
  TextInput,
  TouchableOpacity,
  Animated,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import axios from "axios";
import Constants from "expo-constants";

export default function Project({ navigation }) {
  const [types, setTypes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const apiUrl = Constants.expoConfig?.extra?.API_URL;
  const mounted = useRef(true);

  const [modalVisible, setModalVisible] = useState(false);
  const [newType, setNewType] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [editingItem, setEditingItem] = useState(null);

  const scaleAnim = useRef(new Animated.Value(0.95)).current;

  useEffect(() => {
    if (modalVisible) {
      Animated.spring(scaleAnim, {
        toValue: 1,
        useNativeDriver: false,
        friction: 8,
        tension: 80,
      }).start();
    } else {
      Animated.timing(scaleAnim, {
        toValue: 0.95,
        duration: 120,
        useNativeDriver: false,
      }).start();
    }
  }, [modalVisible, scaleAnim]);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  const fetchTypes = async () => {
    try {
      const res = await axios.get(`${apiUrl}/types`, { timeout: 10000 });
      console.log("Axios response:", res.data);
      if (mounted.current) setTypes(res.data.data ?? res.data);
    } catch (err) {
      console.error(
        "Axios error:",
        err.message,
        err.code,
        err.response?.status
      );
      if (mounted.current) setError("Gagal memuat data: " + err.message);
    } finally {
      if (mounted.current) setLoading(false);
    }
  };

  useEffect(() => {
    fetchTypes();
  }, []);

  const handleSaveType = async () => {
    const trimmed = String(newType || "").trim();
    if (!trimmed) {
      return Alert.alert("Validasi", "Masukkan nama tipe.");
    }

    setSubmitting(true);

    if (editingItem) {
      setTypes((prev) =>
        prev.map((p) => (p.id === editingItem.id ? { ...p, tipe: trimmed } : p))
      );

      try {
        await axios.put(
          `${apiUrl}/types/${editingItem.id}`,
          { tipe: trimmed },
          { headers: { "Content-Type": "application/json" }, timeout: 10000 }
        );
        Alert.alert("Sukses", "Tipe berhasil diperbarui.");
      } catch (err) {
        console.warn("Update failed (kept optimistic):", err?.message ?? err);
        Alert.alert(
          "Gagal",
          "Tidak dapat menyimpan perubahan ke server. Perubahan tetap di aplikasi."
        );
      } finally {
        setSubmitting(false);
        setModalVisible(false);
        setEditingItem(null);
        setNewType("");
      }
    } else {
      const tempId = `tmp-${Date.now()}`;
      const newItem = { id: tempId, tipe: trimmed };
      setTypes((prev) => [newItem, ...(prev || [])]);

      try {
        const res = await axios.post(
          `${apiUrl}/types`,
          { tipe: trimmed },
          { headers: { "Content-Type": "application/json" }, timeout: 10000 }
        );

        console.log("POST response:", res.data);
        let created = null;
        if (res.data) {
          if (Array.isArray(res.data.data)) {
            created = res.data.data[0];
          } else if (res.data.data && typeof res.data.data === "object") {
            created = res.data.data;
          } else if (typeof res.data === "object" && res.data.tipe) {
            created = res.data;
          }
        }
        if (created) {
          setTypes((prev) => prev.map((p) => (p.id === tempId ? created : p)));
        } else {
          await fetchTypes();
        }
        Alert.alert("Sukses", "Tipe berhasil ditambahkan.");
      } catch (err) {
        console.warn("POST failed (kept optimistic):", err?.message ?? err);
        Alert.alert(
          "Gagal",
          "Tidak dapat menyimpan ke server. Item tetap ditambahkan secara lokal."
        );
      } finally {
        setSubmitting(false);
        setModalVisible(false);
        setNewType("");
      }
    }
  };

  const handleDelete = (item) => {
    Alert.alert("Hapus tipe", "Yakin ingin menghapus tipe ini?", [
      { text: "Batal", style: "cancel" },
      {
        text: "Hapus",
        style: "destructive",
        onPress: () => {
          setTypes((prev) =>
            prev.filter((p) =>
              p.id != null
                ? p.id !== item.id
                : JSON.stringify(p) !== JSON.stringify(item)
            )
          );

          if (String(item.id ?? "").startsWith("tmp-")) {
            console.log("Deleted locally:", item);
            return;
          }

          (async () => {
            try {
              await axios.delete(`${apiUrl}/types/${item.id}`, {
                timeout: 10000,
              });
              console.log("Deleted on server:", item.id);
            } catch (err) {
              console.warn("Delete failed:", err?.message ?? err);
              Alert.alert(
                "Gagal",
                "Tidak dapat menghapus pada server. Menyinkronkan ulang."
              );
              await fetchTypes();
            }
          })();
        },
      },
    ]);
  };

  const handleEdit = (item) => {
    setEditingItem(item);
    setNewType(item.tipe ?? item.name ?? "");
    setModalVisible(true);
  };

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color="#1e75ff" />
        <Text style={{ marginTop: 10 }}>Memuat data...</Text>
      </View>
    );
  }

  if (error) {
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
            <Text style={styles.title}>Daftar Proyek</Text>
          </View>
          <View style={{ width: 40 }} />
        </View>

        <View style={styles.center}>
          <Text style={{ color: "red", marginBottom: 12 }}>{error}</Text>
          <TouchableOpacity
            style={styles.retryBtn}
            onPress={() => {
              setError(null);
              setLoading(true);
              fetchTypes();
            }}
          >
            <Text style={{ color: "#fff", fontWeight: "700" }}>Coba lagi</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }
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
          <Text style={styles.title}>Daftar Proyek</Text>
        </View>

        <Pressable
          style={[styles.iconButton, styles.addButton]}
          onPress={() => {
            setEditingItem(null);
            setNewType("");
            setModalVisible(true);
          }}
          android_ripple={{ color: "#e6e9ff", radius: 30 }}
        >
          <Ionicons name="add" size={22} color="#fff" />
        </Pressable>
      </View>

      <FlatList
        data={types}
        keyExtractor={(item, index) =>
          item.id ? String(item.id) : String(index)
        }
        showsHorizontalScrollIndicator={false}
        showsVerticalScrollIndicator={false}
        renderItem={({ item }) => (
          <View style={styles.card}>
            <View style={styles.cardRow}>
              <Text style={styles.text}>
                {item.tipe ?? item.name ?? JSON.stringify(item)}
              </Text>

              <View style={styles.actions}>
                <Pressable
                  style={[styles.actionButton, styles.editButton]}
                  onPress={() => handleEdit(item)}
                  android_ripple={{ color: "rgba(0,0,0,0.06)", radius: 18 }}
                >
                  <Ionicons name="pencil" size={18} color="#1e75ff" />
                </Pressable>

                <Pressable
                  style={[styles.actionButton, styles.deleteButton]}
                  onPress={() => handleDelete(item)}
                  android_ripple={{ color: "rgba(0,0,0,0.06)", radius: 18 }}
                >
                  <Ionicons name="trash" size={18} color="#fff" />
                </Pressable>
              </View>
            </View>
          </View>
        )}
      />

      <Modal
        visible={modalVisible}
        animationType="fade"
        transparent
        statusBarTranslucent
        onRequestClose={() => {
          if (!submitting) setModalVisible(false);
        }}
      >
        <View style={styles.modalOverlay}>
          <Animated.View
            style={[styles.modalContent, { transform: [{ scale: scaleAnim }] }]}
          >
            <Text style={styles.modalTitle}>
              {editingItem ? "Edit Tipe" : "Tambah Tipe"}
            </Text>

            <TextInput
              value={newType}
              onChangeText={setNewType}
              placeholder="Masukkan nama tipe"
              style={styles.input}
              editable={!submitting}
            />

            <View style={styles.modalButtons}>
              <TouchableOpacity
                style={[styles.modalBtn, { backgroundColor: "#e6e9ff" }]}
                onPress={() => {
                  if (!submitting) {
                    setModalVisible(false);
                    setNewType("");
                  }
                }}
                disabled={submitting}
              >
                <Text style={styles.modalBtnText}>Batal</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.modalBtn, { backgroundColor: "#1e75ff" }]}
                onPress={handleSaveType}
                disabled={submitting}
              >
                <Text style={[styles.modalBtnText, { color: "#fff" }]}>
                  {submitting ? "Menyimpan..." : "Simpan"}
                </Text>
              </TouchableOpacity>
            </View>
          </Animated.View>
        </View>
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
  center: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },

  /* header row */
  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 35,
  },
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
  addButton: {
    backgroundColor: "#1e75ff",
  },
  titleWrapper: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 8,
  },

  title: {
    fontSize: 20,
    fontWeight: "700",
    color: "#1a1a2e",
  },

  card: {
    padding: 12,
    backgroundColor: "#fff",
    marginBottom: 12,
    borderRadius: 12,
    elevation: 2,
    shadowColor: "#000",
    shadowOpacity: 0.06,
    shadowRadius: 4,
  },
  cardRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  text: {
    fontSize: 16,
    fontWeight: "600",
    color: "#333",
  },

  actions: {
    flexDirection: "row",
    gap: 8,
  },
  actionButton: {
    width: 36,
    height: 36,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
  },
  editButton: {
    backgroundColor: "#eef4ff",
  },
  deleteButton: {
    backgroundColor: "#ff5252",
    marginLeft: 8,
  },

  /* modal styles */
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
    width: "100%",
    height: "100%",
  },
  modalContent: {
    width: "100%",
    maxWidth: 520,
    backgroundColor: "#fff",
    borderRadius: 12,
    padding: 18,
    elevation: 8,
    shadowColor: "#000",
    shadowOpacity: 0.12,
    shadowRadius: 8,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: "700",
    marginBottom: 12,
  },
  input: {
    borderWidth: 1,
    borderColor: "#d7d7e8",
    padding: 12,
    borderRadius: 10,
    marginBottom: 12,
    backgroundColor: "#fafaff",
  },
  modalButtons: {
    flexDirection: "row",
    justifyContent: "flex-end",
    gap: 8,
  },
  modalBtn: {
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: 10,
  },
  modalBtnText: {
    fontWeight: "700",
    color: "#1a1a2e",
  },
  retryBtn: {
    backgroundColor: "#1e75ff",
    paddingVertical: 10,
    paddingHorizontal: 18,
    borderRadius: 10,
    elevation: 2,
  },
});
