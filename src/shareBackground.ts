import AsyncStorage from "@react-native-async-storage/async-storage";
import { extensionFor, isSupportedImage } from "./shareCardMath";

// The chosen background is copied into the app's own storage. A gallery link can stop
// working later, so the copy is what the card is drawn from.
const KEY = "shareBackgroundUri";

// The picker and file modules are native. They are loaded when first used, so a build
// that lacks them still starts, and the editor reports the problem instead.
async function fileSystem() {
  return await import("expo-file-system/legacy");
}

async function imagePicker() {
  return await import("expo-image-picker");
}

export type PickResult =
  | { status: "picked"; uri: string }
  | { status: "cancelled" }
  | { status: "denied" }
  | { status: "unsupported" }
  | { status: "failed"; message: string };

/** The saved background, if one is still on disk. */
export async function getShareBackground(): Promise<string | null> {
  try {
    const uri = await AsyncStorage.getItem(KEY);
    if (!uri) return null;
    const FileSystem = await fileSystem();
    const info = await FileSystem.getInfoAsync(uri);
    if (info.exists) return uri;
    await AsyncStorage.removeItem(KEY);
    return null;
  } catch {
    return null;
  }
}

/** Opens the gallery and keeps a copy of the chosen photo. */
export async function chooseShareBackground(): Promise<PickResult> {
  try {
    const ImagePicker = await imagePicker();
    const FileSystem = await fileSystem();
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ["images"],
      allowsMultipleSelection: false,
      quality: 1,
    });
    if (result.canceled) return { status: "cancelled" };

    const asset = result.assets[0];
    if (!isSupportedImage(asset.mimeType)) return { status: "unsupported" };

    const target = `${FileSystem.documentDirectory}share-background.${extensionFor(asset.mimeType)}`;
    await FileSystem.deleteAsync(target, { idempotent: true });
    await FileSystem.copyAsync({ from: asset.uri, to: target });
    await AsyncStorage.setItem(KEY, target);
    return { status: "picked", uri: target };
  } catch (error: any) {
    const message = String(error?.message ?? "");
    if (/permission/i.test(message)) return { status: "denied" };
    return { status: "failed", message: message || "Couldn't open your photos." };
  }
}

/** Removes the saved background, so the card returns to its default design. */
export async function clearShareBackground(): Promise<void> {
  const uri = await AsyncStorage.getItem(KEY);
  if (uri) {
    const FileSystem = await fileSystem();
    await FileSystem.deleteAsync(uri, { idempotent: true });
  }
  await AsyncStorage.removeItem(KEY);
}
