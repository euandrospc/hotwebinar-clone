"use client";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";

export interface WizardSectionAccordionProps {
  ai: React.ReactNode;
  fileTitle: string;
  fileSection: React.ReactNode;
  individualTitle: string;
  individualSection: React.ReactNode;
}

export function WizardSectionAccordion({ ai, fileTitle, fileSection, individualTitle, individualSection }: WizardSectionAccordionProps) {
  return (
    <div className="space-y-3">
      {ai}
      <Accordion type="single" collapsible className="rounded-lg border bg-card">
        <AccordionItem value="file">
          <AccordionTrigger className="px-4">{fileTitle}</AccordionTrigger>
          <AccordionContent className="px-4">{fileSection}</AccordionContent>
        </AccordionItem>
        <AccordionItem value="individual" className="border-b-0">
          <AccordionTrigger className="px-4">{individualTitle}</AccordionTrigger>
          <AccordionContent className="px-4">{individualSection}</AccordionContent>
        </AccordionItem>
      </Accordion>
    </div>
  );
}
