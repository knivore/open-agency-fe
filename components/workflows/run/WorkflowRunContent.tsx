'use client';

import { useEffect, useRef, useState } from 'react';
import { Button } from '@headlessui/react';
import { MoveUp } from 'lucide-react';
import { useWorkflowRunContext } from '@/components/workflows/run/WorkflowRunProvider';
import WorkflowRunNavbar from '@/components/workflows/run/navbar/WorkflowRunNavbar';
import WorkflowProcessWindow from '@/components/workflows/run/WorkflowProcessWindow';

export default function WorkflowRunContent() {
  const containerRef = useRef<HTMLDivElement>(null);
  const { output, verboseOutput } = useWorkflowRunContext();
  const [showScrollButton, setShowScrollButton] = useState(false);

  useEffect(() => {
    const container = containerRef.current;
    if (container) {
      const handleScroll = () => {
        setShowScrollButton(container.scrollTop > 100);
      };

      container.addEventListener('scroll', handleScroll);
      return () => container.removeEventListener('scroll', handleScroll);
    }
  }, []);

  useEffect(() => {
    if (containerRef.current) {
      containerRef.current.scrollTo({
        top: containerRef.current.scrollHeight,
        behavior: 'smooth',
      });
    }
  }, [verboseOutput]);

  const scrollToTop = () => {
    containerRef.current?.scrollTo({ top: 0 });
  };

  return (
    <div className="flex min-h-screen flex-col md:h-[calc(100vh-76px)]">
      <WorkflowRunNavbar />

      <main ref={containerRef} className="flex-1 overflow-auto bg-primary-50 p-4 sm:p-6">
        <WorkflowProcessWindow />
      </main>

      <Button
        onClick={scrollToTop}
        className={`fixed bottom-16 right-4 flex items-center gap-1 rounded-full bg-primary-600 px-4 py-2 text-white shadow-lg transition-all duration-300 hover:bg-primary-700 sm:bottom-8 sm:right-8 ${
          output && showScrollButton ? 'opacity-100' : 'pointer-events-none opacity-0'
        }`}
      >
        Back to Top
        <MoveUp className="h-4 w-4 animate-bounce-soft" />
      </Button>
    </div>
  );
}
