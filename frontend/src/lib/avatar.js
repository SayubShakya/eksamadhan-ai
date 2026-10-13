const SIZE = 128;

/**
 * Reads an image file into a small square data URL.
 *
 * The profile lives in localStorage, which holds only a few megabytes — a phone photo
 * would blow that budget on its own. Downscaling to 128px keeps it a few KB.
 */
export function fileToAvatar(file) {
    return new Promise((resolve, reject) => {
        if (!file.type.startsWith('image/')) {
            reject(new Error('That file is not an image.'));
            return;
        }
        if (file.size > 8 * 1024 * 1024) {
            reject(new Error('That image is larger than 8 MB.'));
            return;
        }

        const url = URL.createObjectURL(file);
        const img = new Image();

        img.onload = () => {
            URL.revokeObjectURL(url);
            const canvas = document.createElement('canvas');
            canvas.width = canvas.height = SIZE;
            const ctx = canvas.getContext('2d');

            // Cover-crop from the centre so portraits are not squashed.
            const scale = Math.max(SIZE / img.width, SIZE / img.height);
            const w = img.width * scale;
            const h = img.height * scale;
            ctx.drawImage(img, (SIZE - w) / 2, (SIZE - h) / 2, w, h);

            // Step the quality down if the result is still large, so a photo can never
            // fill the storage budget and make the save fail.
            let out = canvas.toDataURL('image/jpeg', 0.82);
            for (const q of [0.6, 0.4]) {
                if (out.length <= 120_000) break;
                out = canvas.toDataURL('image/jpeg', q);
            }
            resolve(out);
        };

        img.onerror = () => {
            URL.revokeObjectURL(url);
            reject(new Error('That image could not be read.'));
        };

        img.src = url;
    });
}

const LOGO_SIZE = 160;

/**
 * Reads a logo into a small square data URL. Unlike a photo it is fitted, not cropped, so a
 * wide wordmark keeps its ends, and it stays a PNG so a transparent background stays so.
 */
export function fileToLogo(file) {
    return new Promise((resolve, reject) => {
        if (!file.type.startsWith('image/')) {
            reject(new Error('That file is not an image.'));
            return;
        }
        if (file.size > 8 * 1024 * 1024) {
            reject(new Error('That image is larger than 8 MB.'));
            return;
        }

        const url = URL.createObjectURL(file);
        const img = new Image();

        img.onload = () => {
            URL.revokeObjectURL(url);
            const canvas = document.createElement('canvas');
            canvas.width = canvas.height = LOGO_SIZE;
            const ctx = canvas.getContext('2d');
            const scale = Math.min(LOGO_SIZE / img.width, LOGO_SIZE / img.height);
            const w = img.width * scale;
            const h = img.height * scale;
            ctx.drawImage(img, (LOGO_SIZE - w) / 2, (LOGO_SIZE - h) / 2, w, h);

            // A busy PNG can still be large: then a JPEG on white, which the server accepts.
            let out = canvas.toDataURL('image/png');
            if (out.length > 120_000) {
                const flat = document.createElement('canvas');
                flat.width = flat.height = LOGO_SIZE;
                const f = flat.getContext('2d');
                f.fillStyle = '#fff';
                f.fillRect(0, 0, LOGO_SIZE, LOGO_SIZE);
                f.drawImage(canvas, 0, 0);
                out = flat.toDataURL('image/jpeg', 0.85);
            }
            resolve(out);
        };

        img.onerror = () => {
            URL.revokeObjectURL(url);
            reject(new Error('That image could not be read.'));
        };

        img.src = url;
    });
}

export function fullName(user) {
    return [user.firstName, user.lastName].filter(Boolean).join(' ').trim();
}

export function userInitials(user) {
    const a = (user.firstName || '').trim()[0] || '';
    const b = (user.lastName || '').trim()[0] || '';
    if (a || b) return (a + b).toUpperCase();

    // A customer has one display name from Meta rather than two fields, so "Sayub Shakya"
    // has to give SS here the same way it does everywhere else.
    return (user.name || '').trim().split(/\s+/).slice(0, 2)
        .map(word => word[0] || '').join('').toUpperCase();
}
