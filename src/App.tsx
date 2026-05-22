// Thin shim that mounts the shared AppShell with the hosted web adapter.
// All hosted-browser behavior (file input, download save, browser theme
// persistence variant) lives in src/shell/webAdapter.tsx. The shared layout
// (page frame, hero, view switcher, workspace, resize handles, PreviewPanel
// mount, AboutSection) lives in src/shell/AppShell.tsx.

import ThemeProvider from "./components/ThemeProvider";
import AppShell from "./shell/AppShell";
import { useWebAppShellAdapter } from "./shell/webAdapter";

function AppContent() {
  const adapter = useWebAppShellAdapter();

  return (
    <AppShell
      activeResizeAxis={adapter.resize.activeResizeAxis}
      sidebarCollapsed={adapter.resize.sidebarCollapsed}
      previewPanelRef={adapter.resize.previewPanelRef}
      pageFrameStyle={adapter.resize.pageFrameStyle}
      workspaceStyle={adapter.resize.workspaceStyle}
      previewPanelStyle={adapter.resize.previewPanelStyle}
      handleShowSidebar={adapter.resize.handleShowSidebar}
      handleCollapseSidebar={adapter.resize.handleCollapseSidebar}
      handleSidebarResizeStart={adapter.resize.handleSidebarResizeStart}
      handleSidebarResizeKeyDown={adapter.resize.handleSidebarResizeKeyDown}
      handleSidebarResizeClickReset={adapter.resize.handleSidebarResizeClickReset}
      handleSidebarResizeMouseUp={adapter.resize.handleSidebarResizeMouseUp}
      handleSidebarResizeReset={adapter.resize.handleSidebarResizeReset}
      handleHeightResizeStart={adapter.resize.handleHeightResizeStart}
      handleHeightResizeKeyDown={adapter.resize.handleHeightResizeKeyDown}
      handleHeightResizeClickReset={adapter.resize.handleHeightResizeClickReset}
      handleHeightResizeMouseUp={adapter.resize.handleHeightResizeMouseUp}
      handleHeightResizeReset={adapter.resize.handleHeightResizeReset}
      isWorkingMode={adapter.isWorkingMode}
      hasWorkingEntry={adapter.hasWorkingEntry}
      heroSummary={adapter.heroSummary}
      fileSummary={adapter.fileSummary}
      activePage={adapter.activePage}
      onActivePageChange={adapter.setActivePage}
      selectedEntry={adapter.selectedEntry}
      editorFocusRequest={adapter.editorFocusRequest}
      previewPanelSaveProps={adapter.previewPanelSaveProps}
      callbacks={adapter.callbacks}
      workingModeBarProps={adapter.workingModeBarProps}
      heroActionsSlot={adapter.heroActionsSlot}
      dropZoneProps={adapter.dropZoneProps}
      fileListProps={adapter.fileListProps}
      desktopStatusSlot={adapter.desktopStatusSlot}
      hiddenInputSlot={adapter.hiddenInputSlot}
      nativeMenuBridgeSlot={adapter.nativeMenuBridgeSlot}
      appShellClassExtension="app-shell-hosted"
    />
  );
}

export default function App() {
  return (
    <ThemeProvider>
      <AppContent />
    </ThemeProvider>
  );
}
