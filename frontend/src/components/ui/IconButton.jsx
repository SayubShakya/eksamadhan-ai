// A square button that shows only an icon (close, back, menu). `label` is what a screen
// reader says, since there is no visible text; any other prop goes on the <button>.
export default function IconButton({ label, className = '', children, ...rest }) {
    return (
        <button className={className ? `icon-btn ${className}` : 'icon-btn'} aria-label={label} {...rest}>
            {children}
        </button>
    );
}
