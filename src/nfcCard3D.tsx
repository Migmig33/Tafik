import { useEffect, useRef, useState } from "react";
import { StyleSheet, View } from "react-native";

// The source model, used as it is. Its nodes are NFC_Card_White and NFC_Card_Black.
const MODEL = require("./assets/card/TAFIK_NFC_Cards.glb");

// The render shows the card standing upright: its long edge runs vertically, its face
// is toward the viewer, and it is turned slightly so its thickness shows.
const TILT_RADIANS = -0.49;
const SWAY_RADIANS = 0.12;
const SWAY_SECONDS = 6;

// GLTFLoader reads a TextDecoder, which some JavaScript runtimes do not provide. This
// reads the UTF-8 the loader needs, and only where it is missing.
if (typeof (globalThis as any).TextDecoder === "undefined") {
  (globalThis as any).TextDecoder = class {
    decode(input?: ArrayBufferView | ArrayBuffer) {
      if (!input) return "";
      const bytes = input instanceof ArrayBuffer ? new Uint8Array(input) : new Uint8Array(input.buffer, input.byteOffset, input.byteLength);
      let text = "";
      for (let index = 0; index < bytes.length; index += 1) text += String.fromCharCode(bytes[index]);
      try {
        return decodeURIComponent(escape(text));
      } catch {
        return text;
      }
    }
  };
}

type Scene3D = { white: any; black: any };

/**
 * The registered card as a 3D model, standing upright. It is loaded on demand and draws
 * nothing until the GL view and the model are ready, so the static card underneath
 * stays visible. If the GL view or the model fails, onFail is called and that card stays.
 */
export default function NfcCard3D({
  art,
  reduceMotion,
  onFail,
  onReady,
}: {
  art: "white" | "black";
  reduceMotion: boolean;
  onFail: () => void;
  onReady: () => void;
}) {
  const [GLView, setGLView] = useState<any>(null);
  const artRef = useRef(art);
  artRef.current = art;
  const reduceRef = useRef(reduceMotion);
  reduceRef.current = reduceMotion;
  const sceneRef = useRef<Scene3D | null>(null);
  const cleanupRef = useRef<(() => void) | null>(null);
  const failRef = useRef(onFail);
  failRef.current = onFail;
  const readyRef = useRef(onReady);
  readyRef.current = onReady;

  // The GL view comes from a native module, so it is loaded here and not at startup.
  useEffect(() => {
    let cancelled = false;
    import("expo-gl")
      .then((module) => {
        if (!cancelled) setGLView(() => module.GLView);
      })
      .catch(() => {
        if (!cancelled) failRef.current();
      });
    return () => {
      cancelled = true;
      cleanupRef.current?.();
    };
  }, []);

  // A theme change, or a switch between cards, shows the matching model at once.
  useEffect(() => {
    const scene = sceneRef.current;
    if (!scene) return;
    scene.white.visible = art === "white";
    scene.black.visible = art === "black";
  }, [art]);

  const onContextCreate = async (gl: any) => {
    try {
      const THREE = await import("three");
      const { GLTFLoader } = await import("three/examples/jsm/loaders/GLTFLoader.js");
      const { Asset } = await import("expo-asset");

      const asset = Asset.fromModule(MODEL);
      await asset.downloadAsync();
      const response = await fetch(asset.localUri ?? asset.uri);
      const buffer = await response.arrayBuffer();

      const gltf: any = await new Promise((resolve, reject) => {
        new GLTFLoader().parse(buffer, "", resolve, reject);
      });

      const width = gl.drawingBufferWidth;
      const height = gl.drawingBufferHeight;
      const canvas: any = {
        width,
        height,
        style: {},
        clientWidth: width,
        clientHeight: height,
        addEventListener: () => {},
        removeEventListener: () => {},
      };
      const renderer = new THREE.WebGLRenderer({ canvas, context: gl, alpha: true, antialias: false });
      renderer.setPixelRatio(1);
      renderer.setSize(width, height, false);
      renderer.setClearColor(0x000000, 0);

      const scene = new THREE.Scene();
      const camera = new THREE.PerspectiveCamera(28, width / height, 0.01, 10);
      camera.position.set(0, 0, 0.24);
      camera.lookAt(0, 0, 0);

      // Soft light: an even ambient wash, a key from above-left and a faint fill.
      scene.add(new THREE.AmbientLight(0xffffff, 0.7));
      const key = new THREE.DirectionalLight(0xffffff, 1.4);
      key.position.set(0.2, 0.3, 1);
      scene.add(key);
      const fill = new THREE.DirectionalLight(0xffffff, 0.5);
      fill.position.set(-0.3, -0.2, 0.6);
      scene.add(fill);

      // Upright orientation: a 120 degree turn about (1,1,1) maps the card's long edge to
      // vertical and its face to the viewer, then a tilt about the vertical axis shows its edges.
      const axis = new THREE.Vector3(1, 1, 1).normalize();
      const upright = new THREE.Quaternion().setFromAxisAngle(axis, (2 * Math.PI) / 3);
      const tilt = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), TILT_RADIANS);
      const holder = new THREE.Group();
      holder.quaternion.copy(tilt.multiply(upright));
      holder.add(gltf.scene);
      const pivot = new THREE.Group();
      pivot.add(holder);
      scene.add(pivot);

      const white = gltf.scene.getObjectByName("NFC_Card_White");
      const black = gltf.scene.getObjectByName("NFC_Card_Black");
      if (!white || !black) throw new Error("The card model is missing a node.");
      // Both cards sit at the centre; only the one for the theme is shown.
      white.position.set(0, 0, 0);
      black.position.set(0, 0, 0);
      white.visible = artRef.current === "white";
      black.visible = artRef.current === "black";
      sceneRef.current = { white, black };

      const started = Date.now();
      let frame = 0;
      const tick = () => {
        const seconds = (Date.now() - started) / 1000;
        pivot.rotation.y = reduceRef.current ? 0 : Math.sin((seconds * 2 * Math.PI) / SWAY_SECONDS) * SWAY_RADIANS;
        renderer.render(scene, camera);
        gl.endFrameEXP();
        frame = requestAnimationFrame(tick);
      };
      tick();
      cleanupRef.current = () => {
        cancelAnimationFrame(frame);
        renderer.dispose();
        sceneRef.current = null;
      };
      readyRef.current();
    } catch {
      failRef.current();
    }
  };

  if (!GLView) return null;
  return (
    <View style={styles.wrap} pointerEvents="none">
      <GLView style={styles.gl} onContextCreate={onContextCreate} />
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
  },
  gl: {
    flex: 1,
  },
});
