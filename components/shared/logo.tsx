import Image from 'next/image';
import Link from 'next/link';

interface LogoProps {
  className?: string;
  width?: number;
  height?: number;
}

export function Logo({ className = "", width = 150, height = 50 }: LogoProps) {
  return (
    <Link href="/" className={`flex items-center gap-2 ${className}`}>
      <div className="relative flex items-center justify-center overflow-hidden">
        {/* Usamos el logo que proporcionaste */}
        <Image 
          src="/logo.png" 
          alt="HAIR STYLE Salón & Barber" 
          width={width} 
          height={height}
          className="object-contain"
          priority
        />
      </div>
    </Link>
  );
}
