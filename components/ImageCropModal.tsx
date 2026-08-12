import React, { useEffect, useState, useCallback } from 'react';
import {
  Modal,
  View,
  Image,
  Text,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  type LayoutChangeEvent,
} from 'react-native';
import {
  Gesture,
  GestureDetector,
  GestureHandlerRootView,
} from 'react-native-gesture-handler';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
} from 'react-native-reanimated';
import { manipulateAsync, SaveFormat } from 'expo-image-manipulator';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

/* ─── Props ─── */
interface ImageCropModalProps {
  visible: boolean;
  imageUri: string;
  /** Width / height (e.g. 3 for logo = 3:1, 3.5 for signature = 3.5:1) */
  aspectRatio: number;
  onCancel: () => void;
  onCropComplete: (croppedUri: string) => void;
}

/* ─── Constants ─── */
const ACCENT = '#F97316';
const OVERLAY_COLOR = 'rgba(0,0,0,0.6)';
const HANDLE_HIT_SLOP = 44; // touch target radius for corner detection
const CORNER_LEN = 24; // visual bracket arm length
const CORNER_THICK = 3; // visual bracket arm thickness
const MIN_CROP_W = 60; // smallest crop width in screen points

export default function ImageCropModal({
  visible,
  imageUri,
  aspectRatio,
  onCancel,
  onCropComplete,
}: ImageCropModalProps) {
  const insets = useSafeAreaInsets();

  /* ── local state ── */
  const [imageNativeW, setImageNativeW] = useState(0);
  const [imageNativeH, setImageNativeH] = useState(0);
  const [containerW, setContainerW] = useState(0);
  const [containerH, setContainerH] = useState(0);
  const [ready, setReady] = useState(false);
  const [processing, setProcessing] = useState(false);

  /* ── shared values: crop frame ── */
  const cropX = useSharedValue(0);
  const cropY = useSharedValue(0);
  const cropW = useSharedValue(100);
  const cropH = useSharedValue(100);

  /* ── shared values: displayed-image bounds (for worklet access) ── */
  const dispX = useSharedValue(0);
  const dispY = useSharedValue(0);
  const dispW = useSharedValue(0);
  const dispH = useSharedValue(0);

  /* ── shared values: gesture bookkeeping ── */
  const gMode = useSharedValue('none'); // 'none'|'move'|'tl'|'tr'|'bl'|'br'
  const sX = useSharedValue(0); // saved cropX at gesture start
  const sY = useSharedValue(0);
  const sW = useSharedValue(0);
  const sH = useSharedValue(0);

  /* ──────────────────────────────────────────────
   * 1. Load image native pixel dimensions
   * ──────────────────────────────────────────── */
  useEffect(() => {
    if (!visible || !imageUri) return;
    setReady(false);
    setProcessing(false);
    setImageNativeW(0);
    setImageNativeH(0);
    Image.getSize(
      imageUri,
      (w, h) => {
        setImageNativeW(w);
        setImageNativeH(h);
      },
      () => {
        setImageNativeW(0);
        setImageNativeH(0);
      },
    );
  }, [visible, imageUri]);

  /* ──────────────────────────────────────────────
   * 2. Calculate displayed-image bounds (aspect-fit)
   *    & initialise the crop frame
   * ──────────────────────────────────────────── */
  useEffect(() => {
    if (!containerW || !containerH || !imageNativeW || !imageNativeH) return;

    // Aspect-fit: fit the image inside the container preserving its ratio
    const imgAR = imageNativeW / imageNativeH;
    let dW: number;
    let dH: number;
    if (imgAR > containerW / containerH) {
      // Image is wider → constrain by width
      dW = containerW;
      dH = containerW / imgAR;
    } else {
      // Image is taller → constrain by height
      dH = containerH;
      dW = containerH * imgAR;
    }
    const oX = (containerW - dW) / 2;
    const oY = (containerH - dH) / 2;

    // Write display bounds into shared values (worklet-accessible)
    dispX.value = oX;
    dispY.value = oY;
    dispW.value = dW;
    dispH.value = dH;

    // Initial crop: largest rectangle of target aspectRatio that fits the
    // displayed image, scaled to 90 % for visual breathing room.
    const displayedAR = dW / dH;
    let initW: number;
    let initH: number;
    if (aspectRatio > displayedAR) {
      initW = dW;
      initH = initW / aspectRatio;
    } else {
      initH = dH;
      initW = initH * aspectRatio;
    }
    initW *= 0.9;
    initH *= 0.9;

    cropX.value = oX + (dW - initW) / 2;
    cropY.value = oY + (dH - initH) / 2;
    cropW.value = initW;
    cropH.value = initH;

    setReady(true);
  }, [containerW, containerH, imageNativeW, imageNativeH, aspectRatio]);

  /* ──────────────────────────────────────────────
   * 3. Worklet helpers
   * ──────────────────────────────────────────── */
  const minW = MIN_CROP_W;
  const minH = MIN_CROP_W / aspectRatio;

  const clamp = (v: number, lo: number, hi: number): number => {
    'worklet';
    return Math.min(Math.max(v, lo), hi);
  };

  /* ──────────────────────────────────────────────
   * 4. Pan gesture (move / corner-resize)
   * ──────────────────────────────────────────── */
  const pan = Gesture.Pan()
    .minDistance(0)
    .onBegin((e) => {
      'worklet';
      const { x, y } = e;
      const cx = cropX.value;
      const cy = cropY.value;
      const cw = cropW.value;
      const ch = cropH.value;
      const H = HANDLE_HIT_SLOP;

      // Proximity to each edge of the crop frame
      const nearL = Math.abs(x - cx) < H;
      const nearR = Math.abs(x - (cx + cw)) < H;
      const nearT = Math.abs(y - cy) < H;
      const nearB = Math.abs(y - (cy + ch)) < H;

      if (nearL && nearT) gMode.value = 'tl';
      else if (nearR && nearT) gMode.value = 'tr';
      else if (nearL && nearB) gMode.value = 'bl';
      else if (nearR && nearB) gMode.value = 'br';
      else if (x >= cx && x <= cx + cw && y >= cy && y <= cy + ch)
        gMode.value = 'move';
      else gMode.value = 'none';

      sX.value = cx;
      sY.value = cy;
      sW.value = cw;
      sH.value = ch;
    })
    .onUpdate((e) => {
      'worklet';
      const tx = e.translationX;
      const ty = e.translationY;
      const m = gMode.value;

      // Image display boundaries
      const iL = dispX.value;
      const iT = dispY.value;
      const iR = iL + dispW.value;
      const iB = iT + dispH.value;

      /* ── Move ── */
      if (m === 'move') {
        cropX.value = clamp(sX.value + tx, iL, iR - sW.value);
        cropY.value = clamp(sY.value + ty, iT, iB - sH.value);
        return;
      }

      /* ── Corner resize (aspect-ratio locked) ──
       * Strategy: use horizontal translation to compute new width,
       * derive height from aspect ratio, then clamp both dimensions
       * to stay inside the displayed image. The "anchor" is the
       * opposite corner which stays fixed. */

      if (m === 'br') {
        // Anchor = top-left (sX, sY)
        let nw = clamp(sW.value + tx, minW, iR - sX.value);
        let nh = nw / aspectRatio;
        if (nh > iB - sY.value) {
          nh = iB - sY.value;
          nw = nh * aspectRatio;
        }
        if (nh < minH) {
          nh = minH;
          nw = nh * aspectRatio;
        }
        cropW.value = nw;
        cropH.value = nh;
        // cropX, cropY unchanged
      } else if (m === 'tl') {
        // Anchor = bottom-right
        const aR = sX.value + sW.value;
        const aB = sY.value + sH.value;
        let nw = clamp(sW.value - tx, minW, aR - iL);
        let nh = nw / aspectRatio;
        if (nh > aB - iT) {
          nh = aB - iT;
          nw = nh * aspectRatio;
        }
        if (nh < minH) {
          nh = minH;
          nw = nh * aspectRatio;
        }
        cropX.value = aR - nw;
        cropY.value = aB - nh;
        cropW.value = nw;
        cropH.value = nh;
      } else if (m === 'tr') {
        // Anchor = bottom-left (sX stays, sY+sH = anchor bottom)
        const aB = sY.value + sH.value;
        let nw = clamp(sW.value + tx, minW, iR - sX.value);
        let nh = nw / aspectRatio;
        if (nh > aB - iT) {
          nh = aB - iT;
          nw = nh * aspectRatio;
        }
        if (nh < minH) {
          nh = minH;
          nw = nh * aspectRatio;
        }
        cropY.value = aB - nh;
        cropW.value = nw;
        cropH.value = nh;
        // cropX unchanged
      } else if (m === 'bl') {
        // Anchor = top-right
        const aR = sX.value + sW.value;
        let nw = clamp(sW.value - tx, minW, aR - iL);
        let nh = nw / aspectRatio;
        if (nh > iB - sY.value) {
          nh = iB - sY.value;
          nw = nh * aspectRatio;
        }
        if (nh < minH) {
          nh = minH;
          nw = nh * aspectRatio;
        }
        cropX.value = aR - nw;
        cropW.value = nw;
        cropH.value = nh;
        // cropY unchanged
      }
    })
    .onEnd(() => {
      'worklet';
      gMode.value = 'none';
    });

  /* ──────────────────────────────────────────────
   * 5. Animated styles — dark overlay cutout
   *    4 rectangles surrounding the crop frame
   *
   *    ┌───────────────────┐
   *    │     TOP           │
   *    ├──┬──────────┬─────┤
   *    │ L│ (crop)   │  R  │
   *    ├──┴──────────┴─────┤
   *    │    BOTTOM         │
   *    └───────────────────┘
   * ──────────────────────────────────────────── */
  const topOvl = useAnimatedStyle(() => ({
    position: 'absolute' as const,
    top: 0,
    left: 0,
    right: 0,
    height: Math.max(0, cropY.value),
    backgroundColor: OVERLAY_COLOR,
  }));
  const bottomOvl = useAnimatedStyle(() => ({
    position: 'absolute' as const,
    left: 0,
    right: 0,
    top: cropY.value + cropH.value,
    bottom: 0,
    backgroundColor: OVERLAY_COLOR,
  }));
  const leftOvl = useAnimatedStyle(() => ({
    position: 'absolute' as const,
    left: 0,
    top: cropY.value,
    width: Math.max(0, cropX.value),
    height: cropH.value,
    backgroundColor: OVERLAY_COLOR,
  }));
  const rightOvl = useAnimatedStyle(() => ({
    position: 'absolute' as const,
    top: cropY.value,
    left: cropX.value + cropW.value,
    right: 0,
    height: cropH.value,
    backgroundColor: OVERLAY_COLOR,
  }));

  /* ── Crop frame position / size ── */
  const frameStyle = useAnimatedStyle(() => ({
    position: 'absolute' as const,
    left: cropX.value,
    top: cropY.value,
    width: cropW.value,
    height: cropH.value,
  }));

  /* ──────────────────────────────────────────────
   * 6. "Done" — perform actual crop
   * ──────────────────────────────────────────── */
  const handleDone = useCallback(async () => {
    if (processing) return;
    setProcessing(true);
    try {
      const dX = dispX.value;
      const dY = dispY.value;
      const dW = dispW.value;
      const dH = dispH.value;

      // Scale from screen points → image native pixels
      const scaleX = imageNativeW / dW;
      const scaleY = imageNativeH / dH;

      // Crop rectangle relative to the displayed image's origin
      const originX = Math.max(0, Math.round((cropX.value - dX) * scaleX));
      const originY = Math.max(0, Math.round((cropY.value - dY) * scaleY));
      const width = Math.min(
        imageNativeW - originX,
        Math.round(cropW.value * scaleX),
      );
      const height = Math.min(
        imageNativeH - originY,
        Math.round(cropH.value * scaleY),
      );

      const result = await manipulateAsync(
        imageUri,
        [{ crop: { originX, originY, width, height } }],
        { compress: 0.8, format: SaveFormat.JPEG },
      );

      onCropComplete(result.uri);
    } catch (err) {
      console.error('ImageCropModal – crop failed:', err);
    } finally {
      setProcessing(false);
    }
  }, [imageUri, imageNativeW, imageNativeH, processing, onCropComplete]);

  /* ──────────────────────────────────────────────
   * 7. Layout callback
   * ──────────────────────────────────────────── */
  const onContainerLayout = useCallback((e: LayoutChangeEvent) => {
    const { width, height } = e.nativeEvent.layout;
    setContainerW(width);
    setContainerH(height);
  }, []);

  /* ──────────────────────────────────────────────
   * 8. Render
   * ──────────────────────────────────────────── */
  const ratioLabel =
    aspectRatio >= 1
      ? `${aspectRatio}:1`
      : `1:${(1 / aspectRatio).toFixed(1)}`;

  return (
    <Modal visible={visible} animationType="slide" statusBarTranslucent>
      <GestureHandlerRootView
        style={[styles.root, { paddingTop: insets.top }]}
      >
        {/* ── Header ── */}
        <View style={styles.header}>
          <Text style={styles.headerTitle}>Crop Image</Text>
          <Text style={styles.headerRatio}>{ratioLabel}</Text>
        </View>

        {/* ── Image + crop overlay ── */}
        <View style={styles.container} onLayout={onContainerLayout}>
          {imageUri ? (
            <Image
              source={{ uri: imageUri }}
              style={StyleSheet.absoluteFill}
              resizeMode="contain"
            />
          ) : null}

          {ready ? (
            <GestureDetector gesture={pan}>
              <Animated.View style={StyleSheet.absoluteFill} collapsable={false}>
                {/* Dark overlay cutout */}
                <Animated.View style={topOvl} pointerEvents="none" />
                <Animated.View style={bottomOvl} pointerEvents="none" />
                <Animated.View style={leftOvl} pointerEvents="none" />
                <Animated.View style={rightOvl} pointerEvents="none" />

                {/* Crop frame */}
                <Animated.View style={frameStyle} pointerEvents="none">
                  {/* Thin border */}
                  <View style={styles.frameBorder}>
                    {/* Rule-of-thirds grid */}
                    <View
                      style={[styles.gridH, { top: '33.33%' as unknown as number }]}
                    />
                    <View
                      style={[styles.gridH, { top: '66.66%' as unknown as number }]}
                    />
                    <View
                      style={[styles.gridV, { left: '33.33%' as unknown as number }]}
                    />
                    <View
                      style={[styles.gridV, { left: '66.66%' as unknown as number }]}
                    />
                  </View>

                  {/* ── Corner brackets ── */}
                  {/* Top-Left */}
                  <View style={[styles.cornerWrap, { top: -1, left: -1 }]}>
                    <View style={[styles.cH, { top: 0, left: 0 }]} />
                    <View style={[styles.cV, { top: 0, left: 0 }]} />
                  </View>
                  {/* Top-Right */}
                  <View style={[styles.cornerWrap, { top: -1, right: -1 }]}>
                    <View style={[styles.cH, { top: 0, right: 0 }]} />
                    <View style={[styles.cV, { top: 0, right: 0 }]} />
                  </View>
                  {/* Bottom-Left */}
                  <View style={[styles.cornerWrap, { bottom: -1, left: -1 }]}>
                    <View style={[styles.cH, { bottom: 0, left: 0 }]} />
                    <View style={[styles.cV, { bottom: 0, left: 0 }]} />
                  </View>
                  {/* Bottom-Right */}
                  <View style={[styles.cornerWrap, { bottom: -1, right: -1 }]}>
                    <View style={[styles.cH, { bottom: 0, right: 0 }]} />
                    <View style={[styles.cV, { bottom: 0, right: 0 }]} />
                  </View>
                </Animated.View>
              </Animated.View>
            </GestureDetector>
          ) : imageUri ? (
            <View style={styles.loadingOverlay}>
              <ActivityIndicator color={ACCENT} size="large" />
            </View>
          ) : null}
        </View>

        {/* ── Bottom action bar ── */}
        <View
          style={[styles.actionBar, { paddingBottom: Math.max(insets.bottom, 16) }]}
        >
          <TouchableOpacity
            onPress={onCancel}
            style={styles.cancelBtn}
            activeOpacity={0.7}
          >
            <Text style={styles.cancelText}>Cancel</Text>
          </TouchableOpacity>

          <TouchableOpacity
            onPress={handleDone}
            style={[styles.doneBtn, processing && styles.doneBtnDisabled]}
            disabled={processing || !ready}
            activeOpacity={0.8}
          >
            {processing ? (
              <ActivityIndicator color="#fff" size="small" />
            ) : (
              <Text style={styles.doneText}>Done</Text>
            )}
          </TouchableOpacity>
        </View>
      </GestureHandlerRootView>
    </Modal>
  );
}

/* ─── Styles ─── */
const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: '#111',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 14,
  },
  headerTitle: {
    color: '#fff',
    fontSize: 17,
    fontWeight: '600',
  },
  headerRatio: {
    color: 'rgba(255,255,255,0.45)',
    fontSize: 13,
    fontWeight: '500',
  },
  container: {
    flex: 1,
    overflow: 'hidden',
  },
  loadingOverlay: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(0,0,0,0.3)',
  },
  /* crop frame */
  frameBorder: {
    flex: 1,
    borderWidth: 1.5,
    borderColor: ACCENT,
    overflow: 'hidden',
  },
  /* rule-of-thirds grid */
  gridH: {
    position: 'absolute',
    left: 0,
    right: 0,
    height: StyleSheet.hairlineWidth,
    backgroundColor: 'rgba(255,255,255,0.25)',
  },
  gridV: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    width: StyleSheet.hairlineWidth,
    backgroundColor: 'rgba(255,255,255,0.25)',
  },
  /* corner bracket wrapper */
  cornerWrap: {
    position: 'absolute',
    width: CORNER_LEN,
    height: CORNER_LEN,
  },
  cH: {
    position: 'absolute',
    width: CORNER_LEN,
    height: CORNER_THICK,
    backgroundColor: ACCENT,
    borderRadius: 1,
  },
  cV: {
    position: 'absolute',
    width: CORNER_THICK,
    height: CORNER_LEN,
    backgroundColor: ACCENT,
    borderRadius: 1,
  },
  /* action bar */
  actionBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: 16,
    backgroundColor: '#111',
  },
  cancelBtn: {
    paddingVertical: 12,
    paddingHorizontal: 16,
  },
  cancelText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '500',
  },
  doneBtn: {
    backgroundColor: ACCENT,
    paddingVertical: 12,
    paddingHorizontal: 28,
    borderRadius: 10,
    minWidth: 90,
    alignItems: 'center',
  },
  doneBtnDisabled: {
    opacity: 0.6,
  },
  doneText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '700',
  },
});
