import Mux from '@mux/mux-node';

const muxClient = new Mux({
  tokenId: process.env.MUX_TOKEN_ID!,
  tokenSecret: process.env.MUX_TOKEN_SECRET!
});

const { video } = muxClient;

// Function to create an upload URL and return both URL and Upload ID
export async function createUploadUrl() {
  const upload = await video.uploads.create({
    new_asset_settings: { playback_policy: ['public'] },
    cors_origin: process.env.NEXT_PUBLIC_URL || '',
  });

  console.log('Mux upload response:', upload);

  return { url: upload.url, uploadId: upload.id };
}

// Function to retrieve Asset ID from Upload ID with retries
export async function getAssetIdFromUpload(uploadId: string, retries = 5, delayMs = 2000): Promise<string | null> {
  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      const upload = await video.uploads.retrieve(uploadId);
      if (upload.asset_id) {
        return upload.asset_id;
      }
      console.log(`Attempt ${attempt}: Asset ID not found for Upload ID ${uploadId}. Retrying in ${delayMs}ms...`);
    } catch (error) {
      console.error(`Attempt ${attempt}: Error retrieving Mux upload:`, error);
    }
    await new Promise(res => setTimeout(res, delayMs));
  }
  return null;
}

// Function to retrieve Asset Details
export async function getAssetDetails(assetId: string) {
  try {
    const asset = await video.assets.retrieve(assetId);
    return asset;
  } catch (error) {
    console.error('Error retrieving Mux asset details:', error);
    return null;
  }
}

