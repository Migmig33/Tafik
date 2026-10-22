const { getDefaultConfig } = require("expo/metro-config");

// GLB models are bundled as assets, so the 3D card can load TAFIK_NFC_Cards.glb.
const config = getDefaultConfig(__dirname);
config.resolver.assetExts.push("glb");

module.exports = config;
