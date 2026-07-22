import { Platform, Alert } from 'react-native';
import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';
import * as SecureStore from 'expo-secure-store';

const STORAGE_KEY = 'udyog_save_folder_uri';

export async function saveFileToAndroidOrShare(
  cachedUri: string,
  fileName: string,
  dialogTitle: string,
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
    
    // 1. Check if a stored SAF directory URI permission already exists
    let folderUri = await SecureStore.getItemAsync(STORAGE_KEY);
    
    if (!folderUri) {
      // Prompt user to pick/confirm a directory
      const permissions = await StorageAccessFramework.requestDirectoryPermissionsAsync();
      if (!permissions.granted) {
        // Fallback to Sharing.shareAsync if canceled/denied
        await Sharing.shareAsync(cachedUri, {
          mimeType: mimeType,
          dialogTitle: dialogTitle,
          UTI: uti,
        });
        return;
      }
      folderUri = permissions.directoryUri;
      if (folderUri) {
        await SecureStore.setItemAsync(STORAGE_KEY, folderUri);
      }
    }

    if (!folderUri) {
      throw new Error('Failed to obtain folder URI');
    }

    // 2. Create/reuse a "Udyog" subfolder
    let udyogFolderUri = '';
    const files = await StorageAccessFramework.readDirectoryAsync(folderUri);
    const udyogMatch = files.find((f: string) => {
      const decoded = decodeURIComponent(f);
      return decoded.endsWith('/Udyog') || decoded.endsWith('/Udyog/') || decoded.endsWith('%2FUdyog');
    });

    if (udyogMatch) {
      udyogFolderUri = udyogMatch;
    } else {
      try {
        const createdUri = await StorageAccessFramework.makeDirectoryAsync(folderUri, 'Udyog');
        udyogFolderUri = createdUri || folderUri;
      } catch (err) {
        console.log('makeDirectoryAsync error:', err);
        udyogFolderUri = folderUri;
      }
    }

    // 3. Read cached file as base64 content
    const base64Content = await FileSystem.readAsStringAsync(cachedUri, {
      encoding: 'base64',
    });

    // 4. Create the destination file in the SAF directory
    const newFileUri = await StorageAccessFramework.createFileAsync(
      udyogFolderUri,
      fileName,
      mimeType
    );

    if (!newFileUri) {
      throw new Error('Failed to create destination file in Udyog folder');
    }

    // 5. Write base64 content to the SAF file
    await StorageAccessFramework.writeAsStringAsync(newFileUri, base64Content, {
      encoding: 'base64',
    });

    Alert.alert('Saved Successfully', `Saved to Udyog folder as ${fileName}`);
  } catch (err) {
    console.log('Android SAF error, clearing stored URI and falling back to sharing sheet:', err);
    // Clear stored URI if permission was revoked or URI became invalid
    await SecureStore.deleteItemAsync(STORAGE_KEY);
    
    // Graceful fallback to share sheet for this attempt
    try {
      await Sharing.shareAsync(cachedUri, {
        mimeType: mimeType,
        dialogTitle: dialogTitle,
        UTI: uti,
      });
    } catch (shareErr) {
      console.log('Fallback sharing error:', shareErr);
      Alert.alert('Error', 'Could not save or share file. Please try again.');
    }
  }
}

export async function savePdfToAndroidOrShare(
  cachedUri: string,
  fileName: string,
  dialogTitle: string
): Promise<void> {
  return saveFileToAndroidOrShare(cachedUri, fileName, dialogTitle, 'application/pdf', 'com.adobe.pdf');
}

export async function saveCsvToAndroidOrShare(
  cachedUri: string,
  fileName: string,
  dialogTitle: string
): Promise<void> {
  return saveFileToAndroidOrShare(cachedUri, fileName, dialogTitle, 'text/csv', 'public.comma-separated-values-text');
}
