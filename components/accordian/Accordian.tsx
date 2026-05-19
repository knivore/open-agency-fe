'use client';
import React, { ReactNode, useState } from 'react';

interface AccordianProps {
  title: string;
  children: ReactNode;
  open: boolean;
}

const Accordian: React.FC<AccordianProps> = ({ title, children, open }) => {
  const [isOpen, setIsOpen] = useState(open);

  const toggleAccordian = () => {
    setIsOpen(!isOpen);
  };

  return (
    <div className="pb-4">
      <button
        type="button"
        className="w-full text-left font-bold text-lg py-1 flex justify-between items-center btn btn-outline btn-info"
        onClick={toggleAccordian}
      >
        {title}
        <span>{isOpen ? '-' : '+'}</span>
      </button>
      {isOpen && <div className="mt-4">{children}</div>}
    </div>
  );
};

export default Accordian;
