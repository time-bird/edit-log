# EDIT LOG

<img src="images/editlog_image01.png" width="200" alt="Darktheme">
<img src="images/editlog_image02.png" width="200" alt="Lighttheme">

Visualize your writing progress directly within VS Code.
This extension tracks not only the character count of your active file but also the total volume of your project folder, including daily logs of additions and deletions.

## Key Features

- **Real-time Character Counting**: Accurately counts characters in the active document, excluding whitespace and newlines.
- **Folder Statistics**: View the combined character count for all files within the current folder.
- **Customizable Aggregation**: Toggle specific files on or off via a checklist to include or exclude them from the folder total. These settings are saved per workspace.
- **Daily Edit History**: A detailed table showing how much you've added or deleted each day, along with the total count.
- **Native VS Code Integration**: Built with official VS Code Codicons and theme-aware styling for a seamless look and feel.

## How to Use

1. The **EDIT LOG** view is integrated into the **Explorer** side bar (the folder icon). If you cannot find it, right-click anywhere in the Explorer side bar and ensure **EDIT LOG** is checked to make it visible.
2. Click the **EDIT LOG** title in the side bar to expand the view.
3. Open any text file to see its individual character count and the folder's total volume.

<img src="images/EditLogDemo01.gif" width="600" alt="Demo1">

4. Click the **Checklist Icon** next to the folder name to select which files should be included in the total. This allows you to exclude specific files or logs from your project's aggregate count.

<img src="images/EditLogDemo02.gif" width="600" alt="Demo2">

5. Your writing progress is automatically recorded every time you save a file.


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