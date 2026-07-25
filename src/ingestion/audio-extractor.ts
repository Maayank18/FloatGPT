/**
 * Extracts transcript from an Audio file.
 * In a full production app, this would send the blob to OpenAI Whisper API or Google Speech-to-Text.
 */
export async function extractAudioTranscript(file: File): Promise<string> {
  // Placeholder for audio transcription
  throw new Error("Audio file transcription (STT) requires an external API integration which is not yet configured.");
}
