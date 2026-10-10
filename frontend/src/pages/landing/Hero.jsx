// The opening section: the headline, what the product does, the two actions and the inbox picture.
import { IconArrowRight } from '../../components/ui/icons.jsx';
import InboxMock from './InboxMock.jsx';

export default function Hero({ primary }) {
    return (
        <section className="lp-hero">
            <h1>
                <em>Answering</em> Customers<br />
                on Messenger &amp; Instagram
            </h1>
            <p>
                EkSamadhan AI answers your customers from what your business has told it: your
                prices, policies and product details. When it cannot answer, it hands the chat to
                someone on your team who is free, with a short summary of what the customer needs.
            </p>
            <div className="lp-hero__actions">
                <a className="lp-btn lp-btn--lg" href={primary.href}>
                    {primary.label} <IconArrowRight size={16} />
                </a>
                <a className="lp-btn lp-btn--ghost lp-btn--lg" href="#how">See how it works</a>
            </div>
            <InboxMock />
        </section>
    );
}
