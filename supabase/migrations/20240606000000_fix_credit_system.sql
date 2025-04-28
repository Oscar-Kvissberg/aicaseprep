-- Drop existing functions first
DROP FUNCTION IF EXISTS public.get_user_credit_balance(UUID);
DROP FUNCTION IF EXISTS public.add_user_credits(UUID, INTEGER, TEXT, TEXT, JSONB);
DROP FUNCTION IF EXISTS public.has_sufficient_credits(UUID, INTEGER);
DROP FUNCTION IF EXISTS public.use_user_credits(UUID, INTEGER, TEXT);

-- Drop old views first
DROP VIEW IF EXISTS public.credit_balances;

-- Drop old tables
DROP TABLE IF EXISTS public.user_credits CASCADE;
DROP TABLE IF EXISTS public.credit_balances CASCADE;

-- Ensure credit_transactions table exists
CREATE TABLE IF NOT EXISTS public.credit_transactions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    amount INTEGER NOT NULL,
    transaction_type TEXT NOT NULL CHECK (transaction_type IN ('purchase', 'usage', 'promotion', 'subscription', 'refund')),
    description TEXT,
    metadata JSONB,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Create credit_balances view
CREATE OR REPLACE VIEW public.credit_balances AS
SELECT 
    user_id,
    COALESCE(SUM(amount), 0) as current_balance,
    COUNT(*) as transaction_count,
    MIN(created_at) as first_transaction,
    MAX(created_at) as last_transaction
FROM public.credit_transactions
GROUP BY user_id;

-- Recreate functions with standardized parameter names
CREATE OR REPLACE FUNCTION public.get_user_credit_balance(user_id UUID)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    RETURN COALESCE(
        (SELECT SUM(amount)
         FROM public.credit_transactions
         WHERE credit_transactions.user_id = get_user_credit_balance.user_id),
        0
    );
END;
$$;

CREATE OR REPLACE FUNCTION public.add_user_credits(
    in_user_id UUID,
    in_amount INTEGER,
    in_transaction_type TEXT,
    in_description TEXT DEFAULT NULL,
    in_metadata JSONB DEFAULT '{}'::jsonb
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    transaction_id UUID;
BEGIN
    INSERT INTO public.credit_transactions (
        user_id,
        amount,
        transaction_type,
        description,
        metadata
    ) VALUES (
        in_user_id,
        in_amount,
        in_transaction_type,
        in_description,
        in_metadata
    )
    RETURNING id INTO transaction_id;
    
    RETURN transaction_id;
END;
$$;

-- Also recreate helper functions
CREATE OR REPLACE FUNCTION public.has_sufficient_credits(
    user_id UUID,
    required_amount INTEGER
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    current_balance INTEGER;
BEGIN
    SELECT get_user_credit_balance(user_id) INTO current_balance;
    RETURN current_balance >= required_amount;
END;
$$;

-- Create simplified use_user_credits function
CREATE OR REPLACE FUNCTION public.use_user_credits(
    in_user_id UUID,
    in_amount INTEGER,
    in_description TEXT DEFAULT 'Used credit'
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_balance INTEGER;
    transaction_id UUID;
BEGIN
    -- Get current balance directly from the view
    SELECT cb.current_balance INTO v_balance
    FROM public.credit_balances cb
    WHERE cb.user_id = in_user_id;

    -- If no balance found, treat as 0
    IF v_balance IS NULL THEN
        v_balance := 0;
    END IF;

    -- Check if user has sufficient credits
    IF v_balance < in_amount THEN
        RAISE EXCEPTION 'Insufficient credits';
    END IF;

    -- Insert the deduction transaction
    INSERT INTO public.credit_transactions (
        user_id,
        amount,
        transaction_type,
        description
    ) VALUES (
        in_user_id,
        -in_amount,
        'usage',
        in_description
    )
    RETURNING id INTO transaction_id;
    
    RETURN transaction_id;
END;
$$;

-- Grant necessary permissions
GRANT SELECT ON public.credit_transactions TO authenticated;
GRANT SELECT ON public.credit_balances TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_user_credit_balance(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.add_user_credits(UUID, INTEGER, TEXT, TEXT, JSONB) TO authenticated;
GRANT EXECUTE ON FUNCTION public.has_sufficient_credits(UUID, INTEGER) TO authenticated;
GRANT EXECUTE ON FUNCTION public.use_user_credits(UUID, INTEGER, TEXT) TO authenticated; 