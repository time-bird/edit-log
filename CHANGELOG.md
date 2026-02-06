# Change Log

All notable changes to the "EDIT LOG" extension will be documented in this file.

## [0.3.0] - 2026-02-06

### Added
- Export/Import File History (CSV) with data validation to ensure secure history migration.
- Submenu in the view title bar for improved accessibility to history commands.

## [0.2.8] - 2026-02-03

### Fixed
- Tweaked folder character count label display.

## [0.2.7] - 2026-02-01

### Fixed
- Refined header.

## [0.2.6] - 2026-01-30

### Fixed
- Updated folder and file name labels to icons.
- Updated images in README.md accordingly.

## [0.2.5] - 2026-01-30

### Fixed
- Refined README.md

## [0.2.4] - 2026-01-30

### Fixed
- Improve overall visibility by preventing text wrapping across all tables and slightly reducing the date font size.

## [0.2.3] - 2026-01-27

### Fixed
- Standardized date format from local to ISO (yyyy-MM-dd).

## [0.2.2] - 2026-01-27

### Fixed
- Updated scrollbar styling for better visibility on hover and click.
- Adjusted sticky header background color to improve readability.
- Refined container width to align with other UI elements.

## [0.2.1] - 2026-01-24

### Fixed
- Refined README.md

## [0.2.0] - 2026-01-24

### Added
- Added "Toggle All Files" option to the folder file selection list.

## [0.1.3] - 2026-01-24

### Fixed
- Fine-tuned text colors and font weights for better theme compatibility.
- Fixed a bug where the folder file list would unexpectedly close upon selection.

## [0.0.3] - 2026-01-23

### Fixed
- Refined App Icon

## [0.0.2] - 2026-01-23

### Fixed
- Refined README.md

## [0.0.1] - 2026-01-23 (Initial Release)

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