/**
 * StudentHub - High-Performance Google Drive Image Upload Service
 * Optimized for high-resolution images & zero rate limits
 * 
 * DEPLOYMENT INSTRUCTIONS:
 * 1. Open https://script.google.com and open your existing project (or create a new one).
 * 2. Paste this entire updated code into `Code.gs`.
 * 3. Click "Deploy" (top right) -> "Manage deployments".
 * 4. Click the Edit (pencil) icon next to your Web app deployment.
 * 5. Under "Version", select "New version".
 * 6. Click "Deploy".
 */

function doPost(e) {
  try {
    if (!e || !e.postData || !e.postData.contents) {
      throw new Error("No data received in POST request.");
    }

    var data = JSON.parse(e.postData.contents);
    var base64Data = data.base64;
    var filename = data.filename || ("upload_" + new Date().getTime() + ".jpg");
    var mimeType = data.mimeType || "image/jpeg";

    if (!base64Data) {
      throw new Error("Missing 'base64' property in request body.");
    }

    // Decode base64 to binary blob
    var decoded = Utilities.base64Decode(base64Data);
    var blob = Utilities.newBlob(decoded, mimeType, filename);

    // Fast O(1) folder access using cached folderId to prevent Drive search rate limits
    var folder = getOrCreateUploadFolder();

    // Create the file in Google Drive
    var file = folder.createFile(blob);

    // Set permission to anyone with link can view (required for CDN direct URLs)
    file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);

    var fileId = file.getId();
    // Google's direct CDN endpoint (works in <img> tags with zero CORS blocks)
    var cdnUrl = "https://lh3.googleusercontent.com/d/" + fileId;

    var response = {
      success: true,
      fileId: fileId,
      url: cdnUrl,
      name: filename
    };

    return ContentService.createTextOutput(JSON.stringify(response))
      .setMimeType(ContentService.MimeType.JSON);

  } catch (err) {
    var errorResponse = {
      success: false,
      error: err.toString()
    };
    return ContentService.createTextOutput(JSON.stringify(errorResponse))
      .setMimeType(ContentService.MimeType.JSON);
  }
}

// Cached Folder Resolver: prevents scanning entire 5TB Google Drive on every upload
function getOrCreateUploadFolder() {
  var folderName = "StudentHub_Uploads";
  var scriptProps = PropertiesService.getScriptProperties();
  var cachedFolderId = scriptProps.getProperty("STUDENTHUB_FOLDER_ID");

  if (cachedFolderId) {
    try {
      return DriveApp.getFolderById(cachedFolderId);
    } catch (e) {
      // If folder was moved/deleted, fall through to re-locate
    }
  }

  var folders = DriveApp.getFoldersByName(folderName);
  var folder;
  if (folders.hasNext()) {
    folder = folders.next();
  } else {
    folder = DriveApp.createFolder(folderName);
  }

  scriptProps.setProperty("STUDENTHUB_FOLDER_ID", folder.getId());
  return folder;
}

function doGet(e) {
  return ContentService.createTextOutput(JSON.stringify({
    status: "online",
    service: "StudentHub Google Drive Image Uploader",
    timestamp: new Date().toISOString()
  })).setMimeType(ContentService.MimeType.JSON);
}
