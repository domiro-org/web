import type { ThemeColorId } from "../shared/types";

export interface ThemeColorTokens {
  main: string;
  contrastText: string;
  container: string;
  onContainer: string;
}

export interface ThemeColorOption {
  id: ThemeColorId;
  labelKey: string;
  preview: string;
  palette: {
    light: ThemeColorTokens;
    dark: ThemeColorTokens;
  };
  isCustom?: boolean;
}

export const DEFAULT_THEME_COLOR_ID: ThemeColorId = "blue";
export const DEFAULT_CUSTOM_PRIMARY_COLOR = "#00658F";

export const THEME_COLOR_OPTIONS: readonly ThemeColorOption[] = [
  {
    id: "blue",
    labelKey: "page.settings.theme.color.blue",
    preview: "#00658F",
    palette: {
      light: {
        main: "#00658f",
        contrastText: "#ffffff",
        container: "#c5e7ff",
        onContainer: "#001e30"
      },
      dark: {
        main: "#85caff",
        contrastText: "#003354",
        container: "#003a60",
        onContainer: "#cce5ff"
      }
    }
  },
  {
    id: "teal",
    labelKey: "page.settings.theme.color.teal",
    preview: "#006A6F",
    palette: {
      light: {
        main: "#006a6f",
        contrastText: "#ffffff",
        container: "#6ff6f5",
        onContainer: "#002021"
      },
      dark: {
        main: "#4fdade",
        contrastText: "#003739",
        container: "#005152",
        onContainer: "#6ff6f5"
      }
    }
  },
  {
    id: "green",
    labelKey: "page.settings.theme.color.green",
    preview: "#1B6F43",
    palette: {
      light: {
        main: "#1b6f43",
        contrastText: "#ffffff",
        container: "#a8f5c6",
        onContainer: "#00210f"
      },
      dark: {
        main: "#8ddbb0",
        contrastText: "#00391e",
        container: "#045231",
        onContainer: "#a8f5c6"
      }
    }
  },
  {
    id: "purple",
    labelKey: "page.settings.theme.color.purple",
    preview: "#6B47B8",
    palette: {
      light: {
        main: "#6b47b8",
        contrastText: "#ffffff",
        container: "#e6ddff",
        onContainer: "#24005c"
      },
      dark: {
        main: "#cbbdff",
        contrastText: "#311569",
        container: "#4a2f87",
        onContainer: "#e6ddff"
      }
    }
  },
  {
    id: "orange",
    labelKey: "page.settings.theme.color.orange",
    preview: "#984700",
    palette: {
      light: {
        main: "#984700",
        contrastText: "#ffffff",
        container: "#ffddb9",
        onContainer: "#321300"
      },
      dark: {
        main: "#ffb870",
        contrastText: "#4f2500",
        container: "#6d3300",
        onContainer: "#ffddb9"
      }
    }
  },
  {
    id: "pink",
    labelKey: "page.settings.theme.color.pink",
    preview: "#AD306B",
    palette: {
      light: {
        main: "#ad306b",
        contrastText: "#ffffff",
        container: "#ffd8e6",
        onContainer: "#3f001f"
      },
      dark: {
        main: "#ffb0c9",
        contrastText: "#56002d",
        container: "#731846",
        onContainer: "#ffd8e6"
      }
    }
  },
  {
    id: "custom",
    labelKey: "page.settings.theme.color.custom",
    preview: DEFAULT_CUSTOM_PRIMARY_COLOR,
    palette: {
      light: {
        main: DEFAULT_CUSTOM_PRIMARY_COLOR,
        contrastText: "#ffffff",
        container: "#c5e7ff",
        onContainer: "#001e30"
      },
      dark: {
        main: "#85caff",
        contrastText: "#003354",
        container: "#003a60",
        onContainer: "#cce5ff"
      }
    },
    isCustom: true
  }
];

const THEME_COLOR_SET = new Set<ThemeColorId>(THEME_COLOR_OPTIONS.map((option) => option.id));

export function isThemeColorId(value: unknown): value is ThemeColorId {
  return typeof value === "string" && THEME_COLOR_SET.has(value as ThemeColorId);
}

export function getThemeColorOption(id: ThemeColorId): ThemeColorOption {
  return THEME_COLOR_OPTIONS.find((option) => option.id === id) ?? THEME_COLOR_OPTIONS[0];
}
