export { toronto } from './toronto.js';

export const CITIES = {
  toronto: () => import('./toronto.js').then(m => m.toronto),
};

// Convenience sync map for components
import { toronto } from './toronto.js';
export const cityConfigs = { toronto };
