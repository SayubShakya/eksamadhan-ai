// A picture of the real inbox, drawn in HTML: the product itself, not a stock image.
import { IconFacebook, IconInstagram, IconKnowledge } from '../../components/ui/icons.jsx';

export default function InboxMock() {
    const rows = [
        { icon: <IconFacebook size={16} />, name: 'Customer on Messenger', text: 'Do you deliver to Lalitpur?', tag: 'AI', on: true },
        { icon: <IconInstagram size={16} />, name: 'Customer on Instagram', text: 'Can I talk to someone?', tag: 'Staff' },
        { icon: <IconFacebook size={16} />, name: 'Customer on Messenger', text: 'Is size 7 in stock?', tag: 'AI' },
        { icon: <IconInstagram size={16} />, name: 'Customer on Instagram', text: 'Thank you!', tag: 'AI' },
    ];
    return (
        <div className="lp-mock" aria-hidden="true">
            <div className="lp-mock__bar"><i /><i /><i /><span>EkSamadhan AI · Inbox</span></div>
            <div className="lp-mock__body">
                <div className="lp-mock__list">
                    <div className="lp-mock__search">Search conversations</div>
                    {rows.map((r, k) => (
                        <div className={`lp-mock__row${r.on ? ' is-on' : ''}`} key={k}>
                            <span className="lp-mock__avatar">{r.icon}</span>
                            <span className="lp-mock__who"><strong>{r.name}</strong><small>{r.text}</small></span>
                            <span className={`lp-mock__tag lp-mock__tag--${r.tag.toLowerCase()}`}>{r.tag}</span>
                        </div>
                    ))}
                </div>
                <div className="lp-mock__chat">
                    <div className="lp-mock__head">
                        <span className="lp-mock__avatar"><IconFacebook size={16} /></span>
                        <strong>Customer on Messenger</strong>
                        <span className="lp-mock__status"><span /> AI is handling</span>
                    </div>
                    <div className="lp-mock__msgs">
                        <div className="lp-bubble lp-bubble--in">Hi, do you deliver to Lalitpur? I need it by Friday.</div>
                        <div className="lp-bubble lp-bubble--ai">Yes, we deliver to Lalitpur within two days, so an order today arrives before Friday.</div>
                        <span className="lp-chip lp-chip--blue"><IconKnowledge size={13} /> From your delivery policy</span>
                    </div>
                    <div className="lp-mock__composer">Write a reply<span>Send</span></div>
                </div>
                <div className="lp-mock__side">
                    <strong>Details</strong>
                    <div><small>Priority</small><span className="lp-mock__tag lp-mock__tag--normal">Normal</span></div>
                    <div><small>Handled by</small><span>AI</span></div>
                    <div><small>If unsure</small><span>Goes to Staff</span></div>
                </div>
            </div>
        </div>
    );
}
