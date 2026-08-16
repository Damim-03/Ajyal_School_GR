/**
 * نظام التنقّل المكاني — بدائل قابلة لإعادة الاستعمال في أي شاشة فيها
 * صفّ عناصر ذو تركيز (الرئيسية، اختيار المستخدم، أشرطة الأدوات).
 *
 * كل التوقيتات والنوابض في tokens.ts وحده.
 */
export {
  springs, durations, delays, geometry, depth, reduced,
  background, choreography, expansion, neighbor,
} from "./tokens";
export { SpatialNavRow } from "./SpatialNavRow";
export { SpatialNavItem } from "./SpatialNavItem";
export { FocusIndicator } from "./FocusIndicator";
export { AnimatedContextLabel } from "./AnimatedContextLabel";
export { useTileMetrics } from "./useTileMetrics";
export type { TileMetrics } from "./useTileMetrics";
