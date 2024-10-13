import axios from 'axios';
import ffmpegInstaller from '@ffmpeg-installer/ffmpeg';
import ffmpeg from 'fluent-ffmpeg';
import { PassThrough } from 'stream';
import FormData from 'form-data';
import fs from 'fs';

ffmpeg.setFfmpegPath(ffmpegInstaller.path);

/**
 * Transcribes audio extracted from a video URL using OpenAI's Whisper API.
 * @param videoUrl - The URL of the video to transcribe.
 * @returns The transcription text.
 */
export async function transcribeAudio(videoUrl: string): Promise<string> {
  try {
    // Step 1: Download the video and convert to MP3 using ffmpeg
    const outputPath = `/tmp/${Date.now()}.mp3`;
    await new Promise((resolve, reject) => {
      ffmpeg(videoUrl)
        .outputOptions('-vn')
        .audioCodec('libmp3lame')
        .audioBitrate('128k')
        .output(outputPath)
        .on('end', resolve)
        .on('error', reject)
        .run();
    });

    // Step 2: Read the MP3 file
    const audioFile = fs.createReadStream(outputPath);

    // Step 3: Prepare form data for Whisper API
    const form = new FormData();
    form.append('file', audioFile, {
      filename: 'audio.mp3',
      contentType: 'audio/mpeg',
    });
    form.append('model', 'whisper-1');

    // Step 4: Send audio file to Whisper API
    const transcriptionResponse = await axios.post(
      'https://api.openai.com/v1/audio/transcriptions',
      form,
      {
        headers: {
          ...form.getHeaders(),
          'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`,
        },
        timeout: 60000, // Increased timeout to accommodate longer processing
      }
    );

    // Step 5: Clean up the temporary file
    fs.unlinkSync(outputPath);

    return transcriptionResponse.data.text;
  } catch (error: any) {
    console.error('Error in transcribeAudio:', error);
    throw new Error('Failed to transcribe audio: ' + error.message);
  }
}
