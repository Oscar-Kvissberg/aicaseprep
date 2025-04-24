-- Drop existing foreign key constraints if they exist
ALTER TABLE IF EXISTS credit_transactions 
  DROP CONSTRAINT IF EXISTS credit_transactions_user_id_fkey;

ALTER TABLE IF EXISTS credit_balances 
  DROP CONSTRAINT IF EXISTS credit_balances_user_id_fkey;

-- Re-create foreign key constraints with ON DELETE CASCADE
ALTER TABLE credit_transactions
  ADD CONSTRAINT credit_transactions_user_id_fkey 
  FOREIGN KEY (user_id) 
  REFERENCES users(id) 
  ON DELETE CASCADE;

ALTER TABLE credit_balances
  ADD CONSTRAINT credit_balances_user_id_fkey 
  FOREIGN KEY (user_id) 
  REFERENCES users(id) 
  ON DELETE CASCADE; 