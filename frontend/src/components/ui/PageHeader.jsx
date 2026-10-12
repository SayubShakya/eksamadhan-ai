// The title block at the top of a dashboard page: heading, one line under it, and any
// actions on the right (passed as children).
//
// The top bar already names the page, so a heading that only repeats it is hidden on screens
// where the top bar shows its title (above 760px; below that the top bar has no room for it
// and this heading is the page's name). It stays in the page for screen readers either way.
// `echo={false}` for a heading that says something the top bar does not (the home greeting).
export default function PageHeader({ title, sub, echo = true, children }) {
    return (
        <div className={`page__head${echo ? ' page__head--echo' : ''}`}>
            <div>
                <h1 className={`page__title${echo ? ' page__title--echo' : ''}`}>{title}</h1>
                <p className="page__sub">{sub}</p>
            </div>
            {children}
        </div>
    );
}
