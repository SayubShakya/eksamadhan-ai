import { useMemo } from 'react';
import qrcode from 'qrcode-generator';

/**
 * A QR code for a link, drawn as SVG so it stays sharp at any size. Always dark on white, even
 * in dark mode: phone cameras read that contrast most reliably.
 */
export default function QrCode({ value, size = 168, label }) {
    const cells = useMemo(() => {
        if (!value) return null;
        const qr = qrcode(0, 'M');           // version chosen to fit; medium error correction
        qr.addData(value);
        qr.make();
        const n = qr.getModuleCount();
        const dark = [];
        for (let r = 0; r < n; r++) for (let c = 0; c < n; c++) if (qr.isDark(r, c)) dark.push(`M${c} ${r}h1v1h-1z`);
        return { n, path: dark.join('') };
    }, [value]);
    if (!cells) return null;
    const pad = 2;
    return (
        <svg className="qr" width={size} height={size} viewBox={`${-pad} ${-pad} ${cells.n + pad * 2} ${cells.n + pad * 2}`}
             role="img" aria-label={label} shapeRendering="crispEdges">
            <rect x={-pad} y={-pad} width={cells.n + pad * 2} height={cells.n + pad * 2} fill="#fff" />
            <path d={cells.path} fill="#111827" />
        </svg>
    );
}
