// The shape of a voice note: how loud each slice of it is, read from the recording itself, so
// the bars drawn for it are its own and not decoration.

const cache = new Map();

/**
 * `count` heights between 0 and 1, and the length in seconds. A recording the browser cannot
 * fetch or decode (another site's file that refuses to be read, say) gives `null` peaks, and
 * the player draws plain even bars instead of a shape it does not know.
 */
export function peaksFor(url, count = 40) {
    const key = `${url}|${count}`;
    if (!cache.has(key)) cache.set(key, read(url, count));
    return cache.get(key);
}

async function read(url, count) {
    try {
        const res = await fetch(url);
        if (!res.ok) throw new Error(String(res.status));
        const data = await res.arrayBuffer();
        // An offline context decodes without needing a click first, and plays nothing.
        const ctx = new (window.OfflineAudioContext || window.webkitOfflineAudioContext)(1, 1, 44100);
        const audio = await ctx.decodeAudioData(data);
        const samples = audio.getChannelData(0);
        const size = Math.max(1, Math.floor(samples.length / count));
        const peaks = [];
        for (let i = 0; i < count; i++) {
            let max = 0;
            const end = Math.min(samples.length, (i + 1) * size);
            for (let j = i * size; j < end; j += 16) max = Math.max(max, Math.abs(samples[j]));
            peaks.push(max);
        }
        const top = Math.max(...peaks) || 1;
        return { peaks: peaks.map(p => Math.max(0.08, p / top)), duration: audio.duration };
    } catch {
        return { peaks: null, duration: 0 };
    }
}

/** "0:07", "1:23". */
export const clock = (seconds) => {
    const s = Math.max(0, Math.round(seconds || 0));
    return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
};
