import {
	useCallback,
	useEffect,
	useRef,
	useState,
	type MutableRefObject,
	type Ref,
	type RefCallback,
} from 'react';

export type InViewOptions = IntersectionObserverInit;
export type PerformanceQuality = 'auto' | 'low' | 'medium' | 'high';
export type ResolvedPerformanceQuality = 'low' | 'medium' | 'high';

/**
 * IntersectionObserver-based visibility for pausing rAF / WebGL / physics loops.
 *
 * The observer is recreated when the observed element changes. Options are read
 * at creation time from a ref (always latest on each mount); pass a **stable**
 * `options` object from the caller if you need option changes to take effect
 * without remounting the observed node.
 */
export function useInView(options?: InViewOptions) {
	const [inView, setInView] = useState(false);
	const [element, setElement] = useState<Element | null>(null);
	const optsRef = useRef(options);
	optsRef.current = options;
	const observerRoot = options?.root;

	const ref = useCallback((node: Element | null) => {
		setElement(node);
	}, []);

	useEffect(() => {
		if (!element) return;
		const obs = new IntersectionObserver(
			(entries) => {
				const e = entries[0];
				if (e) setInView(e.isIntersecting);
			},
			{
				root: null,
				rootMargin: '48px',
				threshold: 0.08,
				...optsRef.current,
			},
		);
		obs.observe(element);
		return () => obs.disconnect();
	}, [element, observerRoot]);

	return { ref, inView };
}

/**
 * Sync `prefers-reduced-motion` for canvas / rAF code paths (outside Framer).
 */
export function usePrefersReducedMotion() {
	const [reduce, setReduce] = useState(false);

	useEffect(() => {
		if (typeof window === 'undefined') return;
		const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
		const apply = () => setReduce(mq.matches);
		apply();
		mq.addEventListener('change', apply);
		return () => mq.removeEventListener('change', apply);
	}, []);

	return reduce;
}

/**
 * Detect a safer default quality tier on constrained devices.
 * Falls back to `high` when platform signals are unavailable.
 */
export function useAutoPerformanceQuality(): ResolvedPerformanceQuality {
	const reducedMotion = usePrefersReducedMotion();
	const [quality, setQuality] = useState<ResolvedPerformanceQuality>('high');

	useEffect(() => {
		if (typeof window === 'undefined') return;
		if (reducedMotion) {
			setQuality('low');
			return;
		}

		const coarsePointer = window.matchMedia('(pointer: coarse)').matches;
		const memory = typeof navigator !== 'undefined' ? (navigator as Navigator & { deviceMemory?: number }).deviceMemory : undefined;
		const cores = typeof navigator !== 'undefined' ? navigator.hardwareConcurrency : undefined;
		const saveData =
			typeof navigator !== 'undefined' &&
			'connection' in navigator &&
			!!(navigator as Navigator & { connection?: { saveData?: boolean } }).connection?.saveData;

		const lowSignals =
			saveData ||
			(memory !== undefined && memory <= 4) ||
			(cores !== undefined && cores <= 4);
		const mediumSignals =
			coarsePointer ||
			(memory !== undefined && memory <= 8) ||
			(cores !== undefined && cores <= 8);

		if (lowSignals) {
			setQuality('low');
			return;
		}
		if (mediumSignals) {
			setQuality('medium');
			return;
		}
		setQuality('high');
	}, [reducedMotion]);

	return quality;
}

export function resolvePerformanceQuality(
	quality: PerformanceQuality,
	autoQuality: ResolvedPerformanceQuality
): ResolvedPerformanceQuality {
	return quality === 'auto' ? autoQuality : quality;
}

/**
 * True when the primary input supports hover (fine pointer). Use to degrade hover-only physics on touch.
 */
export function useHoverCapable() {
	const [hover, setHover] = useState(true);

	useEffect(() => {
		if (typeof window === 'undefined') return;
		const mq = window.matchMedia('(hover: hover) and (pointer: fine)');
		const apply = () => setHover(mq.matches);
		apply();
		mq.addEventListener('change', apply);
		return () => mq.removeEventListener('change', apply);
	}, []);

	return hover;
}

/** Pause heavy loops when off-screen or when the user requests reduced motion. */
export function useViewportPaused(inView: boolean, reducedMotion: boolean) {
	return !inView || reducedMotion;
}

/** Merged ref callback — matches React’s `RefCallback<T>` (`null` on unmount). */
export function mergeRefs<T>(...refs: Array<Ref<T> | undefined>): RefCallback<T> {
	return (value: T | null) => {
		for (const ref of refs) {
			if (!ref) continue;
			if (typeof ref === 'function') (ref as RefCallback<T>)(value);
			else (ref as MutableRefObject<T | null>).current = value;
		}
	};
}
