/**
 * Vue module declaration for TypeScript
 * Allows importing .vue files in TypeScript
 */
declare module '*.vue' {
  import { DefineComponent } from 'vue';
  const component: DefineComponent<Record<string, never>, Record<string, never>, unknown>;
  export default component;
}