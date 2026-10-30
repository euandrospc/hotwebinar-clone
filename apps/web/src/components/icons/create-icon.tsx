"use client";

import { forwardRef, type ReactNode, type SVGProps } from "react";

export type IconProps = SVGProps<SVGSVGElement> & {
  size?: number | string;
  title?: string;
};

export function createIcon(name: string, viewBox: string, fill: string, paths: ReactNode) {
  const Icon = forwardRef<SVGSVGElement, IconProps>(
    ({ size = 24, className, title, children, ...props }, ref) => {
      const labelled = Boolean(title || props["aria-label"] || props["aria-labelledby"]);
      return (
        <svg
          ref={ref}
          xmlns="http://www.w3.org/2000/svg"
          width={size}
          height={size}
          viewBox={viewBox}
          fill={fill}
          focusable="false"
          aria-hidden={labelled ? undefined : true}
          role={labelled ? "img" : undefined}
          className={["clickup-icon inline-block shrink-0 align-middle", className].filter(Boolean).join(" ")}
          data-icon={name}
          {...props}
        >
          {title && <title>{title}</title>}
          {paths}
          {children}
        </svg>
      );
    }
  );
  Icon.displayName = `ClickUpIcon(${name})`;
  return Icon;
}

export type AppIcon = ReturnType<typeof createIcon>;
