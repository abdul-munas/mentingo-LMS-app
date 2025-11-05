import { cn } from "~/lib/utils";

interface LoadingSpinnerProps {
  size?: "sm" | "md" | "lg" | "xl";
  className?: string;
}

const sizeMap = {
  sm: "size-8",
  md: "size-16",
  lg: "size-32",
  xl: "size-48",
};

export const LoadingSpinner = ({ size = "md", className }: LoadingSpinnerProps) => {
  return (
    <div className="flex h-full items-center justify-center">
      <div
        className={cn(
          "animate-spin rounded-full border-b-2 border-t-2 border-primary-700",
          sizeMap[size],
          className,
        )}
        role="status"
        aria-label="Loading"
      >
        <span className="sr-only">Loading...</span>
      </div>
    </div>
  );
};
