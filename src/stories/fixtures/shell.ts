import { STORAGE_KEY } from '@/lib/study';
import {
  serializeStoredThemeColors,
  THEME_COLORS_STORAGE_KEY,
  type ThemeMode,
  type ThemePalette,
} from '@/lib/theme';

/** 不屬於官方配色、但通過可讀性檢查的淺色自訂配色（暖灰底、赭紅重點）。 */
export const customLightPalette: ThemePalette = {
  background: '#F3F1EC',
  surface: '#FFFFFF',
  text: '#1D2B33',
  muted: '#5B6870',
  accent: '#B23C17',
  border: '#DAD4C9',
};

/** 不屬於官方配色、但通過可讀性檢查的深色自訂配色。 */
export const customDarkPalette: ThemePalette = {
  background: '#10161A',
  surface: '#182127',
  text: '#E9EEF0',
  muted: '#9DABB3',
  accent: '#FF9466',
  border: '#2E3A42',
};

/** 用在 `parameters.localStorage`：跟按下「套用此模式」後存進瀏覽器的配色格式一樣。 */
export function storedThemeColors(palettes: Partial<Record<ThemeMode, ThemePalette>>) {
  return { [THEME_COLORS_STORAGE_KEY]: serializeStoredThemeColors(palettes) };
}

export type StorageFailure = 'quota-exceeded' | 'unavailable';

/**
 * 故事的 `beforeEach`：讓網站寫入指定的 localStorage 項目時失敗，看存檔失敗的提示。
 * - `quota-exceeded`：瀏覽器儲存空間已滿（QuotaExceededError）。
 * - `unavailable`：瀏覽器不允許本機儲存（例如隱私模式的 SecurityError）。
 * 只擋網站自己的存檔（預設是作答資料），範例資料仍照常寫入；換故事時會還原。
 */
export function failLocalStorageWrites(
  failure: StorageFailure,
  keys: readonly string[] = [STORAGE_KEY],
) {
  return () => {
    const originalSetItem = Storage.prototype.setItem;
    Storage.prototype.setItem = function setItem(this: Storage, key, value) {
      if (this === window.localStorage && keys.includes(key)) {
        throw failure === 'quota-exceeded'
          ? new DOMException('The quota has been exceeded.', 'QuotaExceededError')
          : new DOMException('The operation is insecure.', 'SecurityError');
      }
      originalSetItem.call(this, key, value);
    };
    return () => {
      Storage.prototype.setItem = originalSetItem;
    };
  };
}
