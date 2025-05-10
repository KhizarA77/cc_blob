const express = require('express');
const multer = require('multer');
const path = require('path');
const dotenv = require('dotenv');
const { v4: uuidv4 } = require('uuid');

// Load environment variables
dotenv.config();

// Initialize Express app
const app = express();
const port = process.env.PORT || 3000;

// Set up EJS as the view engine
app.set('view engine', 'ejs');
app.use(express.static(path.join(__dirname, 'public')));

// Set up multer for file uploads
const storage = multer.memoryStorage();
const upload = multer({ 
  storage: storage,
  limits: {
    fileSize: 10 * 1024 * 1024 // 10MB size limit
  }
});

// Azure Storage connection
const { BlobServiceClient, StorageSharedKeyCredential, generateBlobSASQueryParameters } = require('@azure/storage-blob');
const connectionString = process.env.AZURE_STORAGE_CONNECTION_STRING;
const containerName = process.env.CONTAINER_NAME;
const blobServiceClient = BlobServiceClient.fromConnectionString(connectionString);
const containerClient = blobServiceClient.getContainerClient(containerName);

// Helper function to generate SAS URL for a blob (valid for 1 hour)
async function generateBlobSasUrl(blobName) {
  const blobClient = containerClient.getBlobClient(blobName);
  
  // Get account name from connection string
  const accountName = blobServiceClient.accountName;
  
  // Create a SAS token that's valid for 1 hour
  const sasOptions = {
    containerName: containerName,
    blobName: blobName,
    permissions: "r", // Read permission
    startsOn: new Date(),
    expiresOn: new Date(new Date().valueOf() + 3600 * 1000), // 1 hour
  };

  // Generate SAS token
  const sasToken = await generateBlobSASToken(
    accountName,
    containerName,
    blobName,
    "r",
    new Date(new Date().valueOf() + 3600 * 1000)
  );
  
  // Return the full URL with the SAS token
  return `${blobClient.url}?${sasToken}`;
}

// Helper function to generate SAS token
async function generateBlobSASToken(accountName, containerName, blobName, permissions, expiresOn) {
  // Extract account key from connection string
  const accountKey = connectionString.match(/AccountKey=([^;]*)/)[1];
  
  // Create a credential with the storage account name and key
  const sharedKeyCredential = new StorageSharedKeyCredential(accountName, accountKey);
  
  // Create a SAS token
  const sasToken = generateBlobSASQueryParameters({
    containerName,
    blobName,
    permissions,
    expiresOn,
  }, sharedKeyCredential).toString();
  
  return sasToken;
}

// Main route
app.get('/', async (req, res) => {
  try {
    const blobList = [];
    const listBlobsResponse = containerClient.listBlobsFlat();
    
    for await (const blob of listBlobsResponse) {
      const blobClient = containerClient.getBlobClient(blob.name);
      
      // Generate SAS URL for the blob
      const sasUrl = await generateBlobSasUrl(blob.name);
      
      blobList.push({
        name: blob.name,
        url: sasUrl, // Use SAS URL instead of regular URL
        contentType: blob.properties.contentType,
        size: formatBytes(blob.properties.contentLength),
        lastModified: new Date(blob.properties.lastModified).toLocaleString()
      });
    }
    
    res.render('index', { blobs: blobList });
  } catch (error) {
    console.error('Error retrieving blobs:', error);
    res.status(500).send(`Error: ${error.message}`);
  }
});

// Upload route
app.post('/upload', upload.single('file'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).send('No file uploaded');
    }

    // Generate a unique name for the blob
    const originalName = req.file.originalname;
    const extension = path.extname(originalName);
    const fileName = `${path.basename(originalName, extension)}-${uuidv4()}${extension}`;
    
    // Get a block blob client
    const blockBlobClient = containerClient.getBlockBlobClient(fileName);
    
    // Set blob content type
    const options = { 
      blobHTTPHeaders: { 
        blobContentType: req.file.mimetype 
      }
    };
    
    // Upload the file
    await blockBlobClient.upload(req.file.buffer, req.file.buffer.length, options);
    
    res.redirect('/');
  } catch (error) {
    console.error('Error uploading file:', error);
    res.status(500).send(`Error: ${error.message}`);
  }
});

// Delete route
app.post('/delete/:blobName', async (req, res) => {
  try {
    const blobName = decodeURIComponent(req.params.blobName);
    const blockBlobClient = containerClient.getBlockBlobClient(blobName);
    
    await blockBlobClient.delete();
    
    res.redirect('/');
  } catch (error) {
    console.error('Error deleting blob:', error);
    res.status(500).send(`Error: ${error.message}`);
  }
});

// Helper function to format bytes
function formatBytes(bytes, decimals = 2) {
  if (bytes === 0) return '0 Bytes';
  
  const k = 1024;
  const dm = decimals < 0 ? 0 : decimals;
  const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB', 'PB', 'EB', 'ZB', 'YB'];
  
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  
  return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
}

// Start the server
app.listen(port, () => {
  console.log(`Server running at http://localhost:${port}`);
});