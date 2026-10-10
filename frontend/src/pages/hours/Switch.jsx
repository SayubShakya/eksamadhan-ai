// The on / off switch that makes a day a working day or a day off.
export default function Switch({ checked, onChange, label }) {
    return (
        <button type="button" role="switch" aria-checked={checked} aria-label={label}
                className={`switch${checked ? ' switch--on' : ''}`} onClick={() => onChange(!checked)}>
            <span className="switch__knob" aria-hidden="true" />
        </button>
    );
}
