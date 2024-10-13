import { NextApiRequest, NextApiResponse } from 'next';
import { createUploadUrl, getAssetIdFromUpload, getAssetDetails } from '../../lib/mux';
import { supabase } from '../../lib/supabase';
import { transcribeAudio } from '../../lib/whisper';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method === 'POST') {
    try {
      const { url: uploadUrl, uploadId } = await createUploadUrl();
      res.status(200).json({ uploadUrl, uploadId });
    } catch (error) {
      console.error('Error creating upload URL:', error);
      res.status(500).json({ error: 'Error creating upload URL' });
    }
  } else if (req.method === 'GET') {
    const { uploadId } = req.query;

    if (typeof uploadId !== 'string') {
      return res.status(400).json({ error: 'Invalid uploadId (expected Upload ID)' });
    }

    try {
      const actualAssetId = await getAssetIdFromUpload(uploadId);
      if (!actualAssetId) {
        return res.status(400).json({ error: 'Could not retrieve Asset ID from Upload ID' });
      }

      const asset = await getAssetDetails(actualAssetId);
      if (!asset) {
        return res.status(404).json({ error: 'Asset not found' });
      }

      console.log(`Asset Status: ${asset.status}`);

      if (asset.status !== 'ready') {
        return res.status(400).json({ error: 'Asset is not ready yet' });
      }

      // **Updated Section**: Use the asset's playback ID for transcription
      const playbackId = asset.playback_ids?.[0]?.id;

      if (!playbackId) {
        return res.status(400).json({ error: 'Asset playback ID not available' });
      }

      const videoUrl = `https://stream.mux.com/${playbackId}.m3u8`;

      // Transcribe the audio
      const transcript = await transcribeAudio(videoUrl);

      // Insert into Supabase
      const { data, error } = await supabase
        .from('friction_logs')
        .insert({
          video_url: videoUrl,
          log: transcript,
          recommendations: [],
        })
        .select()
        .single();

      if (error) {
        console.error('Supabase error:', error);
        return res.status(500).json({ error: 'Error inserting data into database' });
      }

      res.status(200).json({ playbackId: asset.playback_ids?.[0]?.id, frictionLogId: data.id, log: transcript });
    } catch (error) {
      console.error('Error processing video:', error);
      res.status(500).json({ error: 'Error processing video' });
    }
  } else {
    res.setHeader('Allow', ['POST', 'GET']);
    res.status(405).end(`Method ${req.method} Not Allowed`);
  }
}
