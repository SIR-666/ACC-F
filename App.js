import React, { useRef, useEffect } from "react";
import { StatusBar } from "expo-status-bar";
import {
  SafeAreaView,
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Animated,
  Image,
  Dimensions,
  Platform,
  BackHandler,
  Alert,
} from "react-native";
import { NavigationContainer } from "@react-navigation/native";
import { createNativeStackNavigator } from "@react-navigation/native-stack";

import Home from "./screen/Home";
import Project from "./screen/Project";
import History from "./screen/History";

const Stack = createNativeStackNavigator();
const { width: SCREEN_W } = Dimensions.get("window");

function CardButton({ title, desc, onPress, image }) {
  const resolveSource = (img) => {
    if (!img) return null;
    if (typeof img === "number") return img;
    if (typeof img === "object" && (img.uri || img.uri === "")) return img;
    if (typeof img === "string") return { uri: img };
    return null;
  };
  const src = resolveSource(image);

  return (
    <TouchableOpacity
      activeOpacity={0.92}
      onPress={onPress}
      style={styles.card}
    >
      <View style={styles.cardContent}>
        <View style={{ flex: 1 }}>
          <Text style={styles.cardTitle}>{title}</Text>
          <Text style={styles.cardDesc}>{desc}</Text>
        </View>

        <View style={styles.cardImageWrap}>
          {src ? (
            <Image
              source={src}
              style={styles.cardImage}
              resizeMode="contain"
              accessible={false}
            />
          ) : null}
        </View>
      </View>
    </TouchableOpacity>
  );
}

function Dashboard({ navigation }) {
  const blob1 = useRef(new Animated.Value(0)).current;
  const blob2 = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const a1 = Animated.loop(
      Animated.sequence([
        Animated.timing(blob1, {
          toValue: 1,
          duration: 4500,
          useNativeDriver: false,
        }),
        Animated.timing(blob1, {
          toValue: 0,
          duration: 4500,
          useNativeDriver: false,
        }),
      ])
    );

    const a2 = Animated.loop(
      Animated.sequence([
        Animated.timing(blob2, {
          toValue: 1,
          duration: 7000,
          useNativeDriver: false,
        }),
        Animated.timing(blob2, {
          toValue: 0,
          duration: 7000,
          useNativeDriver: false,
        }),
      ])
    );

    a1.start();
    a2.start();

    return () => {
      a1.stop();
      a2.stop();
    };
  }, [blob1, blob2]);

  useEffect(() => {
    const onBackPress = () => {
      Alert.alert("Keluar", "Yakin ingin keluar aplikasi?", [
        { text: "Batal", style: "cancel" },
        {
          text: "Keluar",
          style: "destructive",
          onPress: () => BackHandler.exitApp(),
        },
      ]);
      return true;
    };

    const sub = BackHandler.addEventListener("hardwareBackPress", onBackPress);
    return () => sub.remove();
  }, []);

  const blob1Translate = {
    transform: [
      {
        translateX: blob1.interpolate({
          inputRange: [0, 1],
          outputRange: [-50, 50],
        }),
      },
      {
        translateY: blob1.interpolate({
          inputRange: [0, 1],
          outputRange: [-12, 12],
        }),
      },
      {
        rotate: blob1.interpolate({
          inputRange: [0, 1],
          outputRange: ["0deg", "18deg"],
        }),
      },
    ],
  };

  const blob2Translate = {
    transform: [
      {
        translateX: blob2.interpolate({
          inputRange: [0, 1],
          outputRange: [40, -40],
        }),
      },
      {
        translateY: blob2.interpolate({
          inputRange: [0, 1],
          outputRange: [12, -12],
        }),
      },
      {
        rotate: blob2.interpolate({
          inputRange: [0, 1],
          outputRange: ["0deg", "-14deg"],
        }),
      },
    ],
  };

  return (
    <SafeAreaView style={styles.safe}>
      <View style={StyleSheet.absoluteFill} pointerEvents="none">
        <Animated.View style={[styles.blob, styles.blobLeft, blob1Translate]} />
        <Animated.View
          style={[styles.blob, styles.blobRight, blob2Translate]}
        />
      </View>

      <Text style={styles.header}>Dashboard</Text>
      <Text style={styles.subHeader}>
        Kelola keuangan & proyek Anda dengan mudah
      </Text>

      <View style={styles.grid}>
        <CardButton
          title="Tambahkan Keuangan"
          desc="Catat pemasukan & pengeluaran"
          onPress={() => navigation.navigate("Home")}
          image={require("./assets/money.png")}
        />

        <CardButton
          title="Project"
          desc="Kelola proyek Anda"
          onPress={() => navigation.navigate("Project")}
          image={require("./assets/project.png")}
        />

        <CardButton
          title="History"
          desc="Lihat summary keuangan Anda"
          onPress={() => navigation.navigate("History")}
          image={require("./assets/history.png")}
        />
        <StatusBar style="dark" />
      </View>
    </SafeAreaView>
  );
}

export default function App() {
  return (
    <NavigationContainer>
      <Stack.Navigator
        initialRouteName="Dashboard"
        screenOptions={{ headerShown: false }}
      >
        <Stack.Screen name="Dashboard" component={Dashboard} />
        <Stack.Screen name="Home" component={Home} />
        <Stack.Screen name="Project" component={Project} />
        <Stack.Screen name="History" component={History} />
      </Stack.Navigator>
    </NavigationContainer>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    padding: 22,
    backgroundColor: "#f8f9ff",
    overflow: "hidden",
  },

  header: {
    fontSize: 28,
    fontWeight: "700",
    textAlign: "center",
    marginTop: 30,
    color: "#1a1a2e",
  },

  subHeader: {
    textAlign: "center",
    color: "#5a5a7a",
    marginBottom: 30,
    marginTop: 6,
    fontSize: 14,
  },

  grid: {
    flexDirection: "column",
    rowGap: 16,
  },

  card: {
    padding: 18,
    borderRadius: 16,
    backgroundColor: "#ffffff",
    elevation: Platform.OS === "android" ? 6 : 10,
    shadowColor: "#000",
    shadowOpacity: 0.08,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 },
    borderWidth: 1,
    borderColor: "#eef1ff",
    overflow: "hidden",
    marginBottom: 12,
  },

  cardContent: {
    flexDirection: "row",
    alignItems: "center",
  },

  cardTitle: {
    fontSize: 19,
    fontWeight: "700",
    color: "#1e1e2d",
  },

  cardDesc: {
    fontSize: 14,
    color: "#5a5a7a",
    marginTop: 6,
    maxWidth: SCREEN_W * 0.55,
  },

  cardImageWrap: {
    width: 92,
    height: 92,
    borderRadius: 12,
    overflow: "hidden",
    marginLeft: 12,
    backgroundColor: "transparent",
  },

  cardImage: {
    width: "100%",
    height: "100%",
    borderRadius: 12,
    backgroundColor: "transparent",
  },

  blob: {
    position: "absolute",
    width: SCREEN_W * 0.7,
    height: SCREEN_W * 0.7,
    borderRadius: (SCREEN_W * 0.7) / 2,
    opacity: 0.12,
    top: -SCREEN_W * 0.18,
    left: -SCREEN_W * 0.18,
  },
  blobLeft: {
    backgroundColor: "#1e75ff",
    opacity: 0.12,
    top: -SCREEN_W * 0.25,
    left: -SCREEN_W * 0.28,
    transform: [{ scale: 1.05 }],
  },
  blobRight: {
    backgroundColor: "#10b981",
    opacity: 0.1,
    right: -SCREEN_W * 0.3,
    left: undefined,
    top: SCREEN_W * 0.25,
  },
});
