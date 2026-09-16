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

            resolve(canvas.toDataURL('image/jpeg', 0.82));
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
    return (a + b).toUpperCase();
}
