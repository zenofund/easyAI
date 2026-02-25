import React, { useState, useRef, useEffect, useLayoutEffect, forwardRef } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { type ClassValue, clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

interface TooltipProps {
  content: string;
  children: React.ReactElement;
  position?: 'top' | 'bottom' | 'left' | 'right';
  delay?: number;
  className?: string;
  autoAdjust?: boolean;
}

export const Tooltip = forwardRef<HTMLDivElement, TooltipProps>(({
  content,
  children,
  position = 'top',
  delay = 300,
  className,
  autoAdjust = false,
}, ref) => {
  const [isVisible, setIsVisible] = useState(false);
  const triggerRef = useRef<HTMLDivElement>(null);
  const tooltipRef = useRef<HTMLDivElement>(null);
  const [coords, setCoords] = useState({ top: 0, left: 0 });
  const [activePosition, setActivePosition] = useState(position);

  useEffect(() => {
    setActivePosition(position);
  }, [position]);

  useLayoutEffect(() => {
    if (isVisible && tooltipRef.current) {
      const rect = tooltipRef.current.getBoundingClientRect();
      const padding = 10;
      let { top, left } = coords;
      let hasChanged = false;

      // Horizontal check
      if (rect.left < padding) {
        left += (padding - rect.left);
        hasChanged = true;
      } else if (rect.right > window.innerWidth - padding) {
        left -= (rect.right - (window.innerWidth - padding));
        hasChanged = true;
      }

      // Vertical check
      if (rect.top < padding) {
        top += (padding - rect.top);
        hasChanged = true;
      } else if (rect.bottom > window.innerHeight - padding) {
        top -= (rect.bottom - (window.innerHeight - padding));
        hasChanged = true;
      }

      if (hasChanged) {
        setCoords({ top, left });
      }
    }
  }, [isVisible, coords.top, coords.left]);

  const handleMouseEnter = () => {
    if (triggerRef.current) {
      const rect = triggerRef.current.getBoundingClientRect();
      const scrollX = window.scrollX;
      const scrollY = window.scrollY;
      
      let currentPosition = position;

      if (autoAdjust) {
        const spaceLeft = rect.left;
        const spaceRight = window.innerWidth - rect.right;
        const minSpace = 300; // Safe width for tooltip content

        if (position === 'left' && spaceLeft < minSpace && spaceRight > spaceLeft) {
          currentPosition = 'right';
        } else if (position === 'right' && spaceRight < minSpace && spaceLeft > spaceRight) {
          currentPosition = 'left';
        }
      }

      setActivePosition(currentPosition);

      let top = 0;
      let left = 0;

      // Use fixed positioning relative to viewport
      switch (currentPosition) {
        case 'top':
          top = rect.top - 10;
          left = rect.left + rect.width / 2;
          break;
        case 'bottom':
          top = rect.bottom + 10;
          left = rect.left + rect.width / 2;
          break;
        case 'left':
          top = rect.top + rect.height / 2;
          left = rect.left - 10;
          break;
        case 'right':
          top = rect.top + rect.height / 2;
          left = rect.right + 10;
          break;
      }
      
      setCoords({ top, left });
      setIsVisible(true);
    }
  };

  const handleMouseLeave = () => {
    setIsVisible(false);
  };

  const getPositionStyles = () => {
    switch (activePosition) {
      case 'top':
        return { transform: 'translate(-50%, -100%)' };
      case 'bottom':
        return { transform: 'translate(-50%, 0)' };
      case 'left':
        return { transform: 'translate(-100%, -50%)' };
      case 'right':
        return { transform: 'translate(0, -50%)' };
      default:
        return { transform: 'translate(-50%, -100%)' };
    }
  };

  return (
    <>
      <div
        ref={triggerRef}
        className={cn("inline-flex", className)}
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
      >
        {children}
      </div>

      {createPortal(
        <AnimatePresence>
          {isVisible && (
            <motion.div
              key="tooltip"
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9 }}
              transition={{ duration: 0.15 }}
              style={{
                position: 'fixed',
                top: coords.top,
                left: coords.left,
                ...getPositionStyles(),
                zIndex: 9999,
                pointerEvents: 'none',
              }}
            >
              <div
                ref={tooltipRef}
                className={cn(
                  'px-2 py-1 bg-gray-900 text-white text-xs rounded shadow-lg dark:bg-gray-700 whitespace-nowrap',
                  // Remove className from here to avoid conflicts, it's applied to wrapper
                )}
              >
                {content}
              </div>
            </motion.div>
          )}
        </AnimatePresence>,
        document.body
      )}
    </>
  );
});

Tooltip.displayName = 'Tooltip';
