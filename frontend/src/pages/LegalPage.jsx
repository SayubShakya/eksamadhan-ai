import { useEffect } from 'react';
import { LogoMark } from '../components/Logo.jsx';

/**
 * The Privacy Policy and the Terms, public whether or not someone is signed in.
 *
 * Written from what the code actually does — which data it stores, which outside services it
 * sends it to — so the policy is checked against the system rather than a template. If a
 * processor is added or removed, this is one of the places to update. The backend's short
 * Meta-facing pages (/api/auth/privacy, /terms, /data-deletion) link here for the full text.
 */
const CONTACT = 'shakya.sayub123@gmail.com';
const UPDATED = '25 September 2026';

const Mail = () => <a href={`mailto:${CONTACT}`}>{CONTACT}</a>;

function Privacy() {
    return (
        <>
            <h1>Privacy Policy</h1>
            <p className="legal__updated">Last updated {UPDATED}</p>

            <h2>Who we are</h2>
            <p>
                EkSamadhan AI is a customer-support inbox for Facebook Messenger and Instagram, with AI
                replies and handover to people. It is a final-year project by Sayub Shakya at the
                University of Bedfordshire, not a registered company. Questions about this policy or
                your data: <Mail />.
            </p>

            <h2>Two kinds of data, two roles</h2>
            <p>
                <strong>Staff accounts</strong> are the people who sign in to a workspace. For these, we
                decide how the data is used.
            </p>
            <p>
                <strong>Customer messages</strong> are the conversations a business receives on its
                Facebook Page or Instagram account. The business that connects its page decides why
                they are processed; we process them on its behalf, to show them in its inbox and to
                answer them. If you messaged a business, it is the business you should contact first
                about your data.
            </p>

            <h2>What we collect</h2>
            <ul>
                <li><strong>Staff:</strong> name, email address, a scrambled (hashed) password or, if you
                    use Google sign-in, your Google account identifier; your profile photo if you add one;
                    your role; when you last signed in.</li>
                <li><strong>Customers, through Meta:</strong> the identifier Meta gives you for that page,
                    your name and profile photo as Meta provides them, your messages, and any photos,
                    voice notes or stickers you send, with a written transcript of voice notes.</li>
                <li><strong>What the system works out:</strong> AI replies and the passages they were based
                    on, the mood of a message, a priority, whether a conversation looks like spam, short
                    handover summaries, and a step-by-step record of how each message was handled.</li>
                <li><strong>Business content:</strong> the documents, website pages and pictures a business
                    adds so the AI can answer from them.</li>
                <li><strong>Devices:</strong> if you turn notifications on, your browser's push address and
                    keys, and the browser name.</li>
            </ul>

            <h2>Why we use it</h2>
            <ul>
                <li>To run the service a business signed up for: showing its conversations, answering
                    them, and handing them to its staff.</li>
                <li>To keep accounts secure: sign-in, and limiting repeated failed attempts.</li>
                <li>To tell staff when a conversation needs them, by in-app alert, push notification or
                    email.</li>
            </ul>
            <p>We do not sell data, show advertising, or use tracking or analytics services.</p>

            <h2>Who else handles it</h2>
            <ul>
                <li><strong>Meta</strong> (Facebook, Instagram): where customer messages come from and how
                    replies are sent.</li>
                <li><strong>OpenRouter</strong>: turns message and knowledge text into search vectors so the
                    AI can find the right passage. Where the hosted AI model is switched on, it also
                    writes replies, describes photos and transcribes voice notes; by default a model
                    running on our own machine does those.</li>
                <li><strong>TypeSafe</strong>: reads the text of customer messages to judge mood, priority,
                    spam and whether a person is needed.</li>
                <li><strong>Google (Firebase Authentication)</strong>: only if you choose "Continue with
                    Google".</li>
                <li><strong>Resend</strong>: sends invitation and alert emails.</li>
                <li><strong>Browser push services</strong> (Google, Mozilla, Apple): deliver notifications.
                    Their content is encrypted, so these services cannot read it.</li>
                <li><strong>Cloudflare, Vercel and Upstash</strong>: carry traffic between Meta and our
                    server; Upstash stores only our server's current address.</li>
            </ul>

            <h2>How long we keep it</h2>
            <ul>
                <li>Conversations stay while the business's page is connected. <em>Disconnect</em>, in
                    Settings, deletes the connected pages and all their conversations and messages.</li>
                <li>Unused invitations expire after 7 days.</li>
                <li>Staff accounts stay until the workspace asks us to delete them.</li>
            </ul>

            <h2>Your rights</h2>
            <p>
                You can ask to see the data we hold about you, to correct it, to delete it, to limit how
                it is used, to object to its use, or to receive a copy. Email <Mail /> and we will reply
                within one month. If you are unhappy with the answer you can complain to your data
                protection authority. In the UK, that is the Information Commissioner's Office (ico.org.uk).
            </p>
            <p>
                To remove your Facebook data, you can also remove EkSamadhan AI under Facebook
                <strong> Settings &amp; privacy → Settings → Apps and websites</strong>.
            </p>

            <h2 id="storage">Cookies and browser storage</h2>
            <p>
                EkSamadhan AI sets no cookies and uses no tracking. It keeps a few things in your
                browser, all needed for the app to work, so no consent banner is required:
            </p>
            <ul>
                <li><strong>Your sign-in</strong>, so you stay signed in (removed when you sign out).</li>
                <li><strong>Small preferences</strong>: whether the side menu is open, messages you hid,
                    and when you last dismissed the notifications question.</li>
                <li><strong>The app's own files</strong>, stored by its service worker so it opens quickly
                    and shows a page when you are offline. No conversation is stored this way.</li>
                <li><strong>Google sign-in</strong> keeps its own data for a moment while you sign in, and
                    we clear it straight after.</li>
            </ul>

            <h2>Security</h2>
            <p>
                Passwords are stored only as secure hashes, connections use HTTPS, notifications are
                encrypted end to end, and repeated failed sign-ins are slowed down. No system is
                perfectly secure; if something goes wrong that affects your data, we will tell you.
            </p>

            <h2>Children</h2>
            <p>The service is for businesses and their staff. It is not meant for anyone under 16.</p>

            <h2>Changes</h2>
            <p>If this policy changes, the date at the top changes with it.</p>
        </>
    );
}

function Terms() {
    return (
        <>
            <h1>Terms &amp; Conditions</h1>
            <p className="legal__updated">Last updated {UPDATED}</p>

            <h2>The service</h2>
            <p>
                EkSamadhan AI collects a business's Facebook Messenger and Instagram conversations in one
                inbox, answers them with AI from the business's own knowledge, and hands them to its
                staff when needed. It is a final-year university project run by Sayub Shakya. By
                creating a workspace, joining one, or signing in, you agree to these terms and to
                the <a href="/privacy">Privacy Policy</a>.
            </p>

            <h2>Accounts</h2>
            <ul>
                <li>Keep your sign-in details to yourself. You are responsible for what happens under your
                    account.</li>
                <li>A workspace owner is responsible for the people they invite and can remove them at any
                    time.</li>
            </ul>

            <h2>Your responsibilities as a business</h2>
            <ul>
                <li>You may connect only pages and accounts you are allowed to manage, and you must follow
                    Meta's terms and policies for them.</li>
                <li>You are responsible for your customers' data: telling them how it is used, and having a
                    lawful reason to use it.</li>
                <li>You are responsible for the knowledge you add. Do not add anything you have no right to
                    use.</li>
                <li>Do not use the service to send spam, to mislead people, or for anything unlawful.</li>
            </ul>

            <h2>AI replies</h2>
            <p>
                AI replies are written automatically and can be wrong. The service hands conversations
                to a person when it is unsure, but you remain responsible for what is said to your
                customers, and for checking the conversations that matter.
            </p>

            <h2>Availability</h2>
            <p>
                This is a project under development. It may be unavailable, may change, or may stop, and it
                comes with no guarantee of uptime. Do not rely on it as your only way to reach
                customers.
            </p>

            <h2>Ending</h2>
            <p>
                You can disconnect your pages at any time in Settings, which deletes their conversations.
                We may suspend a workspace that breaks these terms.
            </p>

            <h2>Liability</h2>
            <p>
                The service is provided as it is. As far as the law allows, we are not liable for lost
                business, lost data or indirect losses from using it. Nothing here limits any liability
                that cannot be limited by law.
            </p>

            <h2>Changes and contact</h2>
            <p>
                If these terms change, the date at the top changes with them. Questions: <Mail />.
            </p>
        </>
    );
}

export default function LegalPage({ page }) {
    useEffect(() => {
        document.title = `${page === 'privacy' ? 'Privacy Policy' : 'Terms & Conditions'} | EkSamadhan AI`;
    }, [page]);

    return (
        <div className="legal">
            <header className="legal__head">
                <a href="/" className="legal__brand" aria-label="EkSamadhan AI home">
                    <LogoMark size={28} color="#2563eb" />
                    <span>EkSamadhan AI</span>
                </a>
            </header>
            <main className="legal__body">
                {page === 'privacy' ? <Privacy /> : <Terms />}
            </main>
            <footer className="legal__foot">
                <a href="/privacy" aria-current={page === 'privacy' ? 'page' : undefined}>Privacy Policy</a>
                <a href="/terms" aria-current={page === 'terms' ? 'page' : undefined}>Terms &amp; Conditions</a>
                <a href="/">Back to EkSamadhan AI</a>
            </footer>
        </div>
    );
}
