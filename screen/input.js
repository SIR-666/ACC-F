import { StatusBar } from 'expo-status-bar';
import React, { useState } from "react";
import { StyleSheet, Text, View, TextInput, TouchableOpacity, FlatList } from 'react-native';

export default function App() {
  const [jenis, setJenis] = useState("masuk");
  const [jumlah, setJumlah] = useState("");
  const [keterangan, setKeterangan] = useState("");
  const [data, setData] = useState([]);

  const tambahData = () => {
    if (!jumlah) return;

    const newItem = {
      id: Date.now().toString(),
      jenis,
      jumlah: parseFloat(jumlah),
      keterangan,
      tanggal: new Date().toLocaleString()
    };

    setData([newItem, ...data]);
    setJumlah("");
    setKeterangan("");
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>📘 Catatan Keuangan</Text>

      {/* Pilihan Jenis */}
      <View style={styles.row}>
        <TouchableOpacity
          style={[styles.button, jenis === "masuk" && styles.activeMasuk]}
          onPress={() => setJenis("masuk")}
        >
          <Text style={styles.btnText}>Uang Masuk</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.button, jenis === "keluar" && styles.activeKeluar]}
          onPress={() => setJenis("keluar")}
        >
          <Text style={styles.btnText}>Uang Keluar</Text>
        </TouchableOpacity>
      </View>

      {/* Input Jumlah */}
      <TextInput
        style={styles.input}
        placeholder="Jumlah (Rp)"
        keyboardType="numeric"
        value={jumlah}
        onChangeText={setJumlah}
      />

      {/* Input Keterangan */}
      <TextInput
        style={styles.input}
        placeholder="Keterangan (opsional)"
        value={keterangan}
        onChangeText={setKeterangan}
      />

      {/* Tombol Simpan */}
      <TouchableOpacity style={styles.saveBtn} onPress={tambahData}>
        <Text style={styles.saveText}>Simpan</Text>
      </TouchableOpacity>

      <Text style={styles.subTitle}>Riwayat</Text>

      {/* List Data */}
      <FlatList
        style={{ width: "100%" }}
        data={data}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => (
          <View
            style={[
              styles.item,
              item.jenis === "masuk" ? styles.masuk : styles.keluar,
            ]}
          >
            <Text style={styles.itemText}>
              {item.jenis === "masuk" ? "➕" : "➖"} Rp {item.jumlah.toLocaleString()}
            </Text>
            <Text>{item.keterangan}</Text>
            <Text style={styles.date}>{item.tanggal}</Text>
          </View>
        )}
      />

      <StatusBar style="auto" />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
    padding: 20,
    paddingTop: 50,
  },
  title: {
    fontSize: 26,
    fontWeight: "bold",
    marginBottom: 20,
    textAlign: "center"
  },
  subTitle: {
    fontSize: 20,
    fontWeight: "bold",
    marginVertical: 15
  },
  row: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 20
  },
  button: {
    flex: 1,
    padding: 15,
    marginHorizontal: 5,
    backgroundColor: "#ddd",
    borderRadius: 10,
    alignItems: "center"
  },
  activeMasuk: {
    backgroundColor: "#4CAF50",
  },
  activeKeluar: {
    backgroundColor: "#F44336",
  },
  btnText: {
    fontSize: 16,
    fontWeight: "bold",
    color: "#fff"
  },
  input: {
    borderWidth: 1,
    borderColor: "#ccc",
    padding: 12,
    borderRadius: 10,
    marginBottom: 10
  },
  saveBtn: {
    backgroundColor: "#2196F3",
    padding: 15,
    borderRadius: 10,
    alignItems: "center",
    marginTop: 5
  },
  saveText: {
    color: "#fff",
    fontWeight: "bold",
    fontSize: 16
  },
  item: {
    padding: 15,
    borderRadius: 10,
    marginBottom: 10
  },
  masuk: {
    backgroundColor: "#E8F5E9"
  },
  keluar: {
    backgroundColor: "#FFEBEE"
  },
  itemText: {
    fontSize: 18,
    fontWeight: "bold"
  },
  date: {
    fontSize: 12,
    color: "#555",
    marginTop: 5
  }
});
