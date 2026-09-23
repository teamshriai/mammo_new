/**
 * MammoAuthGate — shared-credential access gate for the Mammo AI demo.
 *
 * Self-contained on purpose: no CSS framework, no design-token file, no icon
 * library, no state library. The only dependency is React (>= 16.8, works on
 * 17/18/19).
 *
 * ---------------------------------------------------------------------------
 * READ THIS FIRST — what this does and does not protect
 * ---------------------------------------------------------------------------
 * This component is a DOOR, not a LOCK. Anyone can bypass it with DevTools or
 * by calling your API directly with curl. It exists so invited users have a
 * way in and everyone else sees a closed door.
 *
 * The real protection MUST be the server rejecting unauthenticated requests.
 * See MAMMO_AUTH_GATE_INTEGRATION.md → "Backend contract". If you skip the
 * backend half, you have decoration, not access control.
 *
 * ---------------------------------------------------------------------------
 * Security choices baked in (please don't "simplify" these away)
 * ---------------------------------------------------------------------------
 * 1. The credential is held in a module variable — never localStorage or
 *    sessionStorage. A refresh re-prompts and nothing is written to the device.
 * 2. The password is never a build-time env var. Anything compiled into the
 *    bundle is readable by every visitor, and usually committed to git too.
 * 3. Your 401 responses must NOT send a `WWW-Authenticate: Basic` header, or
 *    the browser hijacks the response with its own native credential popup and
 *    this modal never appears. This is the single most common way to break it.
 */

import { useCallback, useEffect, useRef, useState } from "react";

/* ========================================================================== *
 * Theme — pink by default. Pass a `theme` prop to override any of these.
 * ========================================================================== */

export const PINK_THEME = {
  accent: "#be185d",
  accentSoft: "#ec4899",
  gradient: "linear-gradient(135deg, #be185d, #ec4899)",
  badgeShadow: "0 8px 20px rgba(190, 24, 93, 0.28)",
  pageBackground:
    "radial-gradient(ellipse 60% 50% at 20% 0%, rgba(190, 24, 93, 0.10), transparent 70%),"
    + "radial-gradient(ellipse 50% 50% at 85% 100%, rgba(236, 72, 153, 0.10), transparent 70%),"
    + "#f8fafc",
  overlay: "rgba(15, 23, 42, 0.45)",
  surface: "#ffffff",
  border: "#e2e8f0",
  borderStrong: "#cbd5e1",
  inputBackground: "#f8fafc",
  textPrimary: "#0f172a",
  textSecondary: "#475569",
  textMuted: "#64748b",
  danger: "#dc2626",
  dangerBackground: "#fef2f2",
  dangerBorder: "#fecaca",
  fontBody:
    "'Plus Jakarta Sans', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
  fontDisplay: "'Outfit', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
  radius: "8px",
  radiusSmall: "4px",
};

/** The blue/cyan palette used by the Liquid Biopsy demo, for parity. */
export const BLUE_THEME = {
  ...PINK_THEME,
  accent: "#2563eb",
  accentSoft: "#06b6d4",
  gradient: "linear-gradient(135deg, #2563eb, #06b6d4)",
  badgeShadow: "0 8px 20px rgba(37, 99, 235, 0.28)",
  pageBackground:
    "radial-gradient(ellipse 60% 50% at 20% 0%, rgba(37, 99, 235, 0.10), transparent 70%),"
    + "radial-gradient(ellipse 50% 50% at 85% 100%, rgba(6, 182, 212, 0.10), transparent 70%),"
    + "#f8fafc",
};

/* ========================================================================== *
 * Credential store — in memory only, for the life of the loaded page.
 * ========================================================================== */

export const AUTH_EXPIRED_EVENT = "mammo-auth-expired";

let credential = null;

/** btoa() throws above U+00FF, which a real password may contain. */
export function encodeCredential(username, password) {
  const bytes = new TextEncoder().encode(`${username}:${password}`);
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary);
}

export function getCredential() {
  return credential;
}

export function setCredential(encoded) {
  credential = encoded;
}

/** Drops the session and tells any mounted gate to re-prompt. */
export function clearCredential() {
  credential = null;
  if (typeof window !== "undefined") {
    window.dispatchEvent(new Event(AUTH_EXPIRED_EVENT));
  }
}

/** Spread into fetch() headers on every protected request. */
export function authHeader() {
  return credential ? { Authorization: `Basic ${credential}` } : {};
}

/**
 * Wrap your own fetch calls with this so a revoked or rotated credential puts
 * the login modal back up instead of failing silently.
 *
 *   const res = await authedFetch("/api/v1/mammo/analyze", { method: "POST", body });
 */
export async function authedFetch(input, init = {}) {
  const response = await fetch(input, {
    ...init,
    headers: { ...(init.headers || {}), ...authHeader() },
  });
  if (response.status === 401 || response.status === 403) clearCredential();
  return response;
}

/* ========================================================================== *
 * Credential verification
 * ========================================================================== */

export class AuthError extends Error {
  constructor(message) {
    super(message);
    this.name = "AuthError";
  }
}

/**
 * Checks credentials before storing them, so a wrong password is reported at
 * sign-in rather than surfacing later as a confusing failed upload.
 *
 * @returns the encoded credential on success, or null if the server rejected it.
 * @throws  AuthError for transport or server-configuration problems, which
 *          deserve different wording than "wrong password".
 */
export async function verifyCredentials(username, password, verifyUrl) {
  const encoded = encodeCredential(username, password);

  let response;
  try {
    response = await fetch(verifyUrl, {
      method: "POST",
      headers: { Authorization: `Basic ${encoded}` },
    });
  } catch {
    throw new AuthError(
      "Can't reach the sign-in service. Check your connection and try again.",
    );
  }

  if (response.ok) return encoded;
  if (response.status === 401 || response.status === 403) return null;
  if (response.status === 503) {
    throw new AuthError(
      "Demo sign-in isn't configured on the server yet. Please contact the team.",
    );
  }
  throw new AuthError(`Sign-in failed (HTTP ${response.status}). Please try again.`);
}

/* ========================================================================== *
 * Focus trap — inlined so this file has no local imports.
 * ========================================================================== */

const FOCUSABLE =
  'button, a[href], input, select, textarea, [tabindex]:not([tabindex="-1"])';

function useFocusTrap(containerRef, isOpen) {
  useEffect(() => {
    if (!isOpen) return;
    const container = containerRef.current;
    if (!container) return;

    const getFocusable = () =>
      Array.from(container.querySelectorAll(FOCUSABLE)).filter((el) => !el.disabled);

    (getFocusable()[0] || container).focus();

    const onKeyDown = (e) => {
      // Escape is swallowed, never forwarded: this dialog is the gate, so it
      // must not be dismissable.
      if (e.key === "Escape") {
        e.preventDefault();
        e.stopPropagation();
        return;
      }
      if (e.key !== "Tab") return;

      const items = getFocusable();
      if (items.length === 0) return;
      const first = items[0];
      const last = items[items.length - 1];

      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    };

    document.addEventListener("keydown", onKeyDown, true);
    return () => document.removeEventListener("keydown", onKeyDown, true);
  }, [isOpen, containerRef]);
}

/** Stops the page behind the overlay from scrolling, without a layout jump. */
function useBodyScrollLock(isLocked) {
  useEffect(() => {
    if (!isLocked || typeof document === "undefined") return;
    const { body } = document;
    const prevOverflow = body.style.overflow;
    const prevPaddingRight = body.style.paddingRight;
    const scrollbar = window.innerWidth - document.documentElement.clientWidth;

    body.style.overflow = "hidden";
    if (scrollbar > 0) body.style.paddingRight = `${scrollbar}px`;

    return () => {
      body.style.overflow = prevOverflow;
      body.style.paddingRight = prevPaddingRight;
    };
  }, [isLocked]);
}

/* ========================================================================== *
 * Icons — inline SVG, no icon library.
 * ========================================================================== */

const LockIcon = ({ size = 22 }) => (
  <svg
    width={size} height={size} viewBox="0 0 24 24" fill="none"
    stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"
    aria-hidden="true" focusable="false"
  >
    <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
    <path d="M7 11V7a5 5 0 0110 0v4" />
  </svg>
);

const EyeIcon = ({ size = 15, off = false }) => (
  <svg
    width={size} height={size} viewBox="0 0 24 24" fill="none"
    stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"
    aria-hidden="true" focusable="false"
  >
    {off ? (
      <>
        <path d="M17.94 17.94A10.07 10.07 0 0112 20c-7 0-11-8-11-8a18.45 18.45 0 015.06-5.94M9.9 4.24A9.12 9.12 0 0112 4c7 0 11 8 11 8a18.5 18.5 0 01-2.16 3.19m-6.72-1.07a3 3 0 11-4.24-4.24" />
        <line x1="1" y1="1" x2="23" y2="23" />
      </>
    ) : (
      <>
        <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
        <circle cx="12" cy="12" r="3" />
      </>
    )}
  </svg>
);

const AlertIcon = ({ size = 14 }) => (
  <svg
    width={size} height={size} viewBox="0 0 24 24" fill="none"
    stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"
    aria-hidden="true" focusable="false" style={{ flexShrink: 0, marginTop: 2 }}
  >
    <path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
    <line x1="12" y1="9" x2="12" y2="13" />
    <line x1="12" y1="17" x2="12.01" y2="17" />
  </svg>
);

const SpinnerIcon = ({ size = 15 }) => (
  <svg
    width={size} height={size} viewBox="0 0 24 24" fill="none"
    stroke="currentColor" strokeWidth="2" strokeLinecap="round"
    aria-hidden="true" focusable="false"
    style={{ animation: "mammo-auth-spin 0.8s linear infinite" }}
  >
    <path d="M21 12a9 9 0 11-6.219-8.56" />
  </svg>
);

/* ========================================================================== *
 * Login modal
 * ========================================================================== */

const TITLE_ID = "mammo-auth-title";
const SUBTITLE_ID = "mammo-auth-subtitle";

export function MammoLoginModal({
  onSuccess,
  theme = PINK_THEME,
  productName = "Mammo AI",
  brandPrefix = "OncoTrace",
  brandSuffix = "-AI",
  title = "Private demo access",
  subtitle = "The Mammo AI analysis demo is invite-only while in preview. Enter the credentials from your invitation to continue.",
  submitLabel = "Sign in",
  verifyUrl = "/api/v1/auth/verify",
  logoSrc = null,
  requestAccessUrl = "https://oncotrace-ai.org/mammo-demo",
  requestAccessLabel = "Request demo access",
}) {
  const panelRef = useRef(null);
  const passwordRef = useRef(null);

  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);

  useFocusTrap(panelRef, true);
  useBodyScrollLock(true);

  const canSubmit = username.trim() !== "" && password !== "" && !busy;

  const fail = useCallback((message) => {
    setError(message);
    setPassword("");
    passwordRef.current?.focus();

    // Driven imperatively rather than via a CSS class: restarting a CSS
    // animation needs either a remount (which drops focus and the typed
    // username) or a forced-reflow hack.
    const panel = panelRef.current;
    const reduced =
      typeof window !== "undefined"
      && window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;

    if (panel?.animate && !reduced) {
      panel.animate(
        [
          { transform: "translateX(0)" },
          { transform: "translateX(-6px)" },
          { transform: "translateX(6px)" },
          { transform: "translateX(-4px)" },
          { transform: "translateX(0)" },
        ],
        { duration: 400, easing: "ease-in-out" },
      );
    }
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!canSubmit) return;

    setBusy(true);
    setError(null);
    try {
      const encoded = await verifyCredentials(username.trim(), password, verifyUrl);
      if (!encoded) {
        fail("That username or password isn't right. Check the details in your invitation.");
        return;
      }
      setCredential(encoded);
      onSuccess?.();
    } catch (err) {
      fail(err?.message || "Something went wrong signing in. Please try again.");
    } finally {
      setBusy(false);
    }
  };

  const inputStyle = (invalid, extraRight) => ({
    width: "100%",
    height: 44,
    padding: `0 ${extraRight ? "44px" : "12px"} 0 12px`,
    background: theme.inputBackground,
    border: `1px solid ${invalid ? theme.danger : theme.borderStrong}`,
    borderRadius: theme.radius,
    color: theme.textPrimary,
    fontFamily: theme.fontBody,
    // 16px specifically: anything smaller makes iOS Safari zoom on focus.
    fontSize: 16,
    outline: "none",
    boxSizing: "border-box",
    transition: "border-color 0.2s ease, box-shadow 0.2s ease",
  });

  const labelStyle = {
    display: "block",
    marginBottom: 6,
    fontSize: 11,
    fontWeight: 600,
    textTransform: "uppercase",
    letterSpacing: "0.08em",
    color: theme.textMuted,
  };

  return (
    <div
      style={{
        position: "fixed", inset: 0, zIndex: 2000,
        background: theme.overlay,
        backdropFilter: "blur(8px)", WebkitBackdropFilter: "blur(8px)",
        display: "flex", alignItems: "center", justifyContent: "center",
        padding: 16, overflowY: "auto",
        animation: "mammo-auth-overlay-in 180ms ease-out both",
      }}
    >
      <style>{`
        @keyframes mammo-auth-overlay-in { from { opacity: 0 } to { opacity: 1 } }
        @keyframes mammo-auth-card-in {
          from { opacity: 0; transform: translateY(14px) scale(0.97); }
          to   { opacity: 1; transform: none; }
        }
        @keyframes mammo-auth-spin { to { transform: rotate(360deg); } }
        .mammo-auth-card { animation: mammo-auth-card-in 340ms cubic-bezier(0.16, 1, 0.3, 1) both; }
        .mammo-auth-input:focus {
          border-color: ${theme.accent} !important;
          box-shadow: 0 0 0 3px ${theme.accent}22;
        }
        .mammo-auth-submit:not(:disabled):hover { filter: brightness(1.06); }
        .mammo-auth-toggle:focus-visible,
        .mammo-auth-submit:focus-visible {
          outline: 2px solid ${theme.accent};
          outline-offset: 2px;
        }
        @media (prefers-reduced-motion: reduce) {
          .mammo-auth-card { animation: none !important; }
        }
        @media (max-width: 480px) {
          .mammo-auth-body { padding: 24px 20px !important; }
        }
      `}</style>

      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={TITLE_ID}
        aria-describedby={SUBTITLE_ID}
        tabIndex={-1}
        className="mammo-auth-card"
        style={{
          width: "min(420px, 100%)",
          background: theme.surface,
          border: `1px solid ${theme.border}`,
          borderRadius: theme.radius,
          boxShadow: "0 24px 64px rgba(0, 0, 0, 0.28)",
          overflow: "hidden",
          fontFamily: theme.fontBody,
          boxSizing: "border-box",
        }}
      >
        {/* Brand hairline */}
        <div aria-hidden="true" style={{ height: 3, background: theme.gradient }} />

        <div className="mammo-auth-body" style={{ padding: "32px 28px" }}>
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", textAlign: "center" }}>
            {logoSrc && (
              <img
                src={logoSrc}
                alt=""
                draggable={false}
                style={{ height: 40, width: "auto", marginBottom: 14 }}
              />
            )}

            <div
              aria-hidden="true"
              style={{
                width: 48, height: 48, borderRadius: theme.radius,
                background: theme.gradient, color: "#ffffff",
                display: "flex", alignItems: "center", justifyContent: "center",
                boxShadow: theme.badgeShadow,
              }}
            >
              <LockIcon size={22} />
            </div>

            <p
              style={{
                margin: "14px 0 0",
                fontFamily: theme.fontDisplay,
                fontSize: 14, fontWeight: 700,
                letterSpacing: "-0.01em", color: theme.textPrimary,
              }}
            >
              {brandPrefix}
              <span style={{ color: theme.accent }}>{brandSuffix}</span>
              <span style={{ color: theme.textMuted, fontWeight: 600 }}> · {productName}</span>
            </p>

            <h2
              id={TITLE_ID}
              style={{
                fontFamily: theme.fontDisplay, fontSize: 18, fontWeight: 700,
                color: theme.textPrimary, margin: "18px 0 0",
              }}
            >
              {title}
            </h2>

            <p
              id={SUBTITLE_ID}
              style={{
                fontSize: 12, color: theme.textSecondary,
                lineHeight: 1.6, margin: "8px 0 0",
              }}
            >
              {subtitle}
            </p>
          </div>

          <form onSubmit={handleSubmit} style={{ marginTop: 26 }} noValidate>
            <div>
              <label htmlFor="mammo-auth-username" style={labelStyle}>Username</label>
              <input
                id="mammo-auth-username"
                className="mammo-auth-input"
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                autoComplete="username"
                autoFocus
                disabled={busy}
                spellCheck={false}
                autoCapitalize="none"
                autoCorrect="off"
                style={inputStyle(!!error, false)}
              />
            </div>

            <div style={{ marginTop: 14, position: "relative" }}>
              <label htmlFor="mammo-auth-password" style={labelStyle}>Password</label>
              <input
                id="mammo-auth-password"
                ref={passwordRef}
                className="mammo-auth-input"
                type={showPassword ? "text" : "password"}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete="current-password"
                disabled={busy}
                spellCheck={false}
                autoCapitalize="none"
                autoCorrect="off"
                style={inputStyle(!!error, true)}
              />
              <button
                type="button"
                className="mammo-auth-toggle"
                onClick={() => setShowPassword((v) => !v)}
                aria-label={showPassword ? "Hide password" : "Show password"}
                aria-pressed={showPassword}
                // Out of the tab order so Tab runs password -> submit.
                tabIndex={-1}
                style={{
                  position: "absolute", right: 8, bottom: 6,
                  width: 32, height: 32,
                  display: "flex", alignItems: "center", justifyContent: "center",
                  background: "transparent", border: "none", cursor: "pointer",
                  color: showPassword ? theme.accent : theme.textMuted,
                  borderRadius: theme.radiusSmall, padding: 0,
                }}
              >
                <EyeIcon off={showPassword} />
              </button>
            </div>

            <div role="alert" aria-live="assertive">
              {error && (
                <div
                  style={{
                    display: "flex", alignItems: "flex-start", gap: 8,
                    marginTop: 14, padding: "10px 12px",
                    background: theme.dangerBackground,
                    border: `1px solid ${theme.dangerBorder}`,
                    borderRadius: theme.radiusSmall,
                    color: theme.danger,
                    fontSize: 12, lineHeight: 1.5,
                  }}
                >
                  <AlertIcon />
                  <span>{error}</span>
                </div>
              )}
            </div>

            <button
              type="submit"
              className="mammo-auth-submit"
              disabled={!canSubmit}
              style={{
                width: "100%", height: 44, marginTop: 20,
                display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
                background: theme.gradient, color: "#ffffff", border: "none",
                borderRadius: theme.radius,
                fontFamily: theme.fontBody, fontSize: 14, fontWeight: 700,
                cursor: canSubmit ? "pointer" : "not-allowed",
                opacity: canSubmit ? 1 : 0.6,
                transition: "opacity 0.2s ease, filter 0.2s ease",
              }}
            >
              {busy ? (<><SpinnerIcon /> Verifying…</>) : submitLabel}
            </button>
          </form>

          <p
            style={{
              marginTop: 18, marginBottom: 0, textAlign: "center",
              fontSize: 11, color: theme.textMuted, lineHeight: 1.6,
            }}
          >
            You'll be asked to sign in again on every refresh. Nothing is saved to this device.
          </p>

          {requestAccessUrl && (
            <p
              style={{
                marginTop: 10, marginBottom: 0, textAlign: "center",
                fontSize: 11, color: theme.textMuted, lineHeight: 1.6,
              }}
            >
              If you don't have access —{' '}
              <a
                href={requestAccessUrl}
                target="_blank"
                rel="noopener noreferrer"
                style={{ color: theme.accent, fontWeight: 600, textDecoration: "none" }}
              >
                {requestAccessLabel}
              </a>
            </p>
          )}
        </div>
      </div>
    </div>
  );
}

/* ========================================================================== *
 * Gate wrapper
 * ========================================================================== */

/**
 * Renders `children` once authenticated, the login modal otherwise.
 *
 *   <MammoAuthGate verifyUrl="/api/v1/auth/verify">
 *     <MammoDemo />
 *   </MammoAuthGate>
 *
 * Set `bypass` (e.g. to a mock/offline mode flag) to skip the gate entirely —
 * without it, a build with no backend can never satisfy the modal and local
 * development hard-locks.
 */
export default function MammoAuthGate({
  children,
  bypass = false,
  theme = PINK_THEME,
  ...modalProps
}) {
  // Memory-only credential, so this is false on every fresh page load and a
  // refresh always re-prompts. Read rather than hardcoded to false so the gate
  // stays correct if it ever remounts mid-session.
  const [authed, setAuthed] = useState(() => !!getCredential());

  useEffect(() => {
    const handleExpired = () => setAuthed(false);
    window.addEventListener(AUTH_EXPIRED_EVENT, handleExpired);
    return () => window.removeEventListener(AUTH_EXPIRED_EVENT, handleExpired);
  }, []);

  if (bypass) return children;
  if (authed) return children;

  // The app isn't mounted behind the modal, so the gate paints its own
  // background — otherwise the locked state reads as a broken blank page.
  return (
    <div style={{ minHeight: "100vh", background: theme.pageBackground }}>
      <MammoLoginModal theme={theme} onSuccess={() => setAuthed(true)} {...modalProps} />
    </div>
  );
}
