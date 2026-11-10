/**
 * Decorative scene for the sign-in art panel: a small production line whose
 * machines break down, get attended and come back — the product in one loop.
 * No words (nothing to translate) and CSS-only motion.
 */
export default function LoginScene() {
  return (
    <div className="login-scene" aria-hidden="true">
      <div className="login-belt" />
      {[0, 1, 2].map((i) => (
        <div key={i} className="login-machine" style={{ ['--i' as string]: i }}>
          <span className="login-state" />
          <span className="login-lines"><i /><i /></span>
          <span className="login-bar"><i /></span>
        </div>
      ))}
    </div>
  );
}
