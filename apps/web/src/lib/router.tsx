import { Link as RouterLink } from "@tanstack/react-router";
import {
  type AnchorHTMLAttributes,
  type ComponentType,
  lazy,
  type PropsWithChildren,
  type ReactNode,
  Suspense,
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

export { useNavigate, useSearch } from "@tanstack/react-router";
