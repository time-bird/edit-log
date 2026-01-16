# EDIT LOG

Visualize your writing progress directly within VS Code.
This extension tracks not only the character count of your active file but also the total volume of your project folder, including daily logs of additions and deletions.

## Key Features

- **Real-time Character Counting**: Accurately counts characters in the active document, excluding whitespace and newlines.
- **Folder Statistics**: View the combined character count for all files within the current folder.
- **Customizable Aggregation**: Toggle specific files on or off via a checklist to include or exclude them from the folder total. These settings are saved per workspace.
- **Daily Edit History**: A detailed table showing how much you've added or deleted each day, along with the total count.
- **Native VS Code Integration**: Built with official VS Code Codicons and theme-aware styling for a seamless look and feel.

## How to Use

1. Open the **EDIT LOG** view in the Explorer side bar.
2. Open any text file to see its individual character count and the folder's total.
3. Click the **Checklist Icon** next to the folder name to select which files should be included in the total.
4. Your progress is automatically recorded every time you save a file.

## Counting Logic
To ensure accuracy for Japanese and global users, this extension uses `Intl.Segmenter` to correctly count surrogate pairs (such as emojis) as a single character. For a focused writing experience, the following are excluded from the count:
- Half-width and full-width spaces
- Tabs
- Newline characters

## Release Notes

### 0.0.1
- Initial release.
- Added recursive folder character counting.
- Added file exclusion settings (persistent).
- Added daily edit history (Add/Del) tracking.