'use client';

import { ReactNode, useEffect, useRef, useState } from 'react';
import { cn } from '@/lib/utils';

interface AnimatedListProps {
  children: ReactNode;
  className?: string;
  staggerDelay?: number;
}

export function AnimatedList({ 
  children, 
  className,
  staggerDelay = 50 
}: AnimatedListProps) {
  const [visibleItems, setVisibleItems] = useState<Set<number>>(new Set());
  const listRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry, index) => {
          if (entry.isIntersecting) {
            setTimeout(() => {
              setVisibleItems((prev) => new Set(prev).add(index));
            }, index * staggerDelay);
            observer.unobserve(entry.target);
          }
        });
      },
      { threshold: 0.1 }
    );

    if (listRef.current) {
      const items = listRef.current.children;
      Array.from(items).forEach((item) => {
        observer.observe(item);
      });
    }

    return () => {
      if (listRef.current) {
        const items = listRef.current.children;
        Array.from(items).forEach((item) => {
          observer.unobserve(item);
        });
      }
    };
  }, [staggerDelay, children]);

  return (
    <div ref={listRef} className={cn('space-y-4', className)}>
      {Array.isArray(children) ? (
        children.map((child, index) => (
          <div
            key={index}
            className={cn(
              'transition-all duration-300',
              visibleItems.has(index)
                ? 'opacity-100 translate-y-0'
                : 'opacity-0 translate-y-4'
            )}
            style={{
              transitionDelay: `${index * staggerDelay}ms`,
            }}
          >
            {child}
          </div>
        ))
      ) : (
        <div
          className={cn(
            'transition-all duration-300',
            visibleItems.has(0)
              ? 'opacity-100 translate-y-0'
              : 'opacity-0 translate-y-4'
          )}
        >
          {children}
        </div>
      )}
    </div>
  );
}

interface AnimatedTableRowProps {
  children: ReactNode;
  index: number;
  staggerDelay?: number;
  className?: string;
}

export function AnimatedTableRow({ 
  children, 
  index,
  staggerDelay = 30,
  className
}: AnimatedTableRowProps) {
  const [isVisible, setIsVisible] = useState(false);
  const rowRef = useRef<HTMLTableRowElement>(null);

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            setTimeout(() => {
              setIsVisible(true);
            }, index * staggerDelay);
            observer.unobserve(entry.target);
          }
        });
      },
      { threshold: 0.1 }
    );

    if (rowRef.current) {
      observer.observe(rowRef.current);
    }

    return () => {
      if (rowRef.current) {
        observer.unobserve(rowRef.current);
      }
    };
  }, [index, staggerDelay]);

  return (
    <tr
      ref={rowRef}
      className={cn(
        'transition-all duration-300',
        isVisible
          ? 'opacity-100 translate-x-0'
          : 'opacity-0 -translate-x-4',
        className
      )}
    >
      {children}
    </tr>
  );
}



