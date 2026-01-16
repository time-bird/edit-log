# Change Log

All notable changes to the "EDIT LOG" extension will be documented in this file.

## [0.0.1] - 2026-01-16 (Initial Release)

### Added
- **Core Counting Logic**: Implemented accurate character counting that excludes whitespace and newlines.
- **Folder Statistics View**: A dedicated Webview in the sidebar to display the total character count of the active folder.
- **File Filtering**: A checklist feature to manually include or exclude specific files from the folder total.
- **Automatic History Logging**: Tracks character additions and removals on every file save, organized by date.
- **Enhanced UI/UX**:
    - Integrated `@vscode/codicons` for a native look.
    - Added automatic text truncation (ellipsis) and tooltips for long folder and file names.
    - Theme-responsive table for daily logs with support for red (deletions) and green (additions) indicators.
- **Data Persistence**: Uses `workspaceState` to remember your file exclusion settings and history across sessions.