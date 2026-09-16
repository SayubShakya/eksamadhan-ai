/**
 * Microphone recording for voice messages.
 *
 * Chrome produces WebM/Opus and Safari MP4; the backend transcodes either to AAC
 * because Meta rejects WebM. Nothing here assumes a format.
 */
export function isRecordingSupported() {
    return typeof MediaRecorder !== 'undefined'
        && !!navigator.mediaDevices?.getUserMedia;
}

export async function startRecording() {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    const recorder = new MediaRecorder(stream);
    const chunks = [];

    recorder.ondataavailable = (e) => { if (e.data.size) chunks.push(e.data); };
    recorder.start();

    return {
        stop: () => new Promise((resolve) => {
            recorder.onstop = () => {
                stream.getTracks().forEach(t => t.stop());   // release the mic light
                resolve(new Blob(chunks, { type: recorder.mimeType || 'audio/webm' }));
            };
            recorder.stop();
        }),
        cancel: () => {
            recorder.onstop = () => {};
            try { recorder.stop(); } catch { /* already stopped */ }
            stream.getTracks().forEach(t => t.stop());
        },
    };
}

export function formatDuration(seconds) {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m}:${String(s).padStart(2, '0')}`;
}
