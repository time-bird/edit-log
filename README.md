# EDIT LOG

<img src="images/editlog_image01.png" width="200" alt="Darktheme">
<img src="images/editlog_image02.png" width="200" alt="Lighttheme">

When you activate a file in the Explorer, it displays the editing history for that file for the current day, including characters deleted, characters added, and the final character count. As long as the file name and its location remain unchanged, the editing history is recorded daily and displayed in a clear list. At the top of the view, you can see the name of the folder the file belongs to, along with the total character count of all files within that folder.

## Key Features

- **Real-time Character Counting**: Accurately counts characters in the active document, excluding whitespace and newlines.
- **Multibyte Character Support**: Fully supports multibyte characters, such as Japanese (tested and verified), ensuring accurate tracking for global writers.
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

### 0.0.2
- Refined README.md