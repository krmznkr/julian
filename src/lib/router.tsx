import { Link as RouterLink, useLocation } from "@tanstack/react-router";
import {
  type AnchorHTMLAttributes,
  type ComponentType,
  lazy,
  type PropsWithChildren,
  type ReactNode,
  Suspense,
  useMemo,
} from "react";

type LinkProps = PropsWithChildren<
  AnchorHTMLAttributes<HTMLAnchorElement> & {
    href: string;
    prefetch?: boolean;
  }
>;

type DynamicOptions = {
  loading?: ComponentType;
};

export function Link({ href, children, prefetch: _prefetch, ...props }: LinkProps) {
  void _prefetch;

  if (href.startsWith("http://") || href.startsWith("https://")) {
    return (
      <a href={href} {...props}>
        {children}
      </a>
    );
  }

  return (
    <RouterLink to={href} {...props}>
      {children}
    </RouterLink>
  );
}

export function dynamic<TProps extends object>(
  loader: () => Promise<{ default: ComponentType<TProps> }>,
  options?: DynamicOptions,
) {
  const LazyComponent = lazy(loader);
  const Loading = options?.loading;

  return function DynamicComponent(props: TProps): ReactNode {
    return (
      <Suspense fallback={Loading ? <Loading /> : null}>
        <LazyComponent {...props} />
      </Suspense>
    );
  };
}

export function useSearchParams() {
  const location = useLocation();
  return useMemo(() => {
    const rawSearch = location.search;
    if (typeof rawSearch === "string") {
      return new URLSearchParams(rawSearch);
    }

    const params = new URLSearchParams();
    if (rawSearch.month != null) params.set("month", String(rawSearch.month));
    if (rawSearch.day != null) params.set("day", String(rawSearch.day));
    if (rawSearch.details) params.set("details", "1");
    return params;
  }, [location.search]);
}

export { useNavigate, useSearch } from "@tanstack/react-router";
