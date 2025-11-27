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
// NOTE: exceljs/xlsx/base64-arraybuffer are required lazily inside exportData
// to ensure we can polyfill Buffer before loading exceljs in RN.

let DateTimePicker = null;
try {
  DateTimePicker = require("@react-native-community/datetimepicker");
  DateTimePicker = DateTimePicker.default || DateTimePicker;
} catch (err) {
  DateTimePicker = null;
}

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
  const [editDate, setEditDate] = useState(
    new Date().toISOString().slice(0, 10)
  );
  const [editDateObj, setEditDateObj] = useState(new Date());
  const [showEditDatePicker, setShowEditDatePicker] = useState(false);

  const editScale = useRef(new Animated.Value(0.95)).current;
  const editInputRef = useRef(null);

  const formatCurrency = useCallback((v) => {
    try {
      return Number(v).toLocaleString();
    } catch {
      return String(v);
    }
  }, []);

  const isDateOnly = (s) =>
    typeof s === "string" && /^\d{4}-\d{2}-\d{2}$/.test(s);

  const toLocalIsoDate = (raw) => {
    if (!raw) return null;
    if (isDateOnly(raw)) return raw;
    const dt = new Date(raw);
    if (isNaN(dt.getTime())) return null;
    const y = dt.getFullYear();
    const m = String(dt.getMonth() + 1).padStart(2, "0");
    const d = String(dt.getDate()).padStart(2, "0");
    return `${y}-${m}-${d}`;
  };

  const formatForDisplay = (raw) => {
    if (!raw) return "";
    if (isDateOnly(raw)) return raw;
    const dt = new Date(raw);
    if (isNaN(dt.getTime())) return String(raw);
    return dt.toLocaleString();
  };

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

      const dateRaw =
        item.tanggal_uang_masuk ??
        item.tanggal_uang_keluar ??
        item.created_at ??
        item.tanggal ??
        null;

      const parsedIso = toLocalIsoDate(dateRaw);
      if (parsedIso) {
        setEditDate(parsedIso);
        const [y, m, d] = parsedIso.split("-").map(Number);
        setEditDateObj(new Date(y, m - 1, d));
      } else {
        const today = new Date();
        setEditDate(today.toISOString().slice(0, 10));
        setEditDateObj(today);
      }

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

      let datePayload;
      if (isDateOnly(editDate)) {
        datePayload = editDate;
      } else {
        try {
          datePayload = new Date(editDate).toISOString();
        } catch {
          datePayload = new Date().toISOString();
        }
      }

      const payload = {
        uang_masuk: editJenis === "masuk" ? cleaned : null,
        uang_keluar: editJenis === "keluar" ? cleaned : null,
        tanggal_uang_masuk: editJenis === "masuk" ? datePayload : null,
        tanggal_uang_keluar: editJenis === "keluar" ? datePayload : null,
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
    editDate,
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

      const totalMasuk = Number(totals.total_masuk ?? 0);
      const totalKeluar = Number(totals.total_keluar ?? 0);
      const saldoSaatIni = Number(totals.balance ?? totalMasuk - totalKeluar);

      const fmt = (v) => {
        const iso = toLocalIsoDate(v);
        if (iso) return iso;
        if (!v) return "";
        const d = new Date(v);
        if (isNaN(d.getTime())) return String(v);
        const pad = (n) => String(n).padStart(2, "0");
        return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(
          d.getDate()
        )}`;
      };

      const dataRows = rows.map((r) => {
        const masukVal = Number(
          String(r.uang_masuk ?? "").replace(/[^0-9.-]+/g, "")
        );
        const keluarVal = Number(
          String(r.uang_keluar ?? "").replace(/[^0-9.-]+/g, "")
        );
        const hasMasuk = !isNaN(masukVal) && masukVal > 0;
        const hasKeluar = !isNaN(keluarVal) && keluarVal > 0;

        const tMasuk = hasMasuk ? fmt(r.tanggal_uang_masuk ?? "") : "";
        const uraianMasuk = hasMasuk
          ? r.keterangan ?? r.tipe_label ?? r.tipe ?? ""
          : "";
        const jumlahMasuk = hasMasuk ? masukVal : "";

        const tKeluar = hasKeluar ? fmt(r.tanggal_uang_keluar ?? "") : "";
        const uraianKeluar = hasKeluar
          ? r.keterangan ?? r.tipe_label ?? r.tipe ?? ""
          : "";
        const jumlahKeluar = hasKeluar ? keluarVal : "";

        return [
          tMasuk,
          uraianMasuk,
          jumlahMasuk,
          tKeluar,
          uraianKeluar,
          jumlahKeluar,
        ];
      });

      let base64Data = null;
      let exportBranch = null;

      // prefer exceljs for consistent styling in RN
      try {
        console.warn("exportData: attempting exceljs branch");
        // ensure Buffer polyfill for exceljs
        if (typeof global.Buffer === "undefined") {
          // buffer is a light dep, make sure installed (npm i buffer) if missing
          // this sets global Buffer for exceljs runtime
          // eslint-disable-next-line global-require
          const { Buffer } = require("buffer");
          global.Buffer = Buffer;
        }

        // require exceljs and base64-arraybuffer at runtime (bundle will include them)
        // eslint-disable-next-line global-require
        const ExcelJS = require("exceljs");
        // eslint-disable-next-line global-require
        const { encode } = require("base64-arraybuffer");
        exportBranch = "exceljs";

        const wb = new ExcelJS.Workbook();
        const ws = wb.addWorksheet("Laporan", {
          views: [{ state: "frozen", ySplit: 5 }],
        });

        // Title merged A1:F1 and centered
        ws.mergeCells("A1:F1");
        const titleCell = ws.getCell("A1");
        titleCell.value = "LAPORAN KEUANGAN MHT";
        titleCell.font = { size: 16, bold: true, color: { argb: "FF1E75FF" } };
        titleCell.alignment = { horizontal: "center", vertical: "middle" };
        titleCell.fill = {
          type: "pattern",
          pattern: "solid",
          fgColor: { argb: "FFFFFFFF" },
        };

        // empty row
        ws.addRow([]);

        // header row (gray)
        const header = [
          "Tanggal (Masuk)",
          "Uraian Pemasukan",
          "Jumlah",
          "Tanggal (Keluar)",
          "Uraian Pengeluaran",
          "Jumlah",
        ];
        const headerRow = ws.addRow(header);
        headerRow.height = 22;
        headerRow.eachCell((cell) => {
          cell.font = { bold: true, color: { argb: "FF000000" } };
          cell.fill = {
            type: "pattern",
            pattern: "solid",
            fgColor: { argb: "FFBDBDBD" },
          };
          cell.alignment = {
            vertical: "middle",
            horizontal: "center",
            wrapText: true,
          };
          cell.border = {
            top: { style: "thin" },
            left: { style: "thin" },
            bottom: { style: "thin" },
            right: { style: "thin" },
          };
        });

        // Row 4: saldo (merge)
        ws.mergeCells("A4:F4");
        const saldoCell = ws.getCell("A4");
        saldoCell.value = `Saldo Saat Ini: Rp ${formatCurrency(saldoSaatIni)}`;
        saldoCell.font = { bold: true, color: { argb: "FF000000" } };
        saldoCell.alignment = { horizontal: "left", vertical: "middle" };

        // totals row
        const totalsRow = ws.addRow(["", "", totalMasuk, "", "", totalKeluar]);
        totalsRow.getCell(3).numFmt = "#,##0";
        totalsRow.getCell(6).numFmt = "#,##0";
        totalsRow.eachCell((cell) => {
          cell.font = { bold: true };
        });

        // data rows
        dataRows.forEach((r, idx) => {
          const row = ws.addRow(r);
          if (row.getCell(3).value !== "") row.getCell(3).numFmt = "#,##0";
          if (row.getCell(6).value !== "") row.getCell(6).numFmt = "#,##0";
          if (idx % 2 === 0) {
            row.eachCell((cell) => {
              cell.fill = {
                type: "pattern",
                pattern: "solid",
                fgColor: { argb: "FFF7F9FF" },
              };
            });
          }
        });

        ws.columns = [
          { key: "tmasuk", width: 18 },
          { key: "um", width: 40 },
          { key: "jm", width: 14 },
          { key: "tkeluar", width: 18 },
          { key: "uk", width: 40 },
          { key: "jk", width: 14 },
        ];

        const buffer = await wb.xlsx.writeBuffer();
        base64Data = encode(buffer);
      } catch (errExcel) {
        console.warn(
          "exceljs export failed, falling back to xlsx:",
          errExcel?.message ?? errExcel
        );
        try {
          exportBranch = "xlsx";
          // fallback to sheetjs (xlsx)
          // eslint-disable-next-line global-require
          const XLSX = require("xlsx");

          const aoa = [];
          aoa.push(["LAPORAN KEUANGAN MHT"]);
          aoa.push([]);
          aoa.push([
            "Tanggal (Masuk)",
            "Uraian Pemasukan",
            "Jumlah",
            "Tanggal (Keluar)",
            "Uraian Pengeluaran",
            "Jumlah",
          ]);
          aoa.push([
            `Saldo Saat Ini: Rp ${formatCurrency(saldoSaatIni)}`,
            "",
            "",
            "",
            "",
            "",
          ]);
          aoa.push(["", "", totalMasuk, "", "", totalKeluar]);
          dataRows.forEach((r) => aoa.push(r));

          const wb = XLSX.utils.book_new();
          const ws = XLSX.utils.aoa_to_sheet(aoa);

          // merge A1:F1
          ws["!merges"] = ws["!merges"] || [];
          ws["!merges"].push({ s: { c: 0, r: 0 }, e: { c: 5, r: 0 } });

          // try to set alignment for A1
          if (!ws["A1"]) ws["A1"] = { t: "s", v: "LAPORAN KEUANGAN MHT" };
          ws["A1"].s = ws["A1"].s || {};
          ws["A1"].s.alignment = { horizontal: "center", vertical: "center" };

          // style header cells A3:F3 basic (may be ignored by some viewers)
          const headerRowIdx = 2; // zero-based (row 3)
          for (let c = 0; c < 6; c++) {
            const cellAddr = XLSX.utils.encode_cell({ r: headerRowIdx, c });
            ws[cellAddr] = ws[cellAddr] || { t: "s", v: "" };
            ws[cellAddr].s = {
              fill: { patternType: "solid", fgColor: { rgb: "BDBDBD" } },
              font: { bold: true, color: { rgb: "000000" } },
              alignment: {
                horizontal: "center",
                vertical: "center",
                wrapText: true,
              },
              border: {
                top: { style: "thin" },
                bottom: { style: "thin" },
                left: { style: "thin" },
                right: { style: "thin" },
              },
            };
          }

          ws["!cols"] = [
            { wch: 18 },
            { wch: 40 },
            { wch: 14 },
            { wch: 18 },
            { wch: 40 },
            { wch: 14 },
          ];

          XLSX.utils.book_append_sheet(wb, ws, "Laporan");
          base64Data = XLSX.write(wb, {
            type: "base64",
            bookType: "xlsx",
            cellStyles: true,
          });
        } catch (errX) {
          console.warn("xlsx fallback failed:", errX?.message ?? errX);
          Alert.alert(
            "Export XLSX",
            "Gagal membuat file XLSX. Periksa dependency (exceljs, buffer, base64-arraybuffer atau xlsx)."
          );
          return;
        }
      }

      const name = `LAPORAN_KEUANGAN_${selectedType}_${Date.now()}.xlsx`;
      const path = FileSystem.documentDirectory + name;
      try {
        await FileSystem.writeAsStringAsync(path, base64Data, {
          encoding: FileSystem.EncodingType.Base64,
        });
      } catch (err) {
        console.warn("writeAsStringAsync base64 failed:", err?.message ?? err);
        await FileSystem.writeAsStringAsync(path, base64Data);
      }

      let shared = false;
      try {
        // eslint-disable-next-line global-require
        const ExpoSharing = require("expo-sharing");
        if (ExpoSharing && ExpoSharing.isAvailableAsync) {
          const avail = await ExpoSharing.isAvailableAsync();
          if (avail) {
            await ExpoSharing.shareAsync(path, {
              mimeType:
                "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
              dialogTitle: "Export LAPORAN KEUANGAN",
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
            title: "Export LAPORAN KEUANGAN",
            message: "File laporan keuangan",
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
  }, [filteredTransactions, transactions, selectedType, exporting, totals]);

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

      const dateRaw =
        item.tanggal_uang_masuk ??
        item.tanggal_uang_keluar ??
        item.created_at ??
        item.tanggal ??
        null;
      const date = formatForDisplay(dateRaw) || new Date().toLocaleString();

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

                {/* Tanggal field (mirip Home) */}
                <Text style={styles.label}>Tanggal</Text>
                <View
                  style={{
                    flexDirection: "row",
                    alignItems: "center",
                    marginBottom: 12,
                  }}
                >
                  <TouchableOpacity
                    style={[
                      styles.input,
                      { flex: 1, justifyContent: "center" },
                    ]}
                    onPress={() => setShowEditDatePicker(true)}
                    disabled={editSubmitting}
                  >
                    <Text style={{ color: "#111" }}>
                      {editDate || "Pilih tanggal"}
                    </Text>
                  </TouchableOpacity>
                </View>

                {showEditDatePicker && DateTimePicker && (
                  <DateTimePicker
                    value={editDateObj || new Date()}
                    mode="date"
                    display={Platform.OS === "android" ? "calendar" : "spinner"}
                    onChange={(event, selected) => {
                      if (Platform.OS === "android")
                        setShowEditDatePicker(false);
                      if (!selected) return;
                      const y = selected.getFullYear();
                      const m = String(selected.getMonth() + 1).padStart(
                        2,
                        "0"
                      );
                      const d = String(selected.getDate()).padStart(2, "0");
                      setEditDateObj(selected);
                      setEditDate(`${y}-${m}-${d}`);
                    }}
                    maximumDate={new Date(2100, 11, 31)}
                    minimumDate={new Date(1970, 0, 1)}
                  />
                )}

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

  todayBtn: {
    marginLeft: 8,
    backgroundColor: "#1e75ff",
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 10,
    flexDirection: "row",
    alignItems: "center",
    elevation: 3,
    shadowColor: "#000",
    shadowOpacity: 0.12,
    shadowRadius: 6,
  },
  todayBtnText: {
    color: "#fff",
    fontWeight: "700",
    marginLeft: 8,
    fontSize: 13,
  },
});
