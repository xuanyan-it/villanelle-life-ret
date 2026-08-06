import type { ReactNode } from "react";
import styles from "./LoadingState.module.css";

export interface LoadingStateProps {
  /** Primary label shown under the spinner. */
  label?: ReactNode;
  /** Optional secondary line (e.g. dimensions or percent). */
  sublabel?: ReactNode;
  /** Extra class name (e.g. to tweak the background). */
  className?: string;
}

/**
 * Centered spinner + label overlay.
 *
 * Shared by the SVS preview panel and the heatmap panel so both loading
 * indicators look identical and stay vertically aligned in the detail dialog.
 * The root is absolutely positioned, so the parent must be `position: relative`.
 */
export const LoadingState = ({
  label,
  sublabel,
  className,
}: LoadingStateProps) => (
  <div className={`${styles.loading} ${className ?? ""}`}>
    <div className={styles.spinner} />
    {label ? <span className={styles.text}>{label}</span> : null}
    {sublabel ? <span className={styles.text}>{sublabel}</span> : null}
  </div>
);

export default LoadingState;
