/// <reference types="astro/client" />

declare module '*.glsl?raw' {
	const content: string;
	export default content;
}
