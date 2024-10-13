'use client'

import { useState, useEffect } from 'react'
import { Button, Input, Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle, Label, Textarea } from "@/components/ui"
import { Upload, Loader2 } from 'lucide-react'
import { useCompletion } from 'ai/react'
import MuxPlayer from '@mux/mux-player-react'

export default function FrictionLogGenerator() {
  const [file, setFile] = useState<File | null>(null)
  const [uploadProgress, setUploadProgress] = useState(0)
  const [videoUrl, setVideoUrl] = useState<string | null>(null)
  const [isUploading, setIsUploading] = useState(false)

  const { complete, completion, isLoading, error: completionError } = useCompletion({
    api: '/api/ai-analysis',
    onResponse: async (response) => {
      if (!response.ok) {
        throw new Error(response.statusText);
      }
      // Clone the response to avoid locking the stream
      const clone = response.clone();
      const text = await clone.text();
      console.log('Response Text:', text);
    },
  });

  useEffect(() => {
    console.log('Completion state updated:', completion);
    if (completionError) {
      console.error('Completion Error:', completionError);
    }
  }, [completion, completionError]);

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    if (event.target.files && event.target.files[0]) {
      setFile(event.target.files[0])
    }
  }

  const handleUpload = async () => {
    if (!file) return;

    setIsUploading(true);
    try {
      // Step 1: Request upload URL and Upload ID from the server
      const response = await fetch('/api/analyze-video', { method: 'POST' });
      if (!response.ok) {
        throw new Error('Failed to get upload URL');
      }
      const { uploadUrl, uploadId } = await response.json(); // Receive Upload ID

      if (!uploadId) {
        throw new Error('Invalid uploadId received from server');
      }

      // Step 2: Upload the file to Mux
      const uploadResponse = await fetch(uploadUrl, {
        method: 'PUT',
        body: file,
      });

      if (!uploadResponse.ok) {
        throw new Error('Failed to upload video');
      }

      // Step 3: Poll the server until the asset is ready
      const maxRetries = 10;
      const delayMs = 3000; // 3 seconds
      let attempt = 0;
      let analysisResponse;

      while (attempt < maxRetries) {
        attempt++;
        analysisResponse = await fetch(`/api/analyze-video?uploadId=${uploadId}`);
        if (analysisResponse.ok) {
          break; // Asset is ready, exit the loop
        } else {
          const errorData = await analysisResponse.json();
          if (errorData.error === 'Asset is not ready yet') {
            console.log(`Attempt ${attempt}: Asset not ready, retrying in ${delayMs / 1000} seconds...`);
            await new Promise(res => setTimeout(res, delayMs));
          } else {
            throw new Error(errorData.error || 'Failed to analyze video');
          }
        }
      }

      if (!analysisResponse || !analysisResponse.ok) {
        throw new Error('Asset processing timed out. Please try again later.');
      }

      const analysis = await analysisResponse.json();
      console.log('Analysis response:', analysis);

      setVideoUrl(`https://stream.mux.com/${analysis.playbackId}.m3u8`);

      // Step 4: Pass the transcript and frictionLogId to the AI analysis
      console.log(`Sending prompt to AI: Transcript: ${analysis.log}\nFriction Log ID: ${analysis.frictionLogId}`);
      await complete(`Transcript: ${analysis.log}\nFriction Log ID: ${analysis.frictionLogId}`);
      
    } catch (error: any) {
      console.error(error);
      alert(error.message);
    } finally {
      setIsUploading(false);
    }
  }

  console.log('Current completion state:', completion);
  console.log('Current completion error:', completionError);
  
  return (
    <div className="container mx-auto p-4">
      <Card className="w-full max-w-2xl mx-auto">
        <CardHeader>
          <CardTitle>Friction Log Generator</CardTitle>
          <CardDescription>Upload a video of software usage to generate a friction log and recommendations.</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid w-full items-center gap-4">
            <div className="flex flex-col space-y-1.5">
              <Label htmlFor="video">Upload Video</Label>
              <Input id="video" type="file" accept="video/*" onChange={handleFileChange} />
            </div>
          </div>
        </CardContent>
        <CardFooter className="flex justify-between">
          <Button onClick={handleUpload} disabled={!file || isUploading || isLoading}>
            {isUploading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Uploading
              </>
            ) : isLoading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Analyzing
              </>
            ) : (
              <>
                <Upload className="mr-2 h-4 w-4" />
                Generate Friction Log
              </>
            )}
          </Button>
        </CardFooter>
      </Card>

      {videoUrl && (
        <Card className="w-full max-w-2xl mx-auto mt-8">
          <CardHeader>
            <CardTitle>Uploaded Video</CardTitle>
          </CardHeader>
          <CardContent>
            <MuxPlayer
              streamType="on-demand"
              playbackId={videoUrl.split('/')[3].split('.')[0]}
              metadata={{
                video_id: 'video-id-54321',
                video_title: 'Test video title',
                viewer_user_id: 'user-id-007',
              }}
            />
          </CardContent>
        </Card>
      )}

      <Card className="w-full max-w-2xl mx-auto mt-8">
        <CardHeader>
          <CardTitle>AI Analysis</CardTitle>
        </CardHeader>
        <CardContent>
          {completion ? (
            <Textarea value={completion} readOnly className="min-h-[200px]" />
          ) : completionError ? (
            <p className="text-red-500 mt-2">Error: {completionError.message}</p>
          ) : (
            <p>No AI analysis available yet. Please upload a video and generate a friction log.</p>
          )}
        </CardContent>
      </Card>
    </div>
  )
}