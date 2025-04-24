-- Create credits table
CREATE TABLE IF NOT EXISTS public.user_credits (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID NOT NULL,
    credits INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Create index on user_id
CREATE UNIQUE INDEX IF NOT EXISTS user_credits_user_id_idx ON public.user_credits (user_id);

-- Grant permissions
GRANT SELECT, INSERT, UPDATE ON public.user_credits TO authenticated; 