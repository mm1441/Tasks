// utils/themeColors.ts
// Color generation utility for task cards with stable color assignment

export type ThemeColor = {
  h: number;
  s: number;
  l: number; // selected color (e.g., 36)
};

export type GeneratedTheme = {
  background: string;
  getItemColor: (stableIndex: number, totalCount: number) => string;
};

/**
 * Generates theme colors with stable color assignment.
 * Colors are based on a stable index (e.g., creation order) rather than
 * current position, preventing color jumps when tasks are reordered.
 *
 * @param base - Base HSL color (e.g., { h: 188, s: 100, l: 36 })
 * @param scheme - 'light' or 'dark'; light uses 90% lightness for background, dark uses 10%
 * @returns Theme with background color and item color generator
 */
export function generateThemeColors(base: ThemeColor, scheme: 'light' | 'dark'): GeneratedTheme {
  const background =
    scheme === 'light'
      ? `hsl(${base.h}, ${base.s}%, 90%)`
      : `hsl(${base.h}, ${base.s}%, 10%)`;

  /**
   * Generates item color based on stable index.
   * Opacity ramps from 1 (first item) to a minimum of 0.2 (last item).
   * 
   * Rules:
   * - First element is always 100% opacity (alpha = 1)
   * - If totalCount <= 7: opacity decreases by 10% per step 
   * - If totalCount > 7: last element is 30% opacity (alpha = 0.2), 
   *   with linear interpolation between first and last
   * 
   * @param stableIndex - Stable index (0-based, e.g., based on creation order)
   * @param totalCount - Total number of items in the section
   * @returns HSLA color string
   */
  const getItemColor = (stableIndex: number, totalCount: number): string => {
    if (totalCount <= 0) {
      return `hsla(${base.h}, ${base.s}%, ${base.l}%, 1)`;
    }
    
    if (totalCount === 1) {
      return `hsla(${base.h}, ${base.s}%, ${base.l}%, 1)`;
    }

    const maxAlpha = 1;
    let minAlpha: number;
    let step: number;

    minAlpha = 0.2;

    if (totalCount === 2) {
      step = 0.3;
    } else {
      step = (maxAlpha - minAlpha) / (totalCount - 1);
    }

    // if (totalCount <= 7) {
    //   // For 7 or fewer items: decrease by 10% per step
    //   // minAlpha = 1 - (totalCount - 1) * 0.05
    //   minAlpha = 1 - (totalCount - 1) * 0.1;
    //   step = 0.1;
    // } else {
    //   // For more than 7 items: last element is 30% opacity
    //   minAlpha = 0.2;
    //   step = (maxAlpha - minAlpha) / (totalCount - 1);
    // }
    
    // Clamp index to valid range
    const clampedIndex = Math.max(0, Math.min(stableIndex, totalCount - 1));
    const alpha = maxAlpha - clampedIndex * step;
    
    return `hsla(${base.h}, ${base.s}%, ${base.l}%, ${alpha})`;
  };

  return {
    background,
    getItemColor,
  };
}

/**
 * Gets an index for a task based on its current position in the provided array.
 *
 * IMPORTANT:
 * - This intentionally uses the *current* ordering of `tasks`.
 * - That means when you reorder the array (e.g. via drag & drop),
 *   the returned indices – and therefore colors – will follow the new order.
 *
 * This matches the desired behaviour:
 * - When two tasks swap positions, they also swap colors.
 *
 * @param tasks - Array of tasks in the order you want colors applied
 * @param taskId - ID of the task to get index for
 * @returns Index in the array (0-based)
 */
export function getStableIndex(tasks: Array<{ id: string }>, taskId: string): number {
  const index = tasks.findIndex(t => t.id === taskId);
  return index >= 0 ? index : 0;
}

/**
 * Converts a hex color to HSL
 * @param hex - Hex color string
 * @returns HSL color object
 */
export function hexToHsl(hex: string): ThemeColor {
  // Remove # if present
  hex = hex.replace('#', '');
  
  // Parse RGB
  const r = parseInt(hex.substring(0, 2), 16) / 255;
  const g = parseInt(hex.substring(2, 4), 16) / 255;
  const b = parseInt(hex.substring(4, 6), 16) / 255;

  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  let h = 0;
  let s = 0;
  const l = (max + min) / 2;

  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);

    switch (max) {
      case r:
        h = ((g - b) / d + (g < b ? 6 : 0)) / 6;
        break;
      case g:
        h = ((b - r) / d + 2) / 6;
        break;
      case b:
        h = ((r - g) / d + 4) / 6;
        break;
    }
  }

  return {
    h: Math.round(h * 360),
    s: Math.round(s * 100),
    l: Math.round(l * 100),
  };
}

/**
 * Converts HSL to hex color
 * @param hsl - HSL color object
 * @returns Hex color string (e.g., "#09b895")
 */
export function hslToHex(hsl: ThemeColor): string {
  const h = hsl.h / 360;
  const s = hsl.s / 100;
  const l = hsl.l / 100;

  let r: number, g: number, b: number;

  if (s === 0) {
    r = g = b = l; // achromatic
  } else {
    const hue2rgb = (p: number, q: number, t: number) => {
      if (t < 0) t += 1;
      if (t > 1) t -= 1;
      if (t < 1 / 6) return p + (q - p) * 6 * t;
      if (t < 1 / 2) return q;
      if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6;
      return p;
    };

    const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
    const p = 2 * l - q;

    r = hue2rgb(p, q, h + 1 / 3);
    g = hue2rgb(p, q, h);
    b = hue2rgb(p, q, h - 1 / 3);
  }

  const toHex = (x: number) => {
    const hex = Math.round(x * 255).toString(16);
    return hex.length === 1 ? '0' + hex : hex;
  };

  return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
}
