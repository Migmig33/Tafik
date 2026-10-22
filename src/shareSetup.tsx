import { useEffect, useMemo, useRef, useState } from "react";
import { Alert, Modal, PanResponder, Pressable, ScrollView, StyleSheet, View } from "react-native";
import type { View as NativeView } from "react-native";
import { Body, GhostButton, PrimaryButton, Title } from "./components";
import { clearShareBackground, chooseShareBackground, getShareBackground } from "./shareBackground";
import { ShareCard } from "./shareCard";
import type { SessionCardFacts } from "./sessionFacts";
import {
  CARD_HEIGHT,
  CARD_WIDTH,
  clampOffset,
  clampZoom,
  textToneFor,
  type TextTone,
} from "./shareCardMath";
import { radius, space, colors, typeScale } from "./theme";
import { Text } from "./typography";

const PREVIEW_WIDTH = 240;
const PREVIEW_HEIGHT = (PREVIEW_WIDTH * CARD_HEIGHT) / CARD_WIDTH;
const PREVIEW_SCALE = PREVIEW_WIDTH / CARD_WIDTH;
const EXPORT_WIDTH = 1080;
const EXPORT_HEIGHT = 1920;
const ZOOM_STEP = 0.25;

/**
 * The step between tapping Share Session and the native sharing sheet. The user picks
 * a background, positions it, and sees the exact image before anything is shared.
 */
export function ShareSetupModal({
  facts,
  onClose,
}: {
  facts: SessionCardFacts | null;
  onClose: () => void;
}) {
  const [photoUri, setPhotoUri] = useState<string | null>(null);
  const [zoom, setZoom] = useState(1);
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const [choice, setChoice] = useState<TextTone>("light");
  const [notice, setNotice] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const cardRef = useRef<NativeView>(null);

  // The drag handler is created once, so it reads the latest values from these refs.
  const latest = useRef({ zoom, offset });
  latest.current = { zoom, offset };
  const dragStart = useRef({ x: 0, y: 0 });

  // Each time the editor opens, the saved background (if any) comes back.
  useEffect(() => {
    if (!facts) return;
    setNotice(null);
    getShareBackground().then(setPhotoUri);
  }, [facts]);

  const tone = textToneFor(photoUri !== null, choice);

  const pan = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => true,
        onPanResponderGrant: () => {
          dragStart.current = { ...latest.current.offset };
        },
        onPanResponderMove: (_, gesture) => {
          // Gestures are measured on the preview, so they are scaled back to card points.
          const { zoom: z } = latest.current;
          const x = dragStart.current.x + gesture.dx / PREVIEW_SCALE;
          const y = dragStart.current.y + gesture.dy / PREVIEW_SCALE;
          setOffset({
            x: clampOffset(x, z, CARD_WIDTH),
            y: clampOffset(y, z, CARD_HEIGHT),
          });
        },
      }),
    []
  );

  const applyZoom = (next: number) => {
    const z = clampZoom(next);
    setZoom(z);
    setOffset((current) => ({
      x: clampOffset(current.x, z, CARD_WIDTH),
      y: clampOffset(current.y, z, CARD_HEIGHT),
    }));
  };

  const choose = async () => {
    setNotice(null);
    const result = await chooseShareBackground();
    if (result.status === "picked") {
      setPhotoUri(result.uri);
      setZoom(1);
      setOffset({ x: 0, y: 0 });
    } else if (result.status === "denied") {
      setNotice("Tafik needs access to your photos to use a background. Allow it in Settings, then try again.");
    } else if (result.status === "unsupported") {
      setNotice("That image format can't be used. Choose a JPEG, PNG or WebP photo.");
    } else if (result.status === "failed") {
      setNotice(result.message);
    }
  };

  const remove = async () => {
    await clearShareBackground();
    setPhotoUri(null);
    setZoom(1);
    setOffset({ x: 0, y: 0 });
    setNotice(null);
  };

  const share = async () => {
    if (busy) return;
    setBusy(true);
    try {
      const outcome = await shareSessionCard(cardRef.current);
      if (outcome === "unavailable") {
        Alert.alert(
          "Sharing isn't available yet",
          "This installed Tafik build can't share images. Install a newly built APK to share Session Cards."
        );
      }
    } catch (error: any) {
      Alert.alert("Couldn't share the card", error?.message ?? "Please try again.");
    } finally {
      setBusy(false);
    }
  };

  const art = { photoUri, zoom, offsetX: offset.x, offsetY: offset.y, tone };

  return (
    <Modal visible={facts !== null} transparent={false} animationType="slide" onRequestClose={onClose}>
      <View style={[styles.screen, { backgroundColor: colors.bg }]}>
        <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
          <Title>Share session</Title>
          <View style={{ height: space(0.75) }} />
          <Body dim>Choose how the card looks, then share it.</Body>

          {facts ? (
            <>
              {/* The preview is the exported card, scaled down. Drag it to reposition a photo. */}
              <View
                {...pan.panHandlers}
                style={[styles.preview, { width: PREVIEW_WIDTH, height: PREVIEW_HEIGHT, borderColor: colors.border }]}
              >
                <View
                  style={{
                    position: "absolute",
                    left: (PREVIEW_WIDTH - CARD_WIDTH) / 2,
                    top: (PREVIEW_HEIGHT - CARD_HEIGHT) / 2,
                    transform: [{ scale: PREVIEW_SCALE }],
                  }}
                >
                  <ShareCard ref={cardRef} facts={facts} art={art} />
                </View>
              </View>
              {photoUri ? <Body dim>Drag the preview to reposition the photo.</Body> : null}

              <View style={styles.section}>
                <Text style={[styles.label, { color: colors.textDim }]}>BACKGROUND</Text>
                {photoUri ? (
                  <>
                    <View style={styles.row}>
                      <GhostButton label="Change photo" onPress={() => void choose()} />
                      <GhostButton label="Remove photo" onPress={() => void remove()} />
                    </View>
                    <View style={styles.row}>
                      <Pressable onPress={() => applyZoom(zoom - ZOOM_STEP)} style={[styles.step, { borderColor: colors.border }]}>
                        <Text style={{ color: colors.text, fontSize: typeScale.callout.fontSize, fontWeight: "600" }}>−</Text>
                      </Pressable>
                      <Text style={[styles.zoomText, { color: colors.textDim }]}>{`Zoom ${Math.round(zoom * 100)}%`}</Text>
                      <Pressable onPress={() => applyZoom(zoom + ZOOM_STEP)} style={[styles.step, { borderColor: colors.border }]}>
                        <Text style={{ color: colors.text, fontSize: typeScale.callout.fontSize, fontWeight: "600" }}>+</Text>
                      </Pressable>
                    </View>
                    <Text style={[styles.label, { color: colors.textDim }]}>TEXT</Text>
                    <View style={styles.row}>
                      {(["light", "dark"] as const).map((item) => (
                        <Pressable
                          key={item}
                          accessibilityRole="radio"
                          accessibilityState={{ selected: choice === item }}
                          onPress={() => setChoice(item)}
                          style={[
                            styles.toneChoice,
                            { borderColor: colors.border, backgroundColor: choice === item ? colors.accentWash : "transparent" },
                          ]}
                        >
                          <Text style={{ color: colors.text, fontSize: typeScale.footnote.fontSize, fontWeight: "600" }}>
                            {item === "light" ? "Light text" : "Dark text"}
                          </Text>
                        </Pressable>
                      ))}
                    </View>
                  </>
                ) : (
                  <GhostButton label="Choose background image" onPress={() => void choose()} />
                )}
                {notice ? <Body dim>{notice}</Body> : null}
              </View>
            </>
          ) : null}
        </ScrollView>

        <View style={styles.actions}>
          <PrimaryButton label={busy ? "Opening share…" : "Share"} disabled={busy || !facts} onPress={() => void share()} />
          <GhostButton label="Close" onPress={onClose} />
        </View>
      </View>
    </Modal>
  );
}

/**
 * Exports the card at 1080 by 1920 and opens Android's share sheet with that single
 * image. The sheet only reports that it opened; posting happens in the target app.
 */
export async function shareSessionCard(view: NativeView | null): Promise<"opened" | "unavailable"> {
  if (!view) throw new Error("The card isn't on screen yet. Try again.");

  let viewShot: typeof import("react-native-view-shot");
  let sharing: typeof import("expo-sharing");
  try {
    viewShot = await import("react-native-view-shot");
    sharing = await import("expo-sharing");
  } catch {
    return "unavailable";
  }
  if (!(await sharing.isAvailableAsync())) return "unavailable";

  const uri = await viewShot.captureRef(view, {
    format: "png",
    quality: 1,
    result: "tmpfile",
    width: EXPORT_WIDTH,
    height: EXPORT_HEIGHT,
  });
  await sharing.shareAsync(uri, {
    mimeType: "image/png",
    dialogTitle: "Share your session card",
    UTI: "public.png",
  });
  return "opened";
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
  },
  content: {
    padding: space(2.5),
    paddingTop: space(6),
    gap: space(1.5),
    alignItems: "center",
  },
  preview: {
    overflow: "hidden",
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: radius.card,
    marginTop: space(1),
  },
  section: {
    alignSelf: "stretch",
    gap: space(1),
  },
  label: {
    ...typeScale.label,
    fontWeight: "600",
    marginTop: space(0.5),
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: space(1),
  },
  step: {
    width: 40,
    height: 40,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: radius.pill,
    alignItems: "center",
    justifyContent: "center",
  },
  zoomText: {
    fontSize: typeScale.footnote.fontSize,
    fontWeight: "600",
  },
  toneChoice: {
    flex: 1,
    alignItems: "center",
    paddingVertical: space(1.25),
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: radius.pill,
  },
  actions: {
    gap: space(1),
    padding: space(2.5),
    paddingBottom: space(3),
  },
});
