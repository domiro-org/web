import MenuIcon from "@mui/icons-material/Menu";
import AppBar from "@mui/material/AppBar";
import Box from "@mui/material/Box";
import Container from "@mui/material/Container";
import Divider from "@mui/material/Divider";
import Drawer from "@mui/material/Drawer";
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
import { alpha, useTheme } from "@mui/material/styles";
import type { PropsWithChildren, ReactNode } from "react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { NavLink, useLocation } from "react-router-dom";
import { useTranslation } from "react-i18next";

import LanguageSwitcher from "../components/LanguageSwitcher";
import { WideShellContext, type WideShellContextValue } from "./WideShellContext";

const DRAWER_WIDTH = 280;

interface NavigationItem {
  to: string;
  labelKey: string;
  exact?: boolean;
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
    () => [
      { to: "/settings", labelKey: "nav.settings", exact: true },
      { to: "/about", labelKey: "nav.about", exact: true }
    ],
    []
  );

  const setSidebar = useCallback((content: ReactNode | null) => {
    setSidebarContent(content);
  }, []);

  const clearSidebar = useCallback(() => {
    setSidebarContent(null);
  }, []);

  const contextValue = useMemo<WideShellContextValue>(
    () => ({ setSidebar, clearSidebar }),
    [clearSidebar, setSidebar]
  );

  // 当页面显式传入 false 时代表禁用右侧栏
  const shouldShowSidebar = sidebarContent !== false;

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
                  // 通过降低透明度让选中态在明暗模式下保持合适对比度
                  transition: (theme) =>
                    theme.transitions.create("background-color", {
                      duration: theme.transitions.duration.shorter
                    }),
                  "&:hover": (theme) => ({
                    bgcolor: alpha(
                      theme.palette.primary.main,
                      theme.palette.mode === "light" ? 0.08 : 0.16
                    )
                  }),
                  "&.Mui-selected": (theme) => ({
                    bgcolor: alpha(
                      theme.palette.primary.main,
                      theme.palette.mode === "light" ? 0.16 : 0.24
                    ),
                    color:
                      theme.palette.mode === "light"
                        ? theme.palette.primary.main
                        : theme.palette.primary.contrastText,
                    "& .MuiListItemText-primary": {
                      fontWeight: 600
                    },
                    "&:hover": {
                      bgcolor: alpha(
                        theme.palette.primary.main,
                        theme.palette.mode === "light" ? 0.2 : 0.28
                      )
                    }
                  })
                }}
              >
                <ListItemText primary={t(item.labelKey)} />
              </ListItemButton>
            </ListItem>
          ))}
        </List>
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
                  // 通过降低透明度让选中态在明暗模式下保持合适对比度
                  transition: (theme) =>
                    theme.transitions.create("background-color", {
                      duration: theme.transitions.duration.shorter
                    }),
                  "&:hover": (theme) => ({
                    bgcolor: alpha(
                      theme.palette.primary.main,
                      theme.palette.mode === "light" ? 0.08 : 0.16
                    )
                  }),
                  "&.Mui-selected": (theme) => ({
                    bgcolor: alpha(
                      theme.palette.primary.main,
                      theme.palette.mode === "light" ? 0.16 : 0.24
                    ),
                    color:
                      theme.palette.mode === "light"
                        ? theme.palette.primary.main
                        : theme.palette.primary.contrastText,
                    "& .MuiListItemText-primary": {
                      fontWeight: 600
                    },
                    "&:hover": {
                      bgcolor: alpha(
                        theme.palette.primary.main,
                        theme.palette.mode === "light" ? 0.2 : 0.28
                      )
                    }
                  })
                }}
              >
                <ListItemText primary={t(item.labelKey)} />
              </ListItemButton>
            </ListItem>
          ))}
        </List>
      </Stack>
      {/* 语言选择固定在侧栏左下角：通过将其放在最底部并留出内边距实现 */}
      <Divider />
      <Box sx={{ px: 1.5, py: 2 }}>
        <LanguageSwitcher fullWidth size="small" />
      </Box>
    </Box>
  );

  const showMobileAppBar = !isLgUp;

  return (
    <WideShellContext.Provider value={contextValue}>
      <Box
        sx={{
          display: "flex",
          minHeight: "100vh",
          bgcolor: "background.default"
        }}
      >
        {showMobileAppBar && (
          <AppBar
            position="fixed"
            color="default"
            elevation={0}
            sx={{
              borderBottom: "1px solid",
              borderColor: "divider"
            }}
          >
            <Toolbar sx={{ px: { xs: 2, md: 3 } }}>
              <IconButton
                color="primary"
                edge="start"
                onClick={handleDrawerToggle}
                sx={{ mr: 2 }}
                aria-label={t("nav.toggle") ?? "toggle"}
              >
                <MenuIcon />
              </IconButton>
            </Toolbar>
          </AppBar>
        )}
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
          {showMobileAppBar && <Toolbar />}
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
            <Box
              sx={{
                display: "grid",
                gridTemplateColumns: {
                  xs: "minmax(0, 1fr)",
                  lg: shouldShowSidebar ? "minmax(0, 3fr) minmax(0, 1fr)" : "minmax(0, 1fr)"
                },
                alignItems: "flex-start",
                gap: 3,
                flexGrow: 1,
                minHeight: 0
              }}
            >
              <Box sx={{ minHeight: 0 }}>
                <Box sx={{ display: "flex", flexDirection: "column", gap: 3, minHeight: 0 }}>
                  {children}
                </Box>
              </Box>
              {shouldShowSidebar && (
                <Box sx={{ minHeight: 0 }}>
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
                </Box>
              )}
            </Box>
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
