import Box from "@mui/material/Box";
import LinearProgress from "@mui/material/LinearProgress";
import { Suspense, lazy } from "react";
import {
  Navigate,
  Outlet,
  RouterProvider,
  createBrowserRouter
} from "react-router-dom";

import WideShell from "../layouts/WideShell";

const InputPage = lazy(() => import("../pages/InputPage"));
const DnsPage = lazy(() => import("../pages/DnsPage"));
const RdapPage = lazy(() => import("../pages/RdapPage"));
const ExportPage = lazy(() => import("../pages/ExportPage"));
const SettingsPage = lazy(() => import("../pages/SettingsPage"));

/**
 * 全局路由定义，启用按需加载页面级组件。
 */
const router = createBrowserRouter([
  {
    path: "/",
    element: <AppLayout />,
    children: [
      { index: true, element: <Navigate to="/input" replace /> },
      { path: "input", element: <InputPage /> },
      { path: "dns", element: <DnsPage /> },
      { path: "rdap", element: <RdapPage /> },
      { path: "export", element: <ExportPage /> },
      { path: "settings", element: <SettingsPage /> }
    ]
  }
]);

export default function AppRoutes() {
  return <RouterProvider router={router} />;
}

/**
 * 带 Suspense 的顶级布局。
 */
function AppLayout() {
  return (
    <WideShell>
      <Suspense fallback={<RouteFallback />}>
        <Outlet />
      </Suspense>
    </WideShell>
  );
}

/**
 * 路由切换加载占位。
 */
function RouteFallback() {
  return (
    <Box sx={{ width: "100%", py: 4 }}>
      <LinearProgress />
    </Box>
  );
}
