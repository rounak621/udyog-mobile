import { Platform, Alert } from 'react-native';
import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';
import * as SecureStore from 'expo-secure-store';
import * as IntentLauncher from 'expo-intent-launcher';

const STORAGE_KEY = 'udyog_save_folder_uri';

export type DocumentSubfolder =
  | 'Challan'
  | 'Sales Bills'
  | 'Purchase Bills'
  | 'Quotations'
  | 'Automated Bills'
  | 'Rental Orders'
  | 'Statements'
  | 'Reports'
  | 'Other';

async function getOrCreateSubfolder(parentUri: string, folderName: string): Promise<string> {
  const { StorageAccessFramework } = FileSystem;
  try {
    const files = await StorageAccessFramework.readDirectoryAsync(parentUri);
    const targetSuffix = `/${folderName}`;
    const targetEncodedSuffix = `%2F${encodeURIComponent(folderName)}`;

    const match = files.find((f: string) => {
      const decoded = decodeURIComponent(f);
      return decoded.endsWith(targetSuffix) || decoded.endsWith(targetSuffix + '/') || f.endsWith(targetEncodedSuffix);
    });

    if (match) {
      return match;
    }

    const createdUri = await StorageAccessFramework.makeDirectoryAsync(parentUri, folderName);
    return createdUri || parentUri;
  } catch (err) {
    console.log(`[SAF-DEBUG] Subfolder resolution failed for ${folderName}, using parentUri:`, err);
    return parentUri;
  }
}

export async function saveFileToAndroidOrShare(
  cachedUri: string,
  fileName: string,
  dialogTitle: string,
  subFolder: DocumentSubfolder = 'Other',
  mimeType: string = 'application/pdf',
  uti: string = 'com.adobe.pdf'
): Promise<void> {
  if (Platform.OS !== 'android') {
    // iOS standard sharing sheet
    await Sharing.shareAsync(cachedUri, {
      mimeType: mimeType,
      dialogTitle: dialogTitle,
      UTI: uti,
    });
    return;
  }

  // Android Storage Access Framework (SAF)
  try {
    const { StorageAccessFramework } = FileSystem;
    
    console.log('[SAF-DEBUG] Starting saveFileToAndroidOrShare for file:', fileName, 'subFolder:', subFolder);
    console.log('[SAF-DEBUG] Checking SecureStore for key:', STORAGE_KEY);
    
    // 1. Check if a stored SAF directory URI permission already exists
    let folderUri = await SecureStore.getItemAsync(STORAGE_KEY);
    console.log('[SAF-DEBUG] Stored folderUri result:', folderUri ? folderUri : 'NULL / NOT FOUND');
    
    if (!folderUri) {
      console.log('[SAF-DEBUG] No stored URI found. Prompting user with requestDirectoryPermissionsAsync()...');
      const permissions = await StorageAccessFramework.requestDirectoryPermissionsAsync();
      console.log('[SAF-DEBUG] requestDirectoryPermissionsAsync response:', JSON.stringify(permissions));
      
      if (!permissions.granted) {
        console.log('[SAF-DEBUG] User canceled or denied directory permission. Falling back to Share sheet.');
        await Sharing.shareAsync(cachedUri, {
          mimeType: mimeType,
          dialogTitle: dialogTitle,
          UTI: uti,
        });
        return;
      }
      folderUri = permissions.directoryUri;
      console.log('[SAF-DEBUG] Granted directoryUri:', folderUri);
      if (folderUri) {
        await SecureStore.setItemAsync(STORAGE_KEY, folderUri);
        console.log('[SAF-DEBUG] Saved granted directoryUri to SecureStore under key:', STORAGE_KEY);
      }
    }

    if (!folderUri) {
      console.log('[SAF-DEBUG] Error: folderUri is still null after permission request');
      throw new Error('Failed to obtain folder URI');
    }

    // 2. Create/reuse "Udyog" root folder and document-specific subfolder
    const udyogFolderUri = await getOrCreateSubfolder(folderUri, 'Udyog');
    const destinationFolderUri = (subFolder && subFolder !== 'Other')
      ? await getOrCreateSubfolder(udyogFolderUri, subFolder)
      : udyogFolderUri;

    console.log('[SAF-DEBUG] Target destination folder URI:', destinationFolderUri);

    // 3. De-duplicate filename if it already exists in the destination folder
    let targetFileName = fileName;
    try {
      console.log('[SAF-DEBUG] Inspecting destination folder for existing files...');
      const existingFiles = await StorageAccessFramework.readDirectoryAsync(destinationFolderUri);
      const existingDecodedNames = existingFiles.map((f: string) => decodeURIComponent(f));

      let counter = 1;
      const lastDotIndex = fileName.lastIndexOf('.');
      const baseName = lastDotIndex > 0 ? fileName.substring(0, lastDotIndex) : fileName;
      const ext = lastDotIndex > 0 ? fileName.substring(lastDotIndex) : '';

      while (existingDecodedNames.some((name: string) => name.endsWith('/' + targetFileName) || name.endsWith('%2F' + targetFileName))) {
        targetFileName = `${baseName} (${counter})${ext}`;
        counter++;
      }
      console.log('[SAF-DEBUG] Target filename after de-duplication check:', targetFileName);
    } catch (checkErr) {
      console.log('[SAF-DEBUG] Error during filename de-duplication check:', checkErr);
    }

    // 4. Read cached file as base64 content
    console.log('[SAF-DEBUG] Reading cached file as base64 from:', cachedUri);
    const base64Content = await FileSystem.readAsStringAsync(cachedUri, {
      encoding: 'base64',
    });
    console.log('[SAF-DEBUG] Successfully read base64 content. Bytes size approx:', base64Content.length);

    // 5. Create destination file in the SAF directory
    console.log('[SAF-DEBUG] Calling createFileAsync on destinationFolderUri with targetFileName:', targetFileName, 'mimeType:', mimeType);
    const newFileUri = await StorageAccessFramework.createFileAsync(
      destinationFolderUri,
      targetFileName,
      mimeType
    );
    console.log('[SAF-DEBUG] createFileAsync succeeded! newFileUri:', newFileUri);

    if (!newFileUri) {
      throw new Error('Failed to create destination file in Udyog folder');
    }

    // 6. Write base64 content to the SAF file
    console.log('[SAF-DEBUG] Writing base64 content to newFileUri via writeAsStringAsync...');
    await StorageAccessFramework.writeAsStringAsync(newFileUri, base64Content, {
      encoding: 'base64',
    });
    console.log('[SAF-DEBUG] writeAsStringAsync completed successfully!');

    // 7. Auto-open the saved file directly for viewing
    try {
      const contentUri = await FileSystem.getContentUriAsync(cachedUri);
      await IntentLauncher.startActivityAsync('android.intent.action.VIEW', {
        data: contentUri,
        flags: 1, // FLAG_GRANT_READ_URI_PERMISSION
        type: mimeType,
      });
    } catch (openErr) {
      console.log('[SAF-DEBUG] Auto-open IntentLauncher failed, fallback to share sheet:', openErr);
      await Sharing.shareAsync(cachedUri, {
        mimeType: mimeType,
        dialogTitle: dialogTitle,
        UTI: uti,
      });
    }
  } catch (err: any) {
    console.log('[SAF-DEBUG] CATCH BLOCK TRIGGERED! Raw error:', err);
    console.log('[SAF-DEBUG] Error message string:', err?.message || String(err));
    
    // Only delete stored URI if the error is genuinely permission-related
    const errStr = String(err?.message || err).toLowerCase();
    const isPermissionError = 
      errStr.includes('permission') ||
      errStr.includes('securityexception') ||
      errStr.includes('revoked') ||
      errStr.includes('denied') ||
      errStr.includes('failed to obtain folder uri');

    console.log('[SAF-DEBUG] isPermissionError evaluation:', isPermissionError);

    if (isPermissionError) {
      console.log('[SAF-DEBUG] Permission error detected! Calling SecureStore.deleteItemAsync for key:', STORAGE_KEY);
      await SecureStore.deleteItemAsync(STORAGE_KEY);
    } else {
      console.log('[SAF-DEBUG] Non-permission error. Retaining stored URI in SecureStore.');
    }

    // Graceful fallback to share sheet for this attempt
    console.log('[SAF-DEBUG] Executing fallback Sharing.shareAsync...');
    try {
      await Sharing.shareAsync(cachedUri, {
        mimeType: mimeType,
        dialogTitle: dialogTitle,
        UTI: uti,
      });
      console.log('[SAF-DEBUG] Fallback Sharing.shareAsync completed.');
    } catch (shareErr) {
      console.log('[SAF-DEBUG] Fallback sharing error:', shareErr);
      Alert.alert('Error', 'Could not save or share file. Please try again.');
    }
  }
}

export async function savePdfToAndroidOrShare(
  cachedUri: string,
  fileName: string,
  dialogTitle: string,
  subFolder: DocumentSubfolder = 'Other'
): Promise<void> {
  return saveFileToAndroidOrShare(cachedUri, fileName, dialogTitle, subFolder, 'application/pdf', 'com.adobe.pdf');
}

export async function saveCsvToAndroidOrShare(
  cachedUri: string,
  fileName: string,
  dialogTitle: string,
  subFolder: DocumentSubfolder = 'Reports'
): Promise<void> {
  return saveFileToAndroidOrShare(cachedUri, fileName, dialogTitle, subFolder, 'text/csv', 'public.comma-separated-values-text');
}
