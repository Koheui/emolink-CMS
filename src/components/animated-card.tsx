'use client';

import { ReactNode, useEffect, useRef, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { cn } from '@/lib/utils';

interface AnimatedCardProps {
  children: ReactNode;
  delay?: number;
  className?: string;
  variant?: 'fade-in-up' | 'fade-in-down' | 'scale-in' | 'slide-in-right';
}

export function AnimatedCard({ 
  children, 
  delay = 0, 
  className,
  variant = 'fade-in-up'
}: AnimatedCardProps) {
  const [isVisible, setIsVisible] = useState(false);
  const cardRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            setTimeout(() => {
              setIsVisible(true);
            }, delay);
            observer.unobserve(entry.target);
          }
        });
      },
      { threshold: 0.1 }
    );

    if (cardRef.current) {
      observer.observe(cardRef.current);
    }

    return () => {
      if (cardRef.current) {
        observer.unobserve(cardRef.current);
      }
    };
  }, [delay]);

  const animationClass = {
    'fade-in-up': isVisible ? 'animate-fade-in-up' : 'opacity-0 translate-y-2',
    'fade-in-down': isVisible ? 'animate-fade-in-down' : 'opacity-0 -translate-y-2',
    'scale-in': isVisible ? 'animate-scale-in' : 'opacity-0 scale-95',
    'slide-in-right': isVisible ? 'animate-slide-in-right' : 'opacity-0 -translate-x-4',
  }[variant];

  return (
    <div ref={cardRef} className={cn('transition-all duration-300', animationClass, className)}>
      {children}
    </div>
  );
}

interface AnimatedCardContentProps {
  title?: string;
  description?: string;
  children: ReactNode;
  delay?: number;
  variant?: 'fade-in-up' | 'fade-in-down' | 'scale-in' | 'slide-in-right';
  className?: string;
}

export function AnimatedCardContent({
  title,
  description,
  children,
  delay = 0,
  variant = 'fade-in-up',
  className
}: AnimatedCardContentProps) {
  return (
    <AnimatedCard delay={delay} variant={variant} className={className}>
      <Card>
        {title && (
          <CardHeader>
            <CardTitle>{title}</CardTitle>
            {description && <CardDescription>{description}</CardDescription>}
          </CardHeader>
        )}
        <CardContent>{children}</CardContent>
      </Card>
    </AnimatedCard>
  );
}



