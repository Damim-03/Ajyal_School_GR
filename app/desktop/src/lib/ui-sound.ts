/**
 * أصوات التفاعل — واجهة صامتة.
 * انظر التعليق في lib/sound.ts.
 */

/* الأسماء مطابقة لنظام SKK حرفياً */
const INTENT = {
  focus: "",
  navigate: "",
  confirm: "",
  back: "",
  openLayer: "",
  closeLayer: "",
  success: "",
  error: "",
} as const;

export type UiSoundIntent = keyof typeof INTENT;

/* eslint-disable @typescript-eslint/no-unused-vars */

export function uiSound(_intent: UiSoundIntent, _enabled = true) {}

export function warmUiSounds() {}

export const UI_SOUND_INTENTS = Object.keys(INTENT) as UiSoundIntent[];
