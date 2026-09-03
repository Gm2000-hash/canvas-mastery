import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { RichContent } from "./RichContent";
import { MediaPlayer } from "./MediaPlayer";
import type { AccordionContent as AccordionData } from "@/modules/curriculum/lib/h5p-types";

interface Props {
  content: AccordionData;
}

export function AccordionPlayer({ content }: Props) {
  return (
    <Accordion type="multiple" className="w-full">
      {content.panels.map((panel) => (
        <AccordionItem key={panel.id} value={panel.id}>
          <AccordionTrigger className="text-sm font-medium">{panel.title}</AccordionTrigger>
          <AccordionContent className="space-y-3">
            <RichContent html={panel.content} />
            <MediaPlayer media={panel.media} />
          </AccordionContent>
        </AccordionItem>
      ))}
    </Accordion>
  );
}
