import { useCallback, useEffect, useLayoutEffect, useRef } from "react";
import type { Row } from "./client.ts";
import {
  findPositionArrival,
  type ArrivalCriteria,
  type ArrivalRequest,
  type ArrivalRow,
} from "./position-arrival.ts";
import "./acid-position-arrival.css";

type PendingArrival = ArrivalRequest & {
  source: DOMRect;
  sourceButton: HTMLButtonElement;
};
type TrackedAnimation = { animation: Animation; restore: () => void };

const motionAllowed = () =>
  document.visibilityState === "visible" &&
  !window.matchMedia("(prefers-reduced-motion: reduce)").matches;

/** Animates confirmed arrivals and cards moving into history after their story.
 * Price changes never reorder this list or start a movement animation. */
export function usePositionArrival(
  positions: readonly Row[],
  snapshotAgeMs: number | null | undefined,
) {
  const listRef = useRef<HTMLElement>(null);
  const rowsRef = useRef(positions);
  rowsRef.current = positions;
  const pending = useRef<PendingArrival | null>(null);
  const oldTops = useRef(new Map<string, number>());
  const previousOrder = useRef<string | null>(null);
  const animations = useRef(new Set<TrackedAnimation>());
  const timer = useRef<ReturnType<typeof setTimeout>>();

  const stopTimer = useCallback(() => {
    if (timer.current !== undefined) clearTimeout(timer.current);
    timer.current = undefined;
  }, []);
  const stopAnimations = useCallback(() => {
    for (const item of [...animations.current]) {
      // Cancellation events are asynchronous. Do not let an old callback
      // remove a motion class from the next animation on the same article.
      item.animation.oncancel = null;
      item.animation.onfinish = null;
      item.animation.cancel();
      item.restore();
    }
    animations.current.clear();
  }, []);
  const cancel = useCallback(() => {
    pending.current = null;
    stopTimer();
    stopAnimations();
  }, [stopTimer, stopAnimations]);

  const begin = useCallback(
    (sourceButton: HTMLButtonElement, criteria: ArrivalCriteria) => {
      cancel();
      if (!motionAllowed()) return;
      pending.current = {
        source: sourceButton.getBoundingClientRect(),
        sourceButton,
        criteria: { ...criteria },
        existingKeys: new Set(rowsRef.current.map((row) => row.key)),
        startedAt: Date.now(),
      };
    },
    [cancel],
  );

  const finish = useCallback(() => {
    // The signature can confirm before the shared snapshot refresh. Do not
    // fabricate a row, or keep the trading controls waiting for the animation.
    if (!pending.current) return;
    stopTimer();
    timer.current = setTimeout(() => {
      pending.current = null;
      timer.current = undefined;
    }, 15_000);
  }, [stopTimer]);

  useLayoutEffect(() => {
    const list = listRef.current;
    if (!list) return;
    // Price/clock updates do not move cards. Reading offsetTop on those renders
    // forces layout after every price text mutation across the entire history.
    const inputOrder = positions.map(position => position.key).join('|');
    if (previousOrder.current === inputOrder && !pending.current) return;
    const elements = [
      ...list.querySelectorAll<HTMLElement>(":scope > [data-position-key]"),
    ];
    const order = elements
      .map((element) => element.dataset.positionKey)
      .join("|");
    const nextTops = new Map(
      elements.map((element) => [
        element.dataset.positionKey!,
        element.offsetTop,
      ]),
    );
    const request = pending.current;
    const match = request
      ? findPositionArrival(positions as ArrivalRow[], request, snapshotAgeMs)
      : undefined;
    const target = match
      ? elements.find((element) => element.dataset.positionKey === match.key)
      : undefined;

    // offsetTop excludes animated transforms. Price stream renders therefore
    // cannot corrupt the resting geometry used by a later insertion.
    const previous = oldTops.current;
    const hadHistory = previousOrder.current !== null;
    const orderChanged = previousOrder.current !== order;
    oldTops.current = nextTops;
    previousOrder.current = order;
    if (!hadHistory || (!orderChanged && !target)) return;
    if (target) {
      pending.current = null;
      stopTimer();
    }
    if (!motionAllowed() || !elements.some((element) => typeof element.animate === "function")) return;
    stopAnimations();

    const track = (
      element: HTMLElement,
      keyframes: Keyframe[],
      options: KeyframeAnimationOptions,
      arrival = false,
    ) => {
      const oldZ = element.style.zIndex;
      const motionClass = arrival ? "position-arriving" : "position-reordering";
      element.classList.add(motionClass);
      if (arrival) {
        element.style.zIndex = "8";
      }
      const animation = element.animate(keyframes, options);
      const item: TrackedAnimation = {
        animation,
        restore: () => {
          element.classList.remove(motionClass);
          if (arrival) {
            element.style.zIndex = oldZ;
          }
          animations.current.delete(item);
        },
      };
      animations.current.add(item);
      animation.onfinish = item.restore;
      animation.oncancel = item.restore;
    };

    if (orderChanged) {
      for (const element of elements) {
        if (element === target) continue;
        const before = previous.get(element.dataset.positionKey!);
        if (before === undefined) continue;
        const delta = before - element.offsetTop;
        if (Math.abs(delta) < 1) continue;
        const bounds = element.getBoundingClientRect();
        // Avoid promoting off-screen history cards to compositor layers.
        if (
          (bounds.bottom < 0 && bounds.bottom + delta < 0) ||
          (bounds.top > window.innerHeight && bounds.top + delta > window.innerHeight)
        ) continue;
        track(
          element,
          [
            { transform: `translateY(${delta}px)` },
            { transform: "translateY(0)" },
          ],
          { duration: 620, easing: "cubic-bezier(.22,.8,.25,1)" },
        );
      }
    }

    if (!request || !target) return;
    const destination = target.getBoundingClientRect();
    // A user may scroll or resize while Solana confirms. Launch from the
    // button's current screen location rather than its old viewport location.
    const source = request.sourceButton.isConnected
      ? request.sourceButton.getBoundingClientRect()
      : request.source;
    const sourceVisible = source.bottom > 0 && source.top < window.innerHeight;
    const targetVisible =
      destination.bottom > 0 && destination.top < window.innerHeight;
    if (
      !sourceVisible ||
      !targetVisible ||
      !destination.width ||
      !destination.height
    )
      return;
    const dx =
      source.left +
      source.width / 2 -
      (destination.left + destination.width / 2);
    const dy =
      source.top +
      source.height / 2 -
      (destination.top + destination.height / 2);
    const sx = Math.min(1, source.width / destination.width);
    const sy = Math.max(
      0.24,
      Math.min(0.55, source.height / destination.height),
    );
    const bend = request.criteria.long ? -14 : 14;
    const restingRadius = getComputedStyle(target).borderRadius;
    track(
      target,
      [
        {
          transform: `translate(${dx}px, ${dy}px) scale(${sx}, ${sy})`,
          borderRadius: "28px",
          filter: "brightness(1.18)",
          offset: 0,
        },
        {
          transform: `translate(${dx * 0.42 + bend}px, ${dy * 0.48}px) scale(.78, .68) rotate(${request.criteria.long ? -1.8 : 1.8}deg)`,
          borderRadius: "22px",
          filter: "brightness(1.1)",
          offset: 0.43,
        },
        {
          transform: "translate(0, 2px) scale(1.015, .98)",
          borderRadius: "15px",
          filter: "brightness(1.04)",
          offset: 0.8,
        },
        {
          transform: "translate(0, 0) scale(1, 1)",
          borderRadius: restingRadius,
          filter: "brightness(1)",
          offset: 1,
        },
      ],
      { duration: 680, easing: "cubic-bezier(.2,.65,.2,1)" },
      true,
    );
  }, [positions, snapshotAgeMs, stopAnimations, stopTimer]);

  useEffect(() => {
    // Keep resting geometry current when receipts expand/collapse or the
    // viewport reflows, without measuring every card on every oracle event.
    const list = listRef.current;
    const geometry = new ResizeObserver(() => {
      if (!list) return;
      oldTops.current = new Map([...list.querySelectorAll<HTMLElement>(':scope > [data-position-key]')]
        .map(element => [element.dataset.positionKey!, element.offsetTop]));
    });
    if (list) geometry.observe(list);
    const media = window.matchMedia("(prefers-reduced-motion: reduce)");
    const stopIfNeeded = () => {
      if (!motionAllowed()) cancel();
    };
    document.addEventListener("visibilitychange", stopIfNeeded);
    media.addEventListener("change", stopIfNeeded);
    window.addEventListener("resize", stopAnimations);
    return () => {
      geometry.disconnect();
      document.removeEventListener("visibilitychange", stopIfNeeded);
      media.removeEventListener("change", stopIfNeeded);
      window.removeEventListener("resize", stopAnimations);
      cancel();
    };
  }, [cancel, stopAnimations]);

  return { listRef, begin, finish, cancel };
}
