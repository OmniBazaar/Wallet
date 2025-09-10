/**
 * Vue module declaration for TypeScript
 * Allows importing .vue files in TypeScript
 */
declare module '*.vue' {
  import { DefineComponent } from 'vue';
  const component: DefineComponent<{}, {}, any>;
  export default component;
}