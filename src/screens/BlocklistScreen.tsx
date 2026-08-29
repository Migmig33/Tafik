import React, { useEffect, useMemo, useState } from "react";
import { FlatList, Pressable, StyleSheet, Switch, Text, TextInput, View } from "react-native";
import { Body, GhostButton, Screen, Title } from "../components";
import { Nav } from "../nav";
import { getBlocklist, setBlocklist } from "../store";
import { space, useTheme } from "../theme";

// PLACEHOLDER app list. The real installed-app list requires a native query
// (PackageManager.getInstalledApplications) exposed from your native module —
// there is no built-in RN API for it. Swap this array for that call.
const MOCK_APPS = [
  { name: "Instagram", pkg: "com.instagram.android" },
  { name: "TikTok", pkg: "com.zhiliaoapp.musically" },
  { name: "YouTube", pkg: "com.google.android.youtube" },
  { name: "X", pkg: "com.twitter.android" },
  { name: "Reddit", pkg: "com.reddit.frontpage" },
  { name: "Facebook", pkg: "com.facebook.katana" },
  { name: "Snapchat", pkg: "com.snapchat.android" },
  { name: "Netflix", pkg: "com.netflix.mediaclient" },
  { name: "Chrome", pkg: "com.android.chrome" },
  { name: "Games Hub", pkg: "com.example.games" },
];

export default function BlocklistScreen({ nav }: { nav: Nav }) {
  const { colors } = useTheme();
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState<Set<string>>(new Set());

  useEffect(() => {
    getBlocklist().then((list) => setSelected(new Set(list)));
  }, []);

  const persist = (next: Set<string>) => {
    setSelected(new Set(next));
    setBlocklist([...next]);
  };

  const toggle = (pkg: string) => {
    const next = new Set(selected);
    next.has(pkg) ? next.delete(pkg) : next.add(pkg);
    persist(next);
  };

  const filtered = useMemo(
    () => MOCK_APPS.filter((a) => a.name.toLowerCase().includes(query.trim().toLowerCase())),
    [query]
  );

  return (
    <Screen>
      <Title>Blocklist</Title>
      <View style={{ height: space(2) }} />

      <TextInput
        value={query}
        onChangeText={setQuery}
        placeholder="Search apps"
        placeholderTextColor={colors.textDim}
        style={{
          backgroundColor: colors.surface,
          borderColor: colors.border,
          borderWidth: StyleSheet.hairlineWidth,
          borderRadius: 8,
          paddingHorizontal: space(1.75),
          paddingVertical: space(1.5),
          color: colors.text,
          fontSize: 15,
        }}
      />

      <View style={{ height: space(1.5) }} />
      <Body dim>{selected.size} selected</Body>
      <View style={{ height: space(1) }} />

      <FlatList
        data={filtered}
        keyExtractor={(i) => i.pkg}
        ItemSeparatorComponent={() => (
          <View style={{ height: StyleSheet.hairlineWidth, backgroundColor: colors.border }} />
        )}
        renderItem={({ item }) => (
          <Pressable
            onPress={() => toggle(item.pkg)}
            style={{ flexDirection: "row", alignItems: "center", paddingVertical: space(1.75) }}
          >
            <Text style={{ flex: 1, color: colors.text, fontSize: 16 }}>{item.name}</Text>
            <Switch
              value={selected.has(item.pkg)}
              onValueChange={() => toggle(item.pkg)}
              trackColor={{ true: colors.accent, false: colors.border }}
            />
          </Pressable>
        )}
      />

      <GhostButton label="Done" onPress={() => nav("home")} />
    </Screen>
  );
}
