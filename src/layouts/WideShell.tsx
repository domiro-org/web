import MenuIcon from "@mui/icons-material/Menu";
import AppBar from "@mui/material/AppBar";
import Box from "@mui/material/Box";
import Container from "@mui/material/Container";
import Divider from "@mui/material/Divider";
import Drawer from "@mui/material/Drawer";
import Grid from "@mui/material/Grid";
import IconButton from "@mui/material/IconButton";
import List from "@mui/material/List";
import ListItem from "@mui/material/ListItem";
import ListItemButton from "@mui/material/ListItemButton";
import ListItemText from "@mui/material/ListItemText";
import Paper from "@mui/material/Paper";
import Stack from "@mui/material/Stack";
import Toolbar from "@mui/material/Toolbar";
import Typography from "@mui/material/Typography";
import useMediaQuery from "@mui/material/useMediaQuery";
import { useTheme } from "@mui/material/styles";
import type { PropsWithChildren, ReactNode } from "react";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState
} from "react";
import { NavLink, useLocation } from "react-router-dom";
import { useTranslation } from "react-i18next";

import LanguageSwitcher from "../components/LanguageSwitcher";

const DRAWER_WIDTH = 280;

interface NavigationItem {
  to: string;
  labelKey: string;
  exact?: boolean;
}

interface WideShellContextValue {
  setSidebar: (content: ReactNode | null) => void;
  clearSidebar: () => void;
}

const WideShellContext = createContext<WideShellContextValue | undefined>(undefined);

/**
 * 供页面设置右侧侧栏的 Hook。
 */
export function useWideShellSidebar(content: ReactNode | null) {
  const context = useContext(WideShellContext);

  useEffect(() => {
    if (!context) {
      return undefined;
    }

    context.setSidebar(content);
    return () => {
      context.clearSidebar();
    };
  }, [content, context]);
}

/**
 * 宽屏布局组件，提供 AppBar + Drawer + 右侧信息栏结构。
 */
export default function WideShell({ children }: PropsWithChildren) {
  const theme = useTheme();
  const isLgUp = useMediaQuery(theme.breakpoints.up("lg"));
  const { t } = useTranslation();
  const location = useLocation();

  const [mobileOpen, setMobileOpen] = useState(false);
  const [sidebarContent, setSidebarContent] = useState<ReactNode | null>(null);

  const navigationItems = useMemo<NavigationItem[]>(
    () => [
      { to: "/input", labelKey: "nav.input", exact: true },
      { to: "/dns", labelKey: "nav.dns" },
      { to: "/rdap", labelKey: "nav.rdap" },
      { to: "/export", labelKey: "nav.export", exact: true }
    ],
    []
  );

  const settingsItems = useMemo<NavigationItem[]>(
    () => [{ to: "/settings", labelKey: "nav.settings", exact: true }],
    []
  );

  const setSidebar = useCallback((content: ReactNode | null) => {
    setSidebarContent(content);
  }, []);

  const clearSidebar = useCallback(() => {
    setSidebarContent(null);
  }, []);

  const contextValue = useMemo(
    () => ({ setSidebar, clearSidebar }),
    [clearSidebar, setSidebar]
  );

  useEffect(() => {
    // 路径变化时先清理旧的侧栏，避免内容残留
    setSidebarContent(null);
  }, [location.pathname]);

  const handleDrawerToggle = () => {
    setMobileOpen((prev) => !prev);
  };

  const handleNavClick = () => {
    if (!isLgUp) {
      setMobileOpen(false);
    }
  };

  const drawer = (
    <Box sx={{ display: "flex", flexDirection: "column", height: "100%" }}>
      <Toolbar sx={{ px: 2 }}>
        <Typography variant="h6" component="div" noWrap>
          {t("app.title")}
        </Typography>
      </Toolbar>
      <Divider />
      <Stack spacing={2} sx={{ flexGrow: 1, px: 1.5, py: 2 }}>
        <List disablePadding>
          {navigationItems.map((item) => (
            <ListItem key={item.to} disablePadding sx={{ mb: 0.5 }}>
              <ListItemButton
                component={NavLink}
                to={item.to}
                end={item.exact}
                onClick={handleNavClick}
                selected={matchSelected(location.pathname, item.to, item.exact)}
                sx={{
                  borderRadius: 2,
                  px: 2,
                  "&.Mui-selected": {
                    bgcolor: "primary.container",
                    color: "primary.onContainer"
                  }
                }}
              >
                <ListItemText primary={t(item.labelKey)} />
              </ListItemButton>
            </ListItem>
          ))}
        </List>
        <Divider flexItem />
        <Box>
          <Typography variant="overline" color="text.secondary" sx={{ mb: 1, display: "block" }}>
            {t("language.select")}
          </Typography>
          <LanguageSwitcher fullWidth size="small" />
        </Box>
        <Divider flexItem />
        <List disablePadding>
          {settingsItems.map((item) => (
            <ListItem key={item.to} disablePadding>
              <ListItemButton
                component={NavLink}
                to={item.to}
                end={item.exact}
                onClick={handleNavClick}
                selected={matchSelected(location.pathname, item.to, item.exact)}
                sx={{
                  borderRadius: 2,
                  px: 2,
                  "&.Mui-selected": {
                    bgcolor: "primary.container",
                    color: "primary.onContainer"
                  }
                }}
              >
                <ListItemText primary={t(item.labelKey)} />
              </ListItemButton>
            </ListItem>
          ))}
        </List>
      </Stack>
    </Box>
  );

  return (
    <WideShellContext.Provider value={contextValue}>
      <Box
        sx={{
          display: "flex",
          minHeight: "100vh",
          bgcolor: "background.default"
        }}
      >
        <AppBar
          position="fixed"
          color="default"
          elevation={0}
          sx={{
            borderBottom: "1px solid",
            borderColor: "divider",
            width: { lg: `calc(100% - ${DRAWER_WIDTH}px)` },
            ml: { lg: `${DRAWER_WIDTH}px` }
          }}
        >
          <Toolbar sx={{ px: { xs: 2, md: 3 } }}>
            {!isLgUp && (
              <IconButton
                color="primary"
                edge="start"
                onClick={handleDrawerToggle}
                sx={{ mr: 2 }}
                aria-label={t("nav.toggle") ?? "toggle"}
              >
                <MenuIcon />
              </IconButton>
            )}
            <Typography variant="h6" component="div" sx={{ flexGrow: 1 }} noWrap>
              {t("app.title")}
            </Typography>
            <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
              <Box
                sx={{
                  width: 36,
                  height: 36,
                  borderRadius: 2,
                  bgcolor: "action.hover",
                  opacity: 0.6
                }}
              />
            </Box>
          </Toolbar>
        </AppBar>
        <Box component="nav" sx={{ width: { lg: DRAWER_WIDTH }, flexShrink: { lg: 0 } }}>
          <Drawer
            variant={isLgUp ? "permanent" : "temporary"}
            open={isLgUp ? true : mobileOpen}
            onClose={handleDrawerToggle}
            ModalProps={{ keepMounted: true }}
            sx={{
              "& .MuiDrawer-paper": {
                width: DRAWER_WIDTH,
                boxSizing: "border-box"
              }
            }}
          >
            {drawer}
          </Drawer>
        </Box>
        <Box
          component="main"
          sx={{
            flexGrow: 1,
            width: { lg: `calc(100% - ${DRAWER_WIDTH}px)` },
            minHeight: "100vh",
            display: "flex",
            flexDirection: "column"
          }}
        >
          <Toolbar />
          <Container
            maxWidth="xl"
            sx={{
              py: 3,
              flexGrow: 1,
              display: "flex",
              flexDirection: "column",
              minHeight: 0
            }}
          >
            <Grid container spacing={3} alignItems="flex-start" sx={{ flexGrow: 1 }}>
              <Grid size={{ xs: 12, lg: 9 }} sx={{ minHeight: 0 }}>
                <Box sx={{ display: "flex", flexDirection: "column", gap: 3, minHeight: 0 }}>
                  {children}
                </Box>
              </Grid>
              <Grid size={{ xs: 12, lg: 3 }} sx={{ minHeight: 0 }}>
                <Box
                  // 右侧栏在大屏保持可见，贴合原型要求
                  sx={{
                    display: "flex",
                    flexDirection: "column",
                    gap: 3,
                    position: { lg: "sticky" },
                    top: { lg: "88px" }
                  }}
                >
                  {sidebarContent ?? <DefaultSidebar />}
                </Box>
              </Grid>
            </Grid>
          </Container>
        </Box>
      </Box>
    </WideShellContext.Provider>
  );
}

/**
 * 默认右侧栏，在未设置内容时提供指引。
 */
function DefaultSidebar() {
  const { t } = useTranslation();

  return (
    <Stack spacing={3} sx={{ flexGrow: 1 }}>
      <Paper elevation={1} sx={{ p: 3 }}>
        <Typography variant="subtitle1" gutterBottom>
          {t("layout.sidebar.placeholderTitle")}
        </Typography>
        <Typography variant="body2" color="text.secondary">
          {t("layout.sidebar.placeholderBody")}
        </Typography>
      </Paper>
    </Stack>
  );
}

/**
 * 判断当前路径是否命中导航项。
 */
function matchSelected(currentPath: string, targetPath: string, exact?: boolean): boolean {
  if (exact) {
    return currentPath === targetPath;
  }
  return currentPath === targetPath || currentPath.startsWith(`${targetPath}/`);
}
