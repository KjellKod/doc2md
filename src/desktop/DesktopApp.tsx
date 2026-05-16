// SPDX-License-Identifier: LicenseRef-doc2md-Desktop
//
// Thin shim that mounts the shared AppShell with the desktop adapter.
// All desktop-specific behavior (native bridge, save state machine,
// conflict bar, recent files, persistence, session restore, settings
// popover, import handoff) lives in src/shell/desktopAdapter.tsx. The
// shared layout (page frame, hero, view switcher, workspace, resize
// handles, PreviewPanel mount, AboutSection) lives in src/shell/AppShell.tsx.

import ThemeProvider from "../components/ThemeProvider";
import AppShell from "../shell/AppShell";
import { useDesktopAppShellAdapter } from "../shell/desktopAdapter";

function DesktopAppContent() {
  const adapter = useDesktopAppShellAdapter();

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
      workingModeBarSlot={adapter.workingModeBarSlot}
      heroActionsSlot={adapter.heroActionsSlot}
      dropZoneSlot={adapter.dropZoneSlot}
      fileListProps={adapter.fileListProps}
      desktopStatusSlot={adapter.desktopStatusSlot}
      hiddenInputSlot={adapter.hiddenInputSlot}
      nativeMenuBridgeSlot={adapter.nativeMenuBridgeSlot}
      heroClassExtension={adapter.heroClassExtension}
    />
  );
}

export default function App() {
  return (
    <ThemeProvider>
      <DesktopAppContent />
    </ThemeProvider>
  );
}
