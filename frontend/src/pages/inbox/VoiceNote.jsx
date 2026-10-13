// A voice note as a waveform: play or pause, the recording's own shape filling in as it plays,
// a click on the shape to jump there, and how long it is. The browser's own player showed
// "0:00 / 0:00" until played and looked like a form control rather than a message.
import { useEffect, useRef, useState } from 'react';
import { IconPlay, IconPause } from '../../components/ui/icons.jsx';
import { peaksFor, clock } from '../../lib/waveform.js';
import { t } from '../../lib/i18n.js';

const BARS = 40;
const EVEN = Array.from({ length: BARS }, () => 0.35);

export default function VoiceNote({ url }) {
    const audio = useRef(null);
    const [peaks, setPeaks] = useState(null);
    const [duration, setDuration] = useState(0);
    const [time, setTime] = useState(0);
    const [playing, setPlaying] = useState(false);

    useEffect(() => {
        let live = true;
        setPeaks(null); setTime(0); setPlaying(false);
        peaksFor(url, BARS).then(r => {
            if (!live) return;
            setPeaks(r.peaks || EVEN);
            if (r.duration) setDuration(r.duration);
        });
        return () => { live = false; };
    }, [url]);

    const toggle = () => {
        const a = audio.current;
        if (!a) return;
        if (a.paused) a.play().catch(() => setPlaying(false)); else a.pause();
    };

    const seek = (e) => {
        const a = audio.current;
        const length = duration || a?.duration;
        if (!a || !length || !Number.isFinite(length)) return;
        const box = e.currentTarget.getBoundingClientRect();
        a.currentTime = Math.min(1, Math.max(0, (e.clientX - box.left) / box.width)) * length;
        setTime(a.currentTime);
    };

    const progress = duration ? time / duration : 0;
    const bars = peaks || EVEN;
    return (
        <div className={`voice${playing ? ' is-playing' : ''}`}>
            <button type="button" className="voice__btn" onClick={toggle}
                    aria-label={playing ? t('Pause voice note') : t('Play voice note')}>
                {playing ? <IconPause size={14} /> : <IconPlay size={14} />}
            </button>
            <div className={`voice__wave${peaks ? '' : ' is-loading'}`} onClick={seek} role="presentation">
                {bars.map((h, i) => (
                    <i key={i} className={i / bars.length < progress ? 'is-played' : ''} style={{ height: `${Math.round(h * 100)}%` }} />
                ))}
            </div>
            <span className="voice__time">{clock(playing || time ? time : duration)}</span>
            <audio ref={audio} src={url} preload="metadata"
                   onLoadedMetadata={(e) => { if (!duration && Number.isFinite(e.target.duration)) setDuration(e.target.duration); }}
                   onTimeUpdate={(e) => setTime(e.target.currentTime)}
                   onPlay={() => setPlaying(true)} onPause={() => setPlaying(false)}
                   onEnded={() => { setPlaying(false); setTime(0); }} />
        </div>
    );
}
