import { ReactNode, useState, useRef, useEffect } from "react";
import { ChevronDown } from "lucide-react";

interface AccordionProps {
  title: ReactNode;
  children: ReactNode;
  defaultOpen?: boolean;
  className?: string;
  summaryClassName?: string;
}

export function Accordion({ title, children, defaultOpen = false, className = "", summaryClassName = "" }: AccordionProps) {
  const [isOpen, setIsOpen] = useState(defaultOpen);
  const contentRef = useRef<HTMLDivElement>(null);
  const [contentHeight, setContentHeight] = useState<string>("0px");

  useEffect(() => {
    if (isOpen) {
      if (contentRef.current) {
        setContentHeight(`${contentRef.current.scrollHeight}px`);
      }
    } else {
      setContentHeight("0px");
    }
  }, [isOpen, children]);

  return (
    <div className={`accordion-card ${isOpen ? "is-open" : ""} ${className}`}>
      <button 
        className={`accordion-header ${summaryClassName}`}
        onClick={(e) => {
          e.preventDefault();
          setIsOpen(!isOpen);
        }}
        aria-expanded={isOpen}
      >
        <span className="accordion-title">{title}</span>
        <ChevronDown 
          className={`accordion-chevron ${isOpen ? "rotate-180 text-brand" : "text-slate-400"}`} 
          size={18} 
          style={{ transition: 'transform 0.35s cubic-bezier(0.4, 0, 0.2, 1)' }}
        />
      </button>
      <div 
        className="accordion-content"
        style={{ 
          maxHeight: contentHeight,
          overflow: "hidden",
          transition: "max-height 0.4s cubic-bezier(0.4, 0, 0.2, 1)"
        }}
      >
        <div ref={contentRef} className="accordion-body pb-4 px-4 pt-1">
          {children}
        </div>
      </div>
    </div>
  );
}
