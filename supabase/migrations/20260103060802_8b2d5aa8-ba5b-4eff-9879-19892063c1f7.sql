-- Add column to store the amount the customer pays with (for cash payments)
ALTER TABLE public.ordenes 
ADD COLUMN monto_pago numeric NULL;

-- Add comment for clarity
COMMENT ON COLUMN public.ordenes.monto_pago IS 'Amount customer pays with for cash payments (to calculate change)';