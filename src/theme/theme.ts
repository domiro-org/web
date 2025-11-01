import { extendTheme, type Theme } from "@mui/material/styles";

import type { ThemeColorId } from "../shared/types";
import {
  DEFAULT_CUSTOM_PRIMARY_COLOR,
  getThemeColorOption
} from "./colorPresets";

interface StyleParams {
  theme: Theme;
}

interface PrimaryPaletteTokens {
  main: string;
  contrastText: string;
  container: string;
  onContainer: string;
}

interface PrimaryPaletteBundle {
  light: PrimaryPaletteTokens;
  dark: PrimaryPaletteTokens;
}

/**
 * 构建自定义主题色的主色板。
 * @param baseColor 用户输入的基准色值
 * @returns 亮/暗色模式下的主色板定义
 */
function buildCustomPrimaryPalette(baseColor: string): PrimaryPaletteBundle {
  const normalized = normalizeHex(baseColor) ?? DEFAULT_CUSTOM_PRIMARY_COLOR;
  const lightMain = normalized;
  const lightContainer = mixHexColors(normalized, "#ffffff", 0.78);
  const darkMain = mixHexColors(normalized, "#ffffff", 0.45);
  const darkContainer = mixHexColors(normalized, "#000000", 0.65);

  return {
    light: {
      main: lightMain,
      contrastText: getReadableTextColor(lightMain),
      container: lightContainer,
      onContainer: getReadableTextColor(lightContainer)
    },
    dark: {
      main: darkMain,
      contrastText: getReadableTextColor(darkMain),
      container: darkContainer,
      onContainer: getReadableTextColor(darkContainer)
    }
  } satisfies PrimaryPaletteBundle;
}

/**
 * 根据用户选择的主题色创建完整的主题对象。
 * @param options 主题配置
 * @returns MUI Theme 实例
 */
export function createAppTheme(options: { colorId: ThemeColorId; customColor: string }) {
  const selectedOption = getThemeColorOption(options.colorId);
  const primaryPalette = selectedOption.isCustom
    ? buildCustomPrimaryPalette(options.customColor)
    : selectedOption.palette;

  return extendTheme({
    cssVarPrefix: "md",
    // 使用 data-attribute 承载当前配色，配合 setMode 手动切换
    colorSchemeSelector: "data",
    shape: {
      borderRadius: 12
    },
    typography: {
      fontFamily: "Roboto, system-ui, -apple-system, Segoe UI, Noto Sans, sans-serif",
      fontSize: 14,
      h5: {
        fontSize: "1.375rem",
        fontWeight: 600
      },
      body1: {
        fontSize: "0.95rem"
      }
    },
    colorSchemes: {
      light: {
        palette: {
          primary: primaryPalette.light,
          secondary: {
            main: "#535f70",
            contrastText: "#ffffff",
            container: "#d8e3f7",
            onContainer: "#101b2c"
          },
          background: {
            default: "#f4f7fb",
            paper: "#ffffff"
          },
          divider: "rgba(72, 86, 104, 0.18)",
          text: {
            primary: "#101b2c",
            secondary: "rgba(16, 27, 44, 0.68)"
          }
        }
      },
      dark: {
        palette: {
          primary: primaryPalette.dark,
          secondary: {
            main: "#bac8da",
            contrastText: "#1b2635",
            container: "#2f3a4a",
            onContainer: "#dce7f4"
          },
          background: {
            default: "#151a21",
            paper: "#1d242e"
          },
          divider: "rgba(202, 215, 228, 0.16)",
          text: {
            primary: "#e2e6eb",
            secondary: "rgba(226, 230, 235, 0.7)"
          }
        }
      }
    },
    components: {
      MuiToolbar: {
        styleOverrides: {
          root: {
            minHeight: 64,
            "@media (min-width:600px)": {
              minHeight: 64
            }
          }
        }
      },
      MuiPaper: {
        defaultProps: {
          elevation: 1
        },
        styleOverrides: {
          root: ({ theme }: StyleParams) => ({
            borderRadius: theme.shape.borderRadius,
            border: `1px solid ${theme.palette.divider}`,
            backgroundImage: "none",
            boxShadow:
              theme.palette.mode === "dark"
                ? "0px 4px 12px rgba(0, 0, 0, 0.18)"
                : "0px 4px 24px rgba(15, 23, 42, 0.08)"
          })
        }
      },
      MuiButton: {
        defaultProps: {
          variant: "contained",
          size: "medium"
        },
        styleOverrides: {
          root: ({ theme }: StyleParams) => ({
            borderRadius: theme.shape.borderRadius,
            textTransform: "none",
            fontWeight: 600
          })
        }
      },
      MuiChip: {
        defaultProps: {
          size: "small"
        },
        styleOverrides: {
          root: {
            borderRadius: 8,
            fontWeight: 500
          }
        }
      },
      MuiLinearProgress: {
        styleOverrides: {
          root: {
            borderRadius: 999,
            height: 6
          },
          bar: {
            borderRadius: 999
          }
        }
      }
    }
  });
}

/**
 * 计算两个十六进制颜色的线性混合值。
 * @param input 起始颜色
 * @param mixin 目标颜色
 * @param weight 混合权重（0-1）
 * @returns 混合后的十六进制颜色
 */
function mixHexColors(input: string, mixin: string, weight: number): string {
  const [r1, g1, b1] = hexToRgb(normalizeHex(input) ?? DEFAULT_CUSTOM_PRIMARY_COLOR);
  const [r2, g2, b2] = hexToRgb(normalizeHex(mixin) ?? mixin);
  const ratio = clamp(weight, 0, 1);

  const r = Math.round(r1 * (1 - ratio) + r2 * ratio);
  const g = Math.round(g1 * (1 - ratio) + g2 * ratio);
  const b = Math.round(b1 * (1 - ratio) + b2 * ratio);

  return rgbToHex(r, g, b);
}

/**
 * 根据颜色亮度挑选可读性的前景色。
 * @param hexColor 背景色
 * @returns 推荐的文本颜色
 */
function getReadableTextColor(hexColor: string): string {
  const [r, g, b] = hexToRgb(normalizeHex(hexColor) ?? DEFAULT_CUSTOM_PRIMARY_COLOR).map(
    (channel) => channel / 255
  );
  const luminance = 0.2126 * linearize(r) + 0.7152 * linearize(g) + 0.0722 * linearize(b);

  return luminance > 0.58 ? "#0f172a" : "#ffffff";
}

/**
 * 将 sRGB 值转换为线性空间，用于计算亮度。
 * @param value sRGB 归一化通道值
 * @returns 线性空间值
 */
function linearize(value: number): number {
  if (value <= 0.04045) {
    return value / 12.92;
  }
  return Math.pow((value + 0.055) / 1.055, 2.4);
}

/**
 * 将十六进制字符串转换为 RGB 数组。
 * @param hexColor 颜色字符串
 * @returns RGB 数组
 */
function hexToRgb(hexColor: string): [number, number, number] {
  const normalized = normalizeHex(hexColor) ?? DEFAULT_CUSTOM_PRIMARY_COLOR;
  const match = /^#?([0-9a-fA-F]{6})$/.exec(normalized);
  if (!match) {
    return [0, 0, 0];
  }

  const value = match[1];
  const r = parseInt(value.slice(0, 2), 16);
  const g = parseInt(value.slice(2, 4), 16);
  const b = parseInt(value.slice(4, 6), 16);

  return [r, g, b];
}

/**
 * 将 RGB 数值转换为十六进制字符串。
 * @param r 红色通道
 * @param g 绿色通道
 * @param b 蓝色通道
 * @returns 对应的十六进制颜色
 */
function rgbToHex(r: number, g: number, b: number): string {
  const clampChannel = (channel: number) => clamp(Math.round(channel), 0, 255);
  const hex = [clampChannel(r), clampChannel(g), clampChannel(b)]
    .map((channel) => channel.toString(16).padStart(2, "0"))
    .join("");

  return ("#" + hex).toUpperCase();
}

/**
 * 对颜色字符串进行裁剪，保证格式为 #RRGGBB。
 * @param color 输入颜色
 * @returns 规范化后的颜色或 null
 */
function normalizeHex(color: string): string | null {
  if (typeof color !== "string") {
    return null;
  }

  const trimmed = color.trim();
  const match = /^#?([0-9a-fA-F]{6})$/.exec(trimmed);
  if (!match) {
    return null;
  }

  const value = match[1].toUpperCase();
  return "#" + value;
}

/**
 * 将数值限制在给定区间内。
 * @param value 输入值
 * @param min 最小值
 * @param max 最大值
 * @returns 限制后的结果
 */
function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}
