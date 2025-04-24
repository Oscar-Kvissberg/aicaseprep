-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Create function to handle updated_at
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Create users table
CREATE TABLE IF NOT EXISTS public.users (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    email TEXT UNIQUE NOT NULL,
    name TEXT,
    password TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    google_access_token TEXT,
    google_id_token TEXT
);

-- Enable Row Level Security (RLS)
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;

-- Create policies (with existence checks)
DO $$
BEGIN
    -- Check if policy exists before creating it
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE tablename = 'users' AND policyname = 'Users can view their own data'
    ) THEN
        CREATE POLICY "Users can view their own data" ON public.users
            FOR SELECT
            USING (auth.jwt() ->> 'email' = email);
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE tablename = 'users' AND policyname = 'Users can update their own data'
    ) THEN
        CREATE POLICY "Users can update their own data" ON public.users
            FOR UPDATE
            USING (auth.jwt() ->> 'email' = email);
    END IF;
END
$$;

-- Create trigger for updated_at
DROP TRIGGER IF EXISTS handle_updated_at ON public.users;
CREATE TRIGGER handle_updated_at
    BEFORE UPDATE ON public.users
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Create business_cases table with new structure
CREATE TABLE IF NOT EXISTS public.business_cases (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    title TEXT NOT NULL,
    company TEXT NOT NULL,
    industry TEXT NOT NULL,
    difficulty TEXT NOT NULL,
    estimated_time TEXT NOT NULL,
    description TEXT NOT NULL,
    language TEXT DEFAULT 'sv',
    author_note TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Enable RLS for business cases
ALTER TABLE public.business_cases ENABLE ROW LEVEL SECURITY;

-- Create policy for business cases (publicly readable)
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE tablename = 'business_cases' AND policyname = 'Business cases are publicly readable'
    ) THEN
        CREATE POLICY "Business cases are publicly readable" ON public.business_cases
            FOR SELECT
            USING (true);
    END IF;
END
$$;

-- Create case_sections table
CREATE TABLE IF NOT EXISTS public.case_sections (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    case_id UUID REFERENCES public.business_cases(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    type TEXT NOT NULL,
    prompt TEXT NOT NULL,
    criteria TEXT NOT NULL,
    ai_instructions TEXT,
    order_index INTEGER NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Add ai_instructions column if it doesn't exist
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'case_sections' AND column_name = 'ai_instructions'
    ) THEN
        ALTER TABLE public.case_sections ADD COLUMN ai_instructions TEXT;
    END IF;
END
$$;

-- Enable RLS for case sections
ALTER TABLE public.case_sections ENABLE ROW LEVEL SECURITY;

-- Create case_tags table
CREATE TABLE IF NOT EXISTS public.case_tags (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    case_id UUID REFERENCES public.business_cases(id) ON DELETE CASCADE,
    tag TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Enable RLS for case tags
ALTER TABLE public.case_tags ENABLE ROW LEVEL SECURITY;

-- Create user_responses table
CREATE TABLE IF NOT EXISTS public.user_responses (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES public.users(id) ON DELETE CASCADE,
    case_id UUID REFERENCES public.business_cases(id) ON DELETE CASCADE,
    section_id UUID REFERENCES public.case_sections(id) ON DELETE CASCADE,
    response_text TEXT NOT NULL,
    feedback TEXT,
    conversation_history TEXT,
    score INTEGER,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Enable RLS for user responses
ALTER TABLE public.user_responses ENABLE ROW LEVEL SECURITY;

-- Create policies for user responses
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE tablename = 'user_responses' AND policyname = 'Users can view their own responses'
    ) THEN
        CREATE POLICY "Users can view their own responses" ON public.user_responses
            FOR SELECT
            USING (auth.jwt() ->> 'email' = (SELECT email FROM public.users WHERE id = user_id));
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE tablename = 'user_responses' AND policyname = 'Users can insert their own responses'
    ) THEN
        CREATE POLICY "Users can insert their own responses" ON public.user_responses
            FOR INSERT
            WITH CHECK (auth.jwt() ->> 'email' = (SELECT email FROM public.users WHERE id = user_id));
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE tablename = 'user_responses' AND policyname = 'Users can update their own responses'
    ) THEN
        CREATE POLICY "Users can update their own responses" ON public.user_responses
            FOR UPDATE
            USING (auth.jwt() ->> 'email' = (SELECT email FROM public.users WHERE id = user_id));
    END IF;
END
$$;

-- Create trigger for updated_at on business_cases
DROP TRIGGER IF EXISTS handle_updated_at_business_cases ON public.business_cases;
CREATE TRIGGER handle_updated_at_business_cases
    BEFORE UPDATE ON public.business_cases
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Create trigger for updated_at on case_sections
DROP TRIGGER IF EXISTS handle_updated_at_case_sections ON public.case_sections;
CREATE TRIGGER handle_updated_at_case_sections
    BEFORE UPDATE ON public.case_sections
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Create trigger for updated_at on case_tags
DROP TRIGGER IF EXISTS handle_updated_at_case_tags ON public.case_tags;
CREATE TRIGGER handle_updated_at_case_tags
    BEFORE UPDATE ON public.case_tags
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Create trigger for updated_at on user_responses
DROP TRIGGER IF EXISTS handle_updated_at_user_responses ON public.user_responses;
CREATE TRIGGER handle_updated_at_user_responses
    BEFORE UPDATE ON public.user_responses
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Create credit_transactions table
CREATE TABLE IF NOT EXISTS public.credit_transactions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES public.users(id) ON DELETE CASCADE,
    amount INTEGER NOT NULL,
    transaction_type TEXT NOT NULL CHECK (transaction_type IN ('purchase', 'usage', 'promotion', 'subscription', 'refund')),
    description TEXT,
    metadata JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Enable RLS for credit transactions
ALTER TABLE public.credit_transactions ENABLE ROW LEVEL SECURITY;

-- Create policies for credit transactions
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE tablename = 'credit_transactions' AND policyname = 'Users can view their own credit transactions'
    ) THEN
        CREATE POLICY "Users can view their own credit transactions" ON public.credit_transactions
            FOR SELECT
            USING (auth.jwt() ->> 'email' = (SELECT email FROM public.users WHERE id = user_id));
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE tablename = 'credit_transactions' AND policyname = 'System can insert credit transactions'
    ) THEN
        CREATE POLICY "System can insert credit transactions" ON public.credit_transactions
            FOR INSERT
            WITH CHECK (true);
    END IF;
END
$$;

-- Create trigger for updated_at on credit_transactions
DROP TRIGGER IF EXISTS handle_updated_at_credit_transactions ON public.credit_transactions;
CREATE TRIGGER handle_updated_at_credit_transactions
    BEFORE UPDATE ON public.credit_transactions
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Create credit_balances view
CREATE OR REPLACE VIEW public.credit_balances AS
SELECT 
    user_id,
    SUM(amount) as current_balance,
    COUNT(*) as transaction_count,
    MIN(created_at) as first_transaction,
    MAX(created_at) as last_transaction
FROM public.credit_transactions
GROUP BY user_id;

-- Create function to get user's current credit balance
CREATE OR REPLACE FUNCTION get_user_credit_balance(p_user_id UUID)
RETURNS INTEGER AS $$
DECLARE
    balance INTEGER;
BEGIN
    SELECT COALESCE(SUM(amount), 0) INTO balance
    FROM public.credit_transactions
    WHERE credit_transactions.user_id = get_user_credit_balance.p_user_id;
    
    RETURN balance;
END;
$$ LANGUAGE plpgsql;

-- Create function to add credits to a user's balance
CREATE OR REPLACE FUNCTION add_user_credits(
    p_user_id UUID,
    p_amount INTEGER,
    p_transaction_type TEXT,
    p_description TEXT DEFAULT NULL,
    p_metadata JSONB DEFAULT NULL
)
RETURNS UUID AS $$
DECLARE
    v_transaction_id UUID;
BEGIN
    INSERT INTO public.credit_transactions (
        user_id,
        amount,
        transaction_type,
        description,
        metadata
    ) VALUES (
        p_user_id,
        p_amount,
        p_transaction_type,
        p_description,
        p_metadata
    )
    RETURNING id INTO v_transaction_id;
    
    RETURN v_transaction_id;
END;
$$ LANGUAGE plpgsql;

-- Create function to check if user has sufficient credits
CREATE OR REPLACE FUNCTION has_sufficient_credits(
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
CREATE OR REPLACE FUNCTION use_user_credits(
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
        p_description
    );
END;
$$ LANGUAGE plpgsql;

-- Insert example case
INSERT INTO public.business_cases (title, company, industry, difficulty, estimated_time, description, language, author_note)
VALUES (
    'Neolar – Intäktsanalys och tillväxtstrategi',
    'Neolar',
    'Förnybar energi / Solenergi',
    '🟡 Medel',
    '20–30 minuter',
    'Du är inbjuden till en caseintervju hos Neolar, ett växande bolag inom solenergi. Caset är uppdelat i två delar – en kvantitativ del och en strategisk del. Ditt mål är att analysera deras nuvarande intäktsstruktur och därefter resonera kring möjliga vägar att öka omsättningen under kommande år.',
    'sv',
    'Detta case bygger på ett faktiskt case jag genomförde i intervju med Neolar. Det testade både min förmåga att hantera siffror och att tänka strategiskt kring tillväxt.'
) RETURNING id;

-- Store the case ID in a variable
DO $$
DECLARE
    neolar_case_id UUID;
BEGIN
    -- Get the case ID
    SELECT id INTO neolar_case_id FROM public.business_cases 
    WHERE title = 'Neolar – Intäktsanalys och tillväxtstrategi' 
    AND company = 'Neolar' 
    AND industry = 'Förnybar energi / Solenergi'
    LIMIT 1;

    -- Insert case sections using the stored ID
    INSERT INTO public.case_sections (case_id, title, type, prompt, criteria, order_index)
    VALUES 
        (
            neolar_case_id,
            'Del 1 – Kvantitativ analys',
            'math',
            'Neolar har två kundsegment: kommersiella kunder och privata kunder. Du får veta att deras totala omsättning är 30 miljoner kronor, varav 24 miljoner kommer från kommersiella kunder och 6 miljoner från privata kunder. Beräkna hur stor andel varje segment står för och diskutera kort vilka slutsatser man kan dra kring deras intäktsmix.',
            'Kandidaten ska:\n1. Beräkna andelen för varje segment (80% kommersiella, 20% privata)\n2. Diskutera implikationerna av intäktsmixens sammansättning\n3. Identifiera möjliga tillväxtområden baserat på segmentanalysen',
            1
        ),
        (
            neolar_case_id,
            'Del 2 – Strategiskt resonemang',
            'strategy',
            'Företaget vill öka sin omsättning det kommande året. Du ska nu, med utgångspunkt i ett Business Situation Framework, analysera möjliga strategier. Tänk på att visa struktur, affärsmässigt tänkande och förmåga att prioritera. Vilka faktorer skulle du titta på? Vad skulle du föreslå som nästa steg för Neolar?',
            'Kandidaten ska:\n1. Använda ett strukturerat ramverk för analysen\n2. Identifiera och analysera relevanta faktorer\n3. Föreslå konkreta åtgärder med tydlig motivering\n4. Prioritera förslag baserat på impact och genomförbarhet',
            2
        );

    -- Insert case tags using the stored ID
    INSERT INTO public.case_tags (case_id, tag)
    VALUES 
        (neolar_case_id, 'strategy'),
        (neolar_case_id, 'profitability'),
        (neolar_case_id, 'frameworks'),
        (neolar_case_id, 'solar energy'),
        (neolar_case_id, 'growth');
END $$; 