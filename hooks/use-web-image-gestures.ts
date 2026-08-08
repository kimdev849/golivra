import { useEffect } from 'react';
import { Dimensions, Platform } from 'react-native';
import { withTiming } from 'react-native-reanimated';

type SharedValue<T> = { value: T };

const MIN_SCALE = 1;
const MAX_SCALE = 5;
const DOUBLE_TAP_SCALE = 2.5;
const CLOSE_DRAG_THRESHOLD = 110;

function clamp(v: number, min: number, max: number): number {
  return Math.min(Math.max(v, min), max);
}

/** Récupère le nœud DOM d'une Animated.View sur react-native-web. */
function getDomNode(ref: { current: unknown } | null): HTMLElement | null {
  const el = ref?.current as { node?: HTMLElement } | HTMLElement | null | undefined;
  if (!el) return null;
  if (typeof el === 'object' && 'node' in el && el.node) return el.node;
  return el as HTMLElement | null;
}

export type WebImageGestureOptions = {
  /** Réf de la vue animée à laquelle attacher les écouteurs (web uniquement). */
  ref: { current: unknown } | null;
  /** Actif uniquement quand la visionneuse est visible. */
  enabled: boolean;
  scale: SharedValue<number>;
  savedScale: SharedValue<number>;
  translateX: SharedValue<number>;
  translateY: SharedValue<number>;
  savedX: SharedValue<number>;
  savedY: SharedValue<number>;
  onClose: () => void;
  /** Laisse passer les glissements horizontaux (pagination d'une galerie). */
  allowHorizontalPageSwipe?: boolean;
  /** Galerie : la molette change de photo tant que l'image n'est pas zoomée. */
  wheelToPage?: (direction: 1 | -1) => void;
};

/**
 * Gestes de zoom pour le web, où react-native-gesture-handler est peu fiable
 * à l'intérieur des Modal :
 *
 *  - double-clic : zoom 1x ↔ 2.5x centré sur le curseur
 *  - molette : zoom continu (y compris le pincement tactile Cmd/Ctrl + molette)
 *  - glisser (souris ou doigt) : déplacement quand l'image est zoomée ;
 *    tirer vers le bas (hors zoom) ferme la visionneuse
 *
 * Les valeurs animées Reanimated sont écrites depuis le thread JS : c'est
 * supporté et, sur le web, tout s'exécute sur le thread JS de toute façon.
 */
export function useWebImageGestures({
  ref,
  enabled,
  scale,
  savedScale,
  translateX,
  translateY,
  savedX,
  savedY,
  onClose,
  allowHorizontalPageSwipe = false,
  wheelToPage,
}: WebImageGestureOptions): void {
  useEffect(() => {
    if (Platform.OS !== 'web' || !enabled) return;
    const el = getDomNode(ref);
    if (!el) return;

    let dragging = false;
    let startX = 0;
    let startY = 0;
    let mode: 'idle' | 'pan' | 'dismiss' = 'idle';

    // Arbitration : zoomé → on capture tout ; sinon on laisse la galerie
    // défiler horizontalement et on ne gère que le glissement vertical.
    const syncTouchAction = () => {
      el.style.touchAction =
        scale.value > 1.02 ? 'none' : allowHorizontalPageSwipe ? 'pan-x' : 'none';
    };
    syncTouchAction();

    const resetTranslation = () => {
      translateX.value = withTiming(0, { duration: 200 });
      translateY.value = withTiming(0, { duration: 200 });
      savedX.value = 0;
      savedY.value = 0;
    };

    const applyZoom = (next: number, cx: number, cy: number) => {
      const { width, height } = Dimensions.get('window');
      const s = clamp(next, MIN_SCALE, MAX_SCALE);
      const focalX = cx - width / 2;
      const focalY = cy - height / 2;
      scale.value = s;
      savedScale.value = s;
      translateX.value = s > 1.02 ? clamp(-focalX, -width / 2, width / 2) : 0;
      translateY.value = s > 1.02 ? clamp(-focalY, -height / 2, height / 2) : 0;
      savedX.value = translateX.value;
      savedY.value = translateY.value;
      syncTouchAction();
    };

    const onDblClick = (e: MouseEvent) => {
      if (scale.value > 1.02) applyZoom(MIN_SCALE, 0, 0);
      else applyZoom(DOUBLE_TAP_SCALE, e.clientX, e.clientY);
    };

    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      // Galerie : tant que l'image n'est pas zoomée, la molette change de photo.
      if (scale.value <= 1.02 && wheelToPage) {
        wheelToPage(e.deltaY > 0 ? 1 : -1);
        return;
      }
      const factor = Math.exp(-e.deltaY * 0.0016);
      applyZoom(scale.value * factor, e.clientX, e.clientY);
    };

    const beginDrag = (x: number, y: number) => {
      dragging = true;
      startX = x;
      startY = y;
      mode = 'idle';
    };

    const moveDrag = (x: number, y: number) => {
      if (!dragging) return;
      const dx = x - startX;
      const dy = y - startY;
      const { width, height } = Dimensions.get('window');

      if (scale.value <= 1.02) {
        // Hors zoom : glissement surtout horizontal → on laisse la galerie défiler.
        if (allowHorizontalPageSwipe && Math.abs(dx) > Math.abs(dy) * 1.15) {
          mode = 'idle';
          return;
        }
        mode = 'dismiss';
        translateX.value = savedX.value + dx * 0.3;
        translateY.value = savedY.value + dy;
        return;
      }

      mode = 'pan';
      const maxX = (width * (scale.value - 1)) / 2;
      const maxY = (height * (scale.value - 1)) / 2;
      translateX.value = clamp(savedX.value + dx, -maxX, maxX);
      translateY.value = clamp(savedY.value + dy, -maxY, maxY);
    };

    const endDrag = (x: number, y: number) => {
      if (!dragging) return;
      dragging = false;
      const dy = y - startY;
      if (mode === 'dismiss') {
        if (dy > CLOSE_DRAG_THRESHOLD) {
          onClose();
          return;
        }
        resetTranslation();
      } else if (mode === 'pan') {
        savedX.value = translateX.value;
        savedY.value = translateY.value;
      }
      mode = 'idle';
      syncTouchAction();
    };

    const cancelDrag = () => {
      if (!dragging) return;
      dragging = false;
      if (mode === 'pan') {
        savedX.value = translateX.value;
        savedY.value = translateY.value;
      } else if (mode === 'dismiss') {
        resetTranslation();
      }
      mode = 'idle';
      syncTouchAction();
    };

    const onMouseDown = (e: MouseEvent) => {
      if (e.button !== 0) return;
      e.preventDefault();
      beginDrag(e.clientX, e.clientY);
    };
    const onMouseMove = (e: MouseEvent) => moveDrag(e.clientX, e.clientY);
    const onMouseUp = (e: MouseEvent) => endDrag(e.clientX, e.clientY);
    const onMouseLeave = () => cancelDrag();

    const onTouchStart = (e: TouchEvent) => {
      if (e.touches.length !== 1) return;
      beginDrag(e.touches[0].clientX, e.touches[0].clientY);
    };
    const onTouchMove = (e: TouchEvent) => {
      if (e.touches.length !== 1) return;
      const touch = e.touches[0];
      const dx = touch.clientX - startX;
      const dy = touch.clientY - startY;
      const vertical = Math.abs(dy) > Math.abs(dx) * 1.15;
      const zoomed = scale.value > 1.02;
      // On bloque le scroll du navigateur uniquement quand on gère nous-mêmes.
      if (vertical || zoomed) e.preventDefault();
      moveDrag(touch.clientX, touch.clientY);
    };
    const onTouchEnd = (e: TouchEvent) => {
      const t = e.changedTouches[0];
      if (!t) return;
      endDrag(t.clientX, t.clientY);
    };
    const onTouchCancel = () => cancelDrag();

    el.addEventListener('dblclick', onDblClick);
    el.addEventListener('wheel', onWheel, { passive: false });
    el.addEventListener('mousedown', onMouseDown);
    el.addEventListener('mousemove', onMouseMove);
    el.addEventListener('mouseup', onMouseUp);
    el.addEventListener('mouseleave', onMouseLeave);
    el.addEventListener('touchstart', onTouchStart, { passive: true });
    el.addEventListener('touchmove', onTouchMove, { passive: false });
    el.addEventListener('touchend', onTouchEnd, { passive: true });
    el.addEventListener('touchcancel', onTouchCancel, { passive: true });

    return () => {
      el.removeEventListener('dblclick', onDblClick);
      el.removeEventListener('wheel', onWheel);
      el.removeEventListener('mousedown', onMouseDown);
      el.removeEventListener('mousemove', onMouseMove);
      el.removeEventListener('mouseup', onMouseUp);
      el.removeEventListener('mouseleave', onMouseLeave);
      el.removeEventListener('touchstart', onTouchStart);
      el.removeEventListener('touchmove', onTouchMove);
      el.removeEventListener('touchend', onTouchEnd);
      el.removeEventListener('touchcancel', onTouchCancel);
      el.style.touchAction = '';
    };
  }, [
    ref,
    enabled,
    scale,
    savedScale,
    translateX,
    translateY,
    savedX,
    savedY,
    onClose,
    allowHorizontalPageSwipe,
    wheelToPage,
  ]);
}
