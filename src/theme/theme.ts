import { extendTheme, type Theme } from "@mui/material/styles";

type StyleParams = { theme: Theme };

const theme = extendTheme({
  cssVarPrefix: "md",
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
        primary: {
          main: "#00658f",
          contrastText: "#ffffff",
          container: "#c5e7ff",
          onContainer: "#001e30"
        },
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
        primary: {
          main: "#85caff",
          contrastText: "#003354",
          container: "#003a60",
          onContainer: "#cce5ff"
        },
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

export default theme;
