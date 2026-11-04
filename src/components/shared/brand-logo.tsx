import Image from "next/image";

export function BrandLogo({ className = "", priority = false }: { className?: string; priority?: boolean }) {
  return (
    <Image
      src="/images/flagupjesus-logo.png"
      alt="FlagUpJesus Global Ministry"
      width={292}
      height={202}
      priority={priority}
      className={className}
    />
  );
}
