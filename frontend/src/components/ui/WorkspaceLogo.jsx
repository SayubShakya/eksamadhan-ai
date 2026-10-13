// A workspace's logo, or the first letter of its name while it has none (like a person's
// photo and initials). Fitted inside a rounded square, never cropped.
export default function WorkspaceLogo({ name, logo, size = 28 }) {
    const initial = (name || '').trim().charAt(0).toUpperCase();
    return (
        <span className={`wslogo${logo ? ' wslogo--image' : ''}`} aria-hidden="true"
              style={{ width: size, height: size, fontSize: Math.round(size * 0.46) }}>
            {logo ? <img src={logo} alt="" /> : initial}
        </span>
    );
}
