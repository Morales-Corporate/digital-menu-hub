import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { cn } from '@/lib/utils';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { CalendarIcon } from 'lucide-react';

const PRESETS = [
  { label: 'Hoy', days: 0 },
  { label: '7 días', days: 7 },
  { label: '15 días', days: 15 },
  { label: '30 días', days: 30 },
  { label: '60 días', days: 60 },
];

interface DateRangeSelectorProps {
  desde: Date;
  hasta: Date;
  onDesdeChange: (d: Date) => void;
  onHastaChange: (d: Date) => void;
}

export default function DateRangeSelector({ desde, hasta, onDesdeChange, onHastaChange }: DateRangeSelectorProps) {
  const applyPreset = (days: number) => {
    const now = new Date();
    onHastaChange(now);
    if (days === 0) {
      const start = new Date(now);
      start.setHours(0, 0, 0, 0);
      onDesdeChange(start);
    } else {
      const start = new Date(now);
      start.setDate(start.getDate() - days);
      start.setHours(0, 0, 0, 0);
      onDesdeChange(start);
    }
  };

  return (
    <div className="flex flex-wrap items-center gap-2">
      {PRESETS.map(p => (
        <Button key={p.days} variant="outline" size="sm" onClick={() => applyPreset(p.days)}>
          {p.label}
        </Button>
      ))}
      <div className="flex items-center gap-2 ml-2">
        <Popover>
          <PopoverTrigger asChild>
            <Button variant="outline" size="sm" className={cn("justify-start text-left font-normal min-w-[130px]")}>
              <CalendarIcon className="mr-2 h-4 w-4" />
              {format(desde, 'dd/MM/yyyy', { locale: es })}
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-auto p-0" align="start">
            <Calendar
              mode="single"
              selected={desde}
              onSelect={(d) => d && onDesdeChange(d)}
              initialFocus
              className="p-3 pointer-events-auto"
            />
          </PopoverContent>
        </Popover>
        <span className="text-muted-foreground text-sm">a</span>
        <Popover>
          <PopoverTrigger asChild>
            <Button variant="outline" size="sm" className={cn("justify-start text-left font-normal min-w-[130px]")}>
              <CalendarIcon className="mr-2 h-4 w-4" />
              {format(hasta, 'dd/MM/yyyy', { locale: es })}
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-auto p-0" align="start">
            <Calendar
              mode="single"
              selected={hasta}
              onSelect={(d) => d && onHastaChange(d)}
              initialFocus
              className="p-3 pointer-events-auto"
            />
          </PopoverContent>
        </Popover>
      </div>
    </div>
  );
}
