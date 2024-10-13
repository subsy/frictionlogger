import type { NextApiRequest, NextApiResponse } from 'next';
import OpenAI from 'openai';
import { supabase } from '../../lib/supabase';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY!,
});

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { prompt } = req.body;

  if (!prompt) {
    return res.status(400).json({ error: 'Missing prompt' });
  }

  const [, frictionLogId] = prompt.match(/Friction Log ID: (.+)$/m) || [];

  if (!frictionLogId) {
    return res.status(400).json({ error: 'Missing frictionLogId' });
  }

  try {
    const response = await openai.chat.completions.create({
      model: 'gpt-4o',
      messages: [
        {
          role: 'system',
          content: 'You are an expert UX analyst. Analyze the following video transcript and provide a detailed friction log and recommendations for improvement.',
        },
        {
          role: 'user',
          content: [
            { type: 'text', text: 'Analyze this video transcript for UX friction points:' },
            { type: 'text', text: prompt },
          ],
        },
      ],
      max_tokens: 500,
    });

    const aiAnalysis = response.choices[0].message?.content;

    if (!aiAnalysis) {
      return res.status(500).json({ error: 'No analysis generated' });
    }

    // Update the friction log with AI analysis
    const { error } = await supabase
      .from('friction_logs')
      .update({ recommendations: [aiAnalysis] })
      .eq('id', frictionLogId);

    if (error) {
      console.error('Supabase error:', error);
      return res.status(500).json({ error: 'Error updating database' });
    }

    console.log('AI Analysis Generated:', aiAnalysis);
    console.log('Sending completion response to client.');

    res.setHeader('Content-Type', 'text/plain');
    res.send(aiAnalysis);
  } catch (error: any) {
    console.error('Error with OpenAI API:', error);
    res.status(500).json({ error: 'Error processing request' });
  }
}
