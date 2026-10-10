// The title block at the top of a dashboard page: heading, one line under it, and any
// actions on the right (passed as children).
export default function PageHeader({ title, sub, children }) {
    return (
        <div className="page__head">
            <div>
                <h1 className="page__title">{title}</h1>
                <p className="page__sub">{sub}</p>
            </div>
            {children}
        </div>
    );
}
