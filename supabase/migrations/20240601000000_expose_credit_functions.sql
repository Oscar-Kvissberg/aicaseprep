-- Drop existing functions first with full signatures
DROP FUNCTION IF EXISTS public.get_user_credit_balance(in_user_id UUID);
DROP FUNCTION IF EXISTS public.get_user_credit_balance(user_id UUID);
DROP FUNCTION IF EXISTS public.add_user_credits(in_user_id UUID, in_amount INTEGER, in_transaction_type TEXT, in_description TEXT, in_metadata JSONB);
DROP FUNCTION IF EXISTS public.add_user_credits(user_id UUID, amount INTEGER, transaction_type TEXT, description TEXT, metadata JSONB);
DROP FUNCTION IF EXISTS public.has_sufficient_credits(p_user_id UUID, p_required_amount INTEGER);
DROP FUNCTION IF EXISTS public.use_user_credits(p_user_id UUID, p_amount INTEGER, p_description TEXT);

-- Drop the old tables (if they exist)
DROP TABLE IF EXISTS user_credit_balances CASCADE;
DROP TABLE IF EXISTS credit_balances CASCADE;
DROP TABLE IF EXISTS credit_transactions CASCADE;

-- Create credit_balances table if it doesn't exist
CREATE TABLE IF NOT EXISTS credit_balances (
    user_id UUID PRIMARY KEY REFERENCES public.users(id),
    current_balance INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Create credit_transactions table if it doesn't exist
CREATE TABLE IF NOT EXISTS credit_transactions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES public.users(id),
    amount INTEGER NOT NULL,
    transaction_type TEXT NOT NULL,
    description TEXT,
    metadata JSONB,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Function to get user credit balance
CREATE OR REPLACE FUNCTION get_user_credit_balance(in_user_id UUID)
RETURNS INTEGER
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN COALESCE(
    (SELECT cb.current_balance 
     FROM credit_balances cb 
     WHERE cb.user_id = in_user_id),
    0
  );
END;
$$;

-- Function to add credits to a user
CREATE OR REPLACE FUNCTION add_user_credits(
  in_user_id UUID,
  in_amount INTEGER,
  in_transaction_type TEXT,
  in_description TEXT,
  in_metadata JSONB DEFAULT '{}'::jsonb
)
RETURNS UUID
LANGUAGE plpgsql
AS $$
DECLARE
  transaction_id UUID;
BEGIN
  -- Create the transaction record
  INSERT INTO credit_transactions (
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

  -- Update or insert the balance
  INSERT INTO credit_balances (user_id, current_balance)
  VALUES (in_user_id, in_amount)
  ON CONFLICT (user_id) 
  DO UPDATE SET 
    current_balance = credit_balances.current_balance + EXCLUDED.current_balance,
    updated_at = NOW();

  RETURN transaction_id;
END;
$$;

-- Create function to check if user has sufficient credits
CREATE OR REPLACE FUNCTION public.has_sufficient_credits(
    p_user_id UUID,
    p_required_amount INTEGER
)
RETURNS BOOLEAN AS $$
DECLARE
    v_current_balance INTEGER;
BEGIN
    SELECT get_user_credit_balance(p_user_id) INTO v_current_balance;
    RETURN v_current_balance >= p_required_amount;
END;
$$ LANGUAGE plpgsql;

-- Create function to use credits with validation
CREATE OR REPLACE FUNCTION public.use_user_credits(
    p_user_id UUID,
    p_amount INTEGER,
    p_description TEXT
)
RETURNS UUID AS $$
BEGIN
    IF NOT has_sufficient_credits(p_user_id, p_amount) THEN
        RAISE EXCEPTION 'Insufficient credits';
    END IF;

    RETURN add_user_credits(
        p_user_id,
        -p_amount,
        'usage',
        p_description,
        '{}'::jsonb
    );
END;
$$ LANGUAGE plpgsql;

-- Grant execute permissions to authenticated users
GRANT EXECUTE ON FUNCTION public.get_user_credit_balance(in_user_id UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.add_user_credits(in_user_id UUID, in_amount INTEGER, in_transaction_type TEXT, in_description TEXT, in_metadata JSONB) TO authenticated;
GRANT EXECUTE ON FUNCTION public.has_sufficient_credits(p_user_id UUID, p_required_amount INTEGER) TO authenticated;
GRANT EXECUTE ON FUNCTION public.use_user_credits(p_user_id UUID, p_amount INTEGER, p_description TEXT) TO authenticated;

-- Grant access to the tables
GRANT SELECT ON credit_transactions TO authenticated;
GRANT SELECT, INSERT, UPDATE ON credit_balances TO authenticated; 