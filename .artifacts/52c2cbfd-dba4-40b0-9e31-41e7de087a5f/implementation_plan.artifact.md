# Fix 0-byte/Corrupted Files Bug for Large Media (YouTube)

The root cause of the bug is the memory-intensive process of reading media files as Base64 strings before writing them to the storage via the Storage Access Framework (SAF). For large files like YouTube videos, this often leads to Out Of Memory (OOM) errors in the JavaScript thread, resulting in empty or corrupted files.

## Proposed Changes

We will replace the "Read-as-Base64 then Write" approach with a direct file copy approach using `FileSystem.copyAsync`, which is significantly more memory-efficient as it handles the data transfer at the native level.

### [Service] Storage & Download

#### [MODIFY] [storage.ts](file:///D:/VIBE%20CODING/fla-vault-project/src/services/storage.ts)
- Add `saveFileToVault` function that takes a source URI and uses `FileSystem.copyAsync` to move it to the SAF vault.
- This avoids loading the file content into JavaScript memory.

#### [MODIFY] [download.ts](file:///D:/VIBE%20CODING/fla-vault-project/src/services/download.ts)
- Update `downloadAndSave` to use the new `saveFileToVault` instead of `readAsStringAsync` + `writeVaultFile`.
- This streamlines the process and fixes the 0-byte issue for large files.

## Verification Plan

### Automated Tests
- I will verify that the code compiles and the logic follows the efficient copy pattern.

### Manual Verification
- The user should try to download a YouTube video that previously failed (e.g., "Rammstein - Sonne").
- Verify that the progress bar reaches 100% and the file in the "FLAVA" folder can be opened and played correctly.
- Check that the file size is non-zero in the file manager.
