import { useEffect, useRef, useState } from "react";
import { Animated, StyleSheet, View } from "react-native";
import { INJECT_3D_FAILURE } from "./devTest";
import { CARD_OFFSET_X, CARD_OFFSET_Y, CARD_SCALE, LIGHTING_BY_CARD } from "./cardFit";

// The source model, used as it is. Its nodes are NFC_Card_White and NFC_Card_Black.
const MODEL = require("./assets/card/TAFIK_NFC_Cards.glb");

// The card stands upright in the inverted orientation: its long edge runs vertically, the
// bottom-right corner is the lowest point, and the left side is nearer the viewer.
// Yaw -20 degrees, pitch -32.02 degrees, roll -27.00 degrees, in three.js axes. The reference
// has the right side nearer the viewer, which the negative yaw gives on the phone.
const YAW_RADIANS = (-20 * Math.PI) / 180;
const PITCH_RADIANS = (-32.0171 * Math.PI) / 180;
const ROLL_RADIANS = (-27 * Math.PI) / 180;
// How long the 3D card may take, from the GL view appearing, to draw its first frame before it gives up.
const LOAD_TIMEOUT_MS = 15000;
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

// GLTFLoader reads navigator.userAgent to choose a texture loader. React Native leaves it
// undefined, so this gives it a plain value where it is missing. The card has no textures.
if (typeof navigator !== "undefined" && typeof navigator.userAgent !== "string") {
  try {
    Object.defineProperty(navigator, "userAgent", { value: "ReactNative", configurable: true });
  } catch {
    // If the property cannot be set, the loader's own error is reported by the setup catch.
  }
}

type Scene3D = { white: any; black: any };

/**
 * The registered card as a 3D model, standing upright. It is loaded on demand. It reports
 * ready only after the model has loaded and its first frame has been drawn, so the static
 * card underneath stays visible until then. If the GL view or the model fails, onFail is
 * called, the reason is logged, and the static card stays.
 */
export default function NfcCard3D({
  art,
  spin,
  onFail,
  onReady,
}: {
  art: "white" | "black";
  // The turntable spin in degrees, driven by the showcase's drag. It is added to the base yaw.
  spin: Animated.Value;
  onFail: () => void;
  onReady: () => void;
}) {
  const [GLView, setGLView] = useState<any>(null);
  const artRef = useRef(art);
  artRef.current = art;
  const spinRef = useRef(0);
  const sceneRef = useRef<Scene3D | null>(null);
  // Sets the lights for the card that is showing. Set once the scene exists.
  const lightingRef = useRef<((card: "white" | "black") => void) | null>(null);
  const cleanupRef = useRef<(() => void) | null>(null);
  const failRef = useRef(onFail);
  failRef.current = onFail;
  const readyRef = useRef(onReady);
  readyRef.current = onReady;
  // One GL context is set up per mount, and nothing starts after the card has unmounted.
  const startedRef = useRef(false);
  const unmountedRef = useRef(false);
  // Set once the first frame has been drawn and onReady has been called.
  const readyDoneRef = useRef(false);

  // The GL view comes from a native module, so it is loaded here and not at startup.
  useEffect(() => {
    unmountedRef.current = false;
    let cancelled = false;
    import("expo-gl")
      .then((module) => {
        if (!cancelled) setGLView(() => module.GLView);
      })
      .catch((error: any) => {
        console.warn("[NfcCard3D] expo-gl did not load:", String(error?.message ?? error));
        if (!cancelled) failRef.current();
      });
    return () => {
      unmountedRef.current = true;
      cancelled = true;
      cleanupRef.current?.();
      cleanupRef.current = null;
    };
  }, []);

  // If the card has not drawn its first frame in time, it gives up and the static card stays.
  useEffect(() => {
    if (!GLView) return;
    const timer = setTimeout(() => {
      if (readyDoneRef.current) return;
      console.warn("[NfcCard3D] the 3D card did not render within", LOAD_TIMEOUT_MS, "ms");
      failRef.current();
    }, LOAD_TIMEOUT_MS);
    return () => clearTimeout(timer);
  }, [GLView]);

  // A theme change, or a switch between cards, shows the matching model at once.
  useEffect(() => {
    const scene = sceneRef.current;
    if (!scene) return;
    scene.white.visible = art === "white";
    scene.black.visible = art === "black";
    lightingRef.current?.(art);
  }, [art]);

  const onContextCreate = async (gl: any) => {
    if (startedRef.current) return;
    startedRef.current = true;
    let renderer: any = null;
    let frame = 0;
    let spinListenerId = "";
    try {
      if (INJECT_3D_FAILURE) throw new Error("Injected 3D failure (development test).");
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
      if (unmountedRef.current) return;

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
      // three.js rejects any context that is an instance of the WebGL 1 class. The expo-gl context
      // reports OpenGL ES 3.2, which is WebGL 2, so the WebGL 1 test is made to answer false.
      // The class is read here because expo-gl defines it only once it has loaded.
      const WebGL1Class = (globalThis as any).WebGLRenderingContext;
      if (typeof WebGL1Class === "function") {
        Object.defineProperty(WebGL1Class, Symbol.hasInstance, { value: () => false, configurable: true });
      }
      renderer = new THREE.WebGLRenderer({ canvas, context: gl, alpha: true, antialias: false });
      renderer.setPixelRatio(1);
      renderer.setSize(width, height, false);
      renderer.setClearColor(0x000000, 0);

      const scene = new THREE.Scene();
      const camera = new THREE.PerspectiveCamera(28, width / height, 0.01, 10);
      // The viewpoint is fitted to the reference image, so the card's perspective matches it.
      camera.position.set(0, 0.0867, 0.284);
      camera.lookAt(-0.01, 0.09, 0);

      // Light for the card that is showing: see LIGHTING_BY_CARD in cardFit.ts.
      const ambient = new THREE.AmbientLight(0xffffff);
      const key = new THREE.DirectionalLight(0xffffff);
      const fill = new THREE.DirectionalLight(0xffffff);
      scene.add(ambient, key, fill);
      const setLighting = (card: "white" | "black") => {
        const light = LIGHTING_BY_CARD[card];
        ambient.intensity = light.ambient;
        key.intensity = light.keyIntensity;
        key.position.set(light.keyPosition[0], light.keyPosition[1], light.keyPosition[2]);
        fill.intensity = light.fillIntensity;
        fill.position.set(light.fillPosition[0], light.fillPosition[1], light.fillPosition[2]);
      };
      setLighting(artRef.current);

      // Upright orientation: a 120 degree turn about (1,1,1) maps the card's long edge to
      // vertical and its face to the viewer, then a tilt about the vertical axis shows its edges.
      const axis = new THREE.Vector3(1, 1, 1).normalize();
      const upright = new THREE.Quaternion().setFromAxisAngle(axis, (2 * Math.PI) / 3);
      const yaw = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), YAW_RADIANS);
      const pitch = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1, 0, 0), PITCH_RADIANS);
      const roll = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 0, 1), ROLL_RADIANS);
      const holder = new THREE.Group();
      // Applied in this order: upright, then roll, yaw and pitch.
      holder.quaternion.copy(pitch.multiply(yaw).multiply(roll).multiply(upright));
      holder.scale.setScalar(CARD_SCALE);
      holder.add(gltf.scene);
      const pivot = new THREE.Group();
      pivot.add(holder);
      // The offset sits on the pivot, so the card turns about its own centre during a spin.
      pivot.position.set(CARD_OFFSET_X, CARD_OFFSET_Y, 0);
      scene.add(pivot);

      const white = gltf.scene.getObjectByName("NFC_Card_White");
      const black = gltf.scene.getObjectByName("NFC_Card_Black");
      if (!white || !black) throw new Error("The card model is missing a node.");
      // No rim or outline is added here. A rim scaled along the card's long edge only left grey
      // strips at the top and bottom, and each card already contrasts with its page.
      // Both cards sit at the centre; only the one for the theme is shown.
      white.position.set(0, 0, 0);
      black.position.set(0, 0, 0);
      white.visible = artRef.current === "white";
      black.visible = artRef.current === "black";
      sceneRef.current = { white, black };
      lightingRef.current = setLighting;

      // The card is drawn when the spin changes, not on a loop. The spin turns the pivot about
      // the scene's vertical axis, so it looks like a turntable.
      const draw = () => {
        frame = 0;
        if (unmountedRef.current) return;
        pivot.rotation.y = spinRef.current;
        renderer.render(scene, camera);
        gl.endFrameEXP();
      };
      const queueDraw = () => {
        if (frame !== 0 || unmountedRef.current) return;
        frame = requestAnimationFrame(draw);
      };
      spinListenerId = spin.addListener(({ value }: { value: number }) => {
        spinRef.current = (value * Math.PI) / 180;
        queueDraw();
      });
      // The first frame is drawn here, before the card reports ready.
      draw();
      cleanupRef.current = () => {
        cancelAnimationFrame(frame);
        spin.removeListener(spinListenerId);
        sceneRef.current = null;
        lightingRef.current = null;
        scene.traverse((object: any) => {
          object.geometry?.dispose();
          object.material?.dispose();
        });
        renderer.dispose();
      };
      if (unmountedRef.current) return;
      readyDoneRef.current = true;
      readyRef.current();
    } catch (error: any) {
      console.warn("[NfcCard3D] setup failed:", String(error?.message ?? error));
      cancelAnimationFrame(frame);
      if (spinListenerId) spin.removeListener(spinListenerId);
      sceneRef.current = null;
      renderer?.dispose();
      if (!unmountedRef.current) failRef.current();
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
