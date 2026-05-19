'use client';
import React, { useEffect, useRef } from 'react';
import mermaid from 'mermaid';
import TextMessage from '@/components/conversations/TextMessage';
import { Task } from '@/types/domain/tasks';

interface MermaidDiagramProps {
  responseData: {
    tasks: Task[];
    urls?: string[]; // Made optional
  };
}

const MermaidDiagram: React.FC<MermaidDiagramProps> = ({ responseData }) => {
  const mermaidContainerRef = useRef<HTMLDivElement>(null);
  const taskNames: string[] = responseData.tasks.map((task) => task.name);
  const convertActionsToMermaid = (tasks: string[]) => {
    let mermaidSyntax = 'flowchart LR;\n';

    mermaidSyntax += `classDef noBgPrimaryBorder stroke:#E91E63,stroke-width:2px,fill:none;\n`;

    tasks.forEach((task, index) => {
      const group = Math.floor(index / 5);
      const isEvenGroup = group % 2 === 0;

      mermaidSyntax += `A${index}["${task}"]:::noBgPrimaryBorder;\n`;

      // if (urls[index]) {
      //     mermaidSyntax += `click A${index} "${urls[index]}" _blank;\n`;
      // }

      if (isEvenGroup) {
        if ((index + 1) % 5 !== 0 && index < tasks.length - 1) {
          mermaidSyntax += `A${index} --> A${index + 1};\n`;
        }
      } else {
        if ((index + 1) % 5 !== 0 && index < tasks.length - 1) {
          mermaidSyntax += `A${index} --> A${index + 1};\n`;
        }
      }

      if ((index + 1) % 5 === 0 && index < tasks.length - 1) {
        mermaidSyntax += `A${index} --> A${index + 1};\n`;
      }
    });

    // console.log('Mermaid Syntax Generated:', mermaidSyntax);
    return mermaidSyntax;
  };

  useEffect(() => {
    mermaid.initialize({ startOnLoad: true });

    if (mermaidContainerRef.current) {
      mermaid.init(undefined, mermaidContainerRef.current);
    }
  }, [responseData]);

  const mermaidSyntax = convertActionsToMermaid(taskNames);

  return (
    <div className="flex flex-col mb-4 justify-start">
      <TextMessage
        role="assistant"
        content={`Here&apos;s a visualization of your workflow!`}
      />
      {/* Render Mermaid diagram */}
      <div className="w-full mb-4">
        <div ref={mermaidContainerRef} className="mermaid">
          {mermaidSyntax}
        </div>
      </div>

      {/* Add buttons below diagram */}
      {/* <div className="text-center">
                <button
                    className="bg-primary text-white px-4 py-2 rounded-full hover:bg-primary m-2"
                    onClick={() => console.log('Looks Good to Me!')}
                >
                    Looks Good to Me!
                </button>
            </div> */}
    </div>
  );
};

export default MermaidDiagram;
