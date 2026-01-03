-- Add column to store cancellation reason
ALTER TABLE public.ordenes 
ADD COLUMN motivo_cancelacion text NULL;

-- Add comment for clarity
COMMENT ON COLUMN public.ordenes.motivo_cancelacion IS 'Reason for order cancellation';