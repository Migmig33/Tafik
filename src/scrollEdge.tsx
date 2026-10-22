import { useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { Animated, StyleSheet } from "react-native";
import Svg, { Defs, LinearGradient, Rect, Stop } from "react-native-svg";
import { BAR_TOP, FADE_RISE_ABOVE_BAR, TabBarBelowContext } from "./tabBar";
import { MOTION } from "./motion";
import { colors, SCREEN_GUTTER, space } from "./theme";

// Within this many pixels of the end the page counts as read to the bottom, so
// rounding in the scroll position cannot leave the fade stuck on.
const SLOP = 8;

// The fade is one continuous linear gradient drawn with react-native-svg, which
// is already a direct dependency and already in the native build. Its opacity
// eases in, so the transition has no visible steps. It is a gradient, not a blur.
// The gradient is drawn over the whole fade. On tab screens the bottom of that
// region sits behind the bar, so the visible part is only the top of the
// gradient. The ramp therefore ends where the bar begins, and everything below
// that point is fully opaque and hidden by the bar. `rampEnd` is that point as a
// fraction of the fade's height, measured from its top.
// The darkest the fade gets. Below full black, so it reads as a shade on the
// content rather than a flat block of colour.
const PEAK_OPACITY = 0.96;

// An S-curve: no change at the start, a steady middle, and a settle at the end.
// That keeps the top of the fade invisible and avoids a visible edge where it begins.
function smoothstep(t: number) {
  return t * t * (3 - 2 * t);
}

function stopsFor(rampEnd: number) {
  return Array.from({ length: 21 }, (_, index) => {
    const offset = index / 20;
    const along = Math.min(1, offset / rampEnd);
    // A steady rise plus the S-curve: the top stays faint and the bottom reads as shade.
    return { offset, opacity: PEAK_OPACITY * (0.25 * along + 0.75 * smoothstep(along)) };
  });
}

const TAB_FADE_HEIGHT = BAR_TOP + FADE_RISE_ABOVE_BAR;
const TAB_STOPS = stopsFor(FADE_RISE_ABOVE_BAR / TAB_FADE_HEIGHT);
const PAGE_STOPS = stopsFor(1);

/**
 * Tracks whether more content lies below the viewport. It reads the real
 * viewport height, content height and scroll offset, and reports only when the
 * answer changes, so scrolling does not re-render the page on every frame.
 *
 * Spread `scrollProps` onto a ScrollView or FlatList, and render
 * `ScrollEdgeFade` beside it in a flex wrapper.
 */
export function useScrollEdge() {
  const viewport = useRef(0);
  const content = useRef(0);
  const offset = useRef(0);
  const [visible, setVisible] = useState(false);

  const update = useCallback(() => {
    const height = viewport.current;
    // Nothing to compare against until the viewport has been measured.
    if (height === 0) return;
    const more =
      content.current > height + SLOP && offset.current + height < content.current - SLOP;
    setVisible(more);
  }, []);

  const scrollProps = useMemo(
    () => ({
      onLayout: (event: { nativeEvent: { layout: { height: number } } }) => {
        viewport.current = event.nativeEvent.layout.height;
        update();
      },
      onContentSizeChange: (_width: number, height: number) => {
        content.current = height;
        update();
      },
      onScroll: (event: { nativeEvent: { contentOffset: { y: number } } }) => {
        offset.current = event.nativeEvent.contentOffset.y;
        update();
      },
      scrollEventThrottle: 16,
    }),
    [update]
  );

  return { visible, scrollProps };
}

/**
 * The bottom-edge fade. It fades in when more content sits below and out at the
 * end of the list. It is a sibling of the scroll view, positioned over the
 * viewport's bottom edge, and it never takes touches, so scrolling and taps on
 * the content underneath are unaffected.
 */
export function ScrollEdgeFade({
  visible,
  color = colors.bg,
  bleed = SCREEN_GUTTER,
}: {
  visible: boolean;
  /** The surface the fade blends into: the page background, or a card's fill. */
  color?: string;
  /** How far the fade reaches past the scroll viewport on each side. Zero keeps it inside a card. */
  bleed?: number;
}) {
  const opacity = useRef(new Animated.Value(0)).current;
  const tabBarBelow = useContext(TabBarBelowContext);

  useEffect(() => {
    const change = Animated.timing(opacity, {
      toValue: visible ? 1 : 0,
      duration: MOTION.fade,
      easing: MOTION.ease,
      useNativeDriver: true,
    });
    change.start();
    return () => change.stop();
  }, [opacity, visible]);

  return (
    <Animated.View
      pointerEvents="none"
      style={[styles.fade, placement(tabBarBelow), { left: -bleed, right: -bleed, opacity }]}
    >
      <Svg width="100%" height="100%">
        <Defs>
          <LinearGradient id="scrollEdgeFade" x1="0" y1="0" x2="0" y2="1">
            {(tabBarBelow ? TAB_STOPS : PAGE_STOPS).map((stop) => (
              <Stop key={stop.offset} offset={stop.offset} stopColor={color} stopOpacity={stop.opacity} />
            ))}
          </LinearGradient>
        </Defs>
        <Rect x="0" y="0" width="100%" height="100%" fill="url(#scrollEdgeFade)" />
      </Svg>
    </Animated.View>
  );
}

/**
 * Where the fade sits, measured from the bottom of the scroll viewport. On tab
 * screens the viewport runs to the bottom of the phone, and the bar floats over
 * it. The fade therefore starts at the bar's top edge and rises through the
 * gap that used to be padding and rise, so it is never hidden under the bar.
 * Elsewhere it covers the screen's own bottom padding and ends at the phone's edge.
 */
function placement(tabBarBelow: boolean) {
  if (tabBarBelow) return { bottom: 0, height: TAB_FADE_HEIGHT };
  // Elsewhere the fade covers the screen's bottom padding and ends at the phone's edge.
  return { bottom: -space(3), height: space(4) + space(3) };
}

const styles = StyleSheet.create({
  fade: {
    position: "absolute",
    left: 0,
    right: 0,
  },
});
