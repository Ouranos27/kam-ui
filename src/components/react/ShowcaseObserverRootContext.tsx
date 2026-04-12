import { createContext, useContext } from 'react';

/**
 * When set, canvas specimens should pass this element as `IntersectionObserver` `root`
 * so pause/resume aligns with the full Preview display region (not only the viewport).
 */
const ShowcaseObserverRootContext = createContext<Element | null>(null);

export function useShowcaseObserverRoot() {
	return useContext(ShowcaseObserverRootContext);
}

export { ShowcaseObserverRootContext };
