/**
 * Public repo root for “Contribute” links. Override with `PUBLIC_GITHUB_REPO` in `.env`.
 * No trailing slash.
 */
export const githubRepoUrl = (() => {
	const v = import.meta.env.PUBLIC_GITHUB_REPO;
	if (typeof v === 'string' && v.trim()) return v.replace(/\/$/, '');
	return 'https://github.com/Ouranos27/kam-ui';
})();
