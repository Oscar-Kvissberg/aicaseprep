-- Drop existing functions
DROP FUNCTION IF EXISTS public.get_user_credit_balance(in_user_id UUID);
DROP FUNCTION IF EXISTS public.add_user_credits(in_user_id UUID, in_amount INTEGER, in_transaction_type TEXT, in_description TEXT, in_metadata JSONB);
DROP FUNCTION IF EXISTS public.has_sufficient_credits(p_user_id UUID, p_required_amount INTEGER);
DROP FUNCTION IF EXISTS public.use_user_credits(p_user_id UUID, p_amount INTEGER, p_description TEXT);

-- Recreate functions with standardized parameter names
CREATE OR REPLACE FUNCTION public.get_user_credit_balance(user_id UUID)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    RETURN COALESCE(
        (SELECT SUM(amount)
         FROM credit_transactions
         WHERE credit_transactions.user_id = get_user_credit_balance.user_id),
        0
    );
END;
$$;

CREATE OR REPLACE FUNCTION public.add_user_credits(
    user_id UUID,
    amount INTEGER,
    transaction_type TEXT,
    description TEXT DEFAULT NULL,
    metadata JSONB DEFAULT '{}'::jsonb
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    transaction_id UUID;
BEGIN
    INSERT INTO credit_transactions (
        user_id,
        amount,
        transaction_type,
        description,
        metadata
    ) VALUES (
        user_id,
        amount,
        transaction_type,
        description,
        metadata
    )
    RETURNING id INTO transaction_id;
    
    RETURN transaction_id;
END;
$$;

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

CREATE OR REPLACE FUNCTION public.use_user_credits(
    user_id UUID,
    amount INTEGER,
    description TEXT DEFAULT 'Used credit'
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    IF NOT has_sufficient_credits(user_id, amount) THEN
        RAISE EXCEPTION 'Insufficient credits';
    END IF;

    RETURN add_user_credits(
        user_id,
        -amount,
        'usage',
        description
    );
END;
$$;

-- Drop the credit_balances table since we're using the transactions table directly
DROP TABLE IF EXISTS credit_balances CASCADE;

-- Create a view for credit balances
CREATE OR REPLACE VIEW public.credit_balances AS
SELECT 
    user_id,
    COALESCE(SUM(amount), 0) as current_balance,
    COUNT(*) as transaction_count,
    MIN(created_at) as first_transaction,
    MAX(created_at) as last_transaction
FROM credit_transactions
GROUP BY user_id;

-- Grant necessary permissions
GRANT EXECUTE ON FUNCTION public.get_user_credit_balance(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.add_user_credits(UUID, INTEGER, TEXT, TEXT, JSONB) TO authenticated;
GRANT EXECUTE ON FUNCTION public.has_sufficient_credits(UUID, INTEGER) TO authenticated;
GRANT EXECUTE ON FUNCTION public.use_user_credits(UUID, INTEGER, TEXT) TO authenticated;

-- Grant access to the view and table
GRANT SELECT ON credit_balances TO authenticated;
GRANT SELECT ON credit_transactions TO authenticated; 