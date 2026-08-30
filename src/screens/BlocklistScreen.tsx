import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  Image,
  Pressable,
  StyleSheet,
  Switch,
  View,
} from "react-native";
import PackageOpen from "lucide-react-native/icons/package-open";
import RefreshCw from "lucide-react-native/icons/refresh-cw";
import Search from "lucide-react-native/icons/search";
import { getInstalledApps, InstalledApp } from "../blocking";
import { Body, Screen, Title } from "../components";
import { getBlocklist, setBlocklist } from "../store";
import { radius, space, useTheme } from "../theme";
import { Text, TextInput } from "../typography";

export default function BlocklistScreen() {
  const { colors } = useTheme();
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [apps, setApps] = useState<InstalledApp[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const loadApps = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    try {
      setApps(await getInstalledApps());
    } catch (error: any) {
      setApps([]);
      setLoadError(error?.message ?? "TapIn couldn't load your app icons.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    getBlocklist().then((list) => setSelected(new Set(list)));
    loadApps();
  }, [loadApps]);

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
    () => apps.filter((app) => app.name.toLowerCase().includes(query.trim().toLowerCase())),
    [apps, query]
  );

  return (
    <Screen>
      <Title>Blocklist</Title>
      <View style={{ height: space(0.75) }} />
      <Body dim>Choose the apps that should disappear while you focus.</Body>
      <View style={{ height: space(2.5) }} />

      <View style={[styles.search, { backgroundColor: colors.surface, borderColor: colors.border }]}>
        <Search size={19} color={colors.textDim} strokeWidth={2} />
        <TextInput
          value={query}
          onChangeText={setQuery}
          placeholder="Search your apps"
          placeholderTextColor={colors.textDim}
          style={{ flex: 1, color: colors.text, fontSize: 15, paddingVertical: space(1.5) }}
        />
      </View>

      <View style={styles.listMeta}>
        <Text style={{ color: colors.text, fontSize: 15, fontWeight: "600" }}>Your apps</Text>
        <View style={[styles.countPill, { backgroundColor: colors.accentWash }]}>
          <Text style={{ color: colors.accent, fontSize: 12, fontWeight: "600" }}>
            {selected.size} selected
          </Text>
        </View>
      </View>

      {loading ? (
        <View style={[styles.stateCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <ActivityIndicator color={colors.accent} />
          <Text style={{ color: colors.textDim, fontSize: 14 }}>Loading your app icons…</Text>
        </View>
      ) : loadError ? (
        <View style={[styles.stateCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <PackageOpen size={28} color={colors.accent} strokeWidth={1.8} />
          <Text style={{ color: colors.text, fontSize: 15, fontWeight: "600", textAlign: "center" }}>
            App icons unavailable
          </Text>
          <Text style={{ color: colors.textDim, fontSize: 13, lineHeight: 19, textAlign: "center" }}>
            {loadError}
          </Text>
          <Pressable
            onPress={loadApps}
            style={[styles.retryButton, { backgroundColor: colors.accent }]}
          >
            <RefreshCw size={16} color={colors.onAccent} strokeWidth={2.2} />
            <Text style={{ color: colors.onAccent, fontSize: 14, fontWeight: "600" }}>Try again</Text>
          </Pressable>
        </View>
      ) : (
        <FlatList
          data={filtered}
          keyExtractor={(item) => item.pkg}
          style={[styles.list, { backgroundColor: colors.surface, borderColor: colors.border }]}
          contentContainerStyle={{ paddingHorizontal: space(1.5) }}
          ListEmptyComponent={
            <Text style={{ color: colors.textDim, fontSize: 14, textAlign: "center", padding: space(3) }}>
              {query.trim() ? "No apps match your search." : "No launchable apps found."}
            </Text>
          }
          ItemSeparatorComponent={() => (
            <View style={{ height: StyleSheet.hairlineWidth, backgroundColor: colors.border }} />
          )}
          renderItem={({ item }) => (
            <Pressable onPress={() => toggle(item.pkg)} style={styles.appRow}>
              <Image
                source={{ uri: item.icon }}
                style={[styles.appIcon, { backgroundColor: colors.accentWash }]}
                resizeMode="contain"
                fadeDuration={0}
              />
              <View style={{ flex: 1 }}>
                <Text numberOfLines={1} style={{ color: colors.text, fontSize: 15, fontWeight: "500" }}>
                  {item.name}
                </Text>
                <Text numberOfLines={1} style={{ color: colors.textDim, fontSize: 11, marginTop: 2 }}>
                  {selected.has(item.pkg) ? "Locked during focus" : "Available during focus"}
                </Text>
              </View>
              <Switch
                value={selected.has(item.pkg)}
                onValueChange={() => toggle(item.pkg)}
                trackColor={{ true: colors.accent, false: colors.border }}
              />
            </Pressable>
          )}
        />
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  search: {
    minHeight: 50,
    flexDirection: "row",
    alignItems: "center",
    gap: space(1.25),
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: radius.input,
    paddingHorizontal: space(1.5),
  },
  listMeta: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginTop: space(2.5),
    marginBottom: space(1.25),
  },
  countPill: {
    borderRadius: radius.pill,
    paddingHorizontal: space(1.25),
    paddingVertical: space(0.6),
  },
  list: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: radius.card,
    overflow: "hidden",
  },
  appRow: {
    minHeight: 68,
    flexDirection: "row",
    alignItems: "center",
    gap: space(1.25),
  },
  appIcon: {
    width: 42,
    height: 42,
    borderRadius: 11,
  },
  stateCard: {
    flex: 1,
    minHeight: 180,
    alignItems: "center",
    justifyContent: "center",
    gap: space(1.25),
    padding: space(3),
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: radius.card,
  },
  retryButton: {
    marginTop: space(0.75),
    minHeight: 44,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: space(0.75),
    paddingHorizontal: space(2),
    borderRadius: radius.pill,
  },
});
