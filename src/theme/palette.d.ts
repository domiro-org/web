import "@mui/material/styles";

declare module "@mui/material/styles" {
  interface PaletteColor {
    container?: string;
    onContainer?: string;
  }

  interface SimplePaletteColorOptions {
    container?: string;
    onContainer?: string;
  }
}
