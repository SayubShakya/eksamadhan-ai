// The upload and picture tabs: one area that fills the add card (the card keeps the tallest
// tab's height so switching never moves the page), accepting a dropped file as well as the
// button. A drop goes through the same handler as the picker, so the same checks apply.
import { useState } from 'react';

export default function DropZone({ Icon, title, hint, onFile, disabled, children }) {
    const [over, setOver] = useState(false);
    const drag = (on) => (e) => {
        e.preventDefault();
        if (!disabled) setOver(on);
    };
    return (
        <div className="kq-zone" data-over={over || undefined}
             onDragEnter={drag(true)} onDragOver={drag(true)} onDragLeave={drag(false)}
             onDrop={(e) => {
                 e.preventDefault();
                 setOver(false);
                 const file = e.dataTransfer?.files?.[0];
                 if (file && !disabled) onFile(file);
             }}>
            <span className="kq-zone__icon" aria-hidden="true"><Icon size={22} /></span>
            <p className="kq-zone__title">{title}</p>
            <p className="kq-zone__hint">{hint}</p>
            <div className="kq-zone__actions">{children}</div>
        </div>
    );
}
