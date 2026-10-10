// What the knowledge page draws each kind of source and status with, the add tabs and topic
// starters, and the score below which a search match counts as weak.
import { IconUpload, IconImage, IconDoc, IconGlobe } from '../../components/ui/icons.jsx';

/** The colour and icon each kind of source is drawn with in the list. */
export const KIND_LOOK = {
    TEXT: { Icon: IconDoc, tone: 'blue' },
    PDF: { Icon: IconUpload, tone: 'red' },
    IMAGE: { Icon: IconImage, tone: 'amber' },
    URL: { Icon: IconGlobe, tone: 'teal' },
};

export const STATUS_LABEL = {
    READY: 'Ready',
    INDEXING: 'Indexing…',
    PENDING: 'Queued',
    FAILED: 'Failed',
};

/** Anything below this is a weak match — useful context for reading the scores. */
export const WEAK_MATCH = 0.25;

/** Topics to start a piece of text from. Each adds its name as a heading line, which starts a new
 *  passage, so every answer stays on one topic. */
export const STARTERS = ['Returns', 'Delivery', 'Payment', 'Opening hours', 'Contact'];

export const ADD_TABS = [
    { id: 'text', label: 'Write text', Icon: IconDoc, tone: 'blue' },
    { id: 'file', label: 'Upload a file', Icon: IconUpload, tone: 'red' },
    { id: 'picture', label: 'Add a picture', Icon: IconImage, tone: 'amber' },
    { id: 'website', label: 'Read a website', Icon: IconGlobe, tone: 'teal' },
];

/** A button's classes, with the busy spinner while its action runs. */
export const btn = (base, busy) => `${base}${busy ? ' btn--busy' : ''}`;
