import { useCallback, useEffect, useMemo, useState } from "react";
import {
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
import { Body, Screen, Skeleton, Title } from "../components";
import { GuideButton, GuideSheet, useScreenGuide } from "../guides";
import { getBlocklist, setBlocklist } from "../store";
import { radius, space, useTheme } from "../theme";
import { Text, TextInput } from "../typography";

/** One row of the card, which is either an installed app or a placeholder. */
type Row =
  | { kind: "app"; app: InstalledApp }
  | { kind: "skeleton"; key: string; nameWidth: `${number}%` };

// Real app names are not all one length. Uniform bars read as a loading
// pattern; uneven ones read as names that have not arrived yet.
const SKELETON_NAME_WIDTHS = ["58%", "42%", "67%", "35%", "50%", "61%"] as const;

export default function BlocklistScreen() {
  const { colors } = useTheme();
  const guide = useScreenGuide("blocklist");
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
      setLoadError(error?.message ?? "TockIn couldn't load your app icons.");
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

  // The skeleton is not a separate widget with its own card: it is this list
  // holding placeholder rows. Anything else has to reproduce the height the
  // list settles on, and getting that wrong is what left the placeholder card
  // running a row longer than the loaded one and under the tab bar.
  const rows = useMemo<Row[]>(
    () =>
      loading
        ? SKELETON_NAME_WIDTHS.map((nameWidth, index) => ({
            kind: "skeleton",
            key: `skeleton-${index}`,
            nameWidth,
          }))
        : filtered.map((app) => ({ kind: "app", app })),
    [loading, filtered]
  );

  return (
    <Screen>
      <View style={styles.header}>
        <Title>Blocklist</Title>
        <GuideButton label="the blocklist" onPress={guide.open} />
      </View>
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

      {loadError ? (
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
          data={rows}
          keyExtractor={(item) => (item.kind === "app" ? item.app.pkg : item.key)}
          style={[styles.list, { backgroundColor: colors.surface, borderColor: colors.border }]}
          contentContainerStyle={styles.listContent}
          // Placeholder rows stand for a list nobody can act on yet.
          scrollEnabled={!loading}
          ListEmptyComponent={
            <Text style={{ color: colors.textDim, fontSize: 14, textAlign: "center", padding: space(3) }}>
              {query.trim() ? "No apps match your search." : "No launchable apps found."}
            </Text>
          }
          ItemSeparatorComponent={() => (
            <View style={{ height: StyleSheet.hairlineWidth, backgroundColor: colors.border }} />
          )}
          renderItem={({ item }) =>
            item.kind === "skeleton" ? (
              <View style={styles.appRow}>
                <Skeleton width={42} height={42} borderRadius={11} />
                <View style={{ flex: 1 }}>
                  <Skeleton width={item.nameWidth} height={13} />
                  <Skeleton width="30%" height={10} style={{ marginTop: space(0.75) }} />
                </View>
                <Skeleton width={51} height={31} borderRadius={radius.pill} />
              </View>
            ) : (
              <Pressable onPress={() => toggle(item.app.pkg)} style={styles.appRow}>
                <Image
                  source={{ uri: item.app.icon }}
                  style={[styles.appIcon, { backgroundColor: colors.accentWash }]}
                  resizeMode="contain"
                  fadeDuration={0}
                />
                <View style={{ flex: 1 }}>
                  <Text numberOfLines={1} style={{ color: colors.text, fontSize: 15, fontWeight: "500" }}>
                    {item.app.name}
                  </Text>
                  <Text numberOfLines={1} style={{ color: colors.textDim, fontSize: 11, marginTop: 2 }}>
                    {selected.has(item.app.pkg) ? "Locked during focus" : "Available during focus"}
                  </Text>
                </View>
                <Switch
                  value={selected.has(item.app.pkg)}
                  onValueChange={() => toggle(item.app.pkg)}
                  trackColor={{ true: colors.accent, false: colors.border }}
                />
              </Pressable>
            )
          }
        />
      )}

      <GuideSheet guide="blocklist" visible={guide.visible} onClose={guide.close} />
    </Screen>
  );
}

// Reading the launcher for every installed app is slow enough to see, and the
// list it fills is a fixed shape, so the wait is spent showing that shape
// rather than a spinner that says nothing about what is coming.
const styles = StyleSheet.create({
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: space(1.5),
  },
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
    // A FlatList inherits flexGrow:1 / flexShrink:1 / flexBasis:auto from
    // ScrollView, so without this its height is a function of how much content
    // it holds: eight placeholder rows and fifty app rows give different flex
    // bases, shrink is distributed in proportion to basis, and the card lands
    // on two different heights a second apart. flex:1 sets flexBasis to 0, so
    // the card takes the space the screen leaves it and content height stops
    // entering into it. This is the whole fix for the loading/loaded jump —
    // the card is now the same height with two apps, fifty apps, or none.
    flex: 1,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: radius.card,
    overflow: "hidden",
  },
  listContent: {
    // Lets the empty-state text sit in the middle of a card that is now taller
    // than its contents, instead of clinging to the top edge.
    flexGrow: 1,
    paddingHorizontal: space(1.5),
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